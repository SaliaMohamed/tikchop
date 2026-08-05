"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, LogOut, Store, X } from "lucide-react";
import { createSellerAccountAndShop, getSellerByOwner, createSellerFromOnboarding } from "../seller-actions";
import { clearActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/user-facing-error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function normalizeAuthPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return `+${digits}`;
  return `+225${digits}`;
}

function getPhoneAliasEmail(value) {
  const digits = normalizeAuthPhone(value).replace(/\D/g, "");
  return digits ? `seller-${digits}@phone.tikchop.local` : "";
}

function isPhoneAliasEmail(value) {
  return /@phone\.tikchop\.local$/i.test(String(value || "").trim());
}

function hasValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("225")) return digits.length >= 13;
  return digits.length >= 8 && digits.length <= 10;
}

function withTimeout(promise, message, timeoutMs = 14000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function signInWithPasswordControlled(credentials, timeoutMs = 22000) {
  if (!supabase) return { data: null, error: new Error("Connexion vendeur indisponible.") };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || typeof fetch === "undefined") {
    return withTimeout(supabase.auth.signInWithPassword(credentials), "Connexion trop longue. Reessayez.", timeoutMs)
      .catch((error) => ({ data: null, error }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: new Error(payload.msg || payload.error_description || payload.error || "Connexion impossible.") };
    if (!payload.access_token || !payload.refresh_token) return { data: null, error: new Error("Session incomplete. Reessayez.") };
    const { data, error } = await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
    if (error) return { data: null, error };
    return { data: { session: data.session || payload, user: data.user || payload.user }, error: null };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Connexion lente. Reessayez dans quelques secondes." : "Connexion impossible. Verifiez votre reseau.";
    return { data: null, error: new Error(message) };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  // STEP 0 = intro/splash, STEP 1 = account+shop form
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("SIGN_UP"); // "SIGN_UP" | "SIGN_IN"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sellerAccount, setSellerAccount] = useState(null);

  const [form, setForm] = useState({
    phone: "+225 ",
    password: "",
    name: "", // shop name
  });

  const suggestedSlug = useMemo(() => slugify(form.name), [form.name]);

  // Auto-detect existing session on mount
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    async function checkSession() {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), "Verification trop longue.", 8000);
        const user = data.session?.user;
        if (!user || !active) return;

        const seller = await withTimeout(
          getSellerByOwner(user.id, data.session?.access_token),
          "Chargement boutique trop long.",
          10000,
        );
        if (seller && active) {
          writeActiveSeller(seller);
          window.location.replace("/dashboard");
        } else if (active) {
          setSellerAccount(user);
          setStep(1);
          setMode("SIGN_IN");
        }
      } catch {
        // silent — user continues normally
      }
    }

    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("new") === "1") {
      clearActiveSeller();
      if (supabase) supabase.auth.signOut().catch(() => {});
      setStep(0);
    } else if (params.get("mode") === "signin") {
      setMode("SIGN_IN");
      setStep(1);
    } else {
      checkSession();
    }

    return () => { active = false; };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = useMemo(() => {
    if (mode === "SIGN_IN") return hasValidPhone(form.phone) && form.password.length > 0;
    return hasValidPhone(form.phone) && form.password.length >= 6 && form.name.trim().length >= 2;
  }, [mode, form]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const phone = form.phone.trim();
    const password = form.password;
    const aliasEmail = getPhoneAliasEmail(phone);

    try {
      if (mode === "SIGN_IN") {
        // Sign in
        const { data, error: signInError } = await signInWithPasswordControlled({ email: aliasEmail, password });
        if (signInError) {
          // fallback to phone field
          const fallback = await signInWithPasswordControlled({ phone: normalizeAuthPhone(phone), password }, 12000);
          if (fallback.error) throw new Error("Numero ou mot de passe incorrect. Si c'est votre premiere fois, appuyez sur Creer un compte.");
          const seller = await getSellerByOwner(fallback.data.user?.id, "");
          if (seller) { writeActiveSeller(seller); window.location.replace("/dashboard"); return; }
          setSellerAccount(fallback.data.user);
          throw new Error("Compte trouve mais aucune boutique. Creez votre boutique.");
        }
        const seller = await withTimeout(getSellerByOwner(data.user?.id, data.session?.access_token), "Chargement boutique trop long.", 10000);
        if (seller) { writeActiveSeller(seller); window.location.replace("/dashboard"); return; }
        setSellerAccount(data.user);
        setMode("SIGN_UP");
        setNotice("Compte trouve. Donnez un nom a votre boutique pour continuer.");
        return;
      }

      let result;
      if (sellerAccount) {
        // User is already logged in but has no shop. Use active session token.
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || "";
        
        result = await withTimeout(
          createSellerFromOnboarding({
            access_token: accessToken,
            name: form.name.trim(),
            phone_number: phone,
            slug: suggestedSlug,
            delivery_mode: "BOTH",
            fixed_delivery_fee: "1000",
            delivery_payment_timing: "AT_RECEPTION",
          }),
          "Creation boutique trop longue. Reessayez dans quelques secondes.",
          36000,
        );
      } else {
        // Sign up + create shop in one call
        result = await withTimeout(
          createSellerAccountAndShop({
            method: "PHONE",
            email: "",
            phone,
            password,
            display_name: form.name.trim(),
            name: form.name.trim(),
            phone_number: phone,
            slug: suggestedSlug,
            delivery_mode: "BOTH",
            fixed_delivery_fee: "1000",
            delivery_payment_timing: "AT_RECEPTION",
          }),
          "Creation boutique trop longue. Reessayez dans quelques secondes.",
          36000,
        );
      }

      if (!result?.success) {
        throw new Error(result?.error || "Impossible de creer la boutique.");
      }

      const created = result.data;

      if (!created?.seller) {
        throw new Error("Impossible de recuperer la boutique creee.");
      }

      // If we did a normal signup, login might be needed, but since we created the session, let's verify
      if (!sellerAccount) {
        const credentials = { email: created.account?.email || aliasEmail, password };
        const { data: signInData, error: signInError } = await signInWithPasswordControlled(credentials, 16000);
        if (signInError) throw new Error("Boutique creee. Appuyez sur J'ai deja un compte puis connectez-vous avec le meme numero.");
      }

      writeActiveSeller(created.seller);
      setNotice("Boutique creee. Ouverture de votre espace vendeur...");
      window.location.replace("/dashboard?created=1");
    } catch (err) {
      setError(friendlyError(err, "Creation boutique incomplete. Verifiez le numero et reessayez."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    clearActiveSeller();
    setSellerAccount(null);
    setMode("SIGN_UP");
    setStep(0);
    setError("");
    setNotice("");
    if (supabase) await supabase.auth.signOut().catch(() => {});
  }

  if (!hydrated) return null;

  // ── Step 0 — Splash / Intro ────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#07120d] px-5 py-10 text-white">
        {/* Logo mark */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#39f58e] shadow-[0_20px_50px_rgba(57,245,142,0.35)]">
          <Store size={36} className="text-[#07120d]" strokeWidth={2.5} />
        </div>

        <h1 className="font-display text-4xl font-black leading-[1.08] text-white text-center">
          Vendez sur WhatsApp.
          <br />
          <span className="text-[#39f58e]">Automatiquement.</span>
        </h1>

        <p className="mt-5 max-w-xs text-center text-base font-bold leading-7 text-white/60">
          Tikchop gere vos commandes, vos clients et vos paiements. Vous n&apos;avez qu&apos;a vendre.
        </p>

        {/* Features */}
        <div className="mt-8 w-full max-w-xs space-y-3">
          {[
            "Boutique en ligne en 2 minutes",
            "Bot WhatsApp qui repond 24h/24",
            "Commandes et livraisons centralisees",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#39f58e]/15">
                <CheckCircle2 size={13} className="text-[#39f58e]" />
              </span>
              <span className="text-sm font-bold text-white/80">{item}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 w-full max-w-xs space-y-3">
          <button
            id="onboarding-start-btn"
            type="button"
            onClick={() => { setMode("SIGN_UP"); setStep(1); }}
            className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#39f58e] text-base font-black text-[#07120d] shadow-[0_18px_44px_rgba(57,245,142,0.32)] active:scale-[0.98] transition"
          >
            Creer ma boutique
            <ArrowRight size={18} />
          </button>
          <button
            id="onboarding-signin-btn"
            type="button"
            onClick={() => { setMode("SIGN_IN"); setStep(1); }}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white/8 text-sm font-black text-white/80 ring-1 ring-white/10 active:scale-[0.98] transition"
          >
            <LockKeyhole size={16} />
            J&apos;ai deja un compte
          </button>
        </div>

        <p className="mt-8 text-center text-[0.65rem] font-bold text-white/25">
          Tikchop · Commerce local en Afrique
        </p>
      </div>
    );
  }

  // ── Step 1 — Account + Shop Form ──────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col bg-[#f5fbf7] px-4 py-8">
      {/* Header */}
      <div className="mx-auto w-full max-w-sm">
        <button
          type="button"
          onClick={() => { setStep(0); setError(""); setNotice(""); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#07120d]/8 active:scale-95"
          aria-label="Retour"
        >
          <X size={16} className="text-[#07120d]" />
        </button>

        <div className="mt-6">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">
            {mode === "SIGN_IN" ? "Connexion" : "Inscription"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#07120d]">
            {mode === "SIGN_IN" ? "Bon retour !" : "Votre boutique"}
          </h1>
          <p className="mt-2 text-sm font-bold text-[#07120d]/50">
            {mode === "SIGN_IN"
              ? "Entrez vos identifiants pour acceder a votre espace vendeur."
              : "Renseignez votre numero, un mot de passe et le nom de votre boutique."}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-auto mt-6 w-full max-w-sm space-y-3">

        {/* Phone */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
          <label htmlFor="onb-phone" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.37 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Numero WhatsApp</span>
              <input
                id="onb-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+225 07 12 34 56 78"
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                autoComplete="tel"
              />
            </span>
          </label>
        </div>

        {/* Password */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
          <label htmlFor="onb-password" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a]">
              <LockKeyhole size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">
                {mode === "SIGN_IN" ? "Mot de passe" : "Choisir un mot de passe"}
              </span>
              <input
                id="onb-password"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder={mode === "SIGN_IN" ? "Votre mot de passe" : "Au moins 6 caracteres"}
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                autoComplete={mode === "SIGN_IN" ? "current-password" : "new-password"}
                minLength={mode === "SIGN_IN" ? 1 : 6}
              />
            </span>
          </label>
        </div>

        {/* Shop name (sign up only) */}
        {mode === "SIGN_UP" && (
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
            <label htmlFor="onb-shop-name" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a]">
                <Store size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Nom de la boutique</span>
                <input
                  id="onb-shop-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ex: Salia Fashion, Kemi Bijoux..."
                  className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                  autoComplete="organization"
                />
              </span>
            </label>
            {suggestedSlug && (
              <p className="px-4 pb-3 text-[0.65rem] font-bold text-[#07120d]/40">
                Lien boutique : tikchop.com/<span className="text-[#008f5a]">{suggestedSlug}</span>
              </p>
            )}
          </div>
        )}

        {/* Errors / Notices */}
        {error && (
          <div className="rounded-[18px] bg-amber-50 p-3.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-[18px] bg-emerald-50 p-3.5 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
            {notice}
          </div>
        )}

        {/* Submit */}
        <button
          id="onb-submit-btn"
          type="submit"
          disabled={saving || !canSubmit}
          className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-black text-white shadow-[0_16px_38px_rgba(0,143,90,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="animate-spin" size={19} /> : <ArrowRight size={19} />}
          {saving ? "En cours..." : mode === "SIGN_IN" ? "Se connecter" : "Creer ma boutique"}
        </button>

        {/* Switch mode */}
        <button
          type="button"
          id="onb-switch-mode-btn"
          onClick={() => { setMode(mode === "SIGN_UP" ? "SIGN_IN" : "SIGN_UP"); setError(""); setNotice(""); }}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-white text-sm font-black text-[#07120d]/60 ring-1 ring-[#07120d]/8 active:scale-[0.98] transition"
        >
          {mode === "SIGN_UP" ? (
            <><LockKeyhole size={15} /> J&apos;ai deja un compte</>
          ) : (
            <><Store size={15} /> Creer un nouveau compte</>
          )}
        </button>

        {sellerAccount && (
          <button
            type="button"
            id="onb-signout-btn"
            onClick={handleSignOut}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[16px] text-xs font-bold text-[#07120d]/40 active:scale-[0.98]"
          >
            <LogOut size={13} /> Changer de compte
          </button>
        )}
      </form>

      <p className="mt-10 pb-4 text-center text-[0.62rem] font-bold text-[#07120d]/25">
        Tikchop · Espace vendeur
      </p>
    </div>
  );
}
