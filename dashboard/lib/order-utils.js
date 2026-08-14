/**
 * Order helpers & constants (pure functions).
 */
import { CheckCircle2, Clock3, MessageCircle, Package, Truck } from "lucide-react";
export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

export function getSimpleOrderStatus(order) {
  if (order?.status === "DELIVERED") return "DELIVERED";
  if (order?.status === "CANCELLED") return "CANCELLED";
  if (order?.delivery_status === "ASSIGNED") return "IN_DELIVERY";
  return order?.status || "PENDING";
}

export const statusLabels = {
  ALL: "Toutes",
  WORK: "Ouvertes",
  PENDING: "New",
  PAID: "Colis",
  DELIVERY: "Livreur",
  PREPARED: "Livreur",
  IN_DELIVERY: "En route",
  DELIVERED: "OK",
  CANCELLED: "Annulees",
};

export const orderTabs = [
  { key: "PENDING", label: "New", icon: MessageCircle },
  { key: "PAID", label: "Colis", icon: Package },
  { key: "DELIVERY", label: "Livreur", icon: Truck },
  { key: "DELIVERED", label: "OK", icon: CheckCircle2 },
];

export const statusHints = {
  PENDING: "Confirmer le client",
  PAID: "Mettre dans le sachet",
  PREPARED: "Envoyer au livreur",
  IN_DELIVERY: "Marquer livree",
  DELIVERED: "Vente fermee",
  CANCELLED: "Commande annulee",
};

export const statusClasses = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  PREPARED: "bg-blue-100 text-blue-700",
  IN_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-zinc-100 text-zinc-500",
  CANCELLED: "bg-red-100 text-red-700",
};

export const LOAD_TIMEOUT_MS = 12000;

export function withTimeout(promise, message, timeoutMs = LOAD_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
export function getCardActionLabel(status) {
  if (status === "PENDING") return "Confirmer";
  if (status === "PAID") return "Colis";
  if (status === "PREPARED") return "Livreur";
  if (status === "IN_DELIVERY") return "Livree";
  if (status === "DELIVERED") return "Finie";
  if (status === "CANCELLED") return "Annulee";
  return "Voir";
}

export function getCardActionTone(status) {
  if (status === "DELIVERED") return "bg-[#071B12]/7 text-[#071B12]/45";
  if (status === "CANCELLED") return "bg-rose-50 text-rose-800";
  return "bg-[#071B12] text-white";
}

export function getQuickAction(order, onPaid, onPrepared, onDelivered, onOpenDelivery) {
  if (order.delivery_status === "ASSIGNED" && order.status !== "DELIVERED") {
    return {
      label: "Marquer livree",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[#059669] text-white hover:bg-[#047857]",
      onClick: onDelivered,
    };
  }

  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      label: "Partager au livreur",
      icon: <Truck size={18} />,
      className: "bg-[#071B12] text-white hover:bg-[#0F2B20]",
      onClick: onOpenDelivery,
    };
  }

  if (order.status === "PENDING") {
    return {
      label: "Client confirme",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[#059669] text-white hover:bg-[#047857]",
      onClick: onPaid,
    };
  }

  if (order.status === "PAID") {
    return {
      label: "Colis pret",
      icon: <Package size={18} />,
      className: "bg-[#071B12] text-white hover:bg-[#0F2B20]",
      onClick: onPrepared,
    };
  }

  return null;
}

export function getOrderItemCount(order) {
  const count = (order.order_items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
  return count || (order.order_items || []).length || 1;
}

export function isDemoOrder(order) {
  return String(order?.order_ref || "").startsWith("DEMO") || String(order?.customer_phone || "") === "DEMO_CLIENT";
}

export function getNextOrder(orders) {
  const priority = { PENDING: 1, PAID: 2, PREPARED: 3, IN_DELIVERY: 4 };
  return [...orders]
    .filter((order) => ["PENDING", "PAID", "PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)))
    .sort((a, b) => {
      const statusDiff = (priority[getSimpleOrderStatus(a)] || 9) - (priority[getSimpleOrderStatus(b)] || 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    })[0] || null;
}

export function isHandoffActive(handoff) {
  return Boolean(handoff?.paused_until && new Date(handoff.paused_until).getTime() > Date.now());
}

export function formatPauseUntil(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function getTemplateToneClass(tone) {
  if (tone === "primary") return "bg-[var(--text-main)] text-white";
  if (tone === "success") return "bg-green-50 text-green-800";
  if (tone === "warning") return "bg-amber-50 text-amber-800";
  if (tone === "info") return "bg-blue-50 text-blue-800";
  if (tone === "danger") return "bg-red-50 text-red-700";
  return "bg-[var(--surface-soft)] text-[var(--text-main)]";
}

export function getNextAction(order) {
  if (order.delivery_status === "ASSIGNED" && order.status !== "DELIVERED") {
    return {
      title: "En livraison",
      subtitle: "Le livreur a la fiche. Fermez apres reception client.",
      icon: <Truck size={17} />,
      iconTone: "bg-indigo-100 text-indigo-700",
      barClass: "bg-indigo-50 text-indigo-800",
    };
  }

  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      title: "A envoyer au livreur",
      subtitle: "Partagez la fiche WhatsApp avec client, adresse et frais.",
      icon: <Truck size={17} />,
      iconTone: "bg-blue-100 text-blue-700",
      barClass: "bg-blue-50 text-blue-800",
    };
  }

  if (order.status === "DELIVERED") {
    return {
      title: "Commande finie",
      subtitle: "Cette commande est fermee.",
      icon: <CheckCircle2 size={17} />,
      iconTone: "bg-zinc-100 text-zinc-500",
      barClass: "bg-zinc-50 text-zinc-500",
    };
  }

  return {
    title: order.status === "PAID" ? "Preparer le colis" : "Client a confirmer",
    subtitle: order.status === "PAID"
      ? "Commande confirmee. Mettez les articles dans le sachet."
      : "Verifiez client, adresse et mode de paiement avant d'emballer.",
    icon: order.status === "PAID" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />,
    iconTone: order.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
    barClass: order.status === "PAID" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800",
  };
}
