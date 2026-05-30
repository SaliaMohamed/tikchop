"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  MonitorSmartphone,
  Package,
  Phone,
  PlugZap,
  Power,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Truck,
  Unplug,
} from "lucide-react";
import {
  activateSellerStandardAssistant,
  disconnectSellerWhatsApp,
  getSellerChatbotSettings,
  getSellerWhatsAppConnection,
  requestSellerWhatsAppPairing,
  repairSellerWhatsAppWebhook,
  refreshSellerWhatsAppPairingCode,
  saveSellerChatbotSettings,
} from "../seller-actions";
import { useActiveSeller, writeActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

function formatPairingCode(code) {
  return String(code || "").match(/.{1,4}/g)?.join(" ") || code || "";
}

function getPairingValidityLabel(pairing) {
  if (!pairing?.pairingExpiresAt) return "Valable quelques minutes.";
  const expiresAt = new Date(pairing.pairingExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return "Valable quelques minutes.";
  const minutes = Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000));
  return `Valable environ ${minutes} min. Regenere si WhatsApp refuse.`;
}

function normalizeWhatsAppInput(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "+225 ";
  if (digits.startsWith("225")) return `+${digits}`;
  if (digits.length <= 10) return `+225 ${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

function getPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function statusCopy(connection) {
  if (!connection) {
    return {
      label: "Verification...",
      tone: "bg-[var(--surface-mid)] text-[var(--text-dim)]",
      icon: <Loader2 className="animate-spin" size={18} />,
    };
  }

  if (connection.isConnected) {
    return {
      label: connection.provider === "tikchop_standard" ? "Standard actif" : "Connecte",
      tone: "bg-emerald-100 text-emerald-800",
      icon: <CheckCircle2 size={18} />,
    };
  }

  if (connection.state === "pairing" || connection.state === "connecting") {
    return {
      label: "En attente",
      tone: "bg-amber-100 text-amber-800",
      icon: <KeyRound size={18} />,
    };
  }

  if (connection.state === "error") {
    return {
      label: "Erreur",
      tone: "bg-red-100 text-red-800",
      icon: <Unplug size={18} />,
    };
  }

  return {
    label: "Deconnecte",
    tone: "bg-zinc-100 text-zinc-700",
    icon: <Unplug size={18} />,
  };
}

const DJASSAMAN_PRESET = {
  bot_tone: "Francais ivoirien simple, chaud et convaincant. Parle comme un bon vendeur WhatsApp: poli, direct, rassurant, jamais robotique.",
  bot_greeting: "Bonjour, bienvenue chez nous. Dites-moi ce que vous cherchez, je vous montre les articles disponibles et je vous aide a commander rapidement.",
  bot_payment_preferences: "Proposer le paiement a la livraison en premier quand la zone le permet, puis Wave, Orange Money, MTN MoMo ou Djamo. Toujours confirmer le montant total avant d'encaisser.",
  bot_delivery_notes: "Demander quartier, commune, point de repere et numero joignable. Apres paiement ou confirmation, envoyer les infos utiles au livreur par WhatsApp et tenir le client informe.",
  bot_special_rules: "Toujours verifier stock, taille/couleur et prix avant de confirmer. Envoyer un recu ou recap clair au client. Relancer poliment si le client hesite, sans forcer.",
};

export default function WhatsAppPage() {
  const seller = useActiveSeller();
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

  const status = useMemo(() => statusCopy(connection), [connection]);
  const storedWhatsAppNumber = normalizeWhatsAppInput(connection?.phone ? `+${connection.phone}` : seller.phone_number || "+225 ");
  const currentWhatsAppNumber = phoneEdited ? whatsappNumber : storedWhatsAppNumber;
  const phoneDigits = getPhoneDigits(currentWhatsAppNumber);
  const phoneReady = phoneDigits.length >= 11;

  async function refreshConnection() {
    if (!seller.slug) return;

    try {
      setError("");
      setLoading(true);
      const token = await getSellerAccessToken();
      const data = await getSellerWhatsAppConnection(seller, token);
      setConnection(data);
    } catch (err) {
      setError(friendlyError(err, "WhatsApp non verifie. Actualise dans quelques secondes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!seller.slug) return;

    let alive = true;
    getSellerAccessToken()
      .then(async (token) => {
        const [connectionData, settingsData] = await Promise.all([
          getSellerWhatsAppConnection(seller, token),
          getSellerChatbotSettings(seller, token),
        ]);
        return { connectionData, settingsData };
      })
      .then(({ connectionData, settingsData }) => {
        if (alive) {
          setConnection(connectionData);
          setSettings(settingsData);
        }
      })
      .catch((err) => {
        if (alive) setError(friendlyError(err, "WhatsApp non verifie. Actualise dans quelques secondes."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [seller]);

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
          setMessage("WhatsApp est connecte. Le chatbot peut maintenant repondre aux clients.");
          window.clearInterval(interval);
        } else if (attempts >= 18) {
          setWatchingConnection(false);
          setMessage("Le code attend toujours la validation WhatsApp. Genere un nouveau code si celui-ci expire.");
          window.clearInterval(interval);
        }
      } catch (err) {
        if (!alive) return;
        setError(friendlyError(err, "Verification WhatsApp en attente."));
      }
    }, 5000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [connection?.isConnected, seller, watchingConnection]);

  async function connectWhatsApp() {
    try {
      setBusy("pairing");
      setError("");
      setMessage("");
      const normalizedPhone = normalizeWhatsAppInput(currentWhatsAppNumber);
      if (getPhoneDigits(normalizedPhone).length < 11) {
        setError("Ajoute le numero WhatsApp vendeur avant de generer le QR.");
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
      setConnection((current) => ({
        ...(current || {}),
        instanceName: data.instanceName,
        phone: data.phone,
        state: "pairing",
        isConnected: false,
        webhookUrl: data.webhookUrl,
        error: "",
      }));
      setWatchingConnection(true);
      setMessage(data.pairingCode
        ? "QR et code generes. Scanne le QR ou entre le code dans WhatsApp si l'option par numero apparait."
        : "QR genere. Scanne-le avec WhatsApp sur ton telephone. Tikchop verifie automatiquement la connexion.");
    } catch (err) {
      setError(friendlyError(err, "Connexion WhatsApp non lancee. Verifiez le numero de la boutique ou contactez le support Tikchop."));
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
        setError("Ajoute le numero WhatsApp vendeur avant de regenerer le code.");
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
      setConnection((current) => ({
        ...(current || {}),
        instanceName: data.instanceName,
        phone: data.phone,
        state: "pairing",
        isConnected: false,
        error: "",
      }));
      setWatchingConnection(true);
      setMessage(data.pairingCode
        ? "Code WhatsApp temporaire genere. Ouvre WhatsApp > Appareils connectes > Lier avec un numero."
        : "Code non recu. Reessaie ou utilise le QR.");
    } catch (err) {
      setError(friendlyError(err, "Code WhatsApp non regenere. Reessayez ou utilisez le QR."));
    } finally {
      setBusy("");
    }
  }

  async function activateStandardAssistant() {
    try {
      setBusy("standard");
      setError("");
      setMessage("");
      setPairing(null);
      setWatchingConnection(false);
      const token = await getSellerAccessToken();
      const data = await activateSellerStandardAssistant(seller, token);
      setConnection((current) => ({
        ...(current || {}),
        ...data,
      }));
      setMessage(data.message || "Assistant Standard active.");
    } catch (err) {
      setError(friendlyError(err, "Assistant Standard non active. Reessayez ou contactez le support Tikchop."));
    } finally {
      setBusy("");
    }
  }

  async function disconnectWhatsApp() {
    if (!window.confirm("Deconnecter ce numero WhatsApp de Tikchop ?")) return;

    try {
      setBusy("disconnect");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await disconnectSellerWhatsApp(seller, token);
      setPairing(null);
      setWatchingConnection(false);
      setConnection((current) => ({
        ...(current || {}),
        ...data,
      }));
      setMessage("WhatsApp est deconnecte pour cette boutique.");
    } catch (err) {
      setError(friendlyError(err, "WhatsApp reste connecte pour le moment."));
    } finally {
      setBusy("");
    }
  }

  async function repairWebhook() {
    try {
      setBusy("webhook");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await repairSellerWhatsAppWebhook(seller, token);
      setConnection((current) => ({
        ...(current || {}),
        ...data,
      }));
      setMessage("Connexion reparee. Les photos et vocaux des clients peuvent maintenant arriver au chatbot.");
    } catch (err) {
      setError(friendlyError(err, "Connexion WhatsApp non reparee. Reessayez ou contactez le support Tikchop."));
    } finally {
      setBusy("");
    }
  }

  async function copyPairingCode() {
    if (!pairing?.pairingCode) return;
    await navigator.clipboard.writeText(pairing.pairingCode);
    setMessage("Code copie.");
  }

  async function saveChatbotSettings() {
    try {
      setBusy("settings");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await saveSellerChatbotSettings(seller, settings, token);
      setSettings(data);
      setMessage("Reglages chatbot enregistres.");
    } catch (err) {
      setError(friendlyError(err, "Reglages chatbot non enregistres."));
    } finally {
      setBusy("");
    }
  }

  function updateSetting(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function applyDjassamanPreset() {
    setSettings((current) => ({
      ...current,
      ...DJASSAMAN_PRESET,
    }));
    setMessage("Preset Djassaman applique. Relis vite, puis appuie sur Enregistrer le style.");
    setError("");
  }

  const qrSource = pairing?.qrBase64
    ? pairing.qrBase64.startsWith("data:")
      ? pairing.qrBase64
      : `data:image/png;base64,${pairing.qrBase64}`
    : "";

  return (
    <div className="app-shell md:max-w-[1120px]">
      {/* Desktop-only header */}
      <header className="mobile-top hidden md:block">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="quiet-label text-[#008f5a]">Chatbot</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[#07120d]">WhatsApp</h1>
            <p className="mt-1 text-sm leading-5 text-[#07120d]/55">{seller.name}</p>
          </div>
          <button
            type="button"
            onClick={refreshConnection}
            disabled={loading}
            className="app-icon-button bg-[#07120d] text-white"
            aria-label="Actualiser WhatsApp"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
          </button>
        </div>
      </header>

      <main className="mt-4 space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:space-y-6 md:pb-10">
        <MobileWhatsAppPwaPanel
          busy={busy}
          connection={connection}
          currentWhatsAppNumber={currentWhatsAppNumber}
          loading={loading}
          pairing={pairing}
          phoneReady={phoneReady}
          qrSource={qrSource}
          status={status}
          watchingConnection={watchingConnection}
          onActivateStandard={activateStandardAssistant}
          onConnect={connectWhatsApp}
          onCopyPairingCode={copyPairingCode}
          onDisconnect={disconnectWhatsApp}
          onPhoneBlur={() => setWhatsappNumber((current) => normalizeWhatsAppInput(current))}
          onPhoneChange={(value) => {
            setPhoneEdited(true);
            setWhatsappNumber(value);
          }}
          onRefresh={refreshConnection}
          onRefreshPairingCode={regeneratePairingCode}
        />

        <section className="hidden overflow-hidden rounded-[32px] bg-[#06110c] p-4 text-white shadow-[0_28px_70px_rgba(8,18,13,0.22)] md:grid md:min-h-[520px] md:grid-cols-[minmax(0,0.9fr)_minmax(430px,1.1fr)] md:gap-6 md:p-6 lg:p-8">
          <div className="relative z-10 flex min-w-0 flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary-bright)] ring-1 ring-white/10">
                  <MonitorSmartphone size={15} />
                  QR sur second ecran
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${connection?.isConnected ? "bg-[var(--primary-bright)] text-[#07100a]" : "bg-white/10 text-white/78"}`}>
                  {status.icon}
                  {status.label}
                </span>
              </div>
              <h1 className="mt-5 font-display text-[2.55rem] font-black leading-[2.65rem] text-white md:text-[4rem] md:leading-[4rem]">
                Scannez le QR. Tikchop vend avec votre WhatsApp.
              </h1>
              <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-white/72">
                Ouvrez cette page sur un ordinateur ou un autre telephone, puis scannez le QR avec WhatsApp. Sur un seul telephone, utilisez le code WhatsApp temporaire ou activez le numero Tikchop Standard.
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:max-w-[560px]">
              <button
                type="button"
                onClick={connectWhatsApp}
                disabled={busy === "pairing" || !phoneReady}
                className="flex min-h-[62px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-5 text-base font-black text-[#07120d] shadow-[0_18px_38px_rgba(57,245,142,0.23)] disabled:opacity-70"
              >
                {busy === "pairing" ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={21} />}
                {!phoneReady ? "Ajoute le numero" : pairing ? "Regenerer le QR" : "Generer le QR WhatsApp"}
              </button>
              <div className="grid gap-2 min-[520px]:grid-cols-2">
                <button
                  type="button"
                  onClick={refreshConnection}
                  disabled={loading}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/12 disabled:opacity-60"
                >
                  <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
                  Verifier
                </button>
                <button
                  type="button"
                  onClick={disconnectWhatsApp}
                  disabled={busy === "disconnect" || !connection?.instanceName}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/12 disabled:opacity-45"
                >
                  {busy === "disconnect" ? <Loader2 className="animate-spin" size={17} /> : <Power size={17} />}
                  Deconnecter
                </button>
              </div>
            </div>
          </div>

          <QrConnectionPanel
            pairing={pairing}
            qrSource={qrSource}
            connection={connection}
            whatsappNumber={currentWhatsAppNumber}
            phoneReady={phoneReady}
            busy={busy}
            loading={loading}
            watchingConnection={watchingConnection}
            onConnect={connectWhatsApp}
            onRefresh={refreshConnection}
            onRefreshPairingCode={regeneratePairingCode}
            onPhoneChange={(value) => {
              setPhoneEdited(true);
              setWhatsappNumber(value);
            }}
            onPhoneBlur={() => setWhatsappNumber((current) => normalizeWhatsAppInput(current))}
            onCopyPairingCode={copyPairingCode}
          />
        </section>

        {(message || error || connection?.error) && (
          <div className={`rounded-[22px] p-4 text-sm font-bold leading-5 ${error || connection?.error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#eafff1] text-[#005f3d] ring-1 ring-emerald-200"}`}>
            {error || connection?.error || message}
          </div>
        )}

        <section className="hidden gap-3 md:grid md:grid-cols-3">
          <InfoTile icon={<MessageCircle size={20} />} title="Repond" text="Prix, stock, disponibilite." />
          <InfoTile icon={<Banknote size={20} />} title="Encaisse" text="Wave, OM, MoMo ou livraison." />
          <InfoTile icon={<Truck size={20} />} title="Livre" text="Recap clair au livreur." />
        </section>

        <section className="hidden rounded-[28px] bg-white p-5 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)] md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-5">
          <div>
            <p className="quiet-label text-[var(--primary)]">Alternative simple</p>
            <h2 className="mt-1 font-display text-2xl font-black text-[var(--text-main)]">Pas envie de scanner maintenant ?</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-dim)]">
              Active le numero Tikchop Standard. Les clients passent par Tikchop, et tes commandes arrivent dans ton dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={activateStandardAssistant}
            disabled={busy === "standard" || connection?.provider === "tikchop_standard"}
            className="mt-4 flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#08120d] px-5 text-sm font-black text-white disabled:opacity-60 md:mt-0"
          >
            {busy === "standard" ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            {connection?.provider === "tikchop_standard" ? "Standard actif" : "Activer Standard"}
          </button>
        </section>

        <section className="hidden djassa-command p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">Premium avance</p>
              <p className="mt-1 break-words font-display text-2xl font-bold text-white">
                {seller.phone_number || "Numero non renseigne"}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-white/72">
                Connexion directe au WhatsApp du vendeur. A utiliser seulement si le vendeur peut scanner un QR depuis un second ecran.
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold shadow-[0_10px_22px_rgba(0,0,0,0.14)] ${connection?.isConnected ? "bg-[var(--primary-bright)] text-[#07100a]" : "bg-white/14 text-white/82"}`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={disconnectWhatsApp}
              disabled={busy === "disconnect" || !connection?.instanceName}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/12 px-4 text-sm font-extrabold text-white shadow-sm disabled:opacity-50"
            >
              {busy === "disconnect" ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
              Deconnecter Premium
            </button>
          </div>

          {connection && (
            <p className="mt-3 text-xs font-bold leading-4 text-white/62">
              Photos et vocaux: {connection.webhookBase64 ? "actifs" : "a reparer"}
            </p>
          )}
        </section>

        {pairing && (
          <section className="hidden app-card p-5">
            <div className="flex items-start gap-3">
              <span className="app-icon-pill shrink-0 bg-[var(--surface-soft)] text-[var(--primary)]">
                <KeyRound size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="quiet-label">Code d&apos;appairage</p>
                  {watchingConnection && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[0.66rem] font-extrabold text-amber-800">
                      <Loader2 className="animate-spin" size={13} />
                      Verification
                    </span>
                  )}
                </div>
                {pairing.pairingCode ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="font-display text-3xl font-bold tracking-normal text-[var(--primary)]">
                      {formatPairingCode(pairing.pairingCode)}
                    </p>
                    <button
                      type="button"
                      onClick={copyPairingCode}
                      className="app-icon-button"
                      aria-label="Copier le code"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-bold text-[var(--text-dim)]">Aucun code retourne pour cette tentative.</p>
                )}
                <div className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                  <p className="font-extrabold text-[var(--text-main)]">Option 1: scanner le QR code</p>
                  <p className="mt-1">Ouvre WhatsApp sur le telephone vendeur, puis Appareils connectes, Connecter un appareil, et scanne le QR affiche ici.</p>
                  {pairing.pairingCode && (
                    <>
                      <p className="mt-3 font-extrabold text-[var(--text-main)]">Option 2: code si WhatsApp le propose</p>
                      <p className="mt-1">Si WhatsApp affiche “connecter avec un numero de telephone”, entre le code ci-dessus.</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={refreshConnection}
                  disabled={loading}
                  className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] disabled:opacity-60"
                >
                  <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
                  Verifier maintenant
                </button>
              </div>
            </div>

            {qrSource && (
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-white p-4 ring-1 ring-[var(--outline)]/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSource} alt="QR WhatsApp" className="h-60 w-60 max-w-full object-contain" />
                <p className="mt-3 text-center text-xs font-bold leading-4 text-[var(--text-dim)]">
                  Si le code est refuse, scanne ce QR depuis WhatsApp. Il expire vite: regenere si necessaire.
                </p>
              </div>
            )}
          </section>
        )}

        {connection?.isConnected && (
          <section className="hidden rounded-lg bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-900 ring-1 ring-emerald-100 md:block">
            Le numero est connecte. Pour tester, envoie un message WhatsApp a cette boutique depuis un autre numero.
          </section>
        )}

        <div className="hidden">
          <SalesAutomationPreview isConnected={connection?.isConnected} onApplyPreset={applyDjassamanPreset} />
        </div>

        <details className="hidden app-card p-5 md:block">
          <summary className="cursor-pointer list-none text-sm font-extrabold text-[var(--text-main)]">
            Options avancees
          </summary>
          <div className="mt-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="quiet-label">Style du Djassaman</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[var(--text-main)]">Vendeur WhatsApp</h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Ces consignes disent a Tikchop comment presenter, encaisser, livrer et fideliser.
              </p>
            </div>
            <button
              type="button"
              onClick={applyDjassamanPreset}
              className="shrink-0 rounded-xl bg-[#08120d] px-3 py-2 text-xs font-extrabold text-[var(--primary-bright)] shadow-[0_12px_24px_rgba(8,18,13,0.16)]"
            >
              Preset
            </button>
          </div>
          <div className="space-y-3">
            <textarea
              value={settings.bot_tone}
              onChange={(event) => updateSetting("bot_tone", event.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_tone}
              className="mobile-input min-h-[82px] resize-none"
            />
            <input
              value={settings.bot_greeting}
              onChange={(event) => updateSetting("bot_greeting", event.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_greeting}
              className="mobile-input"
            />
            <textarea
              value={settings.bot_payment_preferences}
              onChange={(event) => updateSetting("bot_payment_preferences", event.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_payment_preferences}
              className="mobile-input min-h-[82px] resize-none"
            />
            <textarea
              value={settings.bot_delivery_notes}
              onChange={(event) => updateSetting("bot_delivery_notes", event.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_delivery_notes}
              className="mobile-input min-h-[82px] resize-none"
            />
            <textarea
              value={settings.bot_special_rules}
              onChange={(event) => updateSetting("bot_special_rules", event.target.value)}
              placeholder={DJASSAMAN_PRESET.bot_special_rules}
              className="mobile-input min-h-[82px] resize-none"
            />
          </div>
          <button
            type="button"
            onClick={saveChatbotSettings}
            disabled={busy === "settings"}
            className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#08120d,#006540)] px-4 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(8,18,13,0.18)] disabled:opacity-60"
          >
            {busy === "settings" ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Enregistrer le style
          </button>
          </div>
        </details>

        <section className="hidden grid gap-3 min-[420px]:grid-cols-3">
          <InfoTile icon={<MessageCircle size={20} />} title="Reponses" text="Le client parle, Tikchop repond." />
          <InfoTile icon={<Banknote size={20} />} title="Paiement" text="Wave, OM, MoMo, Djamo." />
          <InfoTile icon={<Truck size={20} />} title="Livraison" text="Infos client vers livreur." />
        </section>

        <div className="hidden">
          {(message || error || connection?.error) && (
            <div className={`rounded-lg p-4 text-sm font-bold leading-5 ${error || connection?.error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"}`}>
              {error || connection?.error || message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function QrConnectionPanel({
  pairing,
  qrSource,
  connection,
  whatsappNumber,
  phoneReady,
  busy,
  loading,
  watchingConnection,
  onConnect,
  onRefresh,
  onRefreshPairingCode,
  onPhoneChange,
  onPhoneBlur,
  onCopyPairingCode,
}) {
  const isConnected = Boolean(connection?.isConnected);
  const hasPairing = Boolean(pairing);
  const hasCode = Boolean(pairing?.pairingCode);
  const hasCodeOnlyPairing = pairing?.pairingMode === "code";

  return (
    <div className="mt-6 rounded-[28px] bg-white p-4 text-[var(--text-main)] shadow-[0_24px_60px_rgba(0,0,0,0.22)] ring-1 ring-white/40 md:mt-0 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="quiet-label text-[var(--primary)]">QR Evolution</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 md:text-3xl">Connecter WhatsApp</h2>
        </div>
        {watchingConnection ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
            <Loader2 className="animate-spin" size={14} />
            Verification
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${isConnected ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
            {isConnected ? <CheckCircle2 size={14} /> : <QrCode size={14} />}
            {isConnected ? "Connecte" : "Pret"}
          </span>
        )}
      </div>

      {!isConnected && (
        <div className="mt-5 rounded-[24px] bg-[#07120d] p-3 text-white shadow-[0_18px_38px_rgba(8,18,13,0.16)]">
          <label htmlFor="seller-whatsapp-number" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary-bright)]">
            <Phone size={15} />
            Numero WhatsApp vendeur
          </label>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2 rounded-[18px] bg-white px-3 py-2 text-[#07120d]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--primary)]">
              <Smartphone size={19} />
            </span>
            <input
              id="seller-whatsapp-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsappNumber}
              onChange={(event) => onPhoneChange(event.target.value)}
              onBlur={onPhoneBlur}
              placeholder="+225 07 00 00 00 00"
              className="min-h-12 w-full bg-transparent text-lg font-black tracking-normal outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="mt-2 text-xs font-bold leading-4 text-white/68">
            Le QR sera genere pour ce numero. Mets le numero WhatsApp que le vendeur utilise avec ses clients.
          </p>
          {!phoneReady && (
            <p className="mt-2 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-black leading-4 text-amber-950">
              Entre le numero avant de generer le QR.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-start">
        <div className="rounded-[24px] bg-[var(--surface-soft)] p-4">
          {isConnected ? (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={34} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--text-main)]">WhatsApp est connecte</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Tikchop peut maintenant recevoir les messages et vendre depuis ce numero.
              </p>
              <Link
                href="/messages"
                className="mt-5 flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#08120d] px-5 text-sm font-black text-white no-underline"
              >
                <MessageCircle size={17} />
                Voir les discussions
              </Link>
            </div>
          ) : qrSource ? (
            <div className="flex flex-col items-center justify-center">
              <div className="rounded-[24px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.6)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSource} alt="QR WhatsApp Evolution" className="h-[260px] w-[260px] max-w-full object-contain md:h-[310px] md:w-[310px]" />
              </div>
              <p className="mt-3 text-center text-sm font-black text-[var(--text-main)]">Scanne ce QR avec WhatsApp sur ton telephone.</p>
              <p className="mt-1 text-center text-xs font-bold leading-4 text-[var(--text-dim)]">Le QR expire vite. Regenerer si WhatsApp refuse.</p>
            </div>
          ) : hasPairing ? (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-amber-100 text-amber-800 shadow-[var(--shadow-sm)]">
                <KeyRound size={34} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--text-main)]">
                {pairing.pairingCode ? "Code WhatsApp pret" : "Code non recu"}
              </h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                {pairing.pairingCode
                  ? "Entre le code dans WhatsApp si l'option de liaison avec numero est affichee."
                  : "Genere un code neuf pour la liaison par numero, ou scanne le QR."}
              </p>
              <button
                type="button"
                onClick={onRefreshPairingCode}
                disabled={busy === "code"}
                className="mt-5 flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#08120d] px-5 text-sm font-black text-white disabled:opacity-70"
              >
                {busy === "code" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Reessayer
              </button>
            </div>
          ) : (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]">
                <ScanLine size={36} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--text-main)]">QR pret a generer</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Clique sur le bouton, puis ouvre WhatsApp sur ton telephone pour scanner.
              </p>
              <button
                type="button"
                onClick={onConnect}
                disabled={busy === "pairing" || !phoneReady}
                className="mt-5 flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-[#08120d] px-5 text-sm font-black text-white disabled:opacity-70"
              >
                {busy === "pairing" ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />}
                Generer le QR
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <QrStep icon={<Smartphone size={18} />} title="1. Telephone" text="Ouvre WhatsApp." />
          <QrStep icon={<MonitorSmartphone size={18} />} title="2. Appareils" text="Va dans Appareils connectes." />
          <QrStep icon={<ScanLine size={18} />} title="3. Scan" text="Scanne le QR affiche ici." />
          <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-4 text-amber-900 ring-1 ring-amber-100">
            Sur le meme telephone, le QR est difficile a scanner. Affiche Tikchop sur un autre ecran, ou utilise le code WhatsApp si Appareils connectes propose la liaison par numero.
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="mt-1 flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[var(--outline)] bg-white px-4 text-xs font-black text-[var(--text-main)] disabled:opacity-60"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
            Verifier
          </button>
        </div>
      </div>

      {hasPairing && hasCode && (
        <div className="mt-4 rounded-[22px] border border-[var(--outline)] bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--text-dim)]">Code WhatsApp temporaire</p>
              <p className="mt-1 font-display text-2xl font-black text-[var(--primary)]">{formatPairingCode(pairing.pairingCode)}</p>
            </div>
            <button type="button" onClick={onCopyPairingCode} className="app-icon-button" aria-label="Copier le code WhatsApp temporaire">
              <Copy size={17} />
            </button>
          </div>
          <p className="mt-3 text-xs font-bold leading-4 text-[var(--text-dim)]">
            Ce n&apos;est pas le mot de passe Tikchop. Ouvre WhatsApp, Appareils connectes, puis choisis la liaison avec numero si l&apos;option est affichee. {getPairingValidityLabel(pairing)}
          </p>
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#08120d] px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Generer un nouveau code
          </button>
        </div>
      )}
      {hasPairing && !hasCode && !hasCodeOnlyPairing && (
        <div className="mt-4 rounded-[22px] bg-emerald-50 p-3 text-xs font-bold leading-4 text-emerald-950 ring-1 ring-emerald-100">
          Le QR est pret. Pour connecter sans scanner, genere un code WhatsApp neuf dedie au mode numero.
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#08120d] px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Generer un code WhatsApp
          </button>
        </div>
      )}
      {hasPairing && !pairing.pairingCode && pairing.pairingError && (
        <div className="mt-4 rounded-[22px] bg-amber-50 p-3 text-xs font-bold leading-4 text-amber-900 ring-1 ring-amber-100">
          Le QR est disponible, mais Evolution n&apos;a pas donne de code WhatsApp pour cette tentative. Regenere le QR ou utilise Tikchop sur un second ecran.
          <button
            type="button"
            onClick={onRefreshPairingCode}
            disabled={busy === "code"}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-950 px-4 text-xs font-black text-white disabled:opacity-60"
          >
            {busy === "code" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            Reessayer le code
          </button>
        </div>
      )}
    </div>
  );
}

function QrStep({ icon, title, text }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary)] shadow-sm">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-black text-[var(--text-main)]">{title}</span>
        <span className="mt-0.5 block text-xs font-bold leading-4 text-[var(--text-dim)]">{text}</span>
      </span>
    </div>
  );
}

function SalesAutomationPreview({ isConnected, onApplyPreset }) {
  const steps = [
    {
      icon: <MessageCircle size={18} />,
      title: "Il repond",
      text: "Le client demande un prix, une taille ou une couleur. Tikchop conseille sans attendre.",
    },
    {
      icon: <Package size={18} />,
      title: "Il vend",
      text: "Il presente les articles, confirme le stock et transforme l'interet en commande.",
    },
    {
      icon: <Banknote size={18} />,
      title: "Il encaisse",
      text: "Il propose Wave, Orange Money, MTN MoMo, Djamo ou paiement a la livraison.",
    },
    {
      icon: <Truck size={18} />,
      title: "Il livre",
      text: "Il recupere quartier, repere, numero, puis prepare le message pour le livreur.",
    },
  ];

  return (
    <section className="djassa-command p-5">
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">Automatisation 24h/24</p>
            <h2 className="mt-2 font-display text-[1.85rem] font-bold leading-9">Ton Djassaman digital au travail</h2>
            <p className="mt-2 text-sm font-semibold leading-5 text-white/78">
              Un vrai vendeur WhatsApp qui repond, conseille, prend les commandes, gere le paiement et coordonne la livraison.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold shadow-[0_10px_22px_rgba(0,0,0,0.12)] ${isConnected ? "bg-[var(--primary-bright)] text-[#07100a]" : "bg-white/14 text-white/82"}`}>
            {isConnected ? "Actif" : "A connecter"}
          </span>
        </div>

        <div className="djassa-chat-stack">
          {steps.map((step) => (
            <div key={step.title} className="djassa-chat-bubble grid grid-cols-[auto_1fr] gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#08120d] text-[var(--primary-bright)] ring-1 ring-white/10">
                {step.icon}
              </span>
              <span>
                <span className="block text-sm font-extrabold text-white">{step.title}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-4 text-white/72">{step.text}</span>
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onApplyPreset}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--primary-bright),#ffe66d)] text-sm font-extrabold text-[#07100a] shadow-[0_16px_34px_rgba(57,245,142,0.22)]"
        >
          <ShieldCheck size={18} />
          Appliquer le preset vendeur
        </button>
      </div>
    </section>
  );
}

function WhatsAppStateGuide({ statusLabel, connected, watching, hasError }) {
  const items = [
    {
      label: "Etat",
      value: hasError ? "Erreur" : watching ? "En attente" : connected ? "Connecte" : statusLabel,
      tone: hasError ? "bg-red-50 text-red-800" : connected ? "bg-emerald-50 text-emerald-900" : watching ? "bg-amber-50 text-amber-900" : "bg-white text-[var(--text-main)]",
    },
    {
      label: "A faire",
      value: connected ? "Tester Messages" : watching ? "Ouvrir WhatsApp" : "Entrer le numero",
      tone: "bg-white text-[var(--text-main)]",
    },
    {
      label: "Code",
      value: "Optionnel",
      tone: "bg-white text-[var(--text-main)]",
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-2 rounded-[24px] bg-[var(--surface-soft)] p-2 shadow-[var(--shadow-sm)] ring-1 ring-[var(--line)] md:hidden">
      {items.map((item) => (
        <div key={item.label} className={`rounded-[18px] px-2 py-3 text-center ring-1 ring-[var(--line)] ${item.tone}`}>
          <p className="text-[0.62rem] font-black uppercase leading-3 opacity-60">{item.label}</p>
          <p className="mt-1 truncate text-xs font-black">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function WhatsAppPlans({ connection, busy, onActivateStandard, onConnect, onRepair }) {
  const standardNumber = connection?.standardNumber || process.env.NEXT_PUBLIC_TIKCHOP_WHATSAPP || "";
  const standardHref = standardNumber
    ? `https://wa.me/${standardNumber}?text=${encodeURIComponent("Bonjour Tikchop, je veux activer l'assistant Standard pour ma boutique.")}`
    : "/dashboard";
  const standardActive = connection?.provider === "tikchop_standard";

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <article className="rounded-[28px] bg-[linear-gradient(135deg,#08120d,#006540)] p-5 text-white shadow-[0_20px_46px_rgba(8,18,13,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">Offre Standard</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-9">Assistant Tikchop</h2>
          </div>
          <span className="rounded-full bg-[var(--primary-bright)] px-3 py-1 text-xs font-extrabold text-[#07100a]">
            {standardActive ? "Actif" : "Recommande"}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-5 text-white/78">
          Le plus simple: les clients ecrivent au numero Tikchop, l&apos;assistant vend pour votre boutique et les commandes arrivent ici.
        </p>
        <div className="mt-4 grid gap-2 text-sm font-bold text-white/82">
          <p className="rounded-2xl bg-white/10 p-3">Aucune connexion technique.</p>
          <p className="rounded-2xl bg-white/10 p-3">Vous ajoutez les photos, Tikchop vend.</p>
          <p className="rounded-2xl bg-white/10 p-3">Commande, paiement et livraison suivis.</p>
        </div>
        <button
          type="button"
          onClick={onActivateStandard}
          disabled={busy === "standard" || standardActive}
          className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-bright)] px-4 text-sm font-extrabold text-[#07100a] shadow-[0_16px_34px_rgba(57,245,142,0.22)] disabled:opacity-70"
        >
          {busy === "standard" ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          {standardActive ? "Standard deja actif" : "Activer Standard"}
        </button>
        {standardActive && standardNumber && (
          <a
            href={standardHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/10 px-4 text-sm font-extrabold text-white no-underline"
          >
            <MessageCircle size={17} />
            Tester le numero Tikchop
          </a>
        )}
        {standardActive && !standardNumber && (
          <p className="mt-3 rounded-2xl bg-white/10 p-3 text-xs font-bold leading-4 text-white/72">
            Standard est actif. Le numero Tikchop central sera ajoute par le support pour afficher le lien de test.
          </p>
        )}
      </article>

      <article className="rounded-[28px] border border-[var(--outline)]/55 bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[var(--primary)]">Option avancee</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-9 text-[var(--text-main)]">Mon numero</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${connection?.isConnected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {connection?.isConnected ? "Actif" : "Avance"}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
          Pour repondre depuis votre propre WhatsApp. A choisir seulement si vous voulez etre accompagne.
        </p>
        <div className="mt-4 grid gap-2 text-sm font-bold text-[var(--text-dim)]">
          <p className="rounded-2xl bg-[var(--surface-soft)] p-3">Utile pour une boutique deja organisee.</p>
          <p className="rounded-2xl bg-[var(--surface-soft)] p-3">Peut demander une reconnexion parfois.</p>
        </div>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onConnect}
            disabled={busy === "pairing"}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#08120d] px-4 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy === "pairing" ? <Loader2 className="animate-spin" size={18} /> : <PlugZap size={18} />}
            Utiliser mon numero
          </button>
          <button
            type="button"
            onClick={onRepair}
            disabled={busy === "webhook" || !connection?.instanceName}
            className="hidden min-h-[50px] items-center justify-center gap-2 rounded-xl border border-[var(--outline)] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] disabled:opacity-50"
          >
            {busy === "webhook" ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Reparer Premium
          </button>
        </div>
      </article>
    </section>
  );
}

function ConnectionExplainer() {
  const steps = [
    {
      icon: <PlugZap size={18} />,
      title: "Tikchop cree le canal",
      text: "Un espace WhatsApp se prepare pour cette boutique seulement.",
    },
    {
      icon: <Smartphone size={18} />,
      title: "Le vendeur valide",
      text: "Il entre le code dans WhatsApp, comme pour connecter WhatsApp Web.",
    },
    {
      icon: <MessageCircle size={18} />,
      title: "Les clients ecrivent",
      text: "Les messages, photos et vocaux arrivent automatiquement au vendeur Tikchop.",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Le chatbot repond",
      text: "Tikchop verifie les articles, aide a commander et garde le vendeur au courant.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[26px] bg-white shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)]">
      <div className="bg-[var(--text-main)] p-4 text-white">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">Connexion simple</p>
        <h2 className="mt-2 font-display text-2xl font-bold leading-8">Comment Tikchop branche WhatsApp</h2>
        <p className="mt-2 text-sm font-semibold leading-5 text-white/64">
          Le vendeur garde son numero. Il confirme juste la connexion, puis Tikchop peut assister les clients.
        </p>
      </div>
      <div className="grid gap-2 p-3">
        {steps.map((step, index) => (
          <div key={step.title} className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary)] shadow-sm">
              {step.icon}
            </span>
            <span>
              <span className="block text-sm font-extrabold text-[var(--text-main)]">{index + 1}. {step.title}</span>
              <span className="mt-0.5 block text-xs font-semibold leading-4 text-[var(--text-dim)]">{step.text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoTile({ icon, title, text }) {
  return (
    <div className="app-card min-h-[124px] bg-[#fffdf5] p-4 ring-1 ring-[#ffb000]/16">
      <span className="app-icon-pill bg-[#08120d] text-[var(--primary-bright)]">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-[var(--text-dim)]">{text}</p>
    </div>
  );
}

function MobileWhatsAppPwaPanel({
  busy,
  connection,
  currentWhatsAppNumber,
  loading,
  pairing,
  phoneReady,
  qrSource,
  status,
  watchingConnection,
  onActivateStandard,
  onConnect,
  onCopyPairingCode,
  onDisconnect,
  onPhoneBlur,
  onPhoneChange,
  onRefresh,
  onRefreshPairingCode,
}) {
  const connected = Boolean(connection?.isConnected);
  const standardActive = connection?.provider === "tikchop_standard";
  const ownWhatsAppActive = connected && !standardActive;
  const hasPairing = Boolean(pairing);
  const hasCode = Boolean(pairing?.pairingCode);
  const hasQr = Boolean(qrSource);

  return (
    <section className="space-y-3 md:hidden">
      {/* Main connection card */}
      <section className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10 shadow-[0_2px_14px_rgba(7,18,13,0.07)]">
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-[#07120d]/8 px-4 py-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
            connected ? "bg-[#eafff5] text-[#005f3d]" : "bg-[#07120d]/7 text-[#07120d]/60"
          }`}>
            {status?.icon}
            {status?.label || "Pret"}
          </span>
          {watchingConnection && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
              <Loader2 className="animate-spin" size={13} />
              Verification
            </span>
          )}
        </div>

        <div className="p-4">
          {ownWhatsAppActive ? (
            <div className="text-center py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eafff5] text-[#008f5a]">
                <CheckCircle2 size={34} />
              </span>
              <h3 className="mt-3 font-display text-2xl font-black text-[#07120d]">Connecte</h3>
              <p className="mt-1 text-sm font-semibold text-[#07120d]/50">Tikchop repond depuis ce numero WhatsApp.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#07120d]/8 px-4 text-sm font-black text-[#07120d] disabled:opacity-55"
                >
                  <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
                  Verifier
                </button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  disabled={busy === "disconnect"}
                  className="flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#07120d] px-4 text-sm font-black text-white disabled:opacity-55"
                >
                  {busy === "disconnect" ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />}
                  Retirer
                </button>
              </div>
              <Link href="/messages" className="mt-3 flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#008f5a] px-4 text-sm font-black text-white no-underline">
                <MessageCircle size={17} />
                Voir les messages
              </Link>
            </div>
          ) : (
            <>
              {/* Phone number input */}
              <label className="block text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Numero WhatsApp</label>
              <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 overflow-hidden rounded-[20px] bg-white ring-1 ring-[#07120d]/12 px-3 py-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a]">
                  <Phone size={18} />
                </span>
                <input
                  value={currentWhatsAppNumber}
                  onBlur={onPhoneBlur}
                  onChange={(event) => onPhoneChange(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  className="min-h-12 w-full bg-transparent text-lg font-black text-[#07120d] outline-none placeholder:text-[#07120d]/35"
                  placeholder="+225 07 00 00 00 00"
                />
              </div>
              {!phoneReady && (
                <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black leading-4 text-amber-900 ring-1 ring-amber-100">
                  Numero complet avec +225.
                </p>
              )}

              {/* QR / pairing area */}
              <div className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-[#07120d]/8 text-center p-4">
                {hasQr ? (
                  <>
                    <div className="mx-auto w-fit rounded-[20px] bg-[#fbf9f4] p-3 ring-1 ring-[#07120d]/8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrSource} alt="QR WhatsApp" className="h-[220px] w-[220px] object-contain" />
                    </div>
                    <p className="mt-3 text-sm font-black text-[#07120d]">Scanne avec WhatsApp.</p>
                    <p className="mt-1 text-xs font-bold text-[#07120d]/50">QR expire vite — regenerer si refuse.</p>
                  </>
                ) : hasPairing ? (
                  <>
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-50 text-amber-700">
                      <KeyRound size={32} />
                    </span>
                    <h3 className="mt-3 font-display text-xl font-black text-[#07120d]">Connexion en cours</h3>
                    <p className="mt-1 text-xs font-bold text-[#07120d]/50">Ouvrez WhatsApp pour valider.</p>
                  </>
                ) : (
                  <>
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#008f5a]/10 text-[#008f5a]">
                      <QrCode size={32} />
                    </span>
                    <h3 className="mt-3 font-display text-xl font-black text-[#07120d]">Pret a generer</h3>
                    <p className="mt-1 text-xs font-bold text-[#07120d]/50">Cliquez sur le bouton ci-dessous.</p>
                  </>
                )}
              </div>

              {/* Pairing code card */}
              {hasCode && (
                <div className="mt-3 overflow-hidden rounded-[20px] bg-white ring-1 ring-[#07120d]/10">
                  <div className="flex items-center justify-between gap-3 border-b border-[#07120d]/8 px-4 py-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Code WhatsApp temporaire</p>
                    <button type="button" onClick={onCopyPairingCode} className="app-icon-button" aria-label="Copier le code WhatsApp">
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <p className="font-display text-3xl font-black tracking-wider text-[#07120d]">{formatPairingCode(pairing.pairingCode)}</p>
                    <p className="mt-2 text-xs font-bold leading-4 text-[#07120d]/50">
                      {getPairingValidityLabel(pairing)}
                    </p>
                  </div>
                </div>
              )}

              {watchingConnection && (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[#eafff5] px-3 py-2.5 text-sm font-bold text-[#005f3d] ring-1 ring-emerald-200">
                  <Loader2 className="animate-spin" size={16} />
                  Tikchop verifie la connexion...
                </p>
              )}

              {/* CTA buttons */}
              <div className="mt-4 grid gap-2.5">
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={busy === "pairing" || !phoneReady}
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#07120d] px-5 text-base font-black text-white disabled:opacity-50"
                >
                  {busy === "pairing" ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
                  {hasQr ? "Regenerer le QR" : phoneReady ? "Generer le QR" : "Ajoutez le numero"}
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#07120d]/8 px-4 text-sm font-black text-[#07120d] disabled:opacity-50"
                  >
                    <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
                    Verifier
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshPairingCode}
                    disabled={busy === "code" || !phoneReady}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#07120d]/8 px-4 text-sm font-black text-[#07120d] disabled:opacity-50"
                  >
                    {busy === "code" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                    Code
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Standard / sans QR collapsible */}
      <details className="overflow-hidden rounded-[24px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
        <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-3 px-4">
          <span className="min-w-0">
            <span className="block text-base font-black text-[#07120d]">Sans QR — Assistant Standard</span>
            <span className="block text-xs font-bold text-[#07120d]/50">Tikchop repond a votre place.</span>
          </span>
          <MessageCircle className="text-[#008f5a]" size={21} />
        </summary>
        <div className={`border-t border-[#07120d]/8 p-4 ${standardActive ? "bg-[#eafff5]" : ""}`}>
          {standardActive && (
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#005f3d]">
              <CheckCircle2 size={16} />
              Assistant Standard est actif.
            </p>
          )}
          <button
            type="button"
            onClick={onActivateStandard}
            disabled={busy === "standard" || standardActive}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#008f5a] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(0,143,90,0.18)] disabled:opacity-60"
          >
            {busy === "standard" ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            {standardActive ? "Standard actif" : "Activer Standard"}
          </button>
        </div>
      </details>
    </section>
  );
}
