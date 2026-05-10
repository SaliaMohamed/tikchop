"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Banknote, Bot, CheckCircle2, Copy, ExternalLink, Loader2, LockKeyhole, LogOut, Mail, MessageCircle, Package, ShieldCheck, Store, Truck } from "lucide-react";
import { createSellerAccount, createSellerFromOnboarding, getSellerByOwner } from "../seller-actions";
import { clearActiveSeller, readActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/user-facing-error";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeAuthPhone(value) {
  const phone = cleanPhone(value);
  return phone.startsWith("+") ? phone : `+${phone.replace(/[^\d]/g, "")}`;
}

function getPhoneAliasEmail(value) {
  const digits = normalizeAuthPhone(value).replace(/\D/g, "");
  return digits ? `seller-${digits}@phone.tikchop.local` : "";
}

function isPhoneAliasEmail(value) {
  return /@phone\.tikchop\.local$/i.test(String(value || "").trim());
}

function withIvorianPrefix(value) {
  const local = getIvorianLocalPart(value);
  return local ? `+225 ${local}` : "+225 ";
}

function getIvorianLocalPart(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("225") ? digits.slice(3) : digits;
}

function hasValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("225")) return digits.length >= 13;
  return digits.length >= 8;
}

function getRequestedAccountMode() {
  if (typeof window === "undefined") return "SIGN_UP";
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "signin" ? "SIGN_IN" : "SIGN_UP";
}

function getRequestedAccountMethod() {
  if (typeof window === "undefined") return "PHONE";
  const params = new URLSearchParams(window.location.search);
  const method = params.get("method");
  const mode = params.get("mode");
  return mode === "signin" && method === "email" ? "EMAIL" : "PHONE";
}

function getRequestedInitialStep() {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "signin" ? 1 : 0;
}

function isFreshAccountRequest() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("new") === "1";
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function withTimeout(promise, message, timeoutMs = 14000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isExpectedOnboardingError(error) {
  return /incorrect|premiere fois|mot de passe|ajoute|valide|existe deja|connexion lente|connexion impossible|reessayez|creation boutique non terminee/i.test(
    error?.message || "",
  );
}

async function signInWithPasswordControlled(credentials, timeoutMs = 22000) {
  if (!supabase) {
    return { data: null, error: new Error("Connexion vendeur indisponible pour le moment.") };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || typeof fetch === "undefined") {
    return withTimeout(
      supabase.auth.signInWithPassword(credentials),
      "Connexion trop longue. Reessayez dans quelques secondes.",
      timeoutMs,
    ).catch((error) => ({ data: null, error }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: new Error(payload.msg || payload.error_description || payload.error || "Connexion impossible."),
      };
    }

    if (!payload.access_token || !payload.refresh_token) {
      return { data: null, error: new Error("Session incomplete. Reessayez.") };
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        session: data.session || payload,
        user: data.user || payload.user,
      },
      error: null,
    };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Connexion lente. Reessayez dans quelques secondes."
      : "Connexion impossible. Verifiez votre reseau puis reessayez.";
    return { data: null, error: new Error(message) };
  } finally {
    clearTimeout(timer);
  }
}

const SETUP_STEPS = [
  {
    label: "Compte",
    title: "Compte",
    text: "Numero + mot de passe.",
    icon: <LockKeyhole size={15} />,
  },
  {
    label: "Boutique",
    title: "Boutique",
    text: "Nom visible par les clients.",
    icon: <Store size={15} />,
  },
];

function extractAccountProfile(user) {
  const metadata = user?.user_metadata || {};
  return {
    account_name: metadata.display_name || metadata.full_name || metadata.name || "",
    email: isPhoneAliasEmail(user?.email) ? "" : (user?.email || ""),
    account_phone: metadata.account_phone || user?.phone || "",
    name: metadata.store_name || metadata.shop_name || "",
    phone_number: metadata.account_phone || user?.phone || "",
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionBanner, setSessionBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountMode, setAccountMode] = useState("SIGN_UP");
  const [accountMethod, setAccountMethod] = useState("PHONE");
  const [sellerAccount, setSellerAccount] = useState(null);
  const [existingSeller, setExistingSeller] = useState(null);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdSeller, setCreatedSeller] = useState(null);
  const [form, setForm] = useState({
    account_name: "",
    email: "",
    account_phone: "+225 ",
    password: "",
    name: "",
    phone_number: "+225 ",
    slug: "",
    delivery_mode: "BOTH",
    fixed_delivery_fee: "1000",
    delivery_payment_timing: "AT_RECEPTION",
  });

  const suggestedSlug = useMemo(() => slugify(form.slug || form.name), [form.name, form.slug]);
  const shopUrl = createdSeller ? `${typeof window !== "undefined" ? window.location.origin : ""}/${createdSeller.slug}` : "";
  const totalSetupSteps = SETUP_STEPS.length;
  const isLoginStep = step === 1 && accountMode === "SIGN_IN";
  const currentStepMeta = !isLoginStep && step >= 1 && step <= totalSetupSteps ? SETUP_STEPS[step - 1] : null;
  const footerSpacerClass = step > 0 && step <= totalSetupSteps
    ? isLoginStep
      ? "pb-[calc(4.6rem+env(safe-area-inset-bottom,0px))] md:pb-0"
      : "pb-[calc(5.35rem+env(safe-area-inset-bottom,0px))] md:pb-0"
    : "";

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      setAccountMode(getRequestedAccountMode());
      setAccountMethod(getRequestedAccountMethod());
      setStep(getRequestedInitialStep());
      const startFresh = isFreshAccountRequest();

      if (startFresh) {
        clearActiveSeller();
        setExistingSeller(null);
        setSellerAccount(null);
        setSessionBanner("");
        setStep(0);
        window.history.replaceState(null, "", "/onboarding");
        if (active) setCheckingSession(false);
        if (supabase) {
          await supabase.auth.signOut();
        }
        return;
      }

      const localSeller = readActiveSeller();
      if (localSeller?.slug) {
        router.replace("/dashboard");
        return;
      }

      if (!supabase) {
        if (active) setCheckingSession(false);
        return;
      }

      try {
        if (active) setCheckingSession(true);
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          "Verification du compte trop longue.",
          8000,
        );
        const user = data.session?.user;
        if (!user) {
          return;
        }

        const seller = await withTimeout(
          getSellerByOwner(user.id),
          "Chargement de la boutique trop long.",
          10000,
        );
        if (seller) {
          writeActiveSeller(seller);
          if (active) {
            setExistingSeller(seller);
            router.replace("/dashboard");
          }
        } else if (active) {
          setSellerAccount(user);
          const profile = extractAccountProfile(user);
          setForm((current) => ({
            ...current,
            account_name: current.account_name || profile.account_name,
            email: current.email || profile.email,
            account_phone: current.account_phone || profile.account_phone,
            name: current.name || profile.name,
            phone_number: current.phone_number || profile.phone_number,
          }));
          setSessionBanner("");
          setStep(2);
        }
      } catch (sessionError) {
        console.error("Onboarding session check error:", sessionError);
        if (active) {
          setSessionBanner("On n'a pas pu verifier votre compte tout de suite. Vous pouvez quand meme continuer.");
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "slug" ? slugify(value) : value,
    }));
  }

  function switchAccountMethod(method) {
    setAccountMethod(method);
    if (method === "PHONE") {
      if (!form.account_phone.trim()) {
        updateField("account_phone", "+225 ");
      }
      if (!form.phone_number.trim() || form.phone_number.trim() === "+225") {
        updateField("phone_number", form.account_phone || "+225 ");
      }
    }
  }

  function canContinue() {
    if (step === 1) {
      if (sellerAccount?.id) return true;
      const hasIdentity = accountMethod === "EMAIL"
        ? form.email.includes("@")
        : hasValidPhone(form.account_phone);
      if (accountMode === "SIGN_IN") {
        return hasIdentity && form.password.length > 0;
      }
      return hasIdentity && form.password.length >= 6;
    }
    if (step === 2) return form.name.trim().length >= 2;
    if (step === 3) return hasValidPhone(form.phone_number);
    return true;
  }

  async function ensureSellerAccount() {
    if (!supabase) {
      throw new Error("Connexion vendeur indisponible pour le moment.");
    }

    const email = form.email.trim().toLowerCase();
    const phone = form.account_phone.trim();
    const password = form.password;

    if (accountMode === "SIGN_IN") {
      const credentials = accountMethod === "EMAIL"
        ? { email, password }
        : { email: getPhoneAliasEmail(phone), password };
      const { data, error: signInError } = await signInWithPasswordControlled(credentials);
      if (signInError) {
        if (accountMethod === "PHONE") {
          const fallback = await signInWithPasswordControlled({ phone: normalizeAuthPhone(phone), password }, 12000);
          if (fallback.error) {
            const firstMessage = signInError.message || "";
            const fallbackMessage = fallback.error.message || "";
            if (/lente|reseau|trop longue|timeout/i.test(`${firstMessage} ${fallbackMessage}`)) {
              throw new Error("Connexion lente. Reessayez dans quelques secondes.");
            }
            throw new Error("Numero ou mot de passe incorrect. Si c'est votre premiere fois, appuyez sur Creer un compte.");
          }
          return fallback.data.user;
        }
        throw new Error("Email ou mot de passe incorrect. Si c'est votre premiere fois, appuyez sur Creer un compte.");
      }
      return data.user;
    }

    const account = await withTimeout(
      createSellerAccount({
        method: accountMethod,
        email,
        phone,
        password,
        display_name: form.account_name.trim() || form.name.trim() || email || phone,
      }),
      "Creation du compte trop longue. Reessayez ou utilisez le numero WhatsApp.",
    );

    const credentials = accountMethod === "EMAIL"
      ? { email, password }
      : { email: account.email || getPhoneAliasEmail(account.phone || phone), password };
    const { data, error: signInError } = await signInWithPasswordControlled(credentials, 24000);
    if (signInError) {
      if (accountMethod === "PHONE") {
        const fallback = await signInWithPasswordControlled({ phone: normalizeAuthPhone(account.phone || phone), password }, 12000);
        if (!fallback.error) {
          return fallback.data.user || account;
        }
      }
      throw new Error("Compte cree. Appuyez sur Deja inscrit puis connectez-vous avec le meme numero.");
    }

    return data.user || account;
  }

  async function handleCreate() {
    let account = sellerAccount;
    try {
      setSaving(true);
      setError("");
      account = account || await withTimeout(
        ensureSellerAccount(),
        "Compte trop long a verifier. Reessayez avant de creer la boutique.",
        18000,
      );
      const seller = await withTimeout(
        createSellerFromOnboarding({
          ...form,
          slug: suggestedSlug,
          owner_user_id: account?.id,
          owner_email: isPhoneAliasEmail(account?.email) ? "" : (account?.email || form.email.trim().toLowerCase()),
        }),
        "Creation boutique trop longue. Reessayez dans quelques secondes.",
        32000,
      );
      writeActiveSeller(seller);
      setCreatedSeller(seller);
      setNotice("Boutique creee. Ouverture de votre espace vendeur...");
      window.location.replace("/dashboard?created=1");
    } catch (err) {
      if (!isExpectedOnboardingError(err)) {
        console.error("Onboarding shop creation error:", err);
      }
      const recoveredSeller = account?.id
        ? await withTimeout(
          getSellerByOwner(account.id),
          "Verification de la boutique trop longue.",
          10000,
        ).catch(() => null)
        : null;

      if (recoveredSeller) {
        writeActiveSeller(recoveredSeller);
        setCreatedSeller(recoveredSeller);
        setNotice("Boutique retrouvee. Ouverture de votre espace vendeur...");
        window.location.replace("/dashboard?created=1");
        return;
      }

      setError(friendlyError(err, "Creation boutique non terminee. Verifiez le nom et le numero WhatsApp."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountContinue() {
    if (sellerAccount?.id) {
      setStep(2);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const account = await withTimeout(
        ensureSellerAccount(),
        "Operation trop longue. Reessayez avec votre numero WhatsApp ou changez de connexion.",
      );
      setSellerAccount(account);

      if (accountMode === "SIGN_IN") {
        const existingSeller = await withTimeout(
          getSellerByOwner(account?.id),
          "Recherche boutique trop longue. Reessayez.",
          10000,
        );
        if (existingSeller) {
          writeActiveSeller(existingSeller);
          window.location.replace("/dashboard");
          return;
        }
      }

      setStep(2);
      setNotice(accountMode === "SIGN_IN"
        ? "Compte verifie. Finalisez la boutique, puis vous arrivez dans le dashboard."
        : "Compte cree. Il reste le nom de la boutique, puis vous arrivez dans le dashboard.");
    } catch (err) {
      if (!isExpectedOnboardingError(err)) {
        console.error("Onboarding account error:", err);
      }
      setError(friendlyError(err, "Compte vendeur non valide. Verifiez les informations saisies."));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    setNotice("Lien boutique copie.");
  }

  async function handleSignOut(nextStep = 0) {
    clearActiveSeller();
    setExistingSeller(null);
    setSellerAccount(null);
    setSessionBanner("");
    setAccountMode("SIGN_UP");
    setAccountMethod("PHONE");
    setStep(nextStep);
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  async function handlePasswordReset() {
    if (!supabase) {
      setError("Recuperation indisponible pour le moment. Reessayez plus tard.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    if (!email.includes("@")) {
      setError("Ajoutez votre email avant de demander le lien.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account/update-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setResetSent(true);
    } catch (resetError) {
      setError(friendlyError(resetError, "Lien non envoye. Verifiez l'email saisi."));
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleAuth() {
    if (!supabase) {
      setError("Connexion Google indisponible pour le moment.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthError) {
      setSaving(false);
      setError(friendlyError(oauthError, "Connexion Google impossible pour le moment."));
    }
  }

  if (checkingSession) {
    return <OnboardingRedirectLoader />;
  }

  return (
    <div className="app-shell min-h-screen">
      <main className={`${step === 0 ? "mt-0 pt-[calc(0.45rem+env(safe-area-inset-top,0px))]" : "mt-0 pt-[calc(0.45rem+env(safe-area-inset-top,0px))]"} ${isLoginStep ? "flex min-h-[calc(100vh-4.9rem)] flex-col justify-center gap-2.5" : "space-y-2.5"} ${footerSpacerClass}`}>
        {step === 0 && (
          <OnboardingLandingHero onStart={() => setStep(1)} onSignIn={() => {
            setAccountMode("SIGN_IN");
            setStep(1);
          }} />
        )}

        {currentStepMeta && (
          <OnboardingJourney currentStep={step} onBack={() => setStep((current) => Math.max(0, current - 1))} />
        )}

        {step > 0 && existingSeller && (
          <ExistingSellerBanner seller={existingSeller} onOpen={() => router.replace("/dashboard")} onSwitch={() => handleSignOut(1)} />
        )}

        {step > 0 && !existingSeller && sessionBanner && (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <ShieldCheck size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-amber-900">
                  Verification reportee
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-4 text-amber-800">
                  {sessionBanner}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && !existingSeller && (
          <OnboardingCard
            icon={<LockKeyhole size={28} />}
            title={accountMode === "SIGN_IN" ? "Se connecter" : "Acces vendeur"}
          >
            {sellerAccount?.id && (
              <div className="mb-4 rounded-[20px] border border-[var(--outline)]/45 bg-[var(--surface-soft)] p-3">
                <p className="text-sm font-extrabold text-[var(--text-main)]">Compte deja connecte</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                  Vous pouvez continuer avec ce compte ou vous deconnecter pour choisir un autre numero ou un email.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[46px] rounded-xl bg-[var(--primary)] px-3 text-sm font-extrabold text-white"
                  >
                    Continuer
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="min-h-[46px] rounded-xl bg-white px-3 text-sm font-extrabold text-[var(--text-main)] ring-1 ring-[var(--outline)]/45"
                  >
                    Changer
                  </button>
                </div>
              </div>
            )}

            <SimpleAccountForm
              accountMode={accountMode}
              accountMethod={accountMethod}
              form={form}
              saving={saving}
              resetSent={resetSent}
              setAccountMode={setAccountMode}
              switchAccountMethod={switchAccountMethod}
              updateField={updateField}
              handleGoogleAuth={handleGoogleAuth}
              handlePasswordReset={handlePasswordReset}
            />

            {false && (
            <>
            <div className="mb-4 rounded-[24px] bg-[linear-gradient(135deg,#08120d,#075b3c)] p-4 text-white shadow-[var(--shadow-md)]">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[var(--primary-bright)] ring-1 ring-white/10">
                  {accountMode === "SIGN_IN" ? <LockKeyhole size={21} /> : <MessageCircle size={21} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.13em] text-[var(--primary-bright)]">
                    {accountMode === "SIGN_IN" ? "Retour vendeur" : "Inscription rapide"}
                  </p>
                  <h2 className="mt-1 font-display text-[1.42rem] font-bold leading-7">
                    {accountMode === "SIGN_IN" ? "Ouvrez votre boutique existante." : "Un numero suffit pour demarrer."}
                  </h2>
                  <p className="mt-1.5 text-sm font-semibold leading-5 text-white/72">
                    {accountMode === "SIGN_IN"
                      ? "Retrouvez vos articles, commandes, paiements et livraisons au meme endroit."
                      : "Creez l'acces, nommez la boutique, puis publiez vos premiers articles."}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <AuthTrustPill icon={<Store size={14} />} label="Boutique" />
                <AuthTrustPill icon={<MessageCircle size={14} />} label="WhatsApp" />
                <AuthTrustPill icon={<ShieldCheck size={14} />} label="Protege" />
              </div>
            </div>

            <div className="mb-4 rounded-[22px] border border-[var(--outline)]/50 bg-white p-2 shadow-[var(--shadow-sm)]">
              <p className="px-2 pb-2 pt-1 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                Que voulez-vous faire ?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <AuthModeButton
                  active={accountMode === "SIGN_UP"}
                  title="Créer"
                  text="Nouvelle boutique"
                  onClick={() => setAccountMode("SIGN_UP")}
                />
                <AuthModeButton
                  active={accountMode === "SIGN_IN"}
                  title="Entrer"
                  text="J'ai deja un compte"
                  onClick={() => setAccountMode("SIGN_IN")}
                />
              </div>
            </div>

            <div className="mb-4 rounded-[22px] bg-[var(--surface-soft)] p-2">
              <p className="px-2 pb-2 pt-1 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                Avec quoi voulez-vous revenir ?
              </p>
              <div className="grid gap-2 md:grid-cols-2">
              <AuthMethodButton
                active={accountMethod === "PHONE"}
                icon={<MessageCircle size={18} />}
                title="Numero WhatsApp"
                text="Recommande a Abidjan"
                onClick={() => switchAccountMethod("PHONE")}
              />
              <AuthMethodButton
                active={accountMethod === "EMAIL"}
                icon={<Mail size={18} />}
                title="Email"
                text="Si vous preferez"
                onClick={() => switchAccountMethod("EMAIL")}
              />
              </div>
            </div>

            {accountMethod === "EMAIL" ? (
              <AuthInput
                label="Email vendeur"
                icon={<Mail size={19} />}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="vendeur@email.com"
                inputMode="email"
                autoComplete="email"
              />
            ) : (
              <PhoneInput
                label="Numero WhatsApp vendeur"
                icon={<MessageCircle size={19} />}
                value={form.account_phone}
                onValueChange={(nextPhone) => {
                  updateField("account_phone", nextPhone);
                  if (!form.phone_number || form.phone_number === form.account_phone) {
                    updateField("phone_number", nextPhone);
                  }
                }}
                autoComplete="tel"
              />
            )}

            <AuthInput
              className="mt-3"
              label="Mot de passe Tikchop"
              icon={<LockKeyhole size={19} />}
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder={accountMode === "SIGN_IN" ? "Votre mot de passe" : "Minimum 6 caracteres"}
              type="password"
              autoComplete={accountMode === "SIGN_UP" ? "new-password" : "current-password"}
            />

            <div className="mt-3 rounded-[20px] border border-[var(--outline)]/45 bg-white p-2 shadow-[var(--shadow-sm)]">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={saving}
                className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[16px] bg-[var(--surface-soft)] px-4 text-sm font-extrabold text-[var(--text-main)] disabled:opacity-60"
              >
                <GoogleMark />
                Continuer avec Google
              </button>
              <p className="px-2 pb-1 pt-2 text-center text-xs font-semibold leading-4 text-[var(--text-dim)]">
                Optionnel. Le numero reste le plus simple pour les vendeurs WhatsApp.
              </p>
            </div>

            {accountMode === "SIGN_IN" && accountMethod === "EMAIL" && (
              <div className="mt-3 rounded-[18px] bg-[var(--surface-soft)] p-3">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={saving}
                  className="text-sm font-extrabold text-[var(--primary)] disabled:text-[var(--text-dim)]"
                >
                  Mot de passe oublie ? Envoyer un lien par email
                </button>
                {resetSent && (
                  <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                    Si ce compte existe, un email de recuperation vient d&apos;etre envoye.
                  </p>
                )}
              </div>
            )}

            {accountMode === "SIGN_IN" && accountMethod === "PHONE" && (
              <div className="mt-3 rounded-[18px] bg-[var(--surface-soft)] p-3">
                <p className="text-sm font-semibold leading-5 text-[var(--text-dim)]">
                  Entrez le meme numero et le meme mot de passe que lors de votre inscription.
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                  Si vous preferez recuperer votre acces par email plus tard, vous pourrez ajouter un email depuis votre espace vendeur.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-[18px] border border-[var(--primary)]/15 bg-[var(--surface-soft)] p-3 text-xs font-bold leading-4 text-[var(--text-dim)]">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--primary)]" size={16} />
              <p>
                {accountMethod === "EMAIL"
                  ? "Votre email sert a vous reconnecter et recuperer votre acces."
                  : "Votre numero sert a vous reconnecter et preparer votre WhatsApp de vente."}
              </p>
            </div>
            </>
            )}
          </OnboardingCard>
        )}

        {step === 2 && (
          <OnboardingCard
            icon={<Store size={28} />}
            title="Boutique"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Nom boutique</span>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ex: Amina Mode"
                className="mobile-input text-lg"
              />
            </label>
            <div className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-3">
              <p className="break-all text-base font-extrabold text-[var(--primary)]">tikchop/{suggestedSlug || "ma-boutique"}</p>
            </div>
          </OnboardingCard>
        )}

        {step === 3 && (
          <OnboardingCard
            icon={<MessageCircle size={28} />}
            title="WhatsApp vendeur"
            subtitle="Le numero pour parler aux clients."
          >
            {hasValidPhone(form.account_phone) && (
              <button
                type="button"
                onClick={() => updateField("phone_number", form.account_phone)}
                className="mb-4 flex min-h-[52px] w-full items-center justify-between rounded-xl border border-[var(--outline)] bg-white px-4 text-left"
              >
                <div>
                  <p className="text-sm font-extrabold text-[var(--text-main)]">Utiliser le meme numero</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">{form.account_phone}</p>
                </div>
                <CheckCircle2 size={18} className="text-[var(--primary)]" />
              </button>
            )}
            <PhoneInput
              label="Numero WhatsApp"
              icon={<MessageCircle size={19} />}
              value={form.phone_number}
              onValueChange={(nextPhone) => updateField("phone_number", nextPhone)}
            />
            <p className="mt-4 rounded-lg bg-[var(--surface-soft)] p-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
              L&apos;indicatif +225 est deja ajoute. Entrez seulement le numero utilise sur WhatsApp.
            </p>
          </OnboardingCard>
        )}

        {step === 4 && (
          <OnboardingCard
            icon={<Truck size={28} />}
            title="Reception client"
            subtitle="Livraison, retrait, ou les deux."
          >
            <div className="grid gap-3">
              <ChoiceButton active={form.delivery_mode === "BOTH"} title="Livraison + retrait" text="Le plus flexible" onClick={() => updateField("delivery_mode", "BOTH")} />
              <ChoiceButton active={form.delivery_mode === "DELIVERY"} title="Livraison seulement" text="Le client donne son adresse" onClick={() => updateField("delivery_mode", "DELIVERY")} />
              <ChoiceButton active={form.delivery_mode === "PICKUP"} title="Retrait seulement" text="Le client vient recuperer" onClick={() => updateField("delivery_mode", "PICKUP")} />
            </div>
          </OnboardingCard>
        )}

        {step === 5 && (
          <OnboardingCard
            icon={<Truck size={28} />}
            title="Frais livraison"
            subtitle="Reglez le depart simplement."
          >
            {form.delivery_mode !== "PICKUP" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Frais fixe de depart</span>
                  <input
                    value={form.fixed_delivery_fee}
                    onChange={(event) => updateField("fixed_delivery_fee", event.target.value)}
                    placeholder="1000"
                    inputMode="numeric"
                    className="mobile-input text-lg"
                  />
                </label>
                <div className="mt-4 grid gap-3">
                  <ChoiceButton
                    active={form.delivery_payment_timing === "AT_RECEPTION"}
                    title="Livraison payee a reception"
                    text="Tres courant a Abidjan"
                    onClick={() => updateField("delivery_payment_timing", "AT_RECEPTION")}
                  />
                  <ChoiceButton
                    active={form.delivery_payment_timing === "INCLUDED"}
                    title="Livraison payee avec la commande"
                    text={`Le total affichera ${formatPrice(form.fixed_delivery_fee)} en plus`}
                    onClick={() => updateField("delivery_payment_timing", "INCLUDED")}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-[var(--surface-soft)] p-5 text-center">
                <CheckCircle2 className="mx-auto text-[var(--primary)]" size={34} />
                <p className="mt-3 font-display text-xl font-bold text-[var(--text-main)]">Pas de frais livraison</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">La boutique commence en retrait seulement.</p>
              </div>
            )}
          </OnboardingCard>
        )}

        {step === 6 && createdSeller && (
          <OnboardingCard
            icon={<CheckCircle2 size={30} />}
            title="Boutique prete"
            subtitle="Votre espace vendeur est pret. Faites juste les premieres actions utiles."
          >
            <SuccessSummary seller={createdSeller} form={form} />
            <WhatsAppOfferBox />
            <QuickStartGrid seller={createdSeller} />
            <LaunchChecklist seller={createdSeller} />

            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="quiet-label">Lien boutique</p>
              <p className="mt-1 break-all font-display text-xl font-bold text-[var(--primary)]">{shopUrl}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={copyLink} className="flex min-h-[54px] items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--text-main)]">
                <Copy size={17} />
                Copier
              </button>
              <Link href={`/${createdSeller.slug}`} className="flex min-h-[54px] items-center justify-center rounded-lg border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--text-main)] no-underline">
                Voir
              </Link>
            </div>
          </OnboardingCard>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-bold leading-5 text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold leading-5 text-emerald-800 ring-1 ring-emerald-100">
            {notice}
          </p>
        )}

        {step > 0 && step <= totalSetupSteps && !(step === 1 && existingSeller) && (
        <div className="fixed inset-x-0 bottom-0 z-[320] border-t border-[var(--outline)]/25 bg-white/96 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-14px_30px_rgba(22,29,25,0.11)] backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
          {step === 1 && (
            <button
              type="button"
              disabled={!canContinue() || saving}
              onClick={handleAccountContinue}
              className="mx-auto flex min-h-[52px] w-full max-w-[460px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={19} />}
              {accountMode === "SIGN_IN" ? "Se connecter" : "Creer mon compte"}
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!canContinue() || saving}
              onClick={handleCreate}
              className="mx-auto flex min-h-[52px] w-full max-w-[460px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              Creer ma boutique
            </button>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

function OnboardingRedirectLoader() {
  return (
    <div className="app-shell min-h-screen">
      <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-4 py-8">
        <section className="w-full max-w-[360px] rounded-[28px] border border-[var(--outline)]/55 bg-white p-5 text-center shadow-[var(--shadow-sm)]">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
            <Loader2 className="animate-spin" size={24} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">Ouverture de votre espace vendeur</h1>
          <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
            Si une boutique existe deja sur ce telephone, Tikchop l&apos;ouvre directement.
          </p>
        </section>
      </main>
    </div>
  );
}

function OnboardingLandingHero({ onStart, onSignIn }) {
  return (
    <section className="djassa-command overflow-hidden">
      <div className="relative h-[180px] shrink-0 overflow-hidden md:h-[255px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/fatim-jeune-friperie.jpg"
          alt="Fatim avec ses articles"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06110b] via-[#06110b]/32 to-transparent" />
        <div className="absolute left-3 top-3 rounded-2xl bg-[#06110b]/82 px-3 py-2 text-xs font-extrabold text-[var(--primary-bright)] ring-1 ring-white/12 backdrop-blur-md">
          24h/24
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-[#06110b] shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
          <Bot size={15} />
          Il vend
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/16 p-2 shadow-[0_16px_38px_rgba(0,0,0,0.18)] ring-1 ring-white/18 backdrop-blur-md">
            <PaymentLogo src="/payment-logos/wave.png" label="Wave" size="normal" />
            <PaymentLogo src="/payment-logos/orange-money.svg" label="Orange Money" size="wide" />
            <PaymentLogo src="/payment-logos/mtn-momo.png" label="MTN MoMo" size="large" />
            <PaymentLogo src="/payment-logos/djamo.png" label="Djamo" size="large" />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--primary-bright)]">Djassaman digital</p>
          <h1 className="mt-2 font-display text-[1.82rem] font-bold leading-9 md:text-4xl md:leading-10">
            Laissez WhatsApp vendre a votre place.
          </h1>
          <p className="mt-2 text-[0.95rem] font-semibold leading-6 text-white/82">
            Votre boutique en ligne avec un vendeur WhatsApp automatique: il repond, encaisse, envoie le recu et aide a coordonner vos livreurs.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <HeroProof icon={<MessageCircle size={15} />} label="Repond" />
          <HeroProof icon={<Banknote size={15} />} label="Encaisse" />
          <HeroProof icon={<Truck size={15} />} label="Livre" />
        </div>

        <button
          type="button"
          onClick={onStart}
          className="djassa-glow-action flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl text-base font-extrabold"
        >
          Creer ma boutique Tikchop
          <ArrowRight size={19} />
        </button>
        <button
          type="button"
          onClick={onSignIn}
          className="flex min-h-[42px] w-full items-center justify-center rounded-xl bg-white/10 text-sm font-extrabold text-white/88 ring-1 ring-white/10"
        >
          J&apos;ai deja un compte
        </button>
        <Link
          href="/?info=1"
          className="flex min-h-[42px] w-full items-center justify-center rounded-xl text-sm font-extrabold text-white/74 no-underline"
        >
          En savoir plus
        </Link>
      </div>
    </section>
  );
}

function HeroProof({ icon, label }) {
  return (
    <div className="flex min-h-[52px] flex-col items-center justify-center rounded-2xl bg-white/10 px-2 text-center text-xs font-extrabold text-white ring-1 ring-white/12">
      <span className="text-[var(--primary-bright)]">{icon}</span>
      <span className="mt-1">{label}</span>
    </div>
  );
}

function ExistingSellerBanner({ seller, onOpen, onSwitch }) {
  return (
    <div className="rounded-[22px] border border-[var(--outline)]/45 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <Store size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[var(--text-main)]">Boutique deja connectee</p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-dim)]">
            {seller.name} /{seller.slug}
          </p>
          <p className="mt-1 text-xs font-semibold leading-4 text-[var(--text-dim)]">
            Pour tester un nouveau compte, sortez d&apos;abord de cette boutique.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="min-h-[46px] rounded-xl bg-[var(--primary)] px-3 text-sm font-extrabold text-white"
            >
              Ouvrir
            </button>
            <button
              type="button"
              onClick={onSwitch}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 text-sm font-extrabold text-[var(--text-main)]"
            >
              <LogOut size={15} />
              Nouveau compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingJourney({ currentStep, onBack }) {
  const progress = (currentStep / SETUP_STEPS.length) * 100;

  return (
    <section className="rounded-[18px] border border-[var(--outline)]/45 bg-white/88 p-2.5 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-black text-[var(--text-main)] ring-1 ring-[var(--outline)]/45"
          aria-label="Retour"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-[var(--primary)]">{currentStep}/{SETUP_STEPS.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-mid)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary-bright),#ffe66d)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentLogo({ src, label, size = "normal" }) {
  const sizeClass = {
    normal: "max-h-6",
    wide: "max-h-6",
    large: "max-h-7",
  }[size] || "max-h-6";

  return (
    <div className="flex h-10 flex-1 items-center justify-center rounded-xl bg-white px-2 shadow-[0_10px_20px_rgba(0,0,0,0.16)]" aria-label={label} title={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className={`${sizeClass} max-w-full object-contain`} />
    </div>
  );
}

function OnboardingCard({ icon, title, subtitle, children }) {
  return (
    <section className="app-card p-3.5 md:p-5">
      <div className="mb-3 flex items-center gap-2.5 md:mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)] md:h-11 md:w-11">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold leading-6 text-[var(--text-main)] md:text-3xl md:leading-9">{title}</h1>
          {subtitle ? <p className="mt-0.5 line-clamp-1 text-xs font-semibold leading-4 text-[var(--text-dim)] md:text-sm md:leading-5">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function AuthTrustPill({ icon, label }) {
  return (
    <div className="flex min-h-[48px] flex-col items-center justify-center rounded-2xl bg-white/10 px-2 text-center text-[0.68rem] font-extrabold text-white ring-1 ring-white/10">
      <span className="text-[var(--primary-bright)]">{icon}</span>
      <span className="mt-1">{label}</span>
    </div>
  );
}

function SimpleAccountForm({
  accountMode,
  accountMethod,
  form,
  saving,
  resetSent,
  setAccountMode,
  switchAccountMethod,
  updateField,
  handleGoogleAuth,
  handlePasswordReset,
}) {
  const isSignIn = accountMode === "SIGN_IN";
  const isPhone = accountMethod === "PHONE";

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] bg-[var(--surface-soft)] p-3">
        {isPhone ? (
          <PhoneInput
            label="Numero WhatsApp"
            icon={<MessageCircle size={19} />}
            value={form.account_phone}
            onValueChange={(nextPhone) => {
              updateField("account_phone", nextPhone);
              if (!form.phone_number || form.phone_number === form.account_phone) {
                updateField("phone_number", nextPhone);
              }
            }}
            autoComplete="tel"
          />
        ) : (
          <AuthInput
            label="Email vendeur"
            icon={<Mail size={19} />}
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="vendeur@email.com"
            inputMode="email"
            autoComplete="email"
          />
        )}

        <AuthInput
          className="mt-3"
          label="Mot de passe"
          icon={<LockKeyhole size={19} />}
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder={isSignIn ? "Votre mot de passe" : "Minimum 6 caracteres"}
          type="password"
          autoComplete={isSignIn ? "current-password" : "new-password"}
        />

        {isSignIn && (
          <button
            type="button"
            onClick={() => switchAccountMethod(isPhone ? "EMAIL" : "PHONE")}
            className="mt-3 min-h-[40px] w-full rounded-2xl bg-white px-4 text-sm font-extrabold text-[var(--primary)] ring-1 ring-[var(--outline)]/50"
          >
            {isPhone ? "Email" : "WhatsApp"}
          </button>
        )}
      </div>

      {isSignIn && !isPhone && (
        <div className="rounded-[18px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/45">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={saving}
            className="text-sm font-extrabold text-[var(--primary)] disabled:text-[var(--text-dim)]"
          >
            Mot de passe oublie ? Envoyer un lien par email
          </button>
          {resetSent && (
            <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
              Email envoye.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={saving}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[var(--text-main)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/55 disabled:opacity-60"
      >
        <GoogleMark />
        Google
      </button>

      {isSignIn && (
        <button
          type="button"
          onClick={() => {
            setAccountMode("SIGN_UP");
            switchAccountMethod("PHONE");
          }}
          className="w-full text-center text-sm font-extrabold text-[var(--primary)]"
        >
          Creer une boutique
        </button>
      )}

      {!isSignIn && (
        <button
          type="button"
          onClick={() => setAccountMode("SIGN_IN")}
          className="w-full text-center text-sm font-extrabold text-[var(--primary)]"
        >
          J&apos;ai deja un compte
        </button>
      )}
    </div>
  );
}

function SimpleModeButton({ active, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] items-center justify-between gap-2 rounded-[18px] px-3 text-left transition active:scale-[0.99] ${
        active
          ? "bg-[var(--text-main)] text-white shadow-[0_14px_30px_rgba(13,23,18,0.14)]"
          : "bg-[var(--surface-soft)] text-[var(--text-dim)]"
      }`}
    >
      <span>
        <span className="block text-base font-extrabold leading-5">{title}</span>
        <span className={`mt-1 block text-xs font-bold leading-4 ${active ? "text-white/65" : "text-[var(--text-dim)]"}`}>{text}</span>
      </span>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${active ? "bg-[var(--primary-bright)] text-[var(--text-main)]" : "bg-white text-transparent"}`}>
        <CheckCircle2 size={18} />
      </span>
    </button>
  );
}

function GoogleMark() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
      </svg>
    </span>
  );
}

function AuthModeButton({ active, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] items-center justify-between gap-2 rounded-[18px] px-3 text-left transition active:scale-[0.99] ${
        active
          ? "bg-[var(--text-main)] text-white shadow-[0_14px_30px_rgba(13,23,18,0.14)]"
          : "bg-[var(--surface-soft)] text-[var(--text-dim)]"
      }`}
    >
      <span>
        <span className="block text-base font-extrabold leading-5">{title}</span>
        <span className={`mt-1 block text-xs font-bold leading-4 ${active ? "text-white/65" : "text-[var(--text-dim)]"}`}>{text}</span>
      </span>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${active ? "bg-[var(--primary-bright)] text-[var(--text-main)]" : "bg-white text-transparent"}`}>
        <CheckCircle2 size={18} />
      </span>
    </button>
  );
}

function AuthMethodButton({ active, icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[68px] items-center gap-3 rounded-[18px] px-3 text-left transition active:scale-[0.99] ${
        active ? "bg-white text-[var(--text-main)] shadow-sm ring-1 ring-[var(--primary)]/20" : "bg-transparent text-[var(--text-dim)]"
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-[var(--primary)] text-white" : "bg-white/70 text-[var(--text-dim)]"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold leading-5">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-4 opacity-75">{text}</span>
      </span>
    </button>
  );
}

function AuthInput({ className = "", label, icon, ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-extrabold text-[var(--text-main)]">{label}</span>
      <div className="flex min-h-[58px] items-center gap-3 rounded-[18px] border border-[var(--outline)]/65 bg-white px-4 shadow-[0_12px_28px_rgba(13,23,18,0.06)] transition focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_rgba(0,143,90,0.12)]">
        <span className="shrink-0 text-[var(--primary)]">{icon}</span>
        <input
          {...props}
          className="min-w-0 flex-1 bg-transparent text-base font-extrabold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
        />
      </div>
    </label>
  );
}

function PhoneInput({ className = "", label, icon, value, onValueChange, autoComplete = "tel" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-extrabold text-[var(--text-main)]">{label}</span>
      <div className="flex min-h-[58px] items-center gap-2 rounded-[18px] border border-[var(--outline)]/65 bg-white px-3 shadow-[0_12px_28px_rgba(13,23,18,0.06)] transition focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_rgba(0,143,90,0.12)]">
        <span className="shrink-0 text-[var(--primary)]">{icon}</span>
        <span className="flex h-9 shrink-0 items-center rounded-xl bg-[var(--surface-soft)] px-3 text-sm font-black text-[var(--primary)] ring-1 ring-[var(--primary)]/12">
          +225
        </span>
        <input
          value={getIvorianLocalPart(value)}
          onChange={(event) => onValueChange(withIvorianPrefix(event.target.value))}
          placeholder="07 00 00 00 00"
          inputMode="tel"
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent text-base font-extrabold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
        />
      </div>
    </label>
  );
}

function SuccessSummary({ seller, form }) {
  const deliveryLabel = form.delivery_mode === "PICKUP"
    ? "Retrait seulement"
    : form.delivery_mode === "DELIVERY"
      ? "Livraison seulement"
      : "Livraison + retrait";

  return (
    <div className="mb-4 overflow-hidden rounded-[24px] bg-[var(--text-main)] text-white shadow-[var(--shadow-lg)]">
      <div className="h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[#315bc7]" />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Boutique creee</p>
            <p className="mt-2 break-words font-display text-2xl font-bold leading-8">{seller.name}</p>
            <p className="mt-1 text-sm font-bold text-[var(--primary-bright)]">/{seller.slug}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--text-main)] shadow-sm">
            <CheckCircle2 size={22} />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SuccessChip label="Reception" value={deliveryLabel} />
          <SuccessChip label="WhatsApp" value={form.phone_number || "A verifier"} />
          <SuccessChip label="Livraison" value={form.delivery_mode === "PICKUP" ? "0 F" : formatPrice(form.fixed_delivery_fee)} />
          <SuccessChip label="Paiement livraison" value={form.delivery_payment_timing === "INCLUDED" ? "Avec commande" : "A reception"} />
        </div>
      </div>
    </div>
  );
}

function SuccessChip({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/8">
      <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-white/48">{label}</p>
      <p className="mt-1 text-sm font-extrabold leading-5 text-white">{value}</p>
    </div>
  );
}

function QuickStartGrid({ seller }) {
  const actions = [
    {
      title: "Ajouter un article",
      subtitle: "Publiez votre premiere photo",
      href: "/add-product",
      icon: <Package size={18} />,
    },
    {
      title: "Ouvrir WhatsApp",
      subtitle: "Connecte l'assistant client",
      href: "/whatsapp",
      icon: <MessageCircle size={18} />,
    },
    {
      title: "Voir la boutique",
      subtitle: `/${seller.slug}`,
      href: `/${seller.slug}`,
      icon: <ExternalLink size={18} />,
    },
    {
      title: "Mon espace vendeur",
      subtitle: "Commandes et suivi",
      href: "/dashboard",
      icon: <Store size={18} />,
    },
  ];

  return (
    <div className="mb-4">
      <p className="quiet-label text-[var(--primary)]">Actions conseillees maintenant</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="flex min-h-[112px] flex-col justify-between rounded-[22px] border border-[var(--outline)]/50 bg-white p-4 text-left no-underline shadow-[var(--shadow-sm)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
              {action.icon}
            </span>
            <span>
              <span className="block text-sm font-extrabold leading-5 text-[var(--text-main)]">{action.title}</span>
              <span className="mt-1 block text-xs font-semibold leading-4 text-[var(--text-dim)]">{action.subtitle}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LaunchChecklist({ seller }) {
  const items = [
    {
      title: "Publier le premier article",
      text: "Photos, prix, stock. Tikchop prepare les fiches.",
      href: "/add-product",
    },
    {
      title: "Regler la livraison",
      text: "Ajoute communes, frais et numeros livreurs.",
      href: "/delivery-settings",
    },
    {
      title: "Partager la boutique",
      text: `Le lien public est /${seller.slug}.`,
      href: `/${seller.slug}`,
    },
  ];

  return (
    <div className="mb-4 rounded-[22px] border border-[var(--outline)]/55 bg-white p-4">
      <p className="quiet-label text-[var(--primary)]">Plan simple pour bien demarrer</p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <Link key={item.title} href={item.href} className="flex min-h-[68px] items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-3 text-left no-underline">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-main)] text-sm font-extrabold text-white">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-[var(--text-main)]">{item.title}</span>
              <span className="mt-0.5 block text-xs font-semibold leading-4 text-[var(--text-dim)]">{item.text}</span>
            </span>
            <ArrowRight className="shrink-0 text-[var(--primary)]" size={17} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function WhatsAppOfferBox() {
  return (
    <div className="mb-4 rounded-[22px] border border-[var(--outline)]/55 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <Bot size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="quiet-label">WhatsApp automatique</p>
          <p className="mt-1 font-display text-xl font-bold leading-6 text-[var(--text-main)]">Deux facons de vendre avec Tikchop</p>
          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
              <p className="text-sm font-extrabold text-emerald-950">Simple: assistant Tikchop</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-emerald-800">
                Aucun branchement complique. Les clients passent par le numero Tikchop et vos commandes arrivent dans l&apos;app.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
              <p className="text-sm font-extrabold text-[var(--text-main)]">Accompagne: votre propre WhatsApp</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Pour les boutiques qui veulent repondre depuis leur propre numero avec notre aide.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({ active, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border p-3 text-left active:scale-[0.99] ${
        active ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-[var(--outline)]/55 bg-white"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-extrabold leading-5 text-[var(--text-main)]">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-4 text-[var(--text-dim)]">{text}</span>
      </span>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-transparent"}`}>
        <CheckCircle2 size={17} />
      </span>
    </button>
  );
}
