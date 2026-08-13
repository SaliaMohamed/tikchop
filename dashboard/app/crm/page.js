"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  Phone,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getSellerOrders } from "../actions";
import {
  getSellerChatbotSettings,
  getSellerWhatsAppConnection,
  requestSellerWhatsAppPairing,
  refreshSellerWhatsAppPairingCode,
  disconnectSellerWhatsApp,
  saveSellerChatbotSettings,
} from "../seller-actions";
import { useActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  formatPairingCode,
  getPairingValidityLabel,
  normalizeWhatsAppInput,
  getPhoneDigits,
  statusCopy,
} from "../../lib/whatsapp-utils";
import {
  segmentLabels,
  daysSince,
  getItemsLabel,
  getOrderRef,
  buildCustomers,
  getSegmentCount,
} from "../../lib/crm-utils";
import { CrmHero, StatTile } from "./components/CrmHero";
import { CustomerCard } from "./components/CustomerCard";
import { CustomerSheet } from "./components/CustomerSheet";
import { EmptyCrm } from "./components/EmptyCrm";
import TikchopLottie from "../components/TikchopLottie";

const DJASSAMAN_PRESET = {
  bot_tone: "Francais ivoirien simple, chaud et convaincant. Parle comme un bon vendeur WhatsApp: poli, direct, rassurant, jamais robotique.",
  bot_greeting: "Bonjour, bienvenue chez nous. Dites-moi ce que vous cherchez, je vous montre les articles disponibles et je vous aide a commander rapidement.",
  bot_payment_preferences: "Proposer le paiement a la livraison en premier quand la zone le permet, puis Wave, Orange Money, MTN MoMo ou Djamo. Toujours confirmer le montant total avant d'encaisser.",
  bot_delivery_notes: "Demander quartier, commune, point de repere et numero joignable. Apres paiement ou confirmation, envoyer les infos utiles au livreur par WhatsApp et tenir le client informe.",
  bot_special_rules: "Toujours verifier stock, taille/couleur et prix avant de confirmer. Envoyer un recu ou recap clair au client. Relancer poliment si le client hesite, sans forcer.",
};

export default function CrmPage() {
  const seller = useActiveSeller();

  /* ── WhatsApp connection state ── */
  const [connection, setConnection] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [watchingConnection, setWatchingConnection] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+225 ");
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [settings, setSettings] = useState({
    bot_tone: "",
    bot_greeting: "",
    bot_payment_preferences: "",
    bot_delivery_notes: "",
    bot_special_rules: "",
  });

  /* ── CRM state ── */
  const [orders, setOrders] = useState([]);
  const [crmLoading, setCrmLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const status = useMemo(() => statusCopy(connection), [connection]);
  const storedWhatsAppNumber = normalizeWhatsAppInput(connection?.phone ? `+${connection.phone}` : seller.phone_number || "+225 ");
  const currentWhatsAppNumber = phoneEdited ? whatsappNumber : storedWhatsAppNumber;
  const phoneDigits = getPhoneDigits(currentWhatsAppNumber);
  const phoneReady = phoneDigits.length >= 11;
  const isConnected = Boolean(connection?.isConnected);

  /* ── Fetch WhatsApp + CRM data ── */
  const fetchAll = useCallback(async function fetchAll() {
    if (!seller.slug) return;
    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const [connectionData, settingsData, orderData] = await Promise.all([
        getSellerWhatsAppConnection(seller, token),
        getSellerChatbotSettings(seller, token),
        getSellerOrders(seller.slug, token),
      ]);
      setConnection(connectionData);
      setSettings(settingsData);
      setOrders(orderData || []);
    } catch (err) {
      setError(friendlyError(err, "Donnees non chargees. Actualisez."));
    } finally {
      setLoading(false);
      setCrmLoading(false);
    }
  }, [seller]);

  useEffect(() => {
    const t = setTimeout(() => fetchAll(), 0);
    return () => clearTimeout(t);
  }, [fetchAll]);

  /* ── Polling when waiting for WhatsApp scan ── */
  useEffect(() => {
    if (!watchingConnection || !seller.slug || connection?.isConnected) return undefined;
    let alive = true;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const token = await getSellerAccessToken();
        const data = await getSellerWhatsAppConnection(seller, token);
        if (!alive) return;
        setConnection(data);
        if (data.isConnected) {
          setWatchingConnection(false);
          setPairing(null);
          setMessage("WhatsApp connecte. DJASSAMAN peut maintenant repondre a vos clients.");
          window.clearInterval(interval);
        } else if (attempts >= 18) {
          setWatchingConnection(false);
          setMessage("Le code attend la validation. Generez un nouveau code si besoin.");
          window.clearInterval(interval);
        }
      } catch {
        if (!alive) return;
      }
    }, 5000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [connection?.isConnected, seller, watchingConnection]);

  /* ── WhatsApp actions ── */
  async function connectWhatsApp() {
    try {
      setBusy("pairing");
      setError("");
      setMessage("");
      const normalizedPhone = normalizeWhatsAppInput(currentWhatsAppNumber);
      if (getPhoneDigits(normalizedPhone).length < 11) {
        setError("Ajoutez le numero WhatsApp avant de generer le code.");
        setBusy("");
        return;
      }
      const token = await getSellerAccessToken();
      const data = await requestSellerWhatsAppPairing(seller, token, normalizedPhone);
      const savedPhone = data.phoneDisplay || (data.phone ? `+${data.phone}` : normalizedPhone);
      setWhatsappNumber(normalizeWhatsAppInput(savedPhone));
      setPhoneEdited(false);
      writeActiveSeller({ ...seller, phone_number: savedPhone });
      setPairing(data);
      setConnection((c) => ({ ...(c || {}), instanceName: data.instanceName, phone: data.phone, state: "pairing", isConnected: false, webhookUrl: data.webhookUrl, error: "" }));
      setWatchingConnection(true);
      setMessage(data.pairingCode
        ? "Code genere. Entrez-le dans WhatsApp > Appareils connectes > Lier avec un numero."
        : "QR genere. Scannez-le avec WhatsApp sur votre telephone.");
    } catch (err) {
      setError(friendlyError(err, "Connexion non lancee. Verifiez le numero."));
    } finally {
      setBusy("");
    }
  }

  async function regeneratePairingCode() {
    try {
      setBusy("code");
      setError("");
      setMessage("");
      const normalizedPhone = normalizeWhatsAppInput(currentWhatsAppNumber);
      if (getPhoneDigits(normalizedPhone).length < 11) {
        setError("Ajoutez le numero WhatsApp avant de regenerer le code.");
        setBusy("");
        return;
      }
      const token = await getSellerAccessToken();
      const data = await refreshSellerWhatsAppPairingCode(seller, token, normalizedPhone);
      const savedPhone = data.phoneDisplay || (data.phone ? `+${data.phone}` : normalizedPhone);
      setWhatsappNumber(normalizeWhatsAppInput(savedPhone));
      setPhoneEdited(false);
      writeActiveSeller({ ...seller, phone_number: savedPhone });
      setPairing(data);
      setConnection((c) => ({ ...(c || {}), instanceName: data.instanceName, phone: data.phone, state: "pairing", isConnected: false, error: "" }));
      setWatchingConnection(true);
      setMessage("Nouveau code genere.");
    } catch (err) {
      setError(friendlyError(err, "Code non regenere. Reessayez."));
    } finally {
      setBusy("");
    }
  }

  async function disconnectWhatsApp() {
    if (!window.confirm("Deconnecter ce numero WhatsApp ?")) return;
    try {
      setBusy("disconnect");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await disconnectSellerWhatsApp(seller, token);
      setPairing(null);
      setWatchingConnection(false);
      setConnection((c) => ({ ...(c || {}), ...data }));
      setMessage("WhatsApp deconnecte.");
    } catch (err) {
      setError(friendlyError(err, "Deconnexion echouee."));
    } finally {
      setBusy("");
    }
  }

  async function copyPairingCode() {
    if (!pairing?.pairingCode) return;
    await navigator.clipboard.writeText(pairing.pairingCode);
    setMessage("Code copie.");
  }

  /* ── Chatbot settings ── */
  function updateSetting(field, value) {
    setSettings((c) => ({ ...c, [field]: value }));
  }

  function applyDjassamanPreset() {
    setSettings((c) => ({ ...c, ...DJASSAMAN_PRESET }));
    setMessage("Preset DJASSAMAN applique. Relisez, puis enregistrez.");
    setError("");
  }

  async function saveChatbotSettings() {
    try {
      setBusy("settings");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await saveSellerChatbotSettings(seller, settings, token);
      setSettings(data);
      setMessage("Style DJASSAMAN enregistre.");
    } catch (err) {
      setError(friendlyError(err, "Reglages non enregistres."));
    } finally {
      setBusy("");
    }
  }

  /* ── CRM data ── */
  const customers = useMemo(() => buildCustomers(orders), [orders]);
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchSeg = segment === "ALL"
        || (segment === "FOLLOW_UP" && c.shouldFollowUp)
        || (segment === "LOYAL" && c.isLoyal)
        || (segment === "NEW" && c.orderCount === 1);
      if (!matchSeg) return false;
      if (!q) return true;
      return [c.phone, c.zone, c.address, getItemsLabel(c.lastOrder), getOrderRef(c.lastOrder)].join(" ").toLowerCase().includes(q);
    });
  }, [customers, query, segment]);
  const crmStats = useMemo(() => ({
    followUpCount: customers.filter((c) => c.shouldFollowUp).length,
    loyalCount: customers.filter((c) => c.isLoyal).length,
    activeCount: customers.filter((c) => daysSince(c.lastOrder?.created_at) <= 30).length,
    estimatedSales: customers.reduce((t, c) => t + c.totalSpent, 0),
  }), [customers]);

  return (
    <div className="app-shell md:max-w-[860px] pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="quiet-label text-[#c2572b]">Assistant</p>
          <h1 className="mt-1 font-display text-3xl font-black leading-10 text-[#2b2219]">DJASSAMAN</h1>
        </div>
        <button onClick={fetchAll} disabled={loading} className="app-icon-button bg-[#2b2219] text-white" aria-label="Actualiser">
          <RefreshCw size={19} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* ── Status banner ── */}
      {(message || error) && (
        <div className={`mt-3 rounded-[18px] p-3.5 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#fbeee0] text-[#96451f] ring-1 ring-[#fbefe2]"}`}>
          {error || message}
        </div>
      )}

      {/* ═══ STEP 1: WhatsApp Connection ═══ */}
      {!isConnected ? (
        <section className="mt-4 overflow-hidden rounded-[26px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10 shadow-[0_2px_14px_rgba(43,34,25,0.07)]">
          <div className="flex items-center justify-between border-b border-[#2b2219]/8 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">
              <Bot size={15} />
              Connecter WhatsApp
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-black ${isConnected ? "bg-[#fbefe2] text-[#96451f]" : "bg-[#2b2219]/7 text-[#2b2219]/50"}`}>
              {status?.icon}
              {status?.label || "Pret"}
            </span>
          </div>

          <div className="p-4">
            {/* Phone input */}
            <label className="block text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#2b2219]/60">Numero WhatsApp</label>
            <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#2b2219]/10 px-3 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c2572b]/10 text-[#c2572b]">
                <Phone size={17} />
              </span>
              <input
                value={currentWhatsAppNumber}
                onBlur={() => setWhatsappNumber((c) => normalizeWhatsAppInput(c))}
                onChange={(e) => { setPhoneEdited(true); setWhatsappNumber(e.target.value); }}
                inputMode="tel"
                autoComplete="tel"
                className="min-h-11 w-full bg-transparent text-base font-black text-[#2b2219] outline-none placeholder:text-[#2b2219]/30"
                placeholder="+225 07 00 00 00 00"
              />
            </div>
            {!phoneReady && (
              <p className="mt-2 text-xs font-bold text-[#2b2219]/40">Numero complet requis (11 chiffres minimum).</p>
            )}

            {/* Pairing code display */}
            {pairing?.pairingCode && (
              <div className="mt-3 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#2b2219]/10">
                <div className="flex items-center justify-between border-b border-[#2b2219]/6 px-4 py-2.5">
                  <p className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Code temporaire</p>
                  <button type="button" onClick={copyPairingCode} className="app-icon-button" aria-label="Copier">
                    <Copy size={15} />
                  </button>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="font-display text-3xl font-black tracking-wider text-[#2b2219]">{formatPairingCode(pairing.pairingCode)}</p>
                  <p className="mt-1.5 text-xs font-bold text-[#2b2219]/45">{getPairingValidityLabel(pairing)}</p>
                </div>
              </div>
            )}

            {watchingConnection && (
              <p className="mt-3 flex items-center gap-2 rounded-[14px] bg-[#fbefe2] px-3 py-2.5 text-sm font-bold text-[#96451f]">
                <Loader2 className="animate-spin" size={15} />
                Verification en cours...
              </p>
            )}

            {/* CTA */}
            <div className="mt-4 grid gap-2.5">
              <button
                type="button"
                onClick={pairing ? regeneratePairingCode : connectWhatsApp}
                disabled={busy === "pairing" || busy === "code" || !phoneReady}
                className="flex min-h-[54px] items-center justify-center gap-2 rounded-[20px] bg-[#2b2219] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(43,34,25,0.18)] disabled:opacity-50"
              >
                {busy === "pairing" || busy === "code" ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {!phoneReady ? "Ajoutez le numero" : pairing ? "Regenerer le code" : "Generer le code WhatsApp"}
              </button>
              <button
                type="button"
                onClick={() => fetchAll()}
                disabled={loading}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] bg-[#2b2219]/7 px-4 text-sm font-black text-[#2b2219] disabled:opacity-50"
              >
                <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
                Verifier la connexion
              </button>
            </div>

            {/* Help text */}
            <div className="mt-4 rounded-[14px] bg-white/60 p-3 text-xs font-semibold leading-5 text-[#2b2219]/50 ring-1 ring-[#2b2219]/6">
              <p className="font-extrabold text-[#2b2219]/70">Comment faire :</p>
              <p className="mt-1">1. Entrez votre numero WhatsApp vendeur.</p>
              <p>2. Appuyez sur &quot;Generer le code&quot;.</p>
              <p>3. Ouvrez WhatsApp &gt; Appareils connectes &gt; Lier avec un numero.</p>
              <p>4. Entrez le code affiche ici.</p>
            </div>
          </div>
        </section>
      ) : (
        /* ═══ Connected status ═══ */
        <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-[#fbefe2] p-3.5 ring-1 ring-[#c2572b]/15">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#c2572b]/15 text-[#c2572b]">
            <CheckCircle2 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#2b2219]">WhatsApp connecte</p>
            <p className="text-xs font-bold text-[#2b2219]/50 truncate">{connection.phone ? `+${connection.phone}` : seller.phone_number}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/messages"
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#2b2219] px-3.5 text-xs font-black text-white no-underline"
            >
              <MessageCircle size={13} />
              Messages
            </Link>
            <button
              type="button"
              onClick={disconnectWhatsApp}
              disabled={busy === "disconnect"}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#2b2219]/8 px-3 text-xs font-black text-[#2b2219] disabled:opacity-50"
            >
              {busy === "disconnect" ? <Loader2 className="animate-spin" size={13} /> : <Power size={13} />}
              Retirer
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: DJASSAMAN Style ═══ */}
      <section className="mt-4 overflow-hidden rounded-[26px] bg-white ring-1 ring-[#2b2219]/8 shadow-[0_2px_12px_rgba(43,34,25,0.05)]">
        <div className="flex items-center justify-between border-b border-[#2b2219]/6 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#2b2219] text-[#f0954c]">
              <Bot size={16} />
            </span>
            <div>
              <p className="text-sm font-black text-[#2b2219]">Style DJASSAMAN</p>
              <p className="text-[0.62rem] font-bold text-[#2b2219]/45">Comment il parle a vos clients</p>
            </div>
          </div>
          <button
            type="button"
            onClick={applyDjassamanPreset}
            className="shrink-0 rounded-[12px] bg-[#261e16] px-3 py-1.5 text-[0.66rem] font-black text-[#f0954c]"
          >
            Preset
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Ton & personnalite</label>
            <textarea
              value={settings.bot_tone}
              onChange={(e) => updateSetting("bot_tone", e.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_tone}
              className="mt-1.5 min-h-[72px] w-full resize-none rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
          <div>
            <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Message d&apos;accueil</label>
            <input
              value={settings.bot_greeting}
              onChange={(e) => updateSetting("bot_greeting", e.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_greeting}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
          <div>
            <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Paiement</label>
            <textarea
              value={settings.bot_payment_preferences}
              onChange={(e) => updateSetting("bot_payment_preferences", e.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_payment_preferences}
              className="mt-1.5 min-h-[68px] w-full resize-none rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
          <div>
            <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Livraison</label>
            <textarea
              value={settings.bot_delivery_notes}
              onChange={(e) => updateSetting("bot_delivery_notes", e.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_delivery_notes}
              className="mt-1.5 min-h-[68px] w-full resize-none rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
          <div>
            <label className="block text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Regles speciales</label>
            <textarea
              value={settings.bot_special_rules}
              onChange={(e) => updateSetting("bot_special_rules", e.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_special_rules}
              className="mt-1.5 min-h-[68px] w-full resize-none rounded-[14px] bg-[#fbf6ee] px-3.5 py-2.5 text-sm font-semibold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 placeholder:text-[#2b2219]/30 focus:ring-2 focus:ring-[#c2572b]/30"
            />
          </div>
          <button
            type="button"
            onClick={saveChatbotSettings}
            disabled={busy === "settings"}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#261e16,#8a3c1c)] px-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(38,30,22,0.16)] disabled:opacity-60"
          >
            {busy === "settings" ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
            Enregistrer le style
          </button>
        </div>
      </section>

      {/* ═══ STEP 3: Customer List ═══ */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-[#2b2219]">Clients</h2>
          <span className="text-xs font-black text-[#2b2219]/40">{customers.length}</span>
        </div>

        <CrmHero stats={crmStats} totalCustomers={customers.length} />

        <div className="mt-3 grid grid-cols-3 gap-px bg-[#2b2219]/8 overflow-hidden rounded-[18px] ring-1 ring-[#2b2219]/10">
          <StatTile label="A relancer" value={crmStats.followUpCount} tone="dark" />
          <StatTile label="Bons clients" value={crmStats.loyalCount} tone="green" />
          <StatTile label="Actifs" value={crmStats.activeCount} />
        </div>

        <div className="mt-3 overflow-hidden rounded-[18px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/8">
          <label className="flex min-h-[44px] items-center gap-2 px-3">
            <Search size={16} className="shrink-0 text-[#c2572b]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#2b2219] outline-none placeholder:text-[#2b2219]/35"
              placeholder="Rechercher un client..."
            />
          </label>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {["ALL", "FOLLOW_UP", "LOYAL", "NEW"].map((item) => {
            const active = segment === item;
            return (
              <button
                key={item}
                onClick={() => setSegment(item)}
                className={`flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition-colors ${
                  active ? "bg-[#2b2219] text-white" : "bg-white text-[#2b2219] ring-1 ring-[#2b2219]/10"
                }`}
              >
                {segmentLabels[item]}
                <span className={`rounded-full px-1.5 py-0.5 text-[0.56rem] font-black ${active ? "bg-white/15 text-white" : "bg-[#c2572b]/10 text-[#c2572b]"}`}>
                  {getSegmentCount(customers, item)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {crmLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#c2572b] border-t-transparent" />
              <p className="mt-3 font-black text-[#2b2219]/35 text-sm">Chargement...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <EmptyCrm query={query} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  key={customer.key}
                  customer={customer}
                  sellerName={seller.name}
                  onOpen={() => setSelectedCustomer(customer)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedCustomer && (
        <CustomerSheet
          customer={selectedCustomer}
          sellerName={seller.name}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
