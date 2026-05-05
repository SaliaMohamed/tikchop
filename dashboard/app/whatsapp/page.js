"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  PlugZap,
  Power,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react";
import {
  disconnectSellerWhatsApp,
  getSellerWhatsAppConnection,
  requestSellerWhatsAppPairing,
} from "../seller-actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

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
      label: "Connecte",
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

export default function WhatsAppPage() {
  const seller = useActiveSeller();
  const [connection, setConnection] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [watchingConnection, setWatchingConnection] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setError(err.message || "Impossible de verifier WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!seller.slug) return;

    let alive = true;
    getSellerAccessToken()
      .then((token) => getSellerWhatsAppConnection(seller, token))
      .then((data) => {
        if (alive) setConnection(data);
      })
      .catch((err) => {
        if (alive) setError(err.message || "Impossible de verifier WhatsApp.");
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
        setError(err.message || "Verification WhatsApp impossible.");
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
      }));
      setWatchingConnection(true);
      setMessage("Code genere. Tikchop verifie automatiquement la connexion.");
    } catch (err) {
      setError(err.message || "Impossible de generer le code WhatsApp.");
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
      setError(err.message || "Impossible de deconnecter WhatsApp.");
    } finally {
      setBusy("");
    }
  }

  async function copyPairingCode() {
    if (!pairing?.pairingCode) return;
    await navigator.clipboard.writeText(pairing.pairingCode);
    setMessage("Code copie.");
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

      <main className="mt-6 space-y-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <section className="app-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="quiet-label">Numero vendeur</p>
              <p className="mt-1 break-words font-display text-xl font-bold text-[var(--text-main)]">
                {seller.phone_number || "Numero non renseigne"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">
                Instance Evolution: {connection?.instanceName || seller.slug || "..."}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold ${status.tone}`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 min-[420px]:grid-cols-2">
            <button
              type="button"
              onClick={connectWhatsApp}
              disabled={busy === "pairing"}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-[#101814] px-4 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy === "pairing" ? <Loader2 className="animate-spin" size={18} /> : <PlugZap size={18} />}
              {connection?.isConnected ? "Reconnecter" : "Connecter"}
            </button>
            <button
              type="button"
              onClick={disconnectWhatsApp}
              disabled={busy === "disconnect" || !connection?.instanceName}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] disabled:opacity-50"
            >
              {busy === "disconnect" ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
              Deconnecter
            </button>
          </div>
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
                <p className="mt-3 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                  WhatsApp, Appareils connectes, Connecter avec un numero de telephone.
                </p>
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
              <div className="mt-4 hidden flex-col items-center justify-center rounded-lg bg-white p-3 ring-1 ring-[var(--outline)]/60 md:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSource} alt="QR WhatsApp" className="h-48 w-48 object-contain" />
                <p className="mt-2 text-xs font-bold text-[var(--text-dim)]">QR reserve a un second ecran.</p>
              </div>
            )}
          </section>
        )}

        {connection?.isConnected && (
          <section className="rounded-lg bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-900 ring-1 ring-emerald-100">
            Le numero est connecte. Pour tester, envoie un message WhatsApp a cette boutique depuis un autre numero.
          </section>
        )}

        <section className="grid gap-3 min-[420px]:grid-cols-3">
          <InfoTile icon={<MessageCircle size={20} />} title="Reponses" text="Depuis le numero vendeur." />
          <InfoTile icon={<ShieldCheck size={20} />} title="Catalogue" text="Articles de cette boutique." />
          <InfoTile icon={<Smartphone size={20} />} title="Pairing" text="Sans Evolution Manager." />
        </section>

        {connection?.webhookUrl && (
          <section className="rounded-lg bg-[var(--surface-soft)] p-4">
            <p className="quiet-label">Webhook actif</p>
            <p className="mt-1 break-all text-xs font-semibold leading-5 text-[var(--text-dim)]">
              {connection.webhookUrl}
            </p>
          </section>
        )}

        {(message || error || connection?.error) && (
          <div className={`rounded-lg p-4 text-sm font-bold leading-5 ${error || connection?.error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"}`}>
            {error || connection?.error || message}
          </div>
        )}
      </main>
    </div>
  );
}

function InfoTile({ icon, title, text }) {
  return (
    <div className="app-card min-h-[124px] p-4">
      <span className="app-icon-pill bg-[var(--info-soft)] text-[var(--info)]">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-[var(--text-dim)]">{text}</p>
    </div>
  );
}
