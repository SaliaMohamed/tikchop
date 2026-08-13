"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Phone,
  Power,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import {
  getSellerWhatsAppConnection,
  requestSellerWhatsAppPairing,
  refreshSellerWhatsAppPairingCode,
  disconnectSellerWhatsApp,
} from "../seller-actions";
import { useActiveSeller, writeActiveSeller } from "./sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  formatPairingCode,
  getPairingValidityLabel,
  normalizeWhatsAppInput,
  getPhoneDigits,
  statusCopy,
} from "../../lib/whatsapp-utils";

export default function WhatsAppConnector({ onConnected }) {
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

  const status = useMemo(() => statusCopy(connection), [connection]);
  const storedWhatsAppNumber = normalizeWhatsAppInput(connection?.phone ? `+${connection.phone}` : seller.phone_number || "+225 ");
  const currentWhatsAppNumber = phoneEdited ? whatsappNumber : storedWhatsAppNumber;
  const phoneDigits = getPhoneDigits(currentWhatsAppNumber);
  const phoneReady = phoneDigits.length >= 11;
  const isConnected = Boolean(connection?.isConnected);

  async function refreshConnection() {
    if (!seller.slug) return;
    try {
      setError("");
      setLoading(true);
      const token = await getSellerAccessToken();
      const data = await getSellerWhatsAppConnection(seller, token);
      setConnection(data);
      if (data.isConnected) setMessage("WhatsApp connecte.");
    } catch (err) {
      setError(friendlyError(err, "Connexion non verifiee. Actualisez."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!seller.slug) return;
    let alive = true;
    getSellerAccessToken()
      .then((token) => getSellerWhatsAppConnection(seller, token))
      .then((data) => { if (alive) setConnection(data); })
      .catch(() => { if (alive) setError("WhatsApp non verifie. Actualisez."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
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
          setMessage("WhatsApp connecte. Passons au style du DJASSAMAN.");
          window.clearInterval(interval);
        } else if (attempts >= 18) {
          setWatchingConnection(false);
          setMessage("Le code attend la validation. Generez un nouveau code si besoin.");
          window.clearInterval(interval);
        }
      } catch { /* keep waiting */ }
    }, 5000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [connection?.isConnected, seller, watchingConnection]);

  async function connectWhatsApp() {
    try {
      setBusy("pairing");
      setError("");
      setMessage("");
      const normalizedPhone = normalizeWhatsAppInput(currentWhatsAppNumber);
      if (getPhoneDigits(normalizedPhone).length < 11) {
        setError("Ajoutez le numero complet (11 chiffres).");
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
        : "QR genere. Scannez-le avec WhatsApp.");
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
        setError("Ajoutez le numero complet (11 chiffres).");
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#c2572b]" size={30} />
        <p className="mt-3 text-sm font-black text-[#2b2219]/45">Verification de la connexion...</p>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[20px] bg-[#fbefe2] p-4 ring-1 ring-[#c2572b]/15">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#c2572b]/15 text-[#c2572b]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#2b2219]">WhatsApp connecte</p>
            <p className="truncate text-xs font-bold text-[#2b2219]/50">{connection.phone ? `+${connection.phone}` : seller.phone_number}</p>
          </div>
          <button
            type="button"
            onClick={disconnectWhatsApp}
            disabled={busy === "disconnect"}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#2b2219]/8 px-3 text-xs font-black text-[#2b2219] disabled:opacity-50"
          >
            {busy === "disconnect" ? <Loader2 className="animate-spin" size={13} /> : <Power size={13} />}
            Retirer
          </button>
        </div>

        {onConnected && (
          <button
            type="button"
            onClick={onConnected}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2b2219] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(43,34,25,0.18)]"
          >
            <Bot size={18} />
            Continuer vers le style
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div className={`rounded-[16px] p-3 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#fbeee0] text-[#96451f] ring-1 ring-[#fbefe2]"}`}>
          {error || message}
        </div>
      )}

      <div>
        <label className="block text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#2b2219]/60">Numero WhatsApp vendeur</label>
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
          <p className="mt-2 text-xs font-bold text-[#2b2219]/40">11 chiffres requis (format +225 07 ...).</p>
        )}
      </div>

      {pairing?.pairingCode && (
        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-[#2b2219]/10">
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
        <p className="flex items-center gap-2 rounded-[14px] bg-[#fbefe2] px-3 py-2.5 text-sm font-bold text-[#96451f]">
          <Loader2 className="animate-spin" size={15} />
          Verification en cours...
        </p>
      )}

      <div className="grid gap-2.5">
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
          onClick={refreshConnection}
          disabled={loading}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] bg-[#2b2219]/7 px-4 text-sm font-black text-[#2b2219] disabled:opacity-50"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
          Verifier la connexion
        </button>
      </div>

      <div className="rounded-[16px] bg-white/70 p-3.5 text-xs font-semibold leading-5 text-[#2b2219]/55 ring-1 ring-[#2b2219]/6">
        <p className="flex items-center gap-1.5 font-black text-[#2b2219]/75">
          <Smartphone size={13} className="text-[#c2572b]" />
          Comment connecter :
        </p>
        <p className="mt-1.5">1. Entrez votre numero WhatsApp vendeur.</p>
        <p>2. Appuyez sur &quot;Generer le code&quot;.</p>
        <p>3. Sur le telephone: WhatsApp &gt; Appareils connectes &gt; Lier avec un numero.</p>
        <p>4. Entrez le code affiche. Tikchop verifie automatiquement.</p>
      </div>

      <p className="flex items-center gap-2 text-center text-xs font-bold text-[#2b2219]/40">
        <span className={`inline-flex items-center gap-1 rounded-full bg-[#2b2219]/6 px-2.5 py-1 text-[0.62rem] font-black text-[#2b2219]/60`}>
          {status?.icon}
          {status?.label || "Pret"}
        </span>
        Etape 1 sur 3
      </p>
    </div>
  );
}
