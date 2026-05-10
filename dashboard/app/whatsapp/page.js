"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  Package,
  PlugZap,
  Power,
  RefreshCw,
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
  saveSellerChatbotSettings,
} from "../seller-actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

function formatPairingCode(code) {
  return String(code || "").match(/.{1,4}/g)?.join(" ") || code || "";
}

function statusCopy(connection) {
  if (!connection) {
    return {
      label: "Verification",
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
      label: "Appairage",
      tone: "bg-amber-100 text-amber-800",
      icon: <KeyRound size={18} />,
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
  bot_payment_preferences: "Proposer Wave en premier, puis Orange Money, MTN MoMo, Djamo ou paiement a la livraison si la zone le permet. Toujours confirmer le montant total avant d'encaisser.",
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
  const [settings, setSettings] = useState({
    bot_tone: "",
    bot_greeting: "",
    bot_payment_preferences: "",
    bot_delivery_notes: "",
    bot_special_rules: "",
  });

  const status = useMemo(() => statusCopy(connection), [connection]);

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
      const token = await getSellerAccessToken();
      const data = await requestSellerWhatsAppPairing(seller, token);
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
      setMessage("Code genere. Tikchop verifie automatiquement la connexion.");
    } catch (err) {
      setError(friendlyError(err, "Connexion WhatsApp non lancee. Verifiez le numero de la boutique ou contactez le support Tikchop."));
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
    <div className="app-shell">
      <header className="mobile-top">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="quiet-label text-[var(--primary)]">Chatbot</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">WhatsApp</h1>
            <p className="mt-1 text-sm leading-5 text-[var(--text-dim)]">{seller.name}</p>
          </div>
          <button
            type="button"
            onClick={refreshConnection}
            disabled={loading}
            className="app-icon-button"
            aria-label="Actualiser WhatsApp"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
          </button>
        </div>
      </header>

      <main className="mt-6 space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <section className="djassa-command p-5">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">Assistant vendeur</p>
              <h2 className="mt-2 font-display text-[2rem] font-bold leading-10 text-white">Laissez Tikchop repondre aux clients.</h2>
              <p className="mt-2 text-sm font-semibold leading-5 text-white/76">
                Il conseille, prend les commandes, gere le paiement et prepare les infos pour vos livreurs.
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold shadow-[0_10px_22px_rgba(0,0,0,0.14)] ${connection?.isConnected ? "bg-[var(--primary-bright)] text-[#07100a]" : "bg-white/14 text-white/82"}`}>
              {status.icon}
              {status.label}
            </span>
          </div>
          <div className="relative z-10 mt-5 grid gap-2 min-[420px]:grid-cols-3">
            <InfoTile icon={<MessageCircle size={19} />} title="Repond" text="Prix, stock, conseils." />
            <InfoTile icon={<Banknote size={19} />} title="Encaisse" text="Wave, OM, MoMo." />
            <InfoTile icon={<Truck size={19} />} title="Livre" text="Infos au livreur." />
          </div>
        </section>

        {(message || error || connection?.error) && (
          <div className={`rounded-lg p-4 text-sm font-bold leading-5 ${error || connection?.error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"}`}>
            {error || connection?.error || message}
          </div>
        )}
        <WhatsAppPlans
          connection={connection}
          busy={busy}
          onActivateStandard={activateStandardAssistant}
          onConnect={connectWhatsApp}
          onRepair={repairWebhook}
        />

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
          <section className="app-card p-5">
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
          <section className="rounded-lg bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-900 ring-1 ring-emerald-100">
            Le numero est connecte. Pour tester, envoie un message WhatsApp a cette boutique depuis un autre numero.
          </section>
        )}

        <div className="hidden">
          <SalesAutomationPreview isConnected={connection?.isConnected} onApplyPreset={applyDjassamanPreset} />
        </div>

        <details className="app-card p-5">
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
