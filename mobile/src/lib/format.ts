export function formatCfa(value?: number | null) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function statusLabel(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PAID") return "Payee";
  if (normalized === "PENDING") return "A verifier";
  if (normalized === "PREPARED") return "Prete";
  if (normalized === "DELIVERED") return "Livree";
  if (normalized === "CANCELLED") return "Annulee";
  return normalized || "Nouvelle";
}

export function compactDate(value?: string | null) {
  if (!value) return "Maintenant";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Maintenant";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
