/**
 * WhatsApp connection helpers (pure functions + status copy).
 */
import { CheckCircle2, KeyRound, Loader2, Unplug } from "lucide-react";
export function formatPairingCode(code) {
  return String(code || "").match(/.{1,4}/g)?.join(" ") || code || "";
}

export function getPairingValidityLabel(pairing) {
  if (!pairing?.pairingExpiresAt) return "Valable quelques minutes.";
  const expiresAt = new Date(pairing.pairingExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return "Valable quelques minutes.";
  const minutes = Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000));
  return `Valable environ ${minutes} min. Régénérez si WhatsApp refuse.`;
}

export function normalizeWhatsAppInput(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "+225 ";
  if (digits.startsWith("225")) return `+${digits}`;
  if (digits.length <= 10) return `+225 ${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export function getPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function statusCopy(connection) {
  if (!connection) {
    return {
      label: "Vérification...",
      tone: "bg-[var(--surface-mid)] text-[var(--text-dim)]",
      icon: <Loader2 className="animate-spin" size={18} />,
    };
  }

  if (connection.isConnected) {
    return {
      label: connection.provider === "tikchop_standard" ? "Standard actif" : "Connecté",
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
    label: "Déconnecté",
    tone: "bg-zinc-100 text-zinc-700",
    icon: <Unplug size={18} />,
  };
}