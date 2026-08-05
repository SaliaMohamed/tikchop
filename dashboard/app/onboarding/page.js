"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, LogOut, MapPin, ShoppingBag, Store, Tag, X } from "lucide-react";
import { createSellerAccountAndShop, getSellerByOwner, createSellerFromOnboarding } from "../seller-actions";
import { clearActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/user-facing-error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

// +225 is always prepended — user only types local digits
function buildFullPhone(localDigits) {
  const clean = String(localDigits || "").replace(/\D/g, "");
  return `+225${clean}`;
}

function hasValidLocalPhone(localDigits) {
  const clean = String(localDigits || "").replace(/\D/g, "");
  return clean.length >= 8 && clean.length <= 10;
}

function getPhoneAliasEmail(localDigits) {
  const full = buildFullPhone(localDigits).replace(/\D/g, "");
  return full ? `seller-${full}@phone.tikchop.local` : "";
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
    return withTimeout(supabase.auth.signInWithPassword(credentials), "Connexion trop longue. Réessayez.", timeoutMs)
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
    if (!payload.access_token || !payload.refresh_token) return { data: null, error: new Error("Session incomplète. Réessayez.") };
    const { data, error } = await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
    if (error) return { data: null, error };
    return { data: { session: data.session || payload, user: data.user || payload.user }, error: null };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Connexion lente. Réessayez dans quelques secondes." : "Connexion impossible. Vérifiez votre réseau.";
    return { data: null, error: new Error(message) };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Password strength ─────────────────────────────────────────────────────────
const COMMON_PASSWORDS = new Set(["123456","password","azerty","qwerty","000000","111111","123123","abcdef","motdepasse","tikchop"]);

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  const rules = {
    length: pw.length >= 8,
    lengthMin: pw.length >= 6,
    mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
    notCommon: !COMMON_PASSWORDS.has(pw.toLowerCase()),
  };
  const score = [rules.lengthMin, rules.length, rules.mixed, rules.number, rules.special, rules.notCommon]
    .filter(Boolean).length;
  if (score <= 1) return { score: 1, label: "Trop simple", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Faible", color: "#f97316" };
  if (score <= 3) return { score: 3, label: "Moyen", color: "#eab308" };
  if (score <= 4) return { score: 4, label: "Bon", color: "#22c55e" };
  return { score: 5, label: "Excellent", color: "#008f5a" };
}

const SHOP_CATEGORIES = [
  { id: "mode", label: "Mode & Vêtements", emoji: "👗" },
  { id: "beaute", label: "Beauté & Cosmétiques", emoji: "💄" },
  { id: "alimentation", label: "Alimentation & Boissons", emoji: "🍽️" },
  { id: "electronique", label: "Électronique & Téléphones", emoji: "📱" },
  { id: "maison", label: "Maison & Décoration", emoji: "🏠" },
  { id: "bijoux", label: "Bijoux & Accessoires", emoji: "💍" },
  { id: "sport", label: "Sport & Loisirs", emoji: "⚽" },
  { id: "autre", label: "Autre activité", emoji: "🛍️" },
];

const CI_CITIES = ["Abidjan", "Bouaké", "Daloa", "San-Pédro", "Yamoussoukro", "Korhogo", "Man", "Gagnoa", "Autre"];

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "h-2 w-6 bg-[#008f5a]"
              : i < current
              ? "h-2 w-2 bg-[#008f5a]/40"
              : "h-2 w-2 bg-[#07120d]/15"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  // step 0=splash, 1=account, 2=boutique info (signup only)
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("SIGN_UP");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sellerAccount, setSellerAccount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1 — account
  const [localPhone, setLocalPhone] = useState(""); // only the digits after +225
  const [password, setPassword] = useState("");

  // Step 2 — boutique info
  const [shopName, setShopName] = useState("");
  const [shopCategory, setShopCategory] = useState("");
  const [shopCity, setShopCity] = useState("");

  const suggestedSlug = useMemo(() => slugify(shopName), [shopName]);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const phoneOk = hasValidLocalPhone(localPhone);
  const passwordOkSignup = password.length >= 6;
  const passwordOkSignin = password.length > 0;

  const canProceedStep1 = mode === "SIGN_IN"
    ? phoneOk && passwordOkSignin
    : phoneOk && passwordOkSignup;

  const canSubmitStep2 = shopName.trim().length >= 2 && shopCategory !== "";

  // ── Session detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    async function checkSession() {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), "Vérification trop longue.", 8000);
        const user = data.session?.user;
        if (!user || !active) return;
        const seller = await withTimeout(
          getSellerByOwner(user.id, data.session?.access_token),
          "Chargement boutique trop long.", 10000,
        );
        if (seller && active) { writeActiveSeller(seller); window.location.replace("/dashboard"); }
        else if (active) { setSellerAccount(user); setStep(1); setMode("SIGN_IN"); }
      } catch { /* silent */ }
    }

    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("new") === "1") {
      clearActiveSeller();
      if (supabase) supabase.auth.signOut().catch(() => {});
      setStep(0);
    } else if (params.get("mode") === "signin") {
      setMode("SIGN_IN"); setStep(1);
    } else {
      checkSession();
    }
    return () => { active = false; };
  }, []);

  useEffect(() => { if (typeof window !== "undefined") window.scrollTo(0, 0); }, [step]);

  // ── Step 1 submit (account) ──────────────────────────────────────────────────
  async function handleStep1(e) {
    e.preventDefault();
    setError(""); setNotice("");
    const fullPhone = buildFullPhone(localPhone);
    const aliasEmail = getPhoneAliasEmail(localPhone);

    if (mode === "SIGN_IN") {
      setSaving(true);
      try {
        const { data, error: signInError } = await signInWithPasswordControlled({ email: aliasEmail, password });
        if (signInError) {
          const fallback = await signInWithPasswordControlled({ phone: fullPhone, password }, 12000);
          if (fallback.error) throw new Error("Numéro ou mot de passe incorrect. Si c'est votre première fois, créez un compte.");
          const seller = await getSellerByOwner(fallback.data.user?.id, "");
          if (seller) { writeActiveSeller(seller); window.location.replace("/dashboard"); return; }
          setSellerAccount(fallback.data.user);
          throw new Error("Compte trouvé mais aucune boutique. Créez votre boutique.");
        }
        const seller = await withTimeout(getSellerByOwner(data.user?.id, data.session?.access_token), "Chargement trop long.", 10000);
        if (seller) { writeActiveSeller(seller); window.location.replace("/dashboard"); return; }
        setSellerAccount(data.user);
        setMode("SIGN_UP");
        setNotice("Compte trouvé. Donnez un nom à votre boutique pour continuer.");
        setStep(2);
      } catch (err) {
        setError(friendlyError(err, "Connexion impossible. Vérifiez votre numéro et mot de passe."));
      } finally {
        setSaving(false);
      }
      return;
    }

    // SIGN_UP: just move to step 2 to collect shop info
    setStep(2);
  }

  // ── Step 2 submit (create shop) ──────────────────────────────────────────────
  async function handleStep2(e) {
    e.preventDefault();
    setError(""); setNotice("");
    setSaving(true);

    const fullPhone = buildFullPhone(localPhone);
    const aliasEmail = getPhoneAliasEmail(localPhone);
    const shopInfo = {
      name: shopName.trim(),
      phone_number: fullPhone,
      slug: suggestedSlug,
      delivery_mode: "BOTH",
      fixed_delivery_fee: "1000",
      delivery_payment_timing: "AT_RECEPTION",
      category: shopCategory,
      city: shopCity,
    };

    try {
      let result;
      if (sellerAccount) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || "";
        result = await withTimeout(
          createSellerFromOnboarding({ access_token: accessToken, ...shopInfo }),
          "Création boutique trop longue. Réessayez dans quelques secondes.", 36000,
        );
      } else {
        result = await withTimeout(
          createSellerAccountAndShop({
            method: "PHONE",
            email: "",
            phone: fullPhone,
            password,
            display_name: shopName.trim(),
            ...shopInfo,
          }),
          "Création boutique trop longue. Réessayez dans quelques secondes.", 36000,
        );
      }

      if (!result?.success) throw new Error(result?.error || "Impossible de créer la boutique.");
      const created = result.data;
      if (!created?.seller) throw new Error("Impossible de récupérer la boutique créée.");

      if (!sellerAccount) {
        const credentials = { email: created.account?.email || aliasEmail, password };
        const { error: signInError } = await signInWithPasswordControlled(credentials, 16000);
        if (signInError) throw new Error("Boutique créée ! Appuyez sur 'J'ai déjà un compte' puis connectez-vous.");
      }

      writeActiveSeller(created.seller);
      setNotice("Boutique créée. Ouverture de votre espace vendeur...");
      window.location.replace("/dashboard?created=1");
    } catch (err) {
      setError(friendlyError(err, "Création boutique incomplète. Vérifiez et réessayez."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    clearActiveSeller(); setSellerAccount(null);
    setMode("SIGN_UP"); setStep(0);
    setError(""); setNotice("");
    if (supabase) await supabase.auth.signOut().catch(() => {});
  }

  if (!hydrated) return null;

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 0 — Splash
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#07120d] px-5 py-12 text-white">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#39f58e] shadow-[0_20px_50px_rgba(57,245,142,0.35)]">
          <Store size={36} className="text-[#07120d]" strokeWidth={2.5} />
        </div>

        <h1 className="font-display text-4xl font-black leading-[1.08] text-white text-center">
          Vendez sur WhatsApp.<br />
          <span className="text-[#39f58e]">Automatiquement.</span>
        </h1>

        <p className="mt-4 max-w-[260px] text-center text-sm font-bold leading-6 text-white/50">
          Boutique, commandes et bot en 2 minutes.
        </p>

        {/* Steps preview */}
        <div className="mt-8 w-full max-w-xs space-y-2">
          {[
            { n: "1", label: "Créez votre compte vendeur" },
            { n: "2", label: "Nommez et personnalisez votre boutique" },
            { n: "3", label: "Commencez à vendre sur WhatsApp" },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#39f58e]/15 text-[0.68rem] font-black text-[#39f58e]">{n}</span>
              <span className="text-sm font-bold text-white/70">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 w-full max-w-xs space-y-3">
          <button
            id="onboarding-start-btn"
            type="button"
            onClick={() => { setMode("SIGN_UP"); setStep(1); }}
            className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#39f58e] text-base font-black text-[#07120d] shadow-[0_18px_44px_rgba(57,245,142,0.32)] active:scale-[0.98] transition"
          >
            Créer ma boutique <ArrowRight size={18} />
          </button>
          <button
            id="onboarding-signin-btn"
            type="button"
            onClick={() => { setMode("SIGN_IN"); setStep(1); }}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white/8 text-sm font-black text-white/80 ring-1 ring-white/10 active:scale-[0.98] transition"
          >
            <LockKeyhole size={16} /> J&apos;ai déjà un compte
          </button>
        </div>

        <p className="mt-8 text-center text-[0.62rem] font-bold text-white/20">
          Tikchop · Commerce local en Afrique
        </p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Compte (phone + password)
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#f5fbf7] px-4 py-8">
        <div className="mx-auto w-full max-w-sm">
          {/* Nav */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setStep(0); setError(""); setNotice(""); }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#07120d]/8 active:scale-95"
              aria-label="Retour"
            >
              <X size={16} className="text-[#07120d]" />
            </button>
            {mode === "SIGN_UP" && <StepDots current={0} total={2} />}
          </div>

          <div className="mt-6">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">
              {mode === "SIGN_IN" ? "Connexion" : "Étape 1 sur 2"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-black text-[#07120d]">
              {mode === "SIGN_IN" ? "Bon retour !" : "Votre compte"}
            </h1>
            <p className="mt-1.5 text-sm font-bold text-[#07120d]/50">
              {mode === "SIGN_IN"
                ? "Entrez votre numéro et mot de passe."
                : "Ces identifiants vous permettront de vous connecter."}
            </p>
          </div>
        </div>

        <form onSubmit={handleStep1} className="mx-auto mt-6 w-full max-w-sm space-y-3">

          {/* Phone — +225 fixed */}
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
            <label htmlFor="onb-phone" className="flex min-h-[68px] cursor-text items-center gap-0 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a] mr-3">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.37 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Numéro WhatsApp (Côte d&apos;Ivoire)</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {/* Fixed prefix */}
                  <span className="shrink-0 select-none rounded-lg bg-[#eafff3] px-2 py-0.5 text-sm font-black text-[#008f5a]">+225</span>
                  <input
                    id="onb-phone"
                    type="tel"
                    inputMode="numeric"
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="07 12 34 56 78"
                    className="w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                    autoComplete="tel-local"
                  />
                </div>
              </span>
              {phoneOk && <CheckCircle2 size={17} className="shrink-0 text-[#008f5a] ml-2" />}
            </label>
            {localPhone.length > 0 && !phoneOk && (
              <p className="px-4 pb-2.5 text-[0.7rem] font-bold text-amber-600">
                Numéro CI : 8 à 10 chiffres (ex: 0712345678)
              </p>
            )}
          </div>

          {/* Password */}
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
            <label htmlFor="onb-password" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a]">
                <LockKeyhole size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">
                  {mode === "SIGN_IN" ? "Mot de passe" : "Choisissez un mot de passe"}
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <input
                    id="onb-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "SIGN_IN" ? "Votre mot de passe" : "Au moins 6 caractères"}
                    className="w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                    autoComplete={mode === "SIGN_IN" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 text-[#07120d]/30 hover:text-[#07120d]/60"
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </span>
            </label>

            {/* Strength bar — only on signup */}
            {mode === "SIGN_UP" && password.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: i <= strength.score ? strength.color : "#e5e7eb" }}
                      />
                    ))}
                  </div>
                  <span className="text-[0.68rem] font-black" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
                {/* Rules */}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  {[
                    { ok: password.length >= 6, text: "6 caractères min." },
                    { ok: /\d/.test(password), text: "Un chiffre" },
                    { ok: /[A-Z]/.test(password), text: "Une majuscule" },
                    { ok: !COMMON_PASSWORDS.has(password.toLowerCase()), text: "Pas trop simple" },
                  ].map(({ ok, text }) => (
                    <span key={text} className={`flex items-center gap-1.5 text-[0.68rem] font-bold ${ok ? "text-[#008f5a]" : "text-[#07120d]/35"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? "bg-[#008f5a]" : "bg-[#07120d]/20"}`} />
                      {text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

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
            disabled={saving || !canProceedStep1}
            className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-black text-white shadow-[0_16px_38px_rgba(0,143,90,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="animate-spin" size={19} /> : <ArrowRight size={19} />}
            {saving ? "En cours..." : mode === "SIGN_IN" ? "Se connecter" : "Continuer"}
          </button>

          {/* Switch mode */}
          <button
            type="button"
            id="onb-switch-mode-btn"
            onClick={() => { setMode(mode === "SIGN_UP" ? "SIGN_IN" : "SIGN_UP"); setError(""); setNotice(""); }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-white text-sm font-black text-[#07120d]/60 ring-1 ring-[#07120d]/8 active:scale-[0.98] transition"
          >
            {mode === "SIGN_UP" ? (
              <><LockKeyhole size={15} /> J&apos;ai déjà un compte</>
            ) : (
              <><Store size={15} /> Créer un nouveau compte</>
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

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Boutique info
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-dvh flex-col bg-[#f5fbf7] px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setStep(1); setError(""); setNotice(""); }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#07120d]/8 active:scale-95"
            aria-label="Retour"
          >
            <X size={16} className="text-[#07120d]" />
          </button>
          <StepDots current={1} total={2} />
        </div>

        <div className="mt-6">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">Étape 2 sur 2</p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#07120d]">Votre boutique</h1>
          <p className="mt-1.5 text-sm font-bold text-[#07120d]/50">
            Ces infos personnalisent votre boutique et votre bot WhatsApp.
          </p>
        </div>
      </div>

      <form onSubmit={handleStep2} className="mx-auto mt-6 w-full max-w-sm space-y-4">

        {/* Shop name */}
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
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex: Salia Fashion, Kemi Bijoux…"
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none placeholder:text-[#07120d]/30"
                autoComplete="organization"
              />
            </span>
            {shopName.trim().length >= 2 && <CheckCircle2 size={17} className="shrink-0 text-[#008f5a] ml-1" />}
          </label>
          {suggestedSlug && (
            <p className="px-4 pb-3 text-[0.65rem] font-bold text-[#07120d]/40">
              Lien : tikchop.com/<span className="text-[#008f5a]">{suggestedSlug}</span>
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-2">
            <Tag size={13} className="text-[#008f5a]" />
            <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Que vendez-vous ?</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setShopCategory(cat.id)}
                className={`flex items-center gap-2.5 rounded-[18px] px-3 py-3 text-left text-sm font-black transition active:scale-[0.98] ring-1 ${
                  shopCategory === cat.id
                    ? "bg-[#07120d] text-[#39f58e] ring-[#07120d]"
                    : "bg-white text-[#07120d] ring-[#07120d]/8 hover:ring-[#008f5a]/30"
                }`}
              >
                <span className="text-base leading-none">{cat.emoji}</span>
                <span className="leading-4">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8">
          <label htmlFor="onb-city" className="flex min-h-[58px] cursor-pointer items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#eafff3] text-[#008f5a]">
              <MapPin size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Ville principale (optionnel)</span>
              <select
                id="onb-city"
                value={shopCity}
                onChange={(e) => setShopCity(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#07120d] outline-none"
              >
                <option value="">Choisir une ville…</option>
                {CI_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
          </label>
        </div>

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
          disabled={saving || !canSubmitStep2}
          className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-black text-white shadow-[0_16px_38px_rgba(0,143,90,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="animate-spin" size={19} /> : <ShoppingBag size={19} />}
          {saving ? "Création en cours…" : "Créer ma boutique"}
        </button>
      </form>

      <p className="mt-10 pb-4 text-center text-[0.62rem] font-bold text-[#07120d]/25">
        Tikchop · Espace vendeur
      </p>
    </div>
  );
}
