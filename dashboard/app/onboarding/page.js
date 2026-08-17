"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createSellerAccountAndShop, getSellerByOwner, createSellerFromOnboarding, requestLoginOtp, verifyLoginOtp } from "../seller-actions";
import { clearActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/user-facing-error";
import {
  slugify,
  buildFullPhone,
  hasValidLocalPhone,
  getPhoneAliasEmail,
  withTimeout,
  signInWithPasswordControlled,
  getPasswordStrength,
} from "../../lib/onboarding-utils";
import { resolveSellerLanding } from "../../lib/seller-landing";
import { OnboardingSplash } from "./components/OnboardingSplash";
import { AccountStep } from "./components/AccountStep";
import { ShopStep } from "./components/ShopStep";
import { OtpStep } from "./components/OtpStep";

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  // step 0=splash, 1=account, 2=boutique info (signup only)
  const [step, setStep] = useState(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signin") return 1;
    return 0;
  });
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signin") return "SIGN_IN";
    return "SIGN_UP";
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sellerAccount, setSellerAccount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");

  // Step 1 — account
  const [localPhone, setLocalPhone] = useState(""); // only the digits after +225
  const [password, setPassword] = useState("");

  // Step 2 — boutique info
  const [shopName, setShopName] = useState("");
  const [shopCategory, setShopCategory] = useState("");
  const [shopCity, setShopCity] = useState("");
  const [shopCommune, setShopCommune] = useState("");

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
        if (seller && active) {
          writeActiveSeller(seller);
          const landing = await resolveSellerLanding(seller);
          if (active) window.location.replace(landing);
        }
        else if (active) { setSellerAccount(user); setStep(1); setMode("SIGN_IN"); }
      } catch { /* silent */ }
    }

    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("new") === "1") {
      clearActiveSeller();
      if (supabase) supabase.auth.signOut().catch(() => {});
    } else if (params.get("mode") !== "signin") {
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
          if (seller) {
            writeActiveSeller(seller);
            const landing = await resolveSellerLanding(seller);
            window.location.replace(landing);
            return;
          }
          setSellerAccount(fallback.data.user);
          throw new Error("Compte trouvé mais aucune boutique. Créez votre boutique.");
        }
        const seller = await withTimeout(getSellerByOwner(data.user?.id, data.session?.access_token), "Chargement trop long.", 10000);
        if (seller) {
          writeActiveSeller(seller);
          const landing = await resolveSellerLanding(seller);
          window.location.replace(landing);
          return;
        }
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

  // ── WhatsApp OTP sign-in ─────────────────────────────────────────────────────
  async function handleRequestOtp() {
    setError(""); setNotice("");
    const fullPhone = buildFullPhone(localPhone);
    try {
      const result = await requestLoginOtp(fullPhone);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOtpPhone(fullPhone);
      setStep(3);
    } catch (err) {
      setError(friendlyError(err, "Impossible d'envoyer le code. Réessayez."));
    }
  }

  async function handleResendOtp() {
    const result = await requestLoginOtp(buildFullPhone(localPhone));
    if (!result.ok) throw new Error(result.error);
  }

  async function handleVerifyOtp(code) {
    const result = await verifyLoginOtp(otpPhone, code);
    if (!result.ok) throw new Error(result.error);
    if (!supabase) throw new Error("Connexion indisponible.");

    const { data, error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" });
    if (error || !data.session) throw new Error("Connexion impossible. Réessayez.");

    const user = data.session.user;
    const seller = await withTimeout(
      getSellerByOwner(user.id, data.session.access_token),
      "Chargement boutique trop long.", 10000,
    );
    if (!seller) throw new Error("Ce numéro n'a pas de boutique. Créez-en une.");

    writeActiveSeller(seller);
    const landing = await resolveSellerLanding(seller);
    window.location.replace(landing);
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
      commune: shopCommune,
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
      setNotice("Boutique créée. Configuration de votre DJASSAMAN...");
      window.location.replace("/setup");
    } catch (err) {
      const msg = err?.message || "";
      if (/existe déjà|already.*exist|already.*register/i.test(msg)) {
        // Account exists — switch to sign-in mode automatically
        setMode("SIGN_IN");
        setNotice("Ce numéro a déjà un compte. Connectez-vous avec votre mot de passe.");
        setSaving(false);
        return;
      }
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

  if (step === 0) {
    return (
      <OnboardingSplash
        onCreate={() => { setMode("SIGN_UP"); setStep(1); }}
        onSignIn={() => { setMode("SIGN_IN"); setStep(1); }}
      />
    );
  }

  if (step === 1) {
    return (
      <AccountStep
        mode={mode}
        localPhone={localPhone}
        onPhoneChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
        phoneOk={phoneOk}
        password={password}
        onPasswordChange={(e) => setPassword(e.target.value)}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((v) => !v)}
        strength={strength}
        canProceed={canProceedStep1}
        saving={saving}
        error={error}
        notice={notice}
        sellerAccount={sellerAccount}
        onSubmit={handleStep1}
        onBack={() => { setStep(0); setError(""); setNotice(""); }}
        onSwitchMode={() => { setMode(mode === "SIGN_UP" ? "SIGN_IN" : "SIGN_UP"); setError(""); setNotice(""); }}
        onSignOut={handleSignOut}
        onRequestOtp={handleRequestOtp}
      />
    );
  }

  if (step === 3) {
    return (
      <OtpStep
        phone={otpPhone}
        phoneDisplay={otpPhone}
        onBack={() => { setStep(1); setError(""); setNotice(""); }}
        onResend={handleResendOtp}
        onVerify={handleVerifyOtp}
      />
    );
  }

  return (
    <ShopStep
      shopName={shopName}
      onShopNameChange={(e) => setShopName(e.target.value)}
      suggestedSlug={suggestedSlug}
      shopCategory={shopCategory}
      onShopCategory={setShopCategory}
      shopCity={shopCity}
      onShopCity={(value) => { setShopCity(value); setShopCommune(""); }}
      shopCommune={shopCommune}
      onShopCommune={setShopCommune}
      canSubmit={canSubmitStep2}
      saving={saving}
      error={error}
      notice={notice}
      onSubmit={handleStep2}
      onBack={() => { setStep(1); setError(""); setNotice(""); }}
    />
  );
}