/**
 * Shared helpers for server actions (no "use server" directive).
 * Functions here are only called from server action modules.
 */

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { normalizeCustomerPhone, formatCustomerPhone, getSellerEvolutionInstance, formatCfa, handoffKey } from "./formatters";
import { sendEvolutionText } from "../../../lib/evolution";
export function getHandoffSellerKeys(seller) {
  return Array.from(new Set([seller?.slug, getSellerEvolutionInstance(seller)].filter(Boolean)));
}

export function attachHandoffsToOrders(orders = [], handoffs = []) {
  const byPhone = new Map();
  for (const handoff of handoffs || []) {
    byPhone.set(handoffKey(handoff.customer_phone), handoff);
  }

  return (orders || []).map((order) => ({
    ...order,
    handoff: byPhone.get(handoffKey(order.customer_phone)) || null,
  }));
}

export function parseStoredMessageClient(client = "") {
  const parts = String(client || "")
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);
  const phoneMatch = String(client || "").match(/(\d{8,})@?s?\.?whatsapp?\.?net?/i)
    || String(client || "").match(/(\d{8,})/);

  return {
    sellerHint: parts[0] || "",
    name: parts.length >= 3 ? parts[1] : "",
    phone: phoneMatch?.[1] || "",
  };
}

export function getMessagePhone(row = {}) {
  const parsed = parseStoredMessageClient(row.client);
  return normalizeCustomerPhone(row.customer_phone) || normalizeCustomerPhone(parsed.phone);
}

export function getMessageName(row = {}) {
  const parsed = parseStoredMessageClient(row.client);
  return parsed.name || "";
}

export const MESSAGE_SELECT_BASE = "id,contenu,client,statut,created_at,external_message_id,seller_slug,customer_phone";
export const MESSAGE_SELECT_WITH_MEDIA = `${MESSAGE_SELECT_BASE},media_type,media_url,media_mime_type,media_caption,media_payload`;

export function normalizeMessageMedia(row = {}) {
  const payload = row.media_payload && typeof row.media_payload === "object" ? row.media_payload : {};
  const mimeType = String(row.media_mime_type || payload.mimetype || payload.mimeType || "").trim();
  const explicitType = String(row.media_type || payload.type || "").toLowerCase();
  const type = explicitType
    || (mimeType.startsWith("image/") ? "image" : "")
    || (mimeType.startsWith("audio/") ? "audio" : "")
    || (mimeType.startsWith("video/") ? "video" : "")
    || (mimeType ? "document" : "");
  const base64 = String(payload.base64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  const url = String(row.media_url || payload.url || "").trim()
    || (base64 && mimeType ? `data:${mimeType};base64,${base64}` : "");
  const caption = String(row.media_caption || payload.caption || "").trim();

  if (!type && !url) return null;

  return {
    type: type || "document",
    url,
    mime_type: mimeType,
    caption,
    name: String(payload.fileName || payload.filename || payload.name || "Piece jointe").trim(),
  };
}

export function normalizeStoredMessage(row = {}) {
  const status = String(row.statut || "").toLowerCase();
  const direction = /seller|manual|followup|out|from_me|vendeur/.test(status)
    ? "out"
    : /bot|assistant/.test(status)
      ? "bot"
      : "in";

  return {
    id: String(row.id || `${row.created_at}-${row.external_message_id || ""}`),
    text: String(row.contenu || "").trim(),
    client: row.client || "",
    status: row.statut || "",
    direction,
    created_at: row.created_at || null,
    customer_phone: getMessagePhone(row),
    customer_name: getMessageName(row),
    media: normalizeMessageMedia(row),
  };
}

export function mergeMessageRows(...groups) {
  const byId = new Map();
  for (const rows of groups) {
    for (const row of rows || []) {
      byId.set(String(row.id), row);
    }
  }
  return Array.from(byId.values());
}

export async function getActiveSellerHandoffs(seller) {
  const sellerKeys = getHandoffSellerKeys(seller);
  if (!sellerKeys.length) return [];

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id,client,contenu,seller_slug,customer_phone,created_at")
    .in("seller_slug", sellerKeys)
    .eq("statut", "human_pause")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    if (/messages|seller_slug|customer_phone|schema cache|column/i.test(error.message || "")) return [];
    throw new Error(error.message);
  }

  const byPhone = new Map();
  for (const row of data || []) {
    const until = String(row.contenu || "").match(/human_pause_until:([^\s]+)/)?.[1];
    const pausedUntil = until || new Date(new Date(row.created_at || 0).getTime() + 90 * 60 * 1000).toISOString();
    if (new Date(pausedUntil).getTime() <= Date.now()) continue;
    const phone = normalizeCustomerPhone(row.customer_phone);
    if (!phone || byPhone.has(phone)) continue;
    byPhone.set(phone, {
      seller_slug: row.seller_slug,
      customer_phone: phone,
      instance_name: getSellerEvolutionInstance(seller) || null,
      paused_until: pausedUntil,
      last_from_me_at: row.created_at,
      updated_at: row.created_at,
    });
  }

  return Array.from(byPhone.values());
}

export async function saveSellerCustomerHandoff(seller, customerPhone, durationMinutes = 24 * 60) {
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  if (cleanPhone.length < 6) {
    throw new Error("Numero client invalide.");
  }

  const minutes = Math.max(15, Math.min(Number.parseInt(durationMinutes, 10) || 24 * 60, 7 * 24 * 60));
  const now = new Date();
  const pausedUntil = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
  const instanceName = getSellerEvolutionInstance(seller);
  const sellerKeys = getHandoffSellerKeys(seller);

  const { error } = await supabaseAdmin
    .from("messages")
    .insert(sellerKeys.map((sellerKey) => ({
      contenu: `human_pause_until:${pausedUntil}`,
      client: `${sellerKey} : Pause vendeur : ${cleanPhone}`,
      statut: "human_pause",
      external_message_id: `human_pause:${sellerKey}:${cleanPhone}:${now.getTime()}`,
      seller_slug: sellerKey,
      customer_phone: cleanPhone,
    })));

  if (error) {
    throw new Error(error.message);
  }

  return {
    seller_slug: seller.slug,
    customer_phone: cleanPhone,
    instance_name: instanceName || null,
    paused_until: pausedUntil,
    last_from_me_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function normalizeProductVariants(input) {
  if (Array.isArray(input)) {
    return input
      .map((variant) => ({
        label: String(variant.label || variant.size || variant.color || "").trim(),
        size: String(variant.size || "").trim(),
        color: String(variant.color || "").trim(),
        stock: Number.parseInt(variant.stock ?? variant.stock_quantity ?? 0, 10),
      }))
      .filter((variant) => variant.label || variant.size || variant.color);
  }

  return String(input || "")
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const stockMatch = entry.match(/(?:stock|qt[e├®]|x)\s*[:=]?\s*(\d{1,4})|\b(\d{1,4})\s*(?:pcs?|pieces?)\b/i);
      const stock = Number.parseInt(stockMatch?.[1] || stockMatch?.[2] || 0, 10);
      const cleanLabel = entry
        .replace(/(?:stock|qt[e├®]|x)\s*[:=]?\s*\d{1,4}/ig, "")
        .replace(/\b\d{1,4}\s*(?:pcs?|pieces?)\b/ig, "")
        .trim();
      return {
        label: cleanLabel || entry,
        size: "",
        color: "",
        stock: Number.isFinite(stock) ? stock : 0,
      };
    });
}

export function buildDriverDeliveryMessage(order, driver) {
  const orderRef = order.order_ref || order.id?.slice(0, 8)?.toUpperCase();
  const items = (order.order_items || [])
    .map((item) => `- ${item.quantity} x ${item.products?.name || "Article"}`)
    .join("\n");
  const deliveryFee = Number(order.delivery_fee || 0);
  const productPaid = order.status === "PAID" || order.payment_method === "PAYSTACK";
  const productPaymentText = order.payment_method === "CASH_ON_DELIVERY"
    ? "A ENCAISSER A LA LIVRAISON"
    : productPaid ? "PAYE" : "A verifier";
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const receiptLine = appUrl && order.id ? `\nRecu client: ${appUrl}/receipt?order=${order.id}` : "";

  return `Nouvelle livraison Tikchop

Commande: ${orderRef}
Boutique: ${order.sellers?.name || "Tikchop"}
Livreur: ${driver.name}

Client: ${order.customer_phone || "Non renseigne"}
Zone: ${order.delivery_zone || "Non renseignee"}
Adresse: ${order.delivery_address || "Non renseignee"}

Articles:
${items || "- Articles dans la commande"}

Produits: ${formatCfa(order.total_amount)}
Livraison: ${deliveryFee > 0 ? `${formatCfa(deliveryFee)} a encaisser` : "Aucun frais"}
Paiement produit: ${productPaymentText}
${receiptLine}

Quand c'est livre, informe la boutique.`;
}

export function chooseDriverForOrder(order, drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) return null;

  const normalizeStr = (str) => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const normalizedZone = normalizeStr(order.delivery_zone);

  if (normalizedZone) {
    const exact = drivers.find((driver) => normalizeStr(driver.zone) === normalizedZone);
    if (exact) return exact;

    const close = drivers.find((driver) => {
      const driverZone = normalizeStr(driver.zone);
      return driverZone && (normalizedZone.includes(driverZone) || driverZone.includes(normalizedZone));
    });
    if (close) return close;
  }

  return drivers.find((driver) => !driver.zone) || drivers[0];
}

export async function autoSharePreparedOrderToDriver(orderId) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      seller_id,
      order_ref,
      customer_phone,
      status,
      payment_method,
      total_amount,
      delivery_type,
      delivery_zone,
      delivery_address,
      delivery_fee,
      delivery_driver_id,
      sellers (
        id,
        name,
        slug,
        auto_share_to_driver,
        evolution_instance
      ),
      order_items (
        id,
        quantity,
        products (id, name)
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !order || order.delivery_type === "PICKUP" || !order.sellers?.auto_share_to_driver) {
    return null;
  }

  let drivers = [];
  if (order.delivery_driver_id) {
    const { data } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, seller_id, name, phone_number, zone, is_active")
      .eq("id", order.delivery_driver_id)
      .eq("seller_id", order.seller_id)
      .eq("is_active", true)
      .maybeSingle();
    drivers = data ? [data] : [];
  } else {
    const { data } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, seller_id, name, phone_number, zone, is_active")
      .eq("seller_id", order.seller_id)
      .eq("is_active", true);
    drivers = data || [];
  }

  const driver = chooseDriverForOrder(order, drivers);
  if (!driver?.phone_number) return null;

  const messageResult = await sendEvolutionText({
    instanceName: order.sellers.evolution_instance || order.sellers.slug,
    number: driver.phone_number,
    text: buildDriverDeliveryMessage(order, driver),
  }).catch((shareError) => {
    console.error("Driver auto-share failed:", shareError);
    return { ok: false };
  });

  const updatePayload = {
    delivery_driver_id: driver.id,
    ...(messageResult?.ok ? { delivery_status: "ASSIGNED" } : {}),
  };

  const { data: updated } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("id, delivery_driver_id, delivery_status")
    .maybeSingle();

  return updated ? { ...updated, delivery_drivers: driver, auto_shared_to_driver: Boolean(messageResult?.ok) } : null;
}

export async function sendOrderToAssignedDriver(orderId, driver) {
  if (!driver?.phone_number) return { ok: false, skipped: true };

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      seller_id,
      order_ref,
      customer_phone,
      status,
      payment_method,
      total_amount,
      delivery_type,
      delivery_zone,
      delivery_address,
      delivery_fee,
      sellers (
        id,
        name,
        slug,
        evolution_instance
      ),
      order_items (
        id,
        quantity,
        products (id, name)
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !order || order.delivery_type === "PICKUP") {
    return { ok: false, skipped: true, error: error?.message || "Commande livraison introuvable." };
  }

  return sendEvolutionText({
    instanceName: order.sellers?.evolution_instance || order.sellers?.slug,
    number: driver.phone_number,
    text: buildDriverDeliveryMessage(order, driver),
  });
}
