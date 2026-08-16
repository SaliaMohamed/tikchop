"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
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
import TikchopLottie from "./TikchopLottie";
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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
      if (data.isConnected) setMessage("WhatsApp connecté.");
    } catch (err) {
      setError(friendlyError(err, "Connexion non vérifiée. Actualisez."));
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
      .catch(() => { if (alive) setError("WhatsApp non vérifié. Actualisez."); })
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
          setMessage("WhatsApp connecté. Passons au style du DJASSAMAN.");
          window.clearInterval(interval);
        } else if (attempts >= 18) {
          setWatchingConnection(false);
          setMessage("Le code attend la validation. Générez un nouveau code si besoin.");
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
        setError("Ajoutez le numéro complet (11 chiffres).");
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
        ? "Code généré. Entrez-le dans WhatsApp > Appareils connectés > Lier avec un numéro."
        : "QR généré. Scannez-le avec WhatsApp.");
    } catch (err) {
      setError(friendlyError(err, "Connexion non lancée. Vérifiez le numéro."));
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
        setError("Ajoutez le numéro complet (11 chiffres).");
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
      setMessage("Nouveau code généré.");
    } catch (err) {
      setError(friendlyError(err, "Code non régénéré. Réessayez."));
    } finally {
      setBusy("");
    }
  }

  async function disconnectWhatsApp() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    try {
      setBusy("disconnect");
      setError("");
      setMessage("");
      const token = await getSellerAccessToken();
      const data = await disconnectSellerWhatsApp(seller, token);
      setPairing(null);
      setWatchingConnection(false);
      setConfirmDisconnect(false);
      setConnection((c) => ({ ...(c || {}), ...data }));
      setMessage("WhatsApp déconnecté. Vous pouvez en reconnecter un autre à tout moment.");
    } catch (err) {
      setError(friendlyError(err, "Déconnexion échouée. Réessayez."));
    } finally {
      setBusy("");
    }
  }

  async function copyPairingCode() {
    if (!pairing?.pairingCode) return;
    await navigator.clipboard.writeText(pairing.pairingCode);
    setMessage("Code copié.");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#059669]" size={30} />
        <p className="mt-3 text-sm font-black text-[#0F2B20]/45">Vérification de la connexion...</p>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[20px] bg-[#EAF8F0] p-4 ring-1 ring-[#059669]/15">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#059669]/15 text-[#059669]">
            <TikchopLottie name="success" size={34} loop={false} ariaLabel="WhatsApp connecté" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#0F2B20]">WhatsApp connecté</p>
            <p className="truncate text-xs font-bold text-[#0F2B20]/50">{connection.phone ? `+${connection.phone}` : seller.phone_number}</p>
          </div>
          {busy === "disconnect" ? (
            <Loader2 className="shrink-0 animate-spin text-[#0F2B20]/60" size={18} />
          ) : (confirmDisconnect ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={disconnectWhatsApp}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#DC3D43] px-3 text-xs font-black text-white"
                >
                  <Power size={13} />
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(false)}
                  className="flex min-h-11 items-center rounded-full bg-[#0F2B20]/8 px-3 text-xs font-black text-[#0F2B20]"
                >
                  Annuler
                </button>
              </div>
              <p className="text-right text-[0.68rem] font-bold leading-4 text-[#0F2B20]/50">Déconnecter ce numéro WhatsApp ?</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#0F2B20]/8 px-3 text-xs font-black text-[#0F2B20]"
            >
              <Power size={13} />
              Retirer
            </button>
          ))}
        </div>

        {onConnected && (
          <button
            type="button"
            onClick={onConnected}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#0F2B20] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,43,32,0.18)]"
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
        <div className={`rounded-[16px] p-3 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#E7F6ED] text-[#047857] ring-1 ring-[#EAF8F0]"}`}>
          {error || message}
        </div>
      )}

      <div>
        <label className="block text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#0F2B20]/60">Numéro WhatsApp vendeur</label>
        <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#0F2B20]/10 px-3 py-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#059669]/10 text-[#059669]">
            <Phone size={17} />
          </span>
          <input
            value={currentWhatsAppNumber}
            onBlur={() => setWhatsappNumber((c) => normalizeWhatsAppInput(c))}
            onChange={(e) => { setPhoneEdited(true); setWhatsappNumber(e.target.value); }}
            inputMode="tel"
            autoComplete="tel"
            className="min-h-11 w-full bg-transparent text-base font-black text-[#0F2B20] outline-none placeholder:text-[#0F2B20]/30"
            placeholder="+225 07 00 00 00 00"
          />
        </div>
        {!phoneReady && (
          <p className="mt-2 text-xs font-bold text-[#0F2B20]/40">11 chiffres requis (format +225 07 ...).</p>
        )}
      </div>

      {pairing?.pairingCode && (
        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-[#0F2B20]/10">
          <div className="flex items-center justify-between border-b border-[#0F2B20]/6 px-4 py-2.5">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#059669]">Code temporaire</p>
            <button type="button" onClick={copyPairingCode} className="app-icon-button" aria-label="Copier">
              <Copy size={15} />
            </button>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-display text-3xl font-black tracking-wider text-[#0F2B20]">{formatPairingCode(pairing.pairingCode)}</p>
            <p className="mt-1.5 text-xs font-bold text-[#0F2B20]/45">{getPairingValidityLabel(pairing)}</p>
          </div>
        </div>
      )}

      {watchingConnection && (
        <p className="flex items-center gap-2 rounded-[14px] bg-[#EAF8F0] px-3 py-2.5 text-sm font-bold text-[#047857]">
          <TikchopLottie name="sparkle" size={20} speed={1.5} className="shrink-0" ariaLabel="Vérification en cours" />
          Vérification en cours...
        </p>
      )}

      <div className="grid gap-2.5">
        <button
          type="button"
          onClick={pairing ? regeneratePairingCode : connectWhatsApp}
          disabled={busy === "pairing" || busy === "code" || !phoneReady}
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-[20px] bg-[#0F2B20] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(15,43,32,0.18)] disabled:opacity-50"
        >
          {busy === "pairing" || busy === "code" ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
          {!phoneReady ? "Ajoutez le numéro" : pairing ? "Régénérer le code" : "Générer le code WhatsApp"}
        </button>
        <button
          type="button"
          onClick={refreshConnection}
          disabled={loading}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] bg-[#0F2B20]/7 px-4 text-sm font-black text-[#0F2B20] disabled:opacity-50"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
          Vérifier la connexion
        </button>
      </div>

      <div className="rounded-[16px] bg-white/70 p-3.5 text-xs font-semibold leading-5 text-[#0F2B20]/55 ring-1 ring-[#0F2B20]/6">
        <p className="flex items-center gap-1.5 font-black text-[#0F2B20]/75">
          <Smartphone size={13} className="text-[#059669]" />
          Comment connecter :
        </p>
        <p className="mt-1.5">1. Entrez votre numéro WhatsApp vendeur.</p>
        <p>2. Appuyez sur &quot;Générer le code&quot;.</p>
        <p>3. Sur le téléphone : WhatsApp &gt; Appareils connectés &gt; Lier avec un numéro.</p>
        <p>4. Entrez le code affiché. Tikchop vérifie automatiquement.</p>
      </div>

      <p className="flex items-center gap-2 text-center text-xs font-bold text-[#0F2B20]/40">
        <span className={`inline-flex items-center gap-1 rounded-full bg-[#0F2B20]/6 px-2.5 py-1 text-[0.68rem] font-black text-[#0F2B20]/60`}>
          {status?.icon}
          {status?.label || "Prêt"}
        </span>
        Étape 1 sur 3
      </p>
    </div>
  );
}
