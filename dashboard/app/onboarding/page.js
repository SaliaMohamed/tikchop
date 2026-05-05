"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, MessageCircle, Store, Truck } from "lucide-react";
import { createSellerFromOnboarding, requestSellerWhatsAppPairing } from "../seller-actions";
import { writeActiveSeller } from "../components/sellerContext";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdSeller, setCreatedSeller] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    slug: "",
    delivery_mode: "BOTH",
    fixed_delivery_fee: "1000",
    delivery_payment_timing: "AT_RECEPTION",
  });

  const suggestedSlug = useMemo(() => slugify(form.slug || form.name), [form.name, form.slug]);
  const shopUrl = createdSeller ? `${typeof window !== "undefined" ? window.location.origin : ""}/${createdSeller.slug}` : "";

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "slug" ? slugify(value) : value,
    }));
  }

  function canContinue() {
    if (step === 0) return form.name.trim().length >= 2;
    if (step === 1) return form.phone_number.replace(/[^\d]/g, "").length >= 8;
    return true;
  }

  async function handleCreate() {
    try {
      setSaving(true);
      setError("");
      const seller = await createSellerFromOnboarding({
        ...form,
        slug: suggestedSlug,
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
      setStep(4);
    } catch (err) {
      setError(err.message || "Impossible de creer la boutique.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    alert("Lien boutique copie.");
  }

  return (
    <div className="app-shell min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold text-[var(--text-dim)] no-underline">Retour</Link>
          <p className="font-display text-lg font-bold text-[var(--primary)]">Tikchop</p>
          <span className="text-sm font-bold text-[var(--text-dim)]">{Math.min(step + 1, 5)}/5</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-mid)]">
          <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${((Math.min(step, 4) + 1) / 5) * 100}%` }} />
        </div>
      </header>

      <main className="mt-6 space-y-5">
        {step === 0 && (
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

        {step === 1 && (
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

        {step === 2 && (
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

        {step === 3 && (
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

        {step === 4 && createdSeller && (
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
          {step < 3 && (
            <button
              type="button"
              disabled={!canContinue()}
              onClick={() => setStep((current) => current + 1)}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
            >
              Continuer
              <ArrowRight size={19} />
            </button>
          )}
          {step === 3 && (
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
          {step === 4 && (
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
