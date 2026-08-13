/**
 * CRM helpers & constants (pure functions).
 */
import { getBestCustomerResponse, buildWhatsappHref } from "./customer-response-playbook";
export const segmentLabels = {
  ALL: "Tous",
  FOLLOW_UP: "A relancer",
  LOYAL: "Bons clients",
  NEW: "Nouveaux",
};

export const statusLabels = {
  PENDING: "Nouveau client",
  PAID: "A emballer",
  PREPARED: "Livreur",
  DELIVERED: "Finie",
  CANCELLED: "Annulee",
};

export const confirmedStatuses = new Set(["PAID", "PREPARED", "DELIVERED"]);

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

export function formatDate(value) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function getOrderTotal(order) {
  return Number(order?.total_amount || 0) + Number(order?.delivery_fee || 0);
}

export function getOrderRef(order) {
  return order?.order_ref || order?.id?.slice(0, 8)?.toUpperCase() || "TIKCHOP";
}

export function getOrderItems(order) {
  return order?.order_items || [];
}

export function getItemCount(order) {
  const count = getOrderItems(order).reduce((total, item) => total + Number(item.quantity || 0), 0);
  return count || getOrderItems(order).length || 1;
}

export function getItemsLabel(order) {
  const items = getOrderItems(order);
  if (items.length === 0) return "Article Tikchop";
  return items
    .slice(0, 2)
    .map((item) => `${item.quantity || 1} x ${item.products?.name || "Article"}`)
    .join(", ");
}

export function getCustomerName(customer) {
  if (customer.phone) return customer.phone;
  return "Client sans numero";
}

export function isUnknownPhone(phone) {
  const value = String(phone || "").trim().toUpperCase();
  return !value || value === "UNKNOWN";
}

export function needsFollowUp(customer) {
  const status = customer.lastOrder?.status;
  const age = daysSince(customer.lastOrder?.created_at);
  if (status === "PENDING") return true;
  if (status === "PREPARED") return true;
  if (status === "DELIVERED" && age >= 7) return true;
  return customer.orderCount === 1 && age >= 3 && status !== "CANCELLED";
}

export function isLoyal(customer) {
  return customer.orderCount >= 2 || customer.totalSpent >= 25000;
}

export function buildCustomers(orders) {
  const map = new Map();

  (orders || []).forEach((order) => {
    const phone = isUnknownPhone(order.customer_phone) ? "" : String(order.customer_phone).trim();
    const key = cleanPhone(phone) || `order-${order.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        phone,
        orderCount: 0,
        confirmedCount: 0,
        totalSpent: 0,
        totalEstimated: 0,
        lastOrder: null,
        orders: [],
        zone: "",
        address: "",
      });
    }

    const customer = map.get(key);
    customer.orders.push(order);
    customer.orderCount += 1;
    customer.totalEstimated += getOrderTotal(order);

    if (confirmedStatuses.has(order.status)) {
      customer.confirmedCount += 1;
      customer.totalSpent += getOrderTotal(order);
    }

    if (!customer.lastOrder || new Date(order.created_at || 0) > new Date(customer.lastOrder.created_at || 0)) {
      customer.lastOrder = order;
    }

    customer.zone = order.delivery_zone || customer.zone;
    customer.address = order.delivery_address || customer.address;
  });

  return Array.from(map.values())
    .map((customer) => ({
      ...customer,
      orders: customer.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
      shouldFollowUp: needsFollowUp(customer),
      isLoyal: isLoyal(customer),
    }))
    .sort((a, b) => new Date(b.lastOrder?.created_at || 0) - new Date(a.lastOrder?.created_at || 0));
}

export function whatsappHref(customer, sellerName) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bestResponse = getBestCustomerResponse(customer, { sellerName, origin });
  return buildWhatsappHref(customer.phone, bestResponse?.text);
}

export function getSegmentCount(customers, segment) {
  if (segment === "ALL") return customers.length;
  if (segment === "FOLLOW_UP") return customers.filter((customer) => customer.shouldFollowUp).length;
  if (segment === "LOYAL") return customers.filter((customer) => customer.isLoyal).length;
  if (segment === "NEW") return customers.filter((customer) => customer.orderCount === 1).length;
  return 0;
}

export function getTemplateToneClass(tone) {
  if (tone === "primary") return "bg-[#07120d] text-white ring-[#07120d]/20";
  if (tone === "success") return "bg-[#eafff5] text-[#005f3d] ring-[#008f5a]/20";
  if (tone === "warning") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (tone === "info") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (tone === "danger") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-white text-[#07120d] ring-[#07120d]/10";
}