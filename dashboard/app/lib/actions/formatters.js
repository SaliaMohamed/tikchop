/**
 * Non-async helper functions for server actions.
 * These are safe to import from "use server" files.
 */

export function formatCfa(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function normalizeCustomerPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function handoffKey(value) {
  return normalizeCustomerPhone(value) || String(value || "").trim();
}

export function formatCustomerPhone(value) {
  const digits = normalizeCustomerPhone(value);
  if (!digits) return "";
  return digits.startsWith("225") ? `+${digits}` : `+${digits}`;
}

export function getSellerEvolutionInstance(seller) {
  return String(seller?.evolution_instance || seller?.slug || "").trim();
}
