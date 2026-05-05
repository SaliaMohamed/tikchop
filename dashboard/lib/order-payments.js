import { supabaseAdmin } from "./supabase-admin";
import { sendEvolutionMedia, sendEvolutionText } from "./evolution";
import { buildReceiptPdfBuffer, getReceiptPdfFileName } from "./receipt-pdf";

function getPaystackUpdatePayload(payment = {}) {
  const paidAt = payment.paid_at || payment.transaction_date || new Date().toISOString();

  return {
    status: "PAID",
    paystack_reference: payment.reference || null,
    paystack_payment_status: payment.status || "success",
    paystack_paid_at: paidAt,
  };
}

export async function markOrderPaidFromPaystack(orderId, payment = {}) {
  if (!supabaseAdmin || !orderId) {
    return { data: null, error: null };
  }

  const fullPayload = getPaystackUpdatePayload(payment);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(fullPayload)
    .eq("id", orderId)
    .select("id, order_ref, status")
    .maybeSingle();

  if (!error) {
    return { data, error: null };
  }

  if (!/paystack_/i.test(error.message || "")) {
    return { data: null, error };
  }

  return supabaseAdmin
    .from("orders")
    .update({ status: "PAID" })
    .eq("id", orderId)
    .select("id, order_ref, status")
    .maybeSingle();
}

function getOrderRef(order) {
  return order?.order_ref || order?.id?.slice(0, 8)?.toUpperCase() || "TIKCHOP";
}

function formatCfa(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F CFA`;
}

function getDeliveryPlace(order) {
  return order?.delivery_zone || order?.delivery_address || "";
}

function getSellerEvolutionInstance(seller) {
  if (seller?.evolution_instance) {
    return seller.evolution_instance;
  }

  if (seller?.slug === "salia" && process.env.EVOLUTION_DEFAULT_INSTANCE) {
    return process.env.EVOLUTION_DEFAULT_INSTANCE;
  }

  return seller?.slug;
}

async function getOrderForWhatsAppMessage(orderId) {
  if (!supabaseAdmin || !orderId) {
    return null;
  }

  const fullSelect = `
    id,
    order_ref,
    customer_phone,
    status,
    total_amount,
    delivery_fee,
    delivery_zone,
    delivery_address,
    delivery_status,
    created_at,
    whatsapp_receipt_sent_at,
    paystack_reference,
    paystack_paid_at,
    sellers (
      name,
      slug,
      evolution_instance
    ),
    order_items (
      id,
      quantity,
      price_at_time,
      products (
        id,
        name
      )
    )
  `;

  const basicSelect = `
    id,
    order_ref,
    customer_phone,
    status,
    total_amount,
    delivery_fee,
    created_at,
    paystack_reference,
    sellers (
      name,
      slug
    )
  `;

  const result = await supabaseAdmin
    .from("orders")
    .select(fullSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (result.data) {
    return result.data;
  }

  if (result.error && /whatsapp_receipt_sent_at|evolution_instance|schema cache|column/i.test(result.error.message || "")) {
    const fallback = await supabaseAdmin
      .from("orders")
      .select(basicSelect)
      .eq("id", orderId)
      .maybeSingle();

    if (fallback.error) {
      console.error("WhatsApp order lookup failed:", fallback.error);
      return null;
    }

    return fallback.data;
  }

  if (result.error) {
    console.error("WhatsApp order lookup failed:", result.error);
  }

  return null;
}

async function markReceiptSent(orderId) {
  if (!supabaseAdmin || !orderId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ whatsapp_receipt_sent_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error && !/whatsapp_receipt_sent_at|schema cache|column/i.test(error.message || "")) {
    console.error("Receipt sent marker failed:", error);
  }
}

export async function sendPaystackReceiptMessage(orderId, payment = {}) {
  const order = await getOrderForWhatsAppMessage(orderId);
  if (!order || order.whatsapp_receipt_sent_at) {
    return { sent: false, skipped: true };
  }

  const seller = Array.isArray(order.sellers) ? order.sellers[0] : order.sellers;
  const instanceName = getSellerEvolutionInstance(seller);
  const orderRef = getOrderRef(order);
  const sellerName = seller?.name || "la boutique";
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const deliveryPlace = getDeliveryPlace(order);
  const lines = [
    "Commande prise en charge",
    `Votre paiement est confirme chez ${sellerName}.`,
    `Commande: ${orderRef}`,
    `Montant paye: ${formatCfa(total)}`,
    "",
    "Statut: preparation en cours",
    deliveryPlace
      ? `Livraison: ${deliveryPlace}`
      : "Livraison: la boutique confirme les details avec vous.",
    "",
    "Votre recu PDF arrive juste apres ce message.",
  ];

  const result = await sendEvolutionText({
    instanceName,
    number: order.customer_phone,
    text: lines.join(String.fromCharCode(10)),
  });

  const pdfBuffer = buildReceiptPdfBuffer(order, payment);
  const mediaResult = await sendEvolutionMedia({
    instanceName,
    number: order.customer_phone,
    media: pdfBuffer.toString("base64"),
    mediatype: "document",
    mimetype: "application/pdf",
    fileName: getReceiptPdfFileName(order),
    caption: `Recu Tikchop ${orderRef}`,
  });

  if (result.ok && mediaResult.ok) {
    await markReceiptSent(order.id);
  }

  return { sent: result.ok && mediaResult.ok, skipped: result.skipped || mediaResult.skipped || false };
}

function buildOrderStatusMessage(order, status, driver = null) {
  const orderRef = getOrderRef(order);
  const seller = Array.isArray(order.sellers) ? order.sellers[0] : order.sellers;
  const sellerName = seller?.name || "la boutique";
  const deliveryPlace = getDeliveryPlace(order);

  if (status === "PAID") {
    return [
      "Commande prise en charge",
      `Votre commande ${orderRef} est confirmee chez ${sellerName}.`,
      "La boutique prepare maintenant vos articles.",
      deliveryPlace ? `Livraison: ${deliveryPlace}` : "Livraison: details a confirmer avec vous.",
    ].join(String.fromCharCode(10));
  }

  if (status === "PREPARED") {
    return [
      "Colis pret",
      `Votre commande ${orderRef} est preparee.`,
      "Elle peut maintenant etre retiree ou confiee au livreur.",
      deliveryPlace ? `Destination: ${deliveryPlace}` : "Nous confirmons la destination de livraison avec vous.",
    ].join(String.fromCharCode(10));
  }

  if (status === "ASSIGNED") {
    return [
      "Livraison prise en charge",
      `Votre commande ${orderRef} est confiee a la livraison.`,
      driver?.name ? `Livreur: ${driver.name}` : "Un livreur prend votre colis en charge.",
      deliveryPlace ? `Destination: ${deliveryPlace}` : "Destination a confirmer.",
    ].join(String.fromCharCode(10));
  }

  if (status === "DELIVERED") {
    return [
      "Commande livree",
      `Votre commande ${orderRef} est marquee comme livree.`,
      `Merci d'avoir commande chez ${sellerName}.`,
    ].join(String.fromCharCode(10));
  }

  if (status === "CANCELLED") {
    return [
      "Commande annulee",
      `Votre commande ${orderRef} est annulee.`,
      "Vous pouvez recontacter la boutique si besoin.",
    ].join(String.fromCharCode(10));
  }

  return "";
}

export async function sendOrderLifecycleMessage(orderId, status, { driver = null } = {}) {
  const order = await getOrderForWhatsAppMessage(orderId);
  if (!order) {
    return { sent: false, skipped: true };
  }

  const seller = Array.isArray(order.sellers) ? order.sellers[0] : order.sellers;
  const text = buildOrderStatusMessage(order, status, driver);
  if (!text) {
    return { sent: false, skipped: true };
  }

  const result = await sendEvolutionText({
    instanceName: getSellerEvolutionInstance(seller),
    number: order.customer_phone,
    text,
  });

  return { sent: result.ok, skipped: result.skipped || false };
}

export async function savePaystackInitialization(orderId, payment = {}) {
  if (!supabaseAdmin || !orderId || !payment.reference) {
    return { data: null, error: null };
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      paystack_reference: payment.reference,
      paystack_authorization_url: payment.authorization_url || null,
      paystack_payment_status: "initialized",
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (!error || !/paystack_/i.test(error.message || "")) {
    return { data, error };
  }

  return { data: null, error: null };
}
