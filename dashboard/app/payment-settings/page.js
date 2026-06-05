"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Save,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { activateSellerPayoutSubaccount, getSellerPaymentSettings, saveSellerPaymentSettings } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { getPaymentOption, LOCAL_PAYMENT_OPTIONS, normalizeAcceptedPaymentMethods, onlinePaymentsEnabled, paymentMethodsNeedDirectPhone } from "../../lib/local-commerce";

const ONLINE_PAYMENTS_ENABLED = onlinePaymentsEnabled();

const payoutOptions = [
  {
    key: "WAVE",
    label: "Wave",
    text: "Recommande: le client paie directement ce numero.",
    tone: "blue",
  },
  {
    key: "ORANGE_MONEY",
    label: "Orange Money",
    text: "Le client paie directement le numero vendeur.",
    tone: "orange",
  },
  {
    key: "MTN_MOMO",
    label: "MTN MoMo",
    text: "Le client paie directement le numero vendeur.",
    tone: "yellow",
  },
];

const defaultSettings = {
  payout_network: "WAVE",
  payout_phone: "",
  accepted_payment_methods: ["CASH_ON_DELIVERY", "WAVE", "ORANGE_MONEY", "MTN_MONEY"],
  default_payment_method: "CASH_ON_DELIVERY",
};

function normalizeLocalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("225")) return digits.slice(3);
  return digits;
}

function paymentChoiceText(method) {
  if (method === "CASH_ON_DELIVERY") return "Le client paie apres reception.";
  if (method === "WAVE") return "Le client paie avant sur Wave.";
  if (method === "ORANGE_MONEY") return "Le client paie avant sur Orange Money.";
  if (method === "MTN_MONEY") return "Le client paie avant sur MTN MoMo.";
  if (method === "PAYSTACK") return "Option plus tard.";
  return "Moyen de paiement";
}

function normalizeSettingsFromSeller(sellerData) {
  const accepted = normalizeAcceptedPaymentMethods(sellerData.accepted_payment_methods)
    .filter((method) => ONLINE_PAYMENTS_ENABLED || method !== "PAYSTACK");
  const payoutNetwork = payoutOptions.some((option) => option.key === sellerData.payout_network)
    ? sellerData.payout_network
    : "WAVE";
  const defaultPayment = accepted.includes(sellerData.default_payment_method)
    ? sellerData.default_payment_method
    : accepted.includes("CASH_ON_DELIVERY")
      ? "CASH_ON_DELIVERY"
      : accepted[0] || "CASH_ON_DELIVERY";

  return {
    payout_network: payoutNetwork,
    payout_phone: normalizeLocalPhone(sellerData.payout_phone || sellerData.phone_number || ""),
    accepted_payment_methods: accepted,
    default_payment_method: defaultPayment,
  };
}

function statusCopy(seller) {
  const status = String(seller?.payout_status || "").toLowerCase();
  const hasDirectPhone = normalizeLocalPhone(seller?.payout_phone).length >= 8;
  if (ONLINE_PAYMENTS_ENABLED && (seller?.paystack_subaccount_code || status === "paystack_ready")) {
    return {
      tone: "ready",
      title: "Paiements prets",
      text: "Vos clients voient uniquement les moyens que vous acceptez.",
    };
  }
  if (hasDirectPhone) {
    return {
      tone: "ready",
      title: "Numero enregistre",
      text: "Le bot peut donner ce numero quand le client choisit un paiement mobile.",
    };
  }
  if (status === "manual_review") {
    return {
      tone: "warn",
      title: "A relire",
      text: "Verifiez bien le numero avant de le montrer aux clients.",
    };
  }
  if (status === "failed") {
    return {
      tone: "danger",
      title: "Activation bloquee",
      text: seller?.payout_last_error || "Verifiez le numero puis reessayez.",
    };
  }
  if (status === "pending_confirmation") {
    return {
      tone: "pending",
      title: "Numero a relire",
      text: "Relisez le numero avant de le montrer aux clients.",
    };
  }
  return {
    tone: "pending",
    title: "Choisissez vos paiements",
    text: "Commencez par paiement a la livraison, puis ajoutez Wave, Orange ou MTN si besoin.",
  };
}

export default function PaymentSettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedOption = useMemo(
    () => payoutOptions.find((option) => option.key === settings.payout_network) || payoutOptions[0],
    [settings.payout_network],
  );
  const acceptedMethods = useMemo(
    () => normalizeAcceptedPaymentMethods(settings.accepted_payment_methods),
    [settings.accepted_payment_methods],
  );
  const directPhoneNeeded = paymentMethodsNeedDirectPhone(acceptedMethods);
  const status = statusCopy(seller);
  const fallbackEligible = ONLINE_PAYMENTS_ENABLED && seller?.id && settings.payout_network !== "WAVE";
  const fallbackActive = ONLINE_PAYMENTS_ENABLED && Boolean(seller?.paystack_subaccount_code || seller?.payout_status === "paystack_ready");
  const canActivateFallback = fallbackEligible && !fallbackActive;
  const defaultPaymentOption = getPaymentOption(settings.default_payment_method);
  const acceptedSummary = acceptedMethods
    .map((method) => getPaymentOption(method)?.shortLabel || getPaymentOption(method)?.label)
    .filter(Boolean)
    .join(", ");

  const fetchData = useCallback(async function fetchData() {
    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const { seller: sellerData } = await getSellerPaymentSettings(activeSeller.slug, token);
      setSeller(sellerData);
      setSettings(normalizeSettingsFromSeller(sellerData));
    } catch (err) {
      setError(friendlyError(err, "Paiement vendeur non charge. Reessayez avec une bonne connexion."));
    } finally {
      setLoading(false);
    }
  }, [activeSeller.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  async function saveSettings() {
    if (!seller?.id) return null;
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const updated = await saveSellerPaymentSettings(seller.id, settings, token);
      setSeller((current) => ({ ...current, ...updated }));
      setNotice("Paiement direct enregistre. Les clients verront ce moyen en priorite.");
      return updated;
    } catch (err) {
      setError(friendlyError(err, "Infos non enregistrees. Verifiez le moyen de depot et le numero."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function activatePayout() {
    if (!seller?.id) return;
    try {
      setActivating(true);
      setError("");
      setNotice("");
      const saved = await saveSettings();
      if (!saved) return;
      const token = await getSellerAccessToken();
      await activateSellerPayoutSubaccount(seller.id, token);
      setNotice("Carte / Djamo active pour les clients qui veulent payer en ligne.");
      await fetchData();
    } catch (err) {
      setError(friendlyError(err, "Carte / Djamo indisponible pour le moment. Gardez Wave, Orange, MTN ou paiement a la livraison."));
      await fetchData();
    } finally {
      setActivating(false);
    }
  }

  function toggleAcceptedPayment(method) {
    const option = getPaymentOption(method);
    if (option.online && !fallbackActive) return;

    setSettings((current) => {
      const currentMethods = normalizeAcceptedPaymentMethods(current.accepted_payment_methods);
      const exists = currentMethods.includes(method);
      const nextMethods = exists
        ? currentMethods.filter((item) => item !== method)
        : [...currentMethods, method];
      const safeMethods = nextMethods.length > 0 ? nextMethods : currentMethods;
      const defaultMethod = safeMethods.includes(current.default_payment_method)
        ? current.default_payment_method
        : safeMethods.includes("CASH_ON_DELIVERY")
          ? "CASH_ON_DELIVERY"
          : safeMethods[0];

      return {
        ...current,
        accepted_payment_methods: safeMethods,
        default_payment_method: defaultMethod,
      };
    });
  }

  function setDefaultPayment(method) {
    if (!acceptedMethods.includes(method)) return;
    setSettings((current) => ({ ...current, default_payment_method: method }));
  }

  return (
    <div className="app-shell">
      {/* Desktop header */}
      <header className="mobile-top hidden md:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[#008f5a]">Paiement</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[#07120d]">Comment on vous paie</h1>
            <p className="mt-1 text-base font-semibold leading-6 text-[#07120d]/55">
              Cochez ce que vous acceptez. Tikchop et WhatsApp montreront seulement ces choix.
            </p>
          </div>
          <button onClick={saveSettings} disabled={saving || !seller} className="app-icon-button bg-[#07120d] text-white" aria-label="Enregistrer">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={19} />}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[56vh] flex-col items-center justify-center text-center">
          <Loader2 className="animate-spin text-[#008f5a]" size={34} />
          <p className="mt-4 font-display text-xl font-bold text-[#07120d]">Chargement...</p>
        </div>
      ) : (
        <main className="mt-5 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {error && (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-950 ring-1 ring-amber-200">
              {error}
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-2xl bg-[#eafff1] p-4 text-sm font-bold leading-5 text-[#005f3d] ring-1 ring-emerald-200">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}

          {/* Status Banner */}
          <section className={`overflow-hidden rounded-[26px] ${
            status.tone === "ready"
              ? "bg-[#07120d] text-white"
              : status.tone === "danger"
                ? "bg-red-50 text-red-950 ring-1 ring-red-200"
                : status.tone === "warn"
                  ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
                  : "bg-[#fbf9f4] text-[#07120d] ring-1 ring-[#07120d]/10"
          }`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  status.tone === "ready" ? "bg-[#39f58e]/20 text-[#39f58e]" : "bg-[#008f5a]/10 text-[#008f5a]"
                }`}>
                  {status.tone === "ready" ? <CheckCircle2 size={22} /> : <Wallet size={22} />}
                </span>
                <div>
                  <p className={`text-[0.68rem] font-black uppercase tracking-[0.12em] ${status.tone === "ready" ? "text-[#39f58e]/80" : "text-[#008f5a]"}`}>Statut</p>
                  <h2 className="mt-1 font-display text-2xl font-black leading-7">{status.title}</h2>
                  <p className={`mt-2 text-sm font-bold leading-5 ${status.tone === "ready" ? "text-white/65" : "text-[#07120d]/55"}`}>
                    {status.text}
                  </p>
                  <div className={`mt-3 grid gap-1.5 rounded-2xl p-3 text-sm font-black ${
                    status.tone === "ready" ? "bg-white/8 text-white" : "bg-white text-[#07120d]"
                  }`}>
                    <span>Premier choix: {defaultPaymentOption?.shortLabel || defaultPaymentOption?.label}</span>
                    <span className={status.tone === "ready" ? "text-white/65" : "text-[#07120d]/55"}>{acceptedSummary || "Aucun moyen choisi"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Accepted payment methods */}
          <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <div className="flex items-center justify-between border-b border-[#07120d]/8 px-4 py-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Choix client</p>
                <h2 className="font-display text-lg font-black text-[#07120d]">Moyens acceptes</h2>
              </div>
              <span className="rounded-full bg-[#008f5a]/10 px-3 py-1 text-xs font-black text-[#008f5a]">
                {acceptedMethods.length}
              </span>
            </div>
            <div className="space-y-2 p-3">
              {LOCAL_PAYMENT_OPTIONS.filter((option) => ONLINE_PAYMENTS_ENABLED || !option.online).map((option) => {
                const checked = acceptedMethods.includes(option.value);
                const disabled = option.online && !fallbackActive;
                const isDefault = settings.default_payment_method === option.value;

                return (
                  <div
                    key={option.value}
                    className={`overflow-hidden rounded-[20px] ring-1 transition-all ${
                      isDefault
                        ? "bg-[#07120d] ring-[#07120d]"
                        : checked
                          ? "bg-[#eafff5] ring-emerald-200/80"
                          : "bg-white ring-[#07120d]/8"
                    } ${disabled ? "opacity-55" : ""}`}
                  >
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => toggleAcceptedPayment(option.value)}
                        disabled={disabled}
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                          checked
                            ? isDefault ? "bg-[#39f58e]/20 text-[#39f58e]" : "bg-[#008f5a]/10 text-[#008f5a]"
                            : "bg-[#fbf9f4] text-[#07120d]/40 shadow-sm"
                        } disabled:cursor-not-allowed`}
                        aria-label={`${checked ? "Retirer" : "Accepter"} ${option.label}`}
                      >
                        {checked ? <CheckCircle2 size={20} /> : <Wallet size={20} />}
                      </button>
                      <div className="min-w-0">
                        <strong className={`block text-sm font-black ${isDefault ? "text-white" : "text-[#07120d]"}`}>{option.label}</strong>
                        <small className={`mt-0.5 block text-xs font-bold leading-4 ${isDefault ? "text-white/60" : "text-[#07120d]/50"}`}>
                          {disabled ? "Option a activer plus tard." : paymentChoiceText(option.value)}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDefaultPayment(option.value)}
                        disabled={!checked}
                        className={`min-h-[34px] rounded-full px-2.5 text-[0.66rem] font-black transition-colors ${
                          isDefault
                            ? "bg-[#39f58e] text-[#07120d]"
                            : checked ? "bg-white text-[#008f5a] shadow-sm" : "bg-[#fbf9f4] text-[#07120d]/30"
                        } disabled:opacity-40`}
                      >
                        {isDefault ? "Premier" : "Choisir"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Payout phone number */}
          <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <div className="flex items-center gap-3 border-b border-[#07120d]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a]">
                <Banknote size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Argent vendeur</p>
                <h2 className="font-display text-lg font-black text-[#07120d]">Numero qui recoit</h2>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {!directPhoneNeeded && (
                <div className="rounded-2xl bg-white p-3 text-sm font-bold leading-5 text-[#07120d]/55 ring-1 ring-[#07120d]/8">
                  Vous avez choisi le paiement apres reception. Le numero reste optionnel.
                </div>
              )}

              {/* Network selector — 3 columns */}
              <div className="grid grid-cols-3 gap-2">
                {payoutOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, payout_network: option.key }))}
                    className={`min-h-[70px] rounded-[18px] p-2.5 text-center ring-1 transition-all active:scale-[0.98] ${
                      settings.payout_network === option.key
                        ? "bg-[#07120d] text-white ring-[#07120d]"
                        : "bg-white text-[#07120d] ring-[#07120d]/10"
                    }`}
                  >
                    <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${
                      settings.payout_network === option.key ? "bg-[#39f58e]/20 text-[#39f58e]" : "bg-[#fbf9f4] text-[#008f5a]"
                    }`}>
                      <Smartphone size={18} />
                    </span>
                    <strong className={`mt-1.5 block text-[0.7rem] font-black leading-4 ${settings.payout_network === option.key ? "text-white" : "text-[#07120d]"}`}>
                      {option.label}
                    </strong>
                  </button>
                ))}
              </div>

              {/* Phone input */}
              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#07120d]">Numero {selectedOption.label}</span>
                <div className="grid grid-cols-[74px_1fr] overflow-hidden rounded-[20px] bg-white ring-1 ring-[#07120d]/12">
                  <span className="flex items-center justify-center border-r border-[#07120d]/10 text-sm font-black text-[#008f5a]">+225</span>
                  <input
                    className="min-h-[56px] bg-transparent px-4 text-base font-black text-[#07120d] outline-none"
                    inputMode="numeric"
                    placeholder="07 00 00 00 00"
                    value={settings.payout_phone}
                    onChange={(event) => setSettings((current) => ({ ...current, payout_phone: normalizeLocalPhone(event.target.value) }))}
                  />
                </div>
              </label>

              <div className="rounded-2xl bg-[#fff7d8] p-3 text-xs font-bold leading-4 text-[#3c2a00] ring-1 ring-[#ffd86a]/60">
                Relisez bien. Si le numero est faux, l&apos;argent peut partir au mauvais contact.
              </div>
            </div>
          </section>

          {/* Save section */}
          <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <div className="flex items-center gap-3 border-b border-[#07120d]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a]">
                <ShieldCheck size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Derniere etape</p>
                <h2 className="font-display text-lg font-black text-[#07120d]">Enregistrer</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-bold leading-5 text-[#07120d]/55">
                Ces choix seront utilises dans la boutique et par le bot WhatsApp.
              </p>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving || activating}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-4 text-sm font-black text-white active:scale-[0.99] disabled:bg-[#07120d]/30"
              >
                {saving || activating ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving || activating ? "Enregistrement..." : "Enregistrer mes choix"}
                {!saving && !activating && <ChevronRight size={17} />}
              </button>

              {/* Carte / Djamo collapsible */}
              {ONLINE_PAYMENTS_ENABLED && (
              <details className="rounded-2xl bg-white ring-1 ring-[#07120d]/8">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-black text-[#07120d]">
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fbf9f4] text-[#008f5a]">
                      <CreditCard size={17} />
                    </span>
                    Carte / Djamo
                  </span>
                  <ChevronRight size={17} className="text-[#008f5a]" />
                </summary>

                <div className="border-t border-[#07120d]/8 px-3 pb-3 pt-2">
                  <p className="text-xs font-bold leading-4 text-[#07120d]/55">
                    Utile pour les clients qui veulent payer par carte. A activer seulement quand vous en avez besoin.
                  </p>

                  <button
                    type="button"
                    onClick={activatePayout}
                    disabled={saving || activating || (!canActivateFallback && !fallbackActive)}
                    className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4] px-4 text-sm font-black text-[#07120d] ring-1 ring-[#07120d]/10 disabled:opacity-50"
                  >
                    {activating ? <Loader2 className="animate-spin" size={17} /> : fallbackActive ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
                    {fallbackActive
                      ? "Carte / Djamo actif"
                      : settings.payout_network === "WAVE"
                        ? "Pas besoin pour le moment"
                        : "Activer carte / Djamo"}
                  </button>

                  {settings.payout_network === "WAVE" && (
                    <p className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-4 text-amber-950">
                      <AlertCircle className="mt-0.5 shrink-0" size={15} />
                      Wave suffit pour demarrer. Ajoutez Carte / Djamo plus tard si des clients vous le demandent.
                    </p>
                  )}
                </div>
              </details>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
