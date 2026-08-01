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
    <div className={`app-shell onboarding-shell ${step === 0 ? "pb-0 md:min-h-0 md:w-full md:max-w-[1320px]" : step === 1 ? "min-h-screen !max-w-none !w-full" : "min-h-screen"}`}>
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
    <section className="relative flex h-[100dvh] md:h-auto md:min-h-[600px] flex-col justify-between overflow-hidden bg-[#fbf9f4] p-6 text-[#07120d] w-full max-w-[440px] mx-auto md:rounded-[32px] md:shadow-[0_24px_60px_rgba(7,18,13,0.06)] md:border md:border-[#07120d]/5 md:my-12 animate-fade-in">
      <div className="pointer-events-none absolute -right-20 top-20 h-56 w-56 rounded-full bg-[#39f58e]/20 blur-3xl" />
      
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#07120d] font-display text-base font-black text-[#39f58e]" aria-hidden="true">T</span>
          <span className="font-display text-xl font-black tracking-tight">Tikchop</span>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#07120d] shadow-[0_10px_24px_rgba(7,18,13,0.08)] ring-1 ring-[#07120d]/8"
        >
          Connexion
        </button>
      </header>

      <div className="relative z-10 my-auto flex flex-col items-center text-center gap-6 py-8">
        <svg viewBox="0 0 200 200" className="w-40 h-40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="80" fill="#008f5a" fillOpacity="0.08" />
          <rect x="60" y="80" width="80" height="60" rx="16" fill="white" stroke="#07120d" strokeWidth="6" />
          <path d="M54 80C54 70 60 62 70 62H130C140 62 146 70 146 80" stroke="#07120d" strokeWidth="6" strokeLinecap="round" />
          <circle cx="78" cy="110" r="8" fill="#39f58e" />
          <circle cx="122" cy="110" r="8" fill="#008f5a" />
          <rect x="90" y="102" width="20" height="24" rx="4" fill="#07120d" />
          <path d="M130 50C130 40 140 32 152 32C164 32 174 40 174 50C174 60 164 68 152 68C146 68 142 66 138 62L130 68L132 58C130.8 55.6 130 53 130 50Z" fill="#39f58e" stroke="#07120d" strokeWidth="4" strokeLinejoin="round" />
        </svg>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008f5a]">Boutique en ligne + WhatsApp</p>
          <h1 className="mt-3 font-display text-[2.5rem] font-black leading-[1.05] tracking-tight text-[#07120d]">
            Créez votre boutique
          </h1>
          <p className="mt-3 max-w-[290px] text-sm font-medium leading-relaxed text-[#07120d]/60">
            Publiez vos articles, recevez les ventes et suivez vos clients simplement.
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2.5">
        <Link
          href="/onboarding?step=account"
          onClick={(event) => {
            event.preventDefault();
            onStart();
          }}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-black text-white no-underline shadow-[0_18px_34px_rgba(0,143,90,0.24)] transition active:scale-[0.98]"
        >
          Créer ma boutique
          <ArrowRight size={17} />
        </Link>
        <button
          type="button"
          onClick={onSignIn}
          className="py-1 text-center text-xs font-black text-[#07120d]/55 hover:text-[#07120d]"
        >
          J&apos;ai déjà un compte
        </button>
      </div>
    </section>
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
    <div className="rounded-[18px] bg-[#fbf9f4] p-2.5 ring-1 ring-[#07120d]/8">
      <div className="mb-1.5 flex items-center gap-2">
        <Package size={15} className="text-[#008f5a]" />
        <p className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#4e6055]">Type d&apos;articles</p>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {PRODUCT_PROFILES.map((profile) => {
          const active = value === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onChange(profile.id)}
              className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-black transition active:scale-[0.98] ${
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
    <section className="md:hidden -mt-[calc(0.45rem+env(safe-area-inset-top,0px))] ml-[calc(50%-50vw)] w-screen overflow-x-hidden bg-[#fbf9f4]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-[#fbf9f4] px-5 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Retour"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#07120d] no-underline shadow-[0_10px_22px_rgba(7,18,13,0.06)] ring-1 ring-[#07120d]/8"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#07120d] font-display text-sm font-black text-[#39f58e]" aria-hidden="true">T</span>
            <strong className="font-display text-lg font-black text-[#07120d]">Tikchop</strong>
          </div>
          <span className="h-11 w-11" aria-hidden="true" />
        </header>

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008f5a]">
            {isSignIn ? "Accès vendeur" : "Nouvelle boutique"}
          </p>
          <h1 className="mt-1.5 font-display text-[1.78rem] font-black leading-[1.03] tracking-tight text-[#07120d]">
            {isSignIn ? "Connectez-vous." : "Créez votre accès."}
          </h1>
          <p className="mt-1.5 max-w-[300px] text-[0.82rem] font-bold leading-5 text-[#4a6055]">
            {isSignIn ? "Numéro WhatsApp ou email." : "Un compte, puis votre boutique."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-[20px] bg-white p-1 shadow-[0_12px_28px_rgba(7,18,13,0.05)] ring-1 ring-[#07120d]/8">
          <button
            type="button"
            onClick={() => {
              setAccountMode("SIGN_UP");
              switchAccountMethod("PHONE");
            }}
            className={`min-h-[42px] rounded-[16px] text-sm font-black transition ${
              !isSignIn ? "bg-[#07120d] text-white shadow-[0_12px_22px_rgba(7,18,13,0.16)]" : "text-[#07120d]/50"
            }`}
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => setAccountMode("SIGN_IN")}
            className={`min-h-[42px] rounded-[16px] text-sm font-black transition ${
              isSignIn ? "bg-[#07120d] text-white shadow-[0_12px_22px_rgba(7,18,13,0.16)]" : "text-[#07120d]/50"
            }`}
          >
            Connexion
          </button>
        </div>

        <div className="mt-3 rounded-[24px] bg-white p-3.5 shadow-[0_16px_38px_rgba(7,18,13,0.06)] ring-1 ring-[#07120d]/8">
          <div className="flex rounded-[18px] bg-[#07120d]/5 p-1">
              <button
                type="button"
                onClick={() => switchAccountMethod("PHONE")}
                className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[14px] text-xs font-black transition-all duration-250 ${
                  isPhone ? "bg-white text-[#07120d] shadow-sm" : "text-[#07120d]/60"
                }`}
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => switchAccountMethod("EMAIL")}
                className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[14px] text-xs font-black transition-all duration-250 ${
                  !isPhone ? "bg-white text-[#07120d] shadow-sm" : "text-[#07120d]/60"
                }`}
              >
                <Mail size={14} />
                Email
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {sellerAccount?.id && (
                <div className="rounded-[22px] bg-[#ecfff4] p-4 ring-1 ring-[#008f5a]/18">
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
                </div>
              ) : (
                <AuthInput
                  label="Email"
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

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={onPrimary}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#008f5a] text-base font-black text-white shadow-[0_16px_30px_rgba(0,143,90,0.22)] transition active:scale-[0.98] disabled:bg-[#07120d]/16 disabled:text-[#07120d]/35 disabled:shadow-none"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {saving ? (isSignIn ? "Connexion..." : "Création...") : (isSignIn ? "Se connecter" : "Créer ma boutique")}
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

          <div className="pt-1 text-center">
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
              className="text-xs font-black text-[#008f5a]"
            >
              {isSignIn ? "Créer une boutique" : "J'ai déjà un compte"}
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
      <span className="mb-1 block text-[0.84rem] font-extrabold text-[var(--text-main)]">{label}</span>
      <div className="flex min-h-[52px] items-center gap-3 rounded-[17px] border border-[var(--outline)]/60 bg-white px-4 shadow-[0_10px_22px_rgba(13,23,18,0.045)] transition focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_rgba(0,143,90,0.12)]">
        <span className="shrink-0 text-[var(--primary)]">{icon}</span>
        <input
          {...props}
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] font-extrabold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
        />
      </div>
    </label>
  );
}

function PhoneInput({ className = "", label, icon, value, onValueChange, autoComplete = "tel" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[0.84rem] font-extrabold text-[var(--text-main)]">{label}</span>
      <div className="flex min-h-[52px] items-center gap-2 rounded-[17px] border border-[var(--outline)]/60 bg-white px-3 shadow-[0_10px_22px_rgba(13,23,18,0.045)] transition focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_rgba(0,143,90,0.12)]">
        <span className="shrink-0 text-[var(--primary)]">{icon}</span>
        <span className="flex h-8 shrink-0 items-center rounded-xl bg-[var(--surface-soft)] px-3 text-sm font-black text-[var(--primary)] ring-1 ring-[var(--primary)]/12">
          +225
        </span>
        <input
          value={getIvorianLocalPart(value)}
          onChange={(event) => onValueChange(withIvorianPrefix(event.target.value))}
          placeholder="07 00 00 00 00"
          inputMode="tel"
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] font-extrabold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
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
