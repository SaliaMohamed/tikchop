/**
 * Product status & formatting helpers (pure functions).
 */
import { AlertTriangle, CheckCircle2, EyeOff } from "lucide-react";
export const EXTRA_IMAGES_PATTERN = /\n?\[\[TIKCHOP_EXTRA_IMAGES:([^\]]*)\]\]/i;

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function getCleanProductDescription(description) {
  return String(description || "").replace(EXTRA_IMAGES_PATTERN, "").trim();
}

export function preserveExtraImagesMarker(nextDescription, previousDescription) {
  const marker = String(previousDescription || "").match(EXTRA_IMAGES_PATTERN)?.[0] || "";
  return [String(nextDescription || "").trim(), marker.trim()].filter(Boolean).join("\n");
}

export function getStock(product) {
  return Number.parseInt(product?.stock_quantity || 0, 10) || 0;
}

export function isProductHidden(product) {
  return product?.is_active === false || getStock(product) <= 0;
}

export function isProductLive(product) {
  return !isProductHidden(product) && getStock(product) > 0;
}

export function isProductUnpublished(product) {
  return product?.is_active === false;
}

export function isProductOutOfStock(product) {
  return product?.is_active !== false && getStock(product) <= 0;
}

export function getProductStatus(product) {
  const stock = getStock(product);
  if (product?.is_active === false) {
    return {
      label: "Masque",
      toneClass: "bg-zinc-100 text-zinc-600",
      icon: <EyeOff size={14} />,
    };
  }
  if (stock <= 0) {
    return {
      label: "Rupture",
      toneClass: "bg-red-50 text-red-700",
      icon: <AlertTriangle size={14} />,
    };
  }
  if (stock <= 2) {
    return {
      label: `Stock faible (${stock})`,
      toneClass: "bg-amber-50 text-amber-800",
      icon: <AlertTriangle size={14} />,
    };
  }
  return {
    label: `En vente (${stock})`,
    toneClass: "bg-white text-[var(--primary)]",
    icon: <CheckCircle2 size={14} />,
  };
}