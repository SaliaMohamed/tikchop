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

// ─── Seul moyen de paiement disponible : à la livraison ──────────────────────
// Le numéro de réception (Wave / Orange / MTN) est optionnel mais recommandé
// pour que le bot puisse communiquer les coordonnées de paiement mobile au client.

const PAYOUT_NETWORKS = [
  { key: "WAVE", label: "Wave", color: "#007bff" },
  { key: "ORANGE_MONEY", label: "Orange Money", color: "#ff6600" },
  { key: "MTN_MOMO", label: "MTN MoMo", color: "#ffcc00" },
];

const DEFAULT_SETTINGS = {
  payout_network: "WAVE",
  payout_phone: "",
};

function normalizeLocalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("225")) return digits.slice(3);
  return digits.slice(0, 10);
}

function hasValidPhone(phone) {
  return phone.length >= 8 && phone.length <= 10;
}

export default function PaymentSettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const phoneValid = hasValidPhone(settings.payout_phone);
  const selectedNetwork = PAYOUT_NETWORKS.find((n) => n.key === settings.payout_network) || PAYOUT_NETWORKS[0];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const { seller: sellerData } = await getSellerPaymentSettings(activeSeller.slug, token);
      setSeller(sellerData);
      setSettings({
        payout_network: PAYOUT_NETWORKS.some((n) => n.key === sellerData.payout_network)
          ? sellerData.payout_network
          : "WAVE",
        payout_phone: normalizeLocalPhone(sellerData.payout_phone || sellerData.phone_number || ""),
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

  async function handleSave(e) {
    e?.preventDefault();
    if (!seller?.id) return;
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      // Always fix payment method to CASH_ON_DELIVERY
      const payload = {
        ...settings,
        accepted_payment_methods: ["CASH_ON_DELIVERY"],
        default_payment_method: "CASH_ON_DELIVERY",
      };
      const updated = await saveSellerPaymentSettings(seller.id, payload, token);
      setSeller((c) => ({ ...c, ...updated }));
      setNotice("Paramètres enregistrés. Le bot WhatsApp indiquera ce numéro aux clients.");
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
      <header className="mobile-top hidden md:block">
        <p className="quiet-label text-[#008f5a]">Paiement</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[#07120d]">
          Numéro de réception
        </h1>
        <p className="mt-1 text-base font-semibold leading-6 text-[#07120d]/55">
          Le numéro sur lequel vos clients vous paient (Wave, Orange ou MTN).
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[56vh] flex-col items-center justify-center text-center">
          <Loader2 className="animate-spin text-[#008f5a]" size={34} />
          <p className="mt-4 font-display text-xl font-bold text-[#07120d]">Chargement…</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-5 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">

          {/* Status banner */}
          <section className={`overflow-hidden rounded-[26px] ${hasPayoutPhone ? "bg-[#07120d] text-white" : "bg-[#fbf9f4] ring-1 ring-[#07120d]/10"}`}>
            <div className="flex items-start gap-3 p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${hasPayoutPhone ? "bg-[#39f58e]/20 text-[#39f58e]" : "bg-[#008f5a]/10 text-[#008f5a]"}`}>
                {hasPayoutPhone ? <CheckCircle2 size={22} /> : <Banknote size={22} />}
              </span>
              <div>
                <p className={`text-[0.68rem] font-black uppercase tracking-[0.12em] ${hasPayoutPhone ? "text-[#39f58e]/80" : "text-[#008f5a]"}`}>
                  Statut
                </p>
                <h2 className="mt-1 font-display text-2xl font-black leading-7">
                  {hasPayoutPhone ? "Numéro enregistré" : "Numéro manquant"}
                </h2>
                <p className={`mt-1.5 text-sm font-bold leading-5 ${hasPayoutPhone ? "text-white/60" : "text-[#07120d]/55"}`}>
                  {hasPayoutPhone
                    ? "Le bot WhatsApp communique ce numéro aux clients pour le paiement."
                    : "Ajoutez votre numéro pour que les clients sachent où vous payer."}
                </p>
              </div>
            </div>
          </section>

          {/* Paiement à la livraison — info fixe */}
          <section className="overflow-hidden rounded-[26px] bg-[#eafff3] ring-1 ring-[#39f58e]/30">
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#008f5a]/15 text-[#008f5a]">
                <Truck size={19} />
              </span>
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Mode de paiement</p>
                <h2 className="font-display text-base font-black text-[#07120d]">Paiement à la livraison</h2>
                <p className="text-xs font-bold text-[#07120d]/50 leading-4 mt-0.5">
                  Le client paie à la réception de sa commande.
                </p>
              </div>
            </div>
          </section>

          {/* Numéro de réception */}
          <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <div className="flex items-center gap-3 border-b border-[#07120d]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a]">
                <Smartphone size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Votre numéro de réception</p>
                <h2 className="font-display text-lg font-black text-[#07120d]">
                  Où recevoir l&apos;argent
                  <span className="ml-1 text-[#008f5a]">*</span>
                </h2>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Réseau */}
              <div>
                <p className="mb-2 text-xs font-black text-[#07120d]/70">Réseau mobile <span className="text-[#008f5a]">*</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYOUT_NETWORKS.map((net) => (
                    <button
                      key={net.key}
                      type="button"
                      onClick={() => setSettings((c) => ({ ...c, payout_network: net.key }))}
                      className={`min-h-[64px] rounded-[18px] p-2 text-center ring-1 transition-all active:scale-[0.98] ${
                        settings.payout_network === net.key
                          ? "bg-[#07120d] text-white ring-[#07120d]"
                          : "bg-white text-[#07120d] ring-[#07120d]/10"
                      }`}
                    >
                      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl ${
                        settings.payout_network === net.key ? "bg-[#39f58e]/20 text-[#39f58e]" : "bg-[#f0f0f0] text-[#008f5a]"
                      }`}>
                        <Smartphone size={16} />
                      </span>
                      <strong className={`mt-1 block text-[0.68rem] font-black leading-3 ${settings.payout_network === net.key ? "text-white" : "text-[#07120d]"}`}>
                        {net.label}
                      </strong>
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro */}
              <div>
                <p className="mb-1.5 text-xs font-black text-[#07120d]/70">
                  Numéro {selectedNetwork.label} <span className="text-[#008f5a]">*</span>
                </p>
                <div className={`grid grid-cols-[72px_1fr] overflow-hidden rounded-[20px] bg-white ring-2 transition ${
                  settings.payout_phone && !phoneValid
                    ? "ring-amber-400"
                    : phoneValid
                    ? "ring-[#008f5a]/50"
                    : "ring-[#07120d]/10"
                }`}>
                  <span className="flex items-center justify-center border-r border-[#07120d]/10 text-sm font-black text-[#008f5a]">+225</span>
                  <input
                    className="min-h-[56px] bg-transparent px-4 text-base font-black text-[#07120d] outline-none placeholder:text-[#07120d]/25"
                    inputMode="numeric"
                    placeholder="07 00 00 00 00"
                    value={settings.payout_phone}
                    onChange={(e) => setSettings((c) => ({ ...c, payout_phone: normalizeLocalPhone(e.target.value) }))}
                  />
                  {phoneValid && <CheckCircle2 size={18} className="self-center mr-3 text-[#008f5a]" />}
                </div>
                {settings.payout_phone && !phoneValid && (
                  <p className="mt-1.5 text-[0.7rem] font-bold text-amber-600">
                    Numéro CI : 8 à 10 chiffres (ex: 0712345678)
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#fff7d8] p-3 text-xs font-bold leading-4 text-[#3c2a00] ring-1 ring-[#ffd86a]/60">
                ⚠ Vérifiez bien ce numéro. Si incorrect, les clients ne peuvent pas vous payer.
              </div>
            </div>
          </section>

          {/* Errors / Notices */}
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

          {/* Save */}
          <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <div className="flex items-center gap-3 border-b border-[#07120d]/8 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a]">
                <ShieldCheck size={19} />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Dernière étape</p>
                <h2 className="font-display text-lg font-black text-[#07120d]">Enregistrer</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-bold leading-5 text-[#07120d]/55">
                Ce numéro sera utilisé par le bot WhatsApp pour guider vos clients au moment du paiement.
              </p>
              <button
                type="submit"
                disabled={saving || !seller}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-4 text-sm font-black text-white active:scale-[0.99] disabled:opacity-40"
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
