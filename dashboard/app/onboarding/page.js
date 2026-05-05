"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, LockKeyhole, LogOut, Mail, MessageCircle, Store, Truck, UserRound } from "lucide-react";
import { createSellerAccount, createSellerFromOnboarding, getSellerByOwner, requestSellerWhatsAppPairing } from "../seller-actions";
import { clearActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { supabase } from "../../lib/supabase";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountMode, setAccountMode] = useState("SIGN_UP");
  const [accountMethod, setAccountMethod] = useState("EMAIL");
  const [sellerAccount, setSellerAccount] = useState(null);
  const [existingSeller, setExistingSeller] = useState(null);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [createdSeller, setCreatedSeller] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [form, setForm] = useState({
    account_name: "",
    email: "",
    account_phone: "",
    password: "",
    name: "",
    phone_number: "",
    slug: "",
    delivery_mode: "BOTH",
    fixed_delivery_fee: "1000",
    delivery_payment_timing: "AT_RECEPTION",
  });

  const suggestedSlug = useMemo(() => slugify(form.slug || form.name), [form.name, form.slug]);
  const shopUrl = createdSeller ? `${typeof window !== "undefined" ? window.location.origin : ""}/${createdSeller.slug}` : "";
  const totalSteps = 6;

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      if (!supabase) {
        setCheckingSession(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) {
          if (active) setCheckingSession(false);
          return;
        }

        const seller = await getSellerByOwner(user.id);
        if (seller) {
          writeActiveSeller(seller);
          if (active) setExistingSeller(seller);
        }
      } catch (sessionError) {
        console.error("Onboarding session check error:", sessionError);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "slug" ? slugify(value) : value,
    }));
  }

  function canContinue() {
    if (step === 0) {
      const hasIdentity = accountMethod === "EMAIL"
        ? form.email.includes("@")
        : form.account_phone.replace(/[^\d]/g, "").length >= 8;
      return hasIdentity && form.password.length >= 6;
    }
    if (step === 1) return form.name.trim().length >= 2;
    if (step === 2) return form.phone_number.replace(/[^\d]/g, "").length >= 8;
    return true;
  }

  async function ensureSellerAccount() {
    if (!supabase) {
      throw new Error("Supabase Auth n'est pas configure. Ajoute les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }

    const email = form.email.trim().toLowerCase();
    const phone = form.account_phone.trim();
    const password = form.password;

    if (accountMode === "SIGN_IN") {
      const credentials = accountMethod === "EMAIL"
        ? { email, password }
        : { phone: phone.startsWith("+") ? phone : `+${phone.replace(/[^\d]/g, "")}`, password };
      const { data, error: signInError } = await supabase.auth.signInWithPassword(credentials);
      if (signInError) {
        throw new Error("Connexion impossible. Verifie les informations et le mot de passe.");
      }
      return data.user;
    }

    const account = await createSellerAccount({
      method: accountMethod,
      email,
      phone,
      password,
      display_name: form.account_name.trim() || form.name.trim() || email || phone,
    });

    const credentials = accountMethod === "EMAIL"
      ? { email, password }
      : { phone: account.phone || phone, password };
    const { data, error: signInError } = await supabase.auth.signInWithPassword(credentials);
    if (signInError) {
      throw new Error("Compte cree, mais connexion automatique impossible. Appuie sur 'Deja inscrit' puis connecte-toi.");
    }

    return data.user || account;
  }

  async function handleCreate() {
    try {
      setSaving(true);
      setError("");
      const account = sellerAccount || await ensureSellerAccount();
      const seller = await createSellerFromOnboarding({
        ...form,
        slug: suggestedSlug,
        owner_user_id: account?.id,
        owner_email: account?.email || form.email.trim().toLowerCase(),
      });
      writeActiveSeller(seller);
      setCreatedSeller(seller);
      try {
        const pairingResult = await requestSellerWhatsAppPairing(seller);
        setPairing(pairingResult);
      } catch (pairingError) {
        setPairing({
          error: pairingError.message || "Connexion WhatsApp indisponible pour le moment.",
        });
      }
      setStep(5);
    } catch (err) {
      setError(err.message || "Impossible de creer la boutique.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountContinue() {
    try {
      setSaving(true);
      setError("");
      const account = await ensureSellerAccount();
      setSellerAccount(account);

      if (accountMode === "SIGN_IN") {
        const existingSeller = await getSellerByOwner(account?.id);
        if (existingSeller) {
          writeActiveSeller(existingSeller);
          router.push("/");
          return;
        }
      }

      setStep(1);
    } catch (err) {
      setError(err.message || "Impossible de valider le compte vendeur.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    alert("Lien boutique copie.");
  }

  async function handleSignOut() {
    clearActiveSeller();
    setExistingSeller(null);
    setSellerAccount(null);
    setStep(0);
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  async function handlePasswordReset() {
    if (!supabase) {
      setError("Supabase Auth n'est pas configure.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    if (!email.includes("@")) {
      setError("Ajoute ton email avant de demander le lien.");
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
      setError(resetError.message || "Impossible d'envoyer le lien de recuperation.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="app-shell min-h-screen">
        <main className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <p className="mt-4 font-display text-xl font-bold text-[var(--text-main)]">Verification du compte vendeur...</p>
          <p className="mt-2 max-w-[18rem] text-sm font-semibold leading-5 text-[var(--text-dim)]">
            On regarde si une boutique est deja liee a ce compte.
          </p>
        </main>
      </div>
    );
  }

  if (existingSeller) {
    return (
      <div className="app-shell min-h-screen pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <header className="mobile-top">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold text-[var(--primary)]">Tikchop</p>
            <button type="button" onClick={handleSignOut} className="flex min-h-[40px] items-center gap-2 rounded-full bg-white px-3 text-sm font-extrabold text-[var(--text-dim)] shadow-sm">
              <LogOut size={16} />
              Sortir
            </button>
          </div>
        </header>

        <main className="mt-6 space-y-5">
          <OnboardingCard
            icon={<CheckCircle2 size={30} />}
            title="Boutique deja creee"
            subtitle="Ce compte vendeur possede deja un espace Tikchop."
          >
            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="quiet-label text-[var(--primary)]">Boutique active</p>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--text-main)]">{existingSeller.name}</p>
              <p className="mt-1 break-all text-sm font-extrabold text-[var(--primary)]">/{existingSeller.slug}</p>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white"
              >
                Aller a mon espace
                <ArrowRight size={19} />
              </button>
              <Link href={`/${existingSeller.slug}`} className="flex min-h-[56px] items-center justify-center rounded-xl border border-[var(--outline)] bg-white text-base font-extrabold text-[var(--text-main)] no-underline">
                Voir ma boutique publique
              </Link>
            </div>
          </OnboardingCard>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold text-[var(--text-dim)] no-underline">Retour</Link>
          <p className="font-display text-lg font-bold text-[var(--primary)]">Tikchop</p>
          <span className="text-sm font-bold text-[var(--text-dim)]">{Math.min(step + 1, totalSteps)}/{totalSteps}</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-mid)]">
          <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${((Math.min(step, totalSteps - 1) + 1) / totalSteps) * 100}%` }} />
        </div>
      </header>

      <main className="mt-6 space-y-5">
        {step === 0 && (
          <OnboardingCard
            icon={<UserRound size={28} />}
            title="Compte vendeur"
            subtitle="Le vendeur se connecte a son espace. Sa boutique reste separee des autres."
          >
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface-soft)] p-1">
              <button
                type="button"
                onClick={() => setAccountMode("SIGN_UP")}
                className={`min-h-[46px] rounded-lg text-sm font-extrabold ${accountMode === "SIGN_UP" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-dim)]"}`}
              >
                Nouveau compte
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("SIGN_IN")}
                className={`min-h-[46px] rounded-lg text-sm font-extrabold ${accountMode === "SIGN_IN" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-dim)]"}`}
              >
                Deja inscrit
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-white p-1 ring-1 ring-[var(--outline)]/55">
              <button
                type="button"
                onClick={() => setAccountMethod("EMAIL")}
                className={`min-h-[46px] rounded-lg text-sm font-extrabold ${accountMethod === "EMAIL" ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text-dim)]"}`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountMethod("PHONE");
                  if (!form.phone_number && form.account_phone) {
                    updateField("phone_number", form.account_phone);
                  }
                }}
                className={`min-h-[46px] rounded-lg text-sm font-extrabold ${accountMethod === "PHONE" ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text-dim)]"}`}
              >
                Telephone
              </button>
            </div>

            {accountMode === "SIGN_UP" && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Nom du vendeur</span>
                <div className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[var(--outline)] bg-white px-4">
                  <UserRound className="shrink-0 text-[var(--text-dim)]" size={19} />
                  <input
                    value={form.account_name}
                    onChange={(event) => updateField("account_name", event.target.value)}
                    placeholder="Ex: Amina"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--text-main)] outline-none"
                  />
                </div>
              </label>
            )}

            {accountMethod === "EMAIL" ? (
              <label className={accountMode === "SIGN_UP" ? "mt-4 block" : "block"}>
                <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Email</span>
                <div className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[var(--outline)] bg-white px-4">
                  <Mail className="shrink-0 text-[var(--text-dim)]" size={19} />
                  <input
                    autoFocus
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="vendeur@email.com"
                    inputMode="email"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--text-main)] outline-none"
                  />
                </div>
              </label>
            ) : (
              <label className={accountMode === "SIGN_UP" ? "mt-4 block" : "block"}>
                <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Numero telephone</span>
                <div className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[var(--outline)] bg-white px-4">
                  <MessageCircle className="shrink-0 text-[var(--text-dim)]" size={19} />
                  <input
                    autoFocus
                    value={form.account_phone}
                    onChange={(event) => {
                      updateField("account_phone", event.target.value);
                      if (!form.phone_number || form.phone_number === form.account_phone) {
                        updateField("phone_number", event.target.value);
                      }
                    }}
                    placeholder="Ex: +2250102030405"
                    inputMode="tel"
                    autoComplete="tel"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--text-main)] outline-none"
                  />
                </div>
              </label>
            )}

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Mot de passe</span>
              <div className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[var(--outline)] bg-white px-4">
                <LockKeyhole className="shrink-0 text-[var(--text-dim)]" size={19} />
                <input
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  placeholder="Minimum 6 caracteres"
                  type="password"
                  autoComplete={accountMode === "SIGN_UP" ? "new-password" : "current-password"}
                  className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--text-main)] outline-none"
                />
              </div>
            </label>

            {accountMode === "SIGN_IN" && accountMethod === "EMAIL" && (
              <div className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3">
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
              <p className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Recuperation telephone par code SMS/WhatsApp a brancher avec un fournisseur OTP.
              </p>
            )}

            <p className="mt-4 rounded-lg bg-[var(--surface-soft)] p-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
              {accountMethod === "EMAIL"
                ? "Tikchop peut envoyer des messages email si RESEND_API_KEY est configure. Si l'email est deja inscrit, l'app demandera de se connecter."
                : "Le telephone marche avec mot de passe. Pour une verification par code SMS ou WhatsApp, il faudra brancher un fournisseur OTP."}
            </p>
          </OnboardingCard>
        )}

        {step === 1 && (
          <OnboardingCard
            icon={<Store size={28} />}
            title="Nom de la boutique"
            subtitle="Le client doit comprendre tout de suite chez qui il achete."
          >
            <div className="mb-5 rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="quiet-label text-[var(--primary)]">Inscription vendeur</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Chaque vendeur cree uniquement sa propre boutique. Les autres boutiques ne sont pas visibles ici.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Nom boutique</span>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ex: Amina Mode"
                className="mobile-input text-lg"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Lien boutique</span>
              <div className="flex min-h-[54px] items-center gap-1 rounded-xl border border-[var(--outline)] bg-white px-3">
                <span className="text-sm font-bold text-[var(--text-dim)]">tikchop/</span>
                <input
                  value={suggestedSlug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  placeholder="amina-mode"
                  className="min-w-0 flex-1 bg-transparent text-base font-extrabold text-[var(--primary)] outline-none"
                />
              </div>
            </label>
          </OnboardingCard>
        )}

        {step === 2 && (
          <OnboardingCard
            icon={<MessageCircle size={28} />}
            title="WhatsApp vendeur"
            subtitle="C'est le numero qui recevra les clients et les commandes."
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Numero WhatsApp</span>
              <input
                autoFocus
                value={form.phone_number}
                onChange={(event) => updateField("phone_number", event.target.value)}
                placeholder="Ex: +2250102030405"
                inputMode="tel"
                className="mobile-input text-lg"
              />
            </label>
            <p className="mt-4 rounded-lg bg-[var(--surface-soft)] p-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
              Mets le numero avec indicatif pays si possible. Exemple Cote d&apos;Ivoire: +225...
            </p>
          </OnboardingCard>
        )}

        {step === 3 && (
          <OnboardingCard
            icon={<Truck size={28} />}
            title="Reception client"
            subtitle="Choisis ce que la boutique propose des le premier jour."
          >
            <div className="grid gap-3">
              <ChoiceButton active={form.delivery_mode === "BOTH"} title="Livraison + retrait" text="Le plus flexible" onClick={() => updateField("delivery_mode", "BOTH")} />
              <ChoiceButton active={form.delivery_mode === "DELIVERY"} title="Livraison seulement" text="Le client donne son adresse" onClick={() => updateField("delivery_mode", "DELIVERY")} />
              <ChoiceButton active={form.delivery_mode === "PICKUP"} title="Retrait seulement" text="Le client vient recuperer" onClick={() => updateField("delivery_mode", "PICKUP")} />
            </div>
          </OnboardingCard>
        )}

        {step === 4 && (
          <OnboardingCard
            icon={<Truck size={28} />}
            title="Frais livraison"
            subtitle="Tu pourras ajouter les zones et les livreurs apres."
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

        {step === 5 && createdSeller && (
          <OnboardingCard
            icon={<CheckCircle2 size={30} />}
            title="Boutique prete"
            subtitle="Le lien est cree. Connecte WhatsApp pour activer le chatbot."
          >
            <WhatsAppPairingBox pairing={pairing} />

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

        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/96 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_28px_rgba(22,29,25,0.08)] md:static md:bg-transparent md:p-0 md:shadow-none">
          {step < 4 && (
            <button
              type="button"
              disabled={!canContinue() || saving}
              onClick={step === 0 ? handleAccountContinue : () => setStep((current) => current + 1)}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving && step === 0 ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={19} />}
              {step === 0 ? (accountMode === "SIGN_IN" ? "Se connecter" : "Creer le compte") : "Continuer"}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              {saving ? "Creation..." : "Creer ma boutique"}
            </button>
          )}
          {step === 5 && (
            <button
              type="button"
              onClick={() => router.push("/add-product")}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white"
            >
              Ajouter mon premier article
              <ArrowRight size={19} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function OnboardingCard({ icon, title, subtitle, children }) {
  return (
    <section className="app-card p-5">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold leading-9 text-[var(--text-main)]">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function WhatsAppPairingBox({ pairing }) {
  if (!pairing) {
    return (
      <div className="mb-4 rounded-xl bg-[var(--surface-soft)] p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-[var(--primary)]" size={20} />
          <p className="text-sm font-extrabold text-[var(--text-main)]">Generation du code WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (pairing.error) {
    return (
      <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-800 ring-1 ring-amber-100">
        {pairing.error}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-[var(--outline)] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <KeyRound size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="quiet-label">Code WhatsApp</p>
          {pairing.pairingCode ? (
            <p className="mt-1 font-display text-3xl font-bold tracking-normal text-[var(--primary)]">
              {pairing.pairingCode.match(/.{1,4}/g)?.join(" ") || pairing.pairingCode}
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold text-[var(--text-dim)]">
              Code non retourne. Utilise le QR depuis un autre ecran.
            </p>
          )}
          <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-dim)]">
            Ouvre WhatsApp, Appareils connectes, puis Connecter avec un numero de telephone.
          </p>
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
      className={`flex min-h-[74px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left active:scale-[0.99] ${
        active ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-[var(--outline)]/55 bg-white"
      }`}
    >
      <span>
        <span className="block font-display text-base font-bold text-[var(--text-main)]">{title}</span>
        <span className="mt-1 block text-sm font-semibold text-[var(--text-dim)]">{text}</span>
      </span>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-transparent"}`}>
        <CheckCircle2 size={17} />
      </span>
    </button>
  );
}
