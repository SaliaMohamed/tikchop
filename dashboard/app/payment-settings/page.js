"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  Smartphone,
  Truck,
} from "lucide-react";
import { getSellerPaymentSettings, saveSellerPaymentSettings } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  LOCAL_PAYMENT_OPTIONS,
  onlinePaymentsEnabled,
  normalizeAcceptedPaymentMethods,
  paymentMethodsNeedDirectPhone,
} from "../../lib/local-commerce";
import {
  Notice,
  SettingsHeader,
  SettingsSection,
  StatusPill,
} from "../components/settings-ui";

// ─── Réglages de paiement ────────────────────────────────────────────────────
// Le vendeur choisit les moyens acceptés (livraison, Wave, Orange, MTN, carte)
// et le moyen par défaut. Le bot WhatsApp ne propose que les moyens actifs.
// PAYSTACK (carte / Djamo) n'apparaît que lorsque onlinePaymentsEnabled() le permet.

const PAYOUT_NETWORKS = [
  { key: "WAVE", label: "Wave", color: "#007bff" },
  { key: "ORANGE_MONEY", label: "Orange Money", color: "#ff6600" },
  { key: "MTN_MOMO", label: "MTN MoMo", color: "#ffcc00" },
];

const SELECTABLE_METHODS = LOCAL_PAYMENT_OPTIONS;

const DEFAULT_SETTINGS = {
  payout_network: "WAVE",
  payout_phone: "",
  accepted_payment_methods: ["CASH_ON_DELIVERY", "WAVE", "ORANGE_MONEY", "MTN_MONEY"],
  default_payment_method: "CASH_ON_DELIVERY",
};

function normalizeLocalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("225")) return digits.slice(3);
  return digits.slice(0, 10);
}

function hasValidPhone(phone) {
  return phone.length >= 8 && phone.length <= 10;
}

function getPaymentOptionValue(value) {
  return LOCAL_PAYMENT_OPTIONS.find((option) => option.value === value) || null;
}

export default function PaymentSettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const directPhoneNeeded = paymentMethodsNeedDirectPhone(settings.accepted_payment_methods);
  const phoneValid = hasValidPhone(settings.payout_phone);
  const selectedNetwork = PAYOUT_NETWORKS.find((n) => n.key === settings.payout_network) || PAYOUT_NETWORKS[0];
  const onlineEnabled = onlinePaymentsEnabled();

  const visibleMethods = useMemo(
    () => SELECTABLE_METHODS.filter((option) => option.online ? onlineEnabled : true),
    [onlineEnabled],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const { seller: sellerData } = await getSellerPaymentSettings(activeSeller.slug, token);
      setSeller(sellerData);
      const accepted = normalizeAcceptedPaymentMethods(sellerData.accepted_payment_methods);
      const defaultMethod = sellerData.default_payment_method;
      setSettings({
        payout_network: PAYOUT_NETWORKS.some((n) => n.key === sellerData.payout_network)
          ? sellerData.payout_network
          : "WAVE",
        payout_phone: normalizeLocalPhone(sellerData.payout_phone || sellerData.phone_number || ""),
        accepted_payment_methods: accepted,
        default_payment_method: accepted.includes(defaultMethod) ? defaultMethod : accepted[0] || "CASH_ON_DELIVERY",
      });
    } catch (err) {
      setError(friendlyError(err, "Impossible de charger les paramètres. Vérifiez votre connexion."));
    } finally {
      setLoading(false);
    }
  }, [activeSeller.slug]);

  useEffect(() => {
    const t = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(t);
  }, [fetchData]);

  function toggleMethod(value) {
    setSettings((current) => {
      const has = current.accepted_payment_methods.includes(value);
      const next = has
        ? current.accepted_payment_methods.filter((m) => m !== value)
        : [...current.accepted_payment_methods, value];
      if (next.length === 0) return current;
      const defaultMethod = current.default_payment_method;
      return {
        ...current,
        accepted_payment_methods: next,
        default_payment_method: next.includes(defaultMethod) ? defaultMethod : next[0],
      };
    });
  }

  async function handleSave(e) {
    e?.preventDefault();
    if (!seller?.id) return;
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const payload = {
        ...settings,
        accepted_payment_methods: settings.accepted_payment_methods,
        default_payment_method: settings.accepted_payment_methods.includes(settings.default_payment_method)
          ? settings.default_payment_method
          : settings.accepted_payment_methods[0],
      };
      const updated = await saveSellerPaymentSettings(seller.id, payload, token);
      setSeller((c) => ({ ...c, ...updated }));
      setNotice("Paramètres enregistrés. Le bot WhatsApp ne proposera que les moyens actifs.");
    } catch (err) {
      setError(friendlyError(err, "Enregistrement impossible. Vérifiez le numéro et réessayez."));
    } finally {
      setSaving(false);
    }
  }

  const hasPayoutPhone = hasValidPhone(
    normalizeLocalPhone(seller?.payout_phone || seller?.phone_number || "")
  );

  return (
    <div className="app-shell">
      {/* Desktop header */}
      <SettingsHeader
        label="Paiement"
        title="Paiement"
        text="Choisissez les moyens acceptés et le numéro sur lequel vos clients paient."
      />

      {loading ? (
        <div className="flex min-h-[56vh] flex-col items-center justify-center text-center">
          <Loader2 className="animate-spin text-[#059669]" size={34} />
          <p className="mt-4 font-display text-xl font-bold text-[#0F2B20]">Chargement…</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-5 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">

          {/* Status banner */}
          <section className={`overflow-hidden rounded-[26px] ${hasPayoutPhone ? "bg-[#0F2B20] text-white" : "bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10"}`}>
            <div className="flex items-start gap-3 p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${hasPayoutPhone ? "bg-[#34D399]/20 text-[#34D399]" : "bg-[#059669]/10 text-[#059669]"}`}>
                {hasPayoutPhone ? <CheckCircle2 size={22} /> : <Banknote size={22} />}
              </span>
              <div>
                <p className={`text-[0.68rem] font-black uppercase tracking-[0.12em] ${hasPayoutPhone ? "text-[#34D399]/80" : "text-[#059669]"}`}>
                  Statut
                </p>
                <h2 className="mt-1 font-display text-2xl font-black leading-7">
                  {settings.accepted_payment_methods.length} moyen{settings.accepted_payment_methods.length > 1 ? "s" : ""} de paiement
                </h2>
                <p className={`mt-1.5 text-sm font-bold leading-5 ${hasPayoutPhone ? "text-white/60" : "text-[#0F2B20]/55"}`}>
                  {hasPayoutPhone
                    ? "Le bot WhatsApp propose ces moyens aux clients, dans leur langue."
                    : "Ajoutez un numéro de réception (Wave, Orange, MTN) ou gardez la livraison."}
                </p>
              </div>
            </div>
          </section>

          {/* Moyens de paiement acceptés */}
          <SettingsSection
            icon={<Banknote size={19} />}
            title="Comment vos clients paient"
            sub="Moyens acceptés"
            right={
              settings.accepted_payment_methods.length > 1
                ? <StatusPill ok>{settings.accepted_payment_methods.length} actifs</StatusPill>
                : <StatusPill ok={false} warning>1 seul</StatusPill>
            }
          >
            <div className="divide-y divide-[#0F2B20]/7">
              {visibleMethods.map((option) => {
                const active = settings.accepted_payment_methods.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleMethod(option.value)}
                    className="flex min-h-[62px] w-full items-center justify-between gap-4 px-4 py-3 text-left active:bg-[#EAF8F0]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#059669] text-white" : "bg-white text-[#0F2B20]/40 ring-1 ring-[#0F2B20]/10"}`}>
                        <Smartphone size={16} />
                      </span>
                      <span className="min-w-0">
                        <strong className={`block text-sm font-black ${active ? "text-[#0F2B20]" : "text-[#0F2B20]/45"}`}>{option.label}</strong>
                        <small className="block truncate text-xs font-bold text-[#0F2B20]/45">{option.hint}</small>
                      </span>
                    </div>
                    <span className={`flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${active ? "bg-[#059669]" : "bg-[#0F2B20]/15"}`}>
                      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-5" : ""}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            {settings.accepted_payment_methods.length <= 1 && (
              <p className="px-4 py-3 text-xs font-bold text-[#0F2B20]/45">
                Gardez au moins un moyen actif, sinon vos clients ne pourront pas commander.
              </p>
            )}
          </SettingsSection>

          {/* Méthode par défaut */}
          {settings.accepted_payment_methods.length > 1 && (
            <SettingsSection
              icon={<CheckCircle2 size={19} />}
              title="Moyen proposé en premier"
              sub="Par défaut"
            >
              <div className="p-4 space-y-2">
                {settings.accepted_payment_methods.map((method) => {
                  const option = getPaymentOptionValue(method);
                  const active = settings.default_payment_method === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSettings((c) => ({ ...c, default_payment_method: method }))}
                      className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active ? "border-[#059669]/40 bg-[#EAF8F0]" : "border-[#0F2B20]/10 bg-white"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-black ${active ? "text-[#0F2B20]" : "text-[#0F2B20]"}`}>{option?.label || method}</p>
                        <p className="mt-0.5 text-xs font-bold leading-4 text-[#0F2B20]/50">{option?.hint}</p>
                      </div>
                      {active && <CheckCircle2 className="shrink-0 text-[#059669]" size={19} />}
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
          )}

          {directPhoneNeeded && (
          <section className="overflow-hidden rounded-[26px] bg-[#E8F7EE] ring-1 ring-[#34D399]/30">
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#059669]/15 text-[#059669]">
                <Truck size={19} />
              </span>
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#059669]">Numéro de réception</p>
                <h2 className="font-display text-base font-black text-[#0F2B20]">Où vos clients envoient l&apos;argent</h2>
                <p className="text-xs font-bold text-[#0F2B20]/50 leading-4 mt-0.5">
                  Wave, Orange et MTN se paient sur un numéro. Ajoutez-le pour que le bot le partage.
                </p>
              </div>
            </div>
          </section>
          )}

          {/* Numéro de réception */}
          {directPhoneNeeded && (
          <section className="overflow-hidden rounded-[26px] bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10">
            <div className="flex items-center gap-3 border-b border-[#0F2B20]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#059669]/10 text-[#059669]">
                <Smartphone size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#059669]">Votre numéro de réception</p>
                <h2 className="font-display text-lg font-black text-[#0F2B20]">
                  Où recevoir l&apos;argent
                  <span className="ml-1 text-[#059669]">*</span>
                </h2>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Réseau */}
              <div>
                <p className="mb-2 text-xs font-black text-[#0F2B20]/70">Réseau mobile <span className="text-[#059669]">*</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYOUT_NETWORKS.map((net) => (
                    <button
                      key={net.key}
                      type="button"
                      onClick={() => setSettings((c) => ({ ...c, payout_network: net.key }))}
                      className={`min-h-[64px] rounded-[18px] p-2 text-center ring-1 transition-all active:scale-[0.98] ${
                        settings.payout_network === net.key
                          ? "bg-[#0F2B20] text-white ring-[#0F2B20]"
                          : "bg-white text-[#0F2B20] ring-[#0F2B20]/10"
                      }`}
                    >
                      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl ${
                        settings.payout_network === net.key ? "bg-[#34D399]/20 text-[#34D399]" : "bg-[#f0f0f0] text-[#059669]"
                      }`}>
                        <Smartphone size={16} />
                      </span>
                      <strong className={`mt-1 block text-[0.68rem] font-black leading-3 ${settings.payout_network === net.key ? "text-white" : "text-[#0F2B20]"}`}>
                        {net.label}
                      </strong>
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro */}
              <div>
                <p className="mb-1.5 text-xs font-black text-[#0F2B20]/70">
                  Numéro {selectedNetwork.label} <span className="text-[#059669]">*</span>
                </p>
                <div className={`grid grid-cols-[72px_1fr] overflow-hidden rounded-[20px] bg-white ring-2 transition ${
                  settings.payout_phone && !phoneValid
                    ? "ring-amber-400"
                    : phoneValid
                    ? "ring-[#059669]/50"
                    : "ring-[#0F2B20]/10"
                }`}>
                  <span className="flex items-center justify-center border-r border-[#0F2B20]/10 text-sm font-black text-[#059669]">+225</span>
                  <input
                    className="min-h-[56px] bg-transparent px-4 text-base font-black text-[#0F2B20] outline-none placeholder:text-[#0F2B20]/25"
                    inputMode="numeric"
                    placeholder="07 00 00 00 00"
                    value={settings.payout_phone}
                    onChange={(e) => setSettings((c) => ({ ...c, payout_phone: normalizeLocalPhone(e.target.value) }))}
                  />
                  {phoneValid && <CheckCircle2 size={18} className="self-center mr-3 text-[#059669]" />}
                </div>
                {settings.payout_phone && !phoneValid && (
                  <p className="mt-1.5 text-[0.7rem] font-bold text-amber-600">
                    Numéro CI : 8 à 10 chiffres (ex: 0712345678)
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#fcf1d2] p-3 text-xs font-bold leading-4 text-[#5e431d] ring-1 ring-[#f4cd5e]/60">
                ⚠ Vérifiez bien ce numéro. Le bot WhatsApp le communique aux clients qui choisissent {selectedNetwork.label}.
              </div>
            </div>
          </section>
          )}

          {/* Errors / Notices */}
          {error && (
            <Notice tone="error" className="mt-1">
              {error}
            </Notice>
          )}
          {notice && (
            <Notice className="mt-1">
              {notice}
            </Notice>
          )}

          {/* Save */}
          <section className="overflow-hidden rounded-[26px] bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10">
            <div className="flex items-center gap-3 border-b border-[#0F2B20]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#059669]/10 text-[#059669]">
                <ShieldCheck size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#059669]">Dernière étape</p>
                <h2 className="font-display text-lg font-black text-[#0F2B20]">Enregistrer</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-bold leading-5 text-[#0F2B20]/55">
                Ces réglages seront utilisés par le bot WhatsApp pour proposer les bons moyens de paiement à vos clients.
              </p>
              <button
                type="submit"
                disabled={saving || !seller}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] px-4 text-sm font-black text-white active:scale-[0.99] disabled:opacity-40"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
