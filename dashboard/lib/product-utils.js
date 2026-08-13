/**
 * Product form utility functions.
 */
export function formatPrice(value) {
  return `${Number(normalizeMoneyInput(value) || 0).toLocaleString("fr-FR")} FCFA`;
}

export function normalizeMoneyInput(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function normalizeStockInput(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits || "1";
}

const BACKGROUND_REMOVAL_ENABLED = process.env.NEXT_PUBLIC_BACKGROUND_REMOVAL_ENABLED === "true";
