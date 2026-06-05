"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Banknote, Bot, CheckCircle2, Copy, ExternalLink, Loader2, LockKeyhole, LogOut, Mail, MessageCircle, Package, ShieldCheck, Store, Truck, X } from "lucide-react";
import { createSellerAccount, createSellerAccountAndShop, createSellerFromOnboarding, getSellerByOwner } from "../seller-actions";
import { clearActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/user-facing-error";
import { PRODUCT_PROFILES, storeProductProfileId } from "../../lib/product-profiles";

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
  return digits.length >= 8 && digits.length <= 10;
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
  return method === "email" ? "EMAIL" : "PHONE";
}

function getRequestedInitialStep() {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  if (params.get("intro") === "1") return 0;
  if (params.get("step") === "account") return 1;
  if (params.get("new") === "1" || params.get("mode") === "signin") return 1;
  return 0;
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
  return /incorrect|premiere fois|mot de passe|ajoute|valide|existe deja|connexion lente|connexion impossible|reessayez|creation boutique incomplete/i.test(
    error?.message || "",
  );
}

function isSlowAccountError(error) {
  return /trop longue|trop long|timeout|lente|reseau|network|aborted|operation trop longue/i.test(error?.message || "");
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

const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && process.env.NEXT_PUBLIC_GOOGLE_AUTH_READY === "true";

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
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [step, setStep] = useState(() => getRequestedInitialStep());
  const [redirectingToDashboard, setRedirectingToDashboard] = useState(false);
  const [sessionBanner, setSessionBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountMode, setAccountMode] = useState(() => getRequestedAccountMode());
  const [accountMethod, setAccountMethod] = useState(() => getRequestedAccountMethod());
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
    product_profile: "general",
  });

  const suggestedSlug = useMemo(() => slugify(form.slug || form.name), [form.name, form.slug]);
  const shopUrl = createdSeller ? `${typeof window !== "undefined" ? window.location.origin : ""}/${createdSeller.slug}` : "";
  const totalSetupSteps = SETUP_STEPS.length;
  const isLoginStep = step === 1 && accountMode === "SIGN_IN";
  const isQuickSignupStep = step === 1 && accountMode === "SIGN_UP";
  const currentStepMeta = !isLoginStep && !isQuickSignupStep && step >= 1 && step <= totalSetupSteps ? SETUP_STEPS[step - 1] : null;
  const footerSpacerClass = step > 1 && step <= totalSetupSteps
    ? "pb-[calc(5.35rem+env(safe-area-inset-bottom,0px))] md:pb-0"
    : "";

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      const requestedMode = getRequestedAccountMode();
      const requestedMethod = getRequestedAccountMethod();
      const requestedStep = getRequestedInitialStep();
      setAccountMode(requestedMode);
      setAccountMethod(requestedMethod);
      setStep(requestedStep);
      const startFresh = isFreshAccountRequest();

      if (startFresh) {
        clearActiveSeller();
        setRedirectingToDashboard(false);
        setExistingSeller(null);
        setSellerAccount(null);
        setSessionBanner("");
        setStep(requestedStep);
        window.history.replaceState(null, "", requestedStep === 0 ? "/onboarding?intro=1" : "/onboarding?step=account");
        if (supabase) {
          await supabase.auth.signOut();
        }
        return;
      }

      if (!supabase) {
        return;
      }

      try {
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
          getSellerByOwner(user.id, data.session?.access_token),
          "Chargement de la boutique trop long.",
          10000,
        );
        if (seller) {
          writeActiveSeller(seller);
          if (active) {
            setExistingSeller(seller);
            setRedirectingToDashboard(true);
            window.location.replace("/dashboard");
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
      const hasStorePhone = accountMethod === "PHONE" ? true : hasValidPhone(form.phone_number);
      return hasIdentity && hasStorePhone && form.password.length >= 6 && form.name.trim().length >= 2;
    }
    if (step === 2) return form.name.trim().length >= 2 && hasValidPhone(form.phone_number);
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

    async function signInAfterAccountCreation(account = null, timeoutMs = 24000) {
      const createdPhone = account?.phone || phone;
      const createdEmail = account?.email || email;
      const credentials = accountMethod === "EMAIL"
        ? { email: createdEmail || email, password }
        : { email: createdEmail || getPhoneAliasEmail(createdPhone || phone), password };
      const { data, error: signInError } = await signInWithPasswordControlled(credentials, timeoutMs);
      if (signInError) {
        if (accountMethod === "PHONE") {
          const fallback = await signInWithPasswordControlled({ phone: normalizeAuthPhone(createdPhone || phone), password }, 12000);
          if (!fallback.error) {
            return fallback.data.user || account || null;
          }
        }
        return null;
      }

      return data.user || account || null;
    }

    try {
      const account = await withTimeout(
        createSellerAccount({
          method: accountMethod,
          email,
          phone,
          password,
          display_name: form.account_name.trim() || form.name.trim() || email || phone,
        }),
        "Creation du compte encore en cours. Tikchop verifie automatiquement.",
        36000,
      );

      const recovered = await signInAfterAccountCreation(account);
      if (recovered) {
        return recovered;
      }

      throw new Error("Compte cree. Appuyez sur Deja inscrit puis connectez-vous avec le meme numero.");
    } catch (createError) {
      const recovered = await signInAfterAccountCreation(null, isSlowAccountError(createError) ? 14000 : 9000);
      if (recovered) {
        return recovered;
      }

      if (/existe deja|already|registered|exists|duplicate/i.test(createError?.message || "")) {
        throw new Error("Ce compte existe deja. Appuyez sur J'ai deja un compte puis connectez-vous.");
      }

      throw createError;
    }
  }

  async function handleCreate() {
    let account = sellerAccount;
    let accessToken = "";
    try {
      setSaving(true);
      setError("");

      if (accountMode === "SIGN_UP" && !account?.id) {
        const created = await withTimeout(
          createSellerAccountAndShop({
            method: accountMethod,
            email: form.email.trim().toLowerCase(),
            phone: form.account_phone.trim(),
            password: form.password,
            display_name: form.account_name.trim() || form.name.trim() || form.email.trim() || form.account_phone.trim(),
            name: form.name,
            phone_number: form.phone_number || form.account_phone,
            slug: suggestedSlug,
            delivery_mode: form.delivery_mode,
            fixed_delivery_fee: form.fixed_delivery_fee,
            delivery_payment_timing: form.delivery_payment_timing,
          }),
          "Creation de la boutique trop longue. Reessayez dans quelques secondes.",
          26000,
        );

        const credentials = accountMethod === "EMAIL"
          ? { email: created.account?.email || form.email.trim().toLowerCase(), password: form.password }
          : { email: created.account?.email || getPhoneAliasEmail(form.account_phone), password: form.password };
        const { data: signInData, error: signInError } = await signInWithPasswordControlled(credentials, 16000);
        if (signInError) {
          throw new Error("Boutique creee. Appuyez sur J'ai deja un compte puis connectez-vous avec le meme numero.");
        }

        account = signInData.user || created.account;
        setSellerAccount(account);
        storeProductProfileId(form.product_profile, created.seller?.slug || "default");
        writeActiveSeller(created.seller);
        setCreatedSeller(created.seller);
        setNotice("Boutique creee. Ouverture de votre espace vendeur...");
        window.location.replace("/dashboard?created=1");
        return;
      }

      account = account || await ensureSellerAccount();
      setSellerAccount(account);
      const { data: sessionState } = await supabase.auth.getSession();
      accessToken = sessionState.session?.access_token || "";
      const seller = await withTimeout(
        createSellerFromOnboarding({
          ...form,
          slug: suggestedSlug,
          owner_user_id: account?.id,
          owner_email: isPhoneAliasEmail(account?.email) ? "" : (account?.email || form.email.trim().toLowerCase()),
          access_token: accessToken,
        }),
        "Creation boutique trop longue. Reessayez dans quelques secondes.",
        32000,
      );
      writeActiveSeller(seller);
      storeProductProfileId(form.product_profile, seller?.slug || "default");
      setCreatedSeller(seller);
      setNotice("Boutique creee. Ouverture de votre espace vendeur...");
      window.location.replace("/dashboard?created=1");
    } catch (err) {
      if (!isExpectedOnboardingError(err)) {
        console.error("Onboarding shop creation error:", err);
      }
      const recoveredSeller = account?.id
        ? await withTimeout(
          getSellerByOwner(account.id, accessToken),
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

      setError(friendlyError(err, "Creation boutique incomplete. Verifiez le nom et le numero WhatsApp."));
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
      const account = await ensureSellerAccount();
      setSellerAccount(account);

      if (accountMode === "SIGN_IN") {
        const { data: sessionState } = await supabase.auth.getSession();
        const existingSeller = await withTimeout(
          getSellerByOwner(account?.id, sessionState.session?.access_token),
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
      const next = encodeURIComponent("/onboarding?step=account");
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
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

  if (!hydrated) {
    return <OnboardingBootShell />;
  }

  if (redirectingToDashboard) {
    return <DashboardRedirectLoader />;
  }

  return (
    <div className={`app-shell onboarding-shell ${step === 0 ? "pb-0 md:min-h-0 md:w-full md:max-w-[1320px]" : "min-h-screen"}`}>
      <main className={`${step === 0 ? "mt-0 pt-[calc(0.45rem+env(safe-area-inset-top,0px))] md:flex md:min-h-[calc(100vh-1.5rem)] md:items-center md:justify-center md:px-4 md:py-2" : "mt-0 pt-[calc(0.45rem+env(safe-area-inset-top,0px))]"} ${isLoginStep ? "flex min-h-[calc(100vh-4.9rem)] flex-col justify-center gap-2.5 md:min-h-[calc(100vh-1.5rem)]" : "space-y-2.5"} ${footerSpacerClass}`}>
        {step === 0 && (
          <OnboardingLandingHero onStart={() => {
            window.history.replaceState(null, "", "/onboarding?step=account");
            setAccountMode("SIGN_UP");
            setStep(1);
          }} onSignIn={() => {
            window.history.replaceState(null, "", "/onboarding?mode=signin&method=phone");
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
          <section className="mx-auto grid w-full max-w-[1040px] gap-3 md:grid-cols-[0.92fr_1.08fr] md:items-stretch md:gap-4">
            <MobileAccountPanel
              accountMode={accountMode}
              accountMethod={accountMethod}
              form={form}
              saving={saving}
              resetSent={resetSent}
              sellerAccount={sellerAccount}
              canContinue={canContinue()}
              setAccountMode={setAccountMode}
              switchAccountMethod={switchAccountMethod}
              updateField={updateField}
              handleGoogleAuth={handleGoogleAuth}
              handlePasswordReset={handlePasswordReset}
              onPrimary={accountMode === "SIGN_IN" ? handleAccountContinue : handleCreate}
              onContinueAccount={() => setStep(2)}
              onChangeAccount={() => handleSignOut(1)}
              googleAuthEnabled={GOOGLE_AUTH_ENABLED}
            />
            <DesktopAccountPrimer accountMode={accountMode} />

            <div className="hidden md:block">
            <OnboardingCard
              icon={<LockKeyhole size={28} />}
              title={accountMode === "SIGN_IN" ? "Connexion vendeur" : "Creer le compte"}
              subtitle={accountMode === "SIGN_IN" ? "Numero WhatsApp ou email." : "3 infos. Ensuite vous ajoutez vos articles."}
            >
              {sellerAccount?.id && (
                <div className="mb-4 rounded-[20px] border border-[var(--outline)]/45 bg-[var(--surface-soft)] p-3">
                  <p className="text-sm font-extrabold text-[var(--text-main)]">Compte deja connecte</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                    Continuez avec ce compte ou choisissez un autre numero.
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
                      onClick={() => handleSignOut(1)}
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
                googleAuthEnabled={GOOGLE_AUTH_ENABLED}
              />

              <button
                type="button"
                disabled={!canContinue() || saving}
                onClick={accountMode === "SIGN_IN" ? handleAccountContinue : handleCreate}
                className="mt-4 hidden min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-base font-extrabold text-white shadow-[0_18px_34px_rgba(0,143,90,0.20)] disabled:bg-[var(--outline)] md:flex"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={19} />}
                {accountMode === "SIGN_IN" ? "Entrer dans mon espace" : "Creer ma boutique"}
              </button>

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

            {GOOGLE_AUTH_ENABLED && (
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
            )}

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
                  : "Votre numero sert a vous reconnecter et configurer votre WhatsApp de vente."}
              </p>
            </div>
            </>
            )}
            </OnboardingCard>
            </div>
          </section>
        )}

        {step === 2 && (
          <OnboardingCard
            icon={<Store size={28} />}
            title="Identite boutique"
            subtitle="Nom, WhatsApp et devise."
          >
            <div className="space-y-4">
              <AuthInput
                label="Nom boutique"
                icon={<Store size={19} />}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ex: Amina Mode"
                autoComplete="organization"
              />
              <PhoneInput
                label="WhatsApp boutique"
                icon={<MessageCircle size={19} />}
                value={form.phone_number}
                onValueChange={(nextPhone) => updateField("phone_number", nextPhone)}
              />
              <ProductProfilePicker
                value={form.product_profile}
                onChange={(value) => updateField("product_profile", value)}
              />
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[22px] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--outline)]/45">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--text-dim)]">Lien boutique</p>
                  <p className="mt-1 break-all text-base font-black text-[var(--primary)]">tikchop/{suggestedSlug || "ma-boutique"}</p>
                </div>
                <span className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[var(--text-main)] shadow-sm ring-1 ring-[var(--outline)]/40">
                  XOF
                </span>
              </div>
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
                    title="Livraison reglee a reception"
                    text="Tres courant a Abidjan"
                    onClick={() => updateField("delivery_payment_timing", "AT_RECEPTION")}
                  />
                  <ChoiceButton
                    active={form.delivery_payment_timing === "INCLUDED"}
                    title="Livraison reglee avec la commande"
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

        {step > 1 && step <= totalSetupSteps && !(step === 1 && existingSeller) && (
        <div className={`fixed inset-x-0 bottom-0 z-[320] border-t border-[var(--outline)]/25 bg-white/96 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-14px_30px_rgba(22,29,25,0.11)] backdrop-blur-xl ${step === 1 ? "md:hidden" : "md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0"}`}>
          {step === 1 && (
            <button
              type="button"
              disabled={!canContinue() || saving}
              onClick={accountMode === "SIGN_IN" ? handleAccountContinue : handleCreate}
              className="mx-auto flex min-h-[52px] w-full max-w-[460px] items-center justify-center gap-2 rounded-xl bg-[#008f5a] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={19} />}
              {accountMode === "SIGN_IN" ? "Se connecter" : "Ouvrir ma boutique"}
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!canContinue() || saving}
              onClick={handleCreate}
              className="mx-auto flex min-h-[52px] w-full max-w-[460px] items-center justify-center gap-2 rounded-xl bg-[#008f5a] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              Ouvrir ma boutique
            </button>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

function OnboardingLandingHero({ onStart, onSignIn }) {
  return (
    <>
    <section className="flex h-[100dvh] flex-col justify-between p-5 text-white md:hidden bg-[#07120d] relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gradient from-[rgba(0,143,90,0.15)] to-transparent pointer-events-none" />
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#008f5a] font-display text-base font-black text-[#fbf9f4]" aria-hidden="true">T</span>
          <span className="font-display text-lg font-bold tracking-tight text-[#fbf9f4]">Tikchop</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[#fbf9f4]/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--primary-bright)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary-bright)]" />
          Live
        </span>
      </header>

      <div className="my-auto py-3 flex flex-col gap-4 z-10">
        <div className="relative mx-auto h-[175px] w-full max-w-[340px] overflow-hidden rounded-[20px]">
          <img
            src="/landing/fatim-jeune-friperie.jpg"
            alt="Vendre en ligne"
            className="h-full w-full object-cover object-[center_22%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07120d] via-[#07120d]/40 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-[#07120d]/80 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
            <Bot size={13} className="text-[#008f5a]" />
            Assistant 24h/24
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-[1.75rem] font-bold leading-[2.1rem] tracking-tight text-[#fbf9f4]">
            Laissez WhatsApp<br />vendre à votre place.
          </h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#fbf9f4]/75 px-4">
            Ajoutez vos articles. Tikchop répond à vos clients, encaisse Wave/Orange et gère la livraison.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4]/5 p-2">
          <PaymentLogo src="/payment-logos/wave.png" label="Wave" size="normal" />
          <PaymentLogo src="/payment-logos/orange-money.svg" label="Orange Money" size="wide" />
          <PaymentLogo src="/payment-logos/mtn-momo.png" label="MTN MoMo" size="large" />
          <PaymentLogo src="/payment-logos/djamo.png" label="Djamo" size="large" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 z-10">
        <Link
          href="/onboarding?step=account"
          onClick={(event) => {
            event.preventDefault();
            onStart();
          }}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#008f5a] text-sm font-extrabold text-[#fbf9f4] no-underline transition active:scale-[0.98]"
        >
          Créer ma boutique
          <ArrowRight size={17} />
        </Link>
        <button
          type="button"
          onClick={onSignIn}
          className="text-center text-xs font-bold text-[#fbf9f4]/60 hover:text-white py-1"
        >
          J&apos;ai déjà un compte
        </button>
      </div>
    </section>
    <DesktopOnboardingHero onStart={onStart} onSignIn={onSignIn} />
    </>
  );
}

function DesktopOnboardingHero({ onStart, onSignIn }) {
  return (
    <section className="hidden h-[calc(100vh-3rem)] min-h-[720px] w-full overflow-hidden rounded-[28px] border border-[#d9e2dd] bg-[#f7faf8] shadow-[0_34px_90px_rgba(8,18,13,0.16)] md:block">
      <header className="grid h-[68px] grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-[#dfe7e2] bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="tk-logo-mark flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07120d] font-display text-lg font-black text-[var(--primary-bright)]" aria-hidden="true" />
          <div>
            <strong className="block font-display text-xl font-black text-[#07120d]">Tikchop Store</strong>
            <span className="block text-xs font-bold text-[#6b7a72]">Assistant vendeur WhatsApp</span>
          </div>
        </div>
        <div className="mx-auto flex h-11 w-full max-w-[420px] items-center justify-between rounded-xl bg-[#f0f3f1] px-4 text-sm font-bold text-[#7b8781]">
          <span>Rechercher un article...</span>
          <Package size={17} />
        </div>
        <nav className="flex items-center gap-2 text-sm font-extrabold text-[#34453c]" aria-label="Actions Tikchop">
          <button type="button" onClick={onSignIn} className="h-11 rounded-xl px-4 hover:bg-[#f0f3f1]">
            Connexion
          </button>
          <button type="button" onClick={onStart} className="h-11 rounded-xl bg-[#07120d] px-5 text-white shadow-[0_16px_30px_rgba(7,18,13,0.16)]">
            Creer ma boutique
          </button>
        </nav>
      </header>

      <div className="grid h-[calc(100%-68px)] grid-cols-[360px_1fr]">
        <aside className="relative overflow-hidden bg-[#101a15] p-6 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/fatim-jeune-friperie.jpg"
            alt="Fatim avec ses articles"
            className="absolute inset-0 h-full w-full object-cover object-[48%_center] opacity-78"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,13,0.10),rgba(7,18,13,0.22)_42%,#07120d_100%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#07120d]/76 px-4 py-2 text-sm font-black text-[var(--primary-bright)] ring-1 ring-white/10 backdrop-blur-md">24h/24</span>
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#07120d] shadow-[0_18px_34px_rgba(0,0,0,0.18)]">
                <Bot size={17} />
                Il vend
              </span>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary-bright)]">Cas Fatim</p>
              <h2 className="mt-3 font-display text-4xl font-black leading-[1.02]">La boutique reste ouverte meme quand elle prepare les colis.</h2>
              <div className="mt-5 flex items-center gap-2 rounded-[22px] bg-white/14 p-2 ring-1 ring-white/14 backdrop-blur-md">
                <PaymentLogo src="/payment-logos/wave.png" label="Wave" size="normal" />
                <PaymentLogo src="/payment-logos/orange-money.svg" label="Orange Money" size="wide" />
                <PaymentLogo src="/payment-logos/mtn-momo.png" label="MTN MoMo" size="large" />
                <PaymentLogo src="/payment-logos/djamo.png" label="Djamo" size="large" />
              </div>
            </div>
          </div>
        </aside>

        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-5 p-6">
          <main className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Vendre mieux sur WhatsApp</p>
                <h1 className="mt-2 max-w-[650px] font-display text-[2.65rem] font-black leading-[1.02] text-[#07120d]">
                  Une boutique web claire, un vendeur WhatsApp automatique.
                </h1>
                <p className="mt-3 max-w-[660px] text-base font-semibold leading-6 text-[#4d6258]">
                  Ajoutez photos et prix. Tikchop presente les articles, conseille le client, encaisse et prepare la livraison avec vos livreurs.
                </p>
              </div>
              <div className="hidden grid-cols-3 gap-2 rounded-[18px] bg-white p-2 shadow-[0_18px_42px_rgba(8,18,13,0.07)] ring-1 ring-[#dfe7e2]">
                <DesktopHeroMetric value="7j" label="essai" />
                <DesktopHeroMetric value="24h" label="vente" />
                <DesktopHeroMetric value="0 tuto" label="simple" />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 border-b border-[#dfe7e2] pb-3">
              {["Tous les articles", "Pagne", "Sacs", "Beaute"].map((item, index) => (
                <span key={item} className={`rounded-xl px-4 py-2 text-sm font-black ${index === 0 ? "bg-[#07120d] text-white" : "bg-white text-[#4d6258] ring-1 ring-[#dfe7e2]"}`}>
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <DesktopProductCard image="/landing/raffia-bags.jpg" name="Sac raphia" price="10 000 F" tag="Disponible" />
              <DesktopProductCard image="/landing/fabric-display.jpg" name="Pagne wax" price="15 000 F" tag="Top vente" />
              <DesktopProductCard image="/landing/shea-butter.jpg" name="Karite naturel" price="4 500 F" tag="Livrable" />
            </div>

          </main>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_42px_rgba(8,18,13,0.08)] ring-1 ring-[#dfe7e2]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7b8781]">Menu boutique</p>
              <div className="mt-4 grid gap-2">
                <DesktopMenuItem icon={<Store size={18} />} label="Catalogue" active />
                <DesktopMenuItem icon={<MessageCircle size={18} />} label="WhatsApp" />
                <DesktopMenuItem icon={<Truck size={18} />} label="Livraison" />
              </div>
            </div>
            <div className="rounded-[24px] bg-white p-4 shadow-[0_18px_42px_rgba(8,18,13,0.08)] ring-1 ring-[#dfe7e2]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Lancement</p>
              <h3 className="mt-2 font-display text-2xl font-black leading-7 text-[#07120d]">Dort tranquille, Tikchop gere.</h3>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#607469]">Le client voit les articles, pose ses questions, paie et recoit son recu.</p>
              <div className="mt-4 space-y-2 rounded-2xl bg-[#07120d] p-3 text-xs font-bold text-white/78">
                <DesktopOrderLine icon={<Package size={15} />} text="Commande creee" />
                <DesktopOrderLine icon={<Banknote size={15} />} text="Paiement confirme" />
                <DesktopOrderLine icon={<Truck size={15} />} text="Livreur notifie" />
              </div>
              <button type="button" onClick={onStart} className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07120d] text-sm font-black text-white">
                Creer ma boutique
                <ArrowRight size={18} />
              </button>
              <button type="button" onClick={onSignIn} className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-[#eef5f1] text-sm font-black text-[#07120d]">
                Deja inscrit
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function DesktopHeroMetric({ value, label }) {
  return (
    <div className="min-w-[66px] rounded-xl bg-[#f7faf8] px-3 py-2 text-center">
      <strong className="block font-display text-lg font-black text-[#07120d]">{value}</strong>
      <span className="block text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#7b8781]">{label}</span>
    </div>
  );
}

function DesktopProductCard({ image, name, price, tag }) {
  return (
    <article className="overflow-hidden rounded-[22px] bg-white shadow-[0_18px_42px_rgba(8,18,13,0.07)] ring-1 ring-[#dfe7e2]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={name} className="h-28 w-full object-cover" />
      <div className="p-3">
        <span className="rounded-full bg-[#e8f9ee] px-2.5 py-1 text-[0.68rem] font-black uppercase text-[var(--primary)]">{tag}</span>
        <h3 className="mt-2 truncate font-display text-sm font-black text-[#07120d]">{name}</h3>
        <p className="mt-1 whitespace-nowrap font-display text-lg font-black text-[var(--primary)]">{price}</p>
      </div>
    </article>
  );
}

function DesktopOrderLine({ icon, text }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-2xl bg-white/10 p-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-bright)] text-[#07120d]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function DesktopMenuItem({ icon, label, active = false }) {
  return (
    <div className={`grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black ${active ? "bg-[#07120d] text-white" : "bg-[#f2f5f3] text-[#4d6258]"}`}>
      <span className={active ? "text-[var(--primary-bright)]" : "text-[var(--primary)]"}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function DashboardRedirectLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <section className="w-full max-w-[360px] rounded-[24px] bg-white p-5 text-center shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <Loader2 className="animate-spin" size={22} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">Ouverture du dashboard</h1>
        <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
          Votre boutique est deja connectee.
        </p>
      </section>
    </div>
  );
}

function OnboardingBootShell() {
  return (
    <div className="onboarding-shell flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <section className="w-full max-w-[320px] text-center">
        <span className="tk-logo-mark mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--primary)] font-display text-2xl font-black text-white shadow-[0_18px_38px_rgba(27,163,74,0.2)]" aria-hidden="true" />
        <h1 className="mt-5 font-display text-2xl font-black text-[var(--text-main)]">Tikchop</h1>
        <p className="mt-2 text-sm font-bold text-[var(--text-dim)]">Ouverture de votre espace vendeur...</p>
        <Loader2 className="mx-auto mt-5 animate-spin text-[var(--primary)]" size={24} />
      </section>
    </div>
  );
}

function HeroProof({ icon, label }) {
  return (
    <div className="flex min-h-[52px] flex-col items-center justify-center rounded-2xl bg-white/10 px-2 text-center text-xs font-extrabold text-white ring-1 ring-white/12 md:min-h-[72px] md:text-sm">
      <span className="text-[var(--primary-bright)]">{icon}</span>
      <span className="mt-1">{label}</span>
    </div>
  );
}

function DesktopAccountPrimer({ accountMode }) {
  return (
    <aside className="hidden overflow-hidden rounded-[28px] bg-[#07120d] text-white shadow-[var(--shadow-lg)] md:block">
      <div className="relative h-full min-h-[560px] p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/onboarding-seller-phone.jpg"
          alt="Vendeuse Tikchop"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.42]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,13,0.28),#07120d_72%)]" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary-bright)]">
              {accountMode === "SIGN_IN" ? "Retour vendeur" : "Demarrage rapide"}
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[1.02]">
              {accountMode === "SIGN_IN" ? "Retrouvez votre boutique." : "Votre vendeur WhatsApp est pret."}
            </h2>
          </div>

          <div className="space-y-3">
            <DesktopAccountStep icon={<Store size={18} />} title="Compte" text="Numero WhatsApp ou email." />
            <DesktopAccountStep icon={<Package size={18} />} title="Articles" text="Ajoutez photos et prix." />
            <DesktopAccountStep icon={<Bot size={18} />} title="Vente" text="Tikchop repond, encaisse et notifie." />
          </div>
        </div>
      </div>
    </aside>
  );
}

function DesktopAccountStep({ icon, title, text }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/12 backdrop-blur-md">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[#07120d]">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="mt-0.5 block text-sm font-semibold leading-5 text-white/70">{text}</span>
      </span>
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
    <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white px-2 shadow-[0_10px_20px_rgba(0,0,0,0.16)] md:h-14" aria-label={label} title={label}>
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

function ProductProfilePicker({ value, onChange }) {
  return (
    <div className="rounded-[22px] bg-white p-3 shadow-[0_4px_18px_rgba(13,23,18,0.04)] ring-1 ring-[#07120d]/7">
      <div className="mb-2 flex items-center gap-2">
        <Package size={15} className="text-[#008f5a]" />
        <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#4e6055]">Vous vendez</p>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {PRODUCT_PROFILES.map((profile) => {
          const active = value === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onChange(profile.id)}
              className={`min-h-[40px] shrink-0 rounded-full px-3 text-xs font-black transition active:scale-[0.98] ${
                active
                  ? "bg-[#07120d] text-white"
                  : "bg-[#fbf9f4] text-[#07120d] ring-1 ring-[#07120d]/8"
              }`}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileAccountPanel({
  accountMode,
  accountMethod,
  form,
  saving,
  resetSent,
  sellerAccount,
  canContinue,
  setAccountMode,
  switchAccountMethod,
  updateField,
  handleGoogleAuth,
  handlePasswordReset,
  onPrimary,
  onContinueAccount,
  onChangeAccount,
  googleAuthEnabled,
}) {
  const isSignIn = accountMode === "SIGN_IN";
  const isPhone = accountMethod === "PHONE";

  return (
    <section className="md:hidden">
      <div className="flex min-h-[100dvh] flex-col justify-between pb-4 bg-[#fbf9f4]">
        {/* Premium Header Block */}
        <div>
          <div className="relative overflow-hidden bg-gradient-to-b from-[#07120d] to-[#122b1f] px-5 pb-6 pt-[calc(1.2rem+env(safe-area-inset-top,0px))] text-white shadow-md">
            {/* Background glowing pattern */}
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#008f5a]/10 blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#008f5a] font-display text-base font-black text-white shadow-lg" aria-hidden="true">T</span>
                <strong className="font-display text-lg font-black tracking-tight">Tikchop</strong>
              </div>
              <Link
                href="/"
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 transition active:bg-white/20 no-underline"
              >
                <X size={16} />
              </Link>
            </div>

            <div className="mt-5">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">Tikchop Seller</p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
                {isSignIn ? "Bon retour parmi nous" : "Créer ma boutique en 10s"}
              </h1>
              <p className="mt-1 text-xs text-white/60 font-semibold leading-relaxed">
                {isSignIn ? "Connectez-vous pour gérer votre boutique mobile." : "Pas besoin d'ordinateur. Tout se gère depuis WhatsApp."}
              </p>
            </div>

            {/* Trust Signal Badges */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <AuthTrustPill icon="⚡" label="En 10 secondes" />
              <AuthTrustPill icon="📱" label="100% Mobile" />
              <AuthTrustPill icon="🆓" label="Gratuit & sans carte" />
            </div>
          </div>

          {/* Form Content */}
          <div className="px-5 pt-5">
            {/* Tab switchers */}
            <div className="flex rounded-2xl bg-[#07120d]/5 p-0.5 ring-1 ring-[#07120d]/5">
              <button
                type="button"
                onClick={() => switchAccountMethod("PHONE")}
                className={`flex-1 flex min-h-[38px] items-center justify-center gap-1.5 rounded-[14px] text-xs font-bold transition-all duration-250 ${
                  isPhone ? "bg-white text-[#07120d] shadow-sm" : "text-[#07120d]/60"
                }`}
              >
                <MessageCircle size={14} />
                Numéro WhatsApp
              </button>
              <button
                type="button"
                onClick={() => switchAccountMethod("EMAIL")}
                className={`flex-1 flex min-h-[38px] items-center justify-center gap-1.5 rounded-[14px] text-xs font-bold transition-all duration-250 ${
                  !isPhone ? "bg-white text-[#07120d] shadow-sm" : "text-[#07120d]/60"
                }`}
              >
                <Mail size={14} />
                Adresse Email
              </button>
            </div>

            <div className="mt-5 space-y-3.5">
              {sellerAccount?.id && (
                <div className="rounded-[22px] bg-white p-4 shadow-[0_4px_18px_rgba(13,23,18,0.06)] ring-1 ring-[#07120d]/5">
                  <p className="text-xs font-bold text-[#07120d] text-center">Compte déjà connecté</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onContinueAccount}
                      className="min-h-[40px] rounded-xl bg-[#008f5a] text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-[0.98] transition"
                    >
                      Continuer
                    </button>
                    <button
                      type="button"
                      onClick={onChangeAccount}
                      className="min-h-[40px] rounded-xl bg-[#07120d]/5 text-xs font-bold text-[#07120d] active:scale-[0.98] transition"
                    >
                      Changer
                    </button>
                  </div>
                </div>
              )}

              {isPhone ? (
                <div>
                  <PhoneInput
                    label="Numéro WhatsApp"
                    icon={<MessageCircle size={17} />}
                    value={form.account_phone}
                    onValueChange={(nextPhone) => {
                      updateField("account_phone", nextPhone);
                      if (!form.phone_number || form.phone_number === form.account_phone) {
                        updateField("phone_number", nextPhone);
                      }
                    }}
                    autoComplete="tel"
                  />
                  <p className="mt-1.5 px-1 text-[0.68rem] font-bold text-[#07120d]/40">
                    Sera utilisé comme identifiant de votre boutique.
                  </p>
                </div>
              ) : (
                <AuthInput
                  label="Adresse Email"
                  icon={<Mail size={17} />}
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="vendeur@email.com"
                  inputMode="email"
                  autoComplete="email"
                />
              )}

              {!isSignIn && (
                <AuthInput
                  label="Nom de votre boutique"
                  icon={<Store size={17} />}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Ex: Amina Boutique"
                  autoComplete="organization"
                />
              )}

              {!isSignIn && (
                <ProductProfilePicker
                  value={form.product_profile}
                  onChange={(value) => updateField("product_profile", value)}
                />
              )}

              {!isSignIn && !isPhone && (
                <PhoneInput
                  label="WhatsApp boutique"
                  icon={<MessageCircle size={17} />}
                  value={form.phone_number}
                  onValueChange={(nextPhone) => updateField("phone_number", nextPhone)}
                  autoComplete="tel"
                />
              )}

              <AuthInput
                label="Mot de passe"
                icon={<LockKeyhole size={17} />}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder={isSignIn ? "Votre mot de passe" : "Minimum 6 caractères"}
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
              />
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="mt-6 px-5 space-y-3">
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={onPrimary}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#008f5a] text-sm font-extrabold text-white shadow-lg shadow-[#008f5a]/20 hover:bg-[#007a4d] disabled:bg-[#07120d]/20 disabled:shadow-none disabled:text-[#07120d]/40 transition active:scale-[0.98]"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {saving ? (isSignIn ? "Connexion en cours..." : "Création de la boutique...") : (isSignIn ? "Se connecter" : "Lancer ma boutique")}
          </button>

          {googleAuthEnabled && (
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={saving}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-white border border-[#07120d]/10 text-xs font-bold text-[#07120d] hover:bg-zinc-50 disabled:opacity-60 transition active:scale-[0.98]"
            >
              <GoogleMark />
              Continuer avec Google
            </button>
          )}

          {isSignIn && !isPhone && (
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={saving}
              className="w-full text-center text-xs font-bold text-[#008f5a] hover:underline disabled:text-[#07120d]/40"
            >
              Mot de passe oublié ?
            </button>
          )}

          {resetSent && (
            <p className="rounded-xl bg-emerald-50 py-2 text-center text-xs font-bold text-emerald-800 ring-1 ring-emerald-100 animate-pulse">
              Email de réinitialisation envoyé.
            </p>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                if (isSignIn) {
                  setAccountMode("SIGN_UP");
                  switchAccountMethod("PHONE");
                } else {
                  setAccountMode("SIGN_IN");
                }
              }}
              className="text-xs font-black text-[#008f5a] hover:text-[#007a4d]"
            >
              {isSignIn ? "Créer une nouvelle boutique →" : "J'ai déjà un compte vendeur →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileAuthMethodPill({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[50px] items-center justify-center gap-2 rounded-[24px] px-4 text-base font-black transition active:scale-[0.99] ${
        active ? "bg-[#e8f8ee] text-[var(--primary)]" : "bg-[#f0f0f0] text-[var(--text-dim)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
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
  googleAuthEnabled,
}) {
  const isSignIn = accountMode === "SIGN_IN";
  const isPhone = accountMethod === "PHONE";

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] bg-[var(--surface-soft)] p-3">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => switchAccountMethod("PHONE")}
            className={`min-h-[46px] rounded-2xl px-3 text-sm font-extrabold ${
              isPhone
                ? "bg-[var(--text-main)] text-white shadow-sm"
                : "bg-white text-[var(--text-dim)] ring-1 ring-[var(--outline)]/45"
            }`}
          >
            Numero WhatsApp
          </button>
          <button
            type="button"
            onClick={() => switchAccountMethod("EMAIL")}
            className={`min-h-[46px] rounded-2xl px-3 text-sm font-extrabold ${
              !isPhone
                ? "bg-[var(--text-main)] text-white shadow-sm"
                : "bg-white text-[var(--text-dim)] ring-1 ring-[var(--outline)]/45"
            }`}
          >
            Email
          </button>
        </div>

        {isPhone ? (
          <>
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
            <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-4 text-[var(--text-dim)] ring-1 ring-[var(--outline)]/45">
              Aucun code SMS. Le numero sert d&apos;identifiant pour retrouver la boutique.
            </p>
          </>
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

        {!isSignIn && !isPhone && (
          <PhoneInput
            label="Numero WhatsApp boutique"
            icon={<MessageCircle size={19} />}
            value={form.phone_number}
            onValueChange={(nextPhone) => updateField("phone_number", nextPhone)}
            autoComplete="tel"
          />
        )}

        {!isSignIn && (
          <AuthInput
            className="mt-3"
            label="Nom de la boutique"
            icon={<Store size={19} />}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Ex: Amina Mode"
            autoComplete="organization"
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

      </div>

      {!isSignIn && (
        <div className="rounded-[18px] bg-white p-3 text-sm font-bold leading-5 text-[var(--text-dim)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/45">
          Votre lien sera <span className="text-[var(--primary)]">tikchop/{slugify(form.name) || "ma-boutique"}</span>. Vous pourrez ajouter les articles juste apres.
        </div>
      )}

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

      {googleAuthEnabled && (
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={saving}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[var(--text-main)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/55 disabled:opacity-60"
        >
          <GoogleMark />
          Google
        </button>
      )}

      {isSignIn && (
        <button
          type="button"
          onClick={() => {
            setAccountMode("SIGN_UP");
            switchAccountMethod("PHONE");
          }}
          className="w-full text-center text-sm font-extrabold text-[var(--primary)]"
        >
          Creer une nouvelle boutique
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
