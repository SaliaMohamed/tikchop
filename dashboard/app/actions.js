"use server";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase-admin";
import { createPaystackSubaccount, getPayoutNetworkConfig, initializeTransaction, normalizePayoutNetwork, normalizePayoutPhone } from "../lib/paystack";
import { savePaystackInitialization, sendOrderLifecycleMessage } from "../lib/order-payments";
import { sendEvolutionText } from "../lib/evolution";
import { getPaymentOption, getSellerDefaultPaymentMethod, normalizeAcceptedPaymentMethods, onlinePaymentsEnabled, paymentMethodsNeedDirectPhone } from "../lib/local-commerce";
import { createClient } from "../lib/supabase/server";

// Auth basée sur les cookies HttpOnly (@supabase/ssr) — accessToken ignoré intentionnellement.
async function requireSellerUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }
  return data.user;
}

async function requireSellerBySlug(slug, _accessToken, select = "*") {
  const user = await requireSellerUser();
  const { data: seller, error } = await supabaseAdmin
    .from("sellers")
    .select(select)
    .eq("slug", slug)
    .eq("owner_user_id", user.id)
    .single();

  if (error || !seller) {
    throw new Error("Boutique non autorisee pour ce compte vendeur.");
  }

  return seller;
}

async function requireSellerById(sellerId, _accessToken, select = "id") {
  const user = await requireSellerUser();
  const { data: seller, error } = await supabaseAdmin
    .from("sellers")
    .select(select)
    .eq("id", sellerId)
    .eq("owner_user_id", user.id)
    .single();

  if (error || !seller) {
    throw new Error("Boutique non autorisee pour ce compte vendeur.");
  }

  return seller;
}

async function requireOrderForSeller(orderId, accessToken) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, seller_id, status")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Commande introuvable.");
  }

  await requireSellerById(order.seller_id, accessToken);
  return order;
}

function formatCfa(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function normalizeCustomerPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function handoffKey(value) {
  return normalizeCustomerPhone(value) || String(value || "").trim();
}

function formatCustomerPhone(value) {
  const digits = normalizeCustomerPhone(value);
  if (!digits) return "";
  return digits.startsWith("225") ? `+${digits}` : `+${digits}`;
}

function getSellerEvolutionInstance(seller) {
  return String(seller?.evolution_instance || seller?.slug || "").trim();
}

function getHandoffSellerKeys(seller) {
  return Array.from(new Set([seller?.slug, getSellerEvolutionInstance(seller)].filter(Boolean)));
}

function attachHandoffsToOrders(orders = [], handoffs = []) {
  const byPhone = new Map();
  for (const handoff of handoffs || []) {
    byPhone.set(handoffKey(handoff.customer_phone), handoff);
  }

  return (orders || []).map((order) => ({
    ...order,
    handoff: byPhone.get(handoffKey(order.customer_phone)) || null,
  }));
}

function parseStoredMessageClient(client = "") {
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

function getMessagePhone(row = {}) {
  const parsed = parseStoredMessageClient(row.client);
  return normalizeCustomerPhone(row.customer_phone) || normalizeCustomerPhone(parsed.phone);
}

function getMessageName(row = {}) {
  const parsed = parseStoredMessageClient(row.client);
  return parsed.name || "";
}

const MESSAGE_SELECT_BASE = "id,contenu,client,statut,created_at,external_message_id,seller_slug,customer_phone";
const MESSAGE_SELECT_WITH_MEDIA = `${MESSAGE_SELECT_BASE},media_type,media_url,media_mime_type,media_caption,media_payload`;

function normalizeMessageMedia(row = {}) {
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

function normalizeStoredMessage(row = {}) {
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

function mergeMessageRows(...groups) {
  const byId = new Map();
  for (const rows of groups) {
    for (const row of rows || []) {
      byId.set(String(row.id), row);
    }
  }
  return Array.from(byId.values());
}

async function getActiveSellerHandoffs(seller) {
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

async function saveSellerCustomerHandoff(seller, customerPhone, durationMinutes = 24 * 60) {
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

function normalizeProductVariants(input) {
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
      const stockMatch = entry.match(/(?:stock|qt[eé]|x)\s*[:=]?\s*(\d{1,4})|\b(\d{1,4})\s*(?:pcs?|pieces?)\b/i);
      const stock = Number.parseInt(stockMatch?.[1] || stockMatch?.[2] || 0, 10);
      const cleanLabel = entry
        .replace(/(?:stock|qt[eé]|x)\s*[:=]?\s*\d{1,4}/ig, "")
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

function buildDriverDeliveryMessage(order, driver) {
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

function chooseDriverForOrder(order, drivers) {
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

async function autoSharePreparedOrderToDriver(orderId) {
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

async function sendOrderToAssignedDriver(orderId, driver) {
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

export async function uploadProductImage(formData) {
  const file = formData?.get("image");

  if (!file || typeof file === "string") {
    throw new Error("Image manquante.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Selectionnez une vraie image.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image trop lourde. Maximum 8 MB.");
  }

  const cloudinary = getCloudinaryConfig();
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/products/${timestamp}-${createHash("sha1")
    .update(`${file.name}-${file.size}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return {
    url: data.secure_url,
    cleanUrl: getCloudinaryCleanProductUrl(data.secure_url),
    publicId: data.public_id,
  };
}

export async function uploadSellerLogo(formData) {
  const file = formData?.get("image");

  if (!file || typeof file === "string") {
    throw new Error("Image manquante.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Selectionnez une vraie image.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image trop lourde. Maximum 8 MB.");
  }

  const cloudinary = getCloudinaryConfig();
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/logos/${timestamp}-${createHash("sha1")
    .update(`${file.name}-${file.size}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return {
    url: data.secure_url,
    cleanUrl: data.secure_url,
    publicId: data.public_id,
  };
}

export async function removeProductBackground(imageUrl, options = {}) {
  await requireSellerUser();

  const sourceUrl = String(imageUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("Photo manquante.");
  }

  if (!sourceUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error("Fond propre disponible seulement apres envoi de la photo.");
  }

  const serviceUrl = String(process.env.REMBG_API_URL || process.env.BACKGROUND_REMOVAL_API_URL || "").replace(/\/+$/, "");
  if (!serviceUrl) {
    throw new Error("Fond propre pas encore active. Ajoutez REMBG_API_URL cote serveur.");
  }

  const imageResponse = await fetch(getAiOptimizedImageUrl(sourceUrl));
  if (!imageResponse.ok) {
    throw new Error("Photo impossible a preparer.");
  }

  const imageType = imageResponse.headers.get("content-type")?.startsWith("image/")
    ? imageResponse.headers.get("content-type")
    : "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const removePayload = new FormData();
  removePayload.append("image", new Blob([imageBuffer], { type: imageType }), "tikchop-product.jpg");
  removePayload.append("background", normalizeBackgroundOption(options.background));

  const headers = {};
  if (process.env.REMBG_API_KEY) {
    headers["x-api-key"] = process.env.REMBG_API_KEY;
  }

  const removeResponse = await fetch(`${serviceUrl}/remove`, {
    method: "POST",
    headers,
    body: removePayload,
  });

  if (!removeResponse.ok) {
    throw new Error("Fond propre indisponible. Reessayez ou gardez la photo claire.");
  }

  const outputType = removeResponse.headers.get("content-type")?.startsWith("image/")
    ? removeResponse.headers.get("content-type")
    : "image/png";
  const outputBuffer = Buffer.from(await removeResponse.arrayBuffer());
  const cloudinary = getCloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/products-background/${timestamp}-${createHash("sha1")
    .update(`${sourceUrl}-${outputBuffer.length}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const uploaded = await uploadBufferToCloudinary({
    buffer: outputBuffer,
    mimeType: outputType,
    publicId,
    cloudinary,
  });

  return {
    url: uploaded.secure_url,
    cleanUrl: getCloudinaryCleanProductUrl(uploaded.secure_url),
    publicId: uploaded.public_id,
  };
}

async function uploadBufferToCloudinary({ buffer, mimeType, publicId, cloudinary }) {
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", new Blob([buffer], { type: mimeType }), "tikchop-product-clean.png");
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return data;
}

function normalizeBackgroundOption(value) {
  const background = String(value || "warm").trim().toLowerCase();
  if (["white", "gray", "warm", "transparent"].includes(background)) return background;
  return "warm";
}

function getCloudinaryConfig() {
  const directConfig = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };

  if (directConfig.cloudName && directConfig.apiKey && directConfig.apiSecret) {
    return directConfig;
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) return directConfig;

  try {
    const url = new URL(cloudinaryUrl);
    return {
      cloudName: directConfig.cloudName || url.hostname,
      apiKey: directConfig.apiKey || decodeURIComponent(url.username),
      apiSecret: directConfig.apiSecret || decodeURIComponent(url.password),
    };
  } catch {
    return directConfig;
  }
}

export async function analyzeProductImage(imageUrl, voiceHint = "") {
  if (!imageUrl) {
    throw new Error("Image manquante.");
  }

  let lastError = null;

  for (const provider of getVisionProviderOrder()) {
    try {
      if (provider === "gemini") return await analyzeProductImageWithGemini(imageUrl, voiceHint);
      if (provider === "openai") return await analyzeProductImageWithOpenAI(imageUrl, voiceHint);
      if (provider === "openrouter") return await analyzeProductImageWithOpenRouter(imageUrl, voiceHint);
    } catch (err) {
      console.error(`${provider} vision failed:`, err);
      lastError = err;
    }
  }

  console.warn("AI analysis failed or not configured. Returning empty product data. Last error:", lastError);
  return normalizeProductAnalysis({});
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000, timeoutMessage = "Service trop lent.") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeProductImagesBatch(imageUrls = [], voiceHint = "") {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 6) : [];
  if (urls.length === 0) return [];

  const providerOrder = getVisionProviderOrder();

  if (providerOrder[0] !== "gemini") {
    return Promise.all(urls.map((url) => analyzeProductImage(url, voiceHint)));
  }

  try {
    return await analyzeProductImagesBatchWithGemini(urls, voiceHint);
  } catch (err) {
    console.error("Gemini batch failed:", err);
    return Promise.all(urls.map((url) => analyzeProductImage(url, voiceHint)));
  }
}

async function analyzeProductImageWithGemini(imageUrl, voiceHint = "") {
  const imageResponse = await fetchWithTimeout(
    getAiOptimizedImageUrl(imageUrl),
    {},
    8000,
    "Photo trop lente a lire pour l'IA.",
  );
  if (!imageResponse.ok) {
    throw new Error("Image impossible a lire pour l'IA.");
  }

  const mimeType = imageResponse.headers.get("content-type")?.startsWith("image/")
    ? imageResponse.headers.get("content-type")
    : "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const imageBase64 = imageBuffer.toString("base64");
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
            { text: productAnalysisPrompt(voiceHint) },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: productAnalysisSchema(),
        temperature: 0.15,
        maxOutputTokens: 1600,
      },
    }),
  }, 18000, "Analyse Gemini trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse Gemini impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Analyse Gemini vide.");
  }

  return normalizeProductAnalysis(parseJsonModelOutput(textOutput));
}

async function analyzeProductImagesBatchWithGemini(imageUrls, voiceHint = "") {
  const imageParts = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    const imageResponse = await fetchWithTimeout(
      getAiOptimizedImageUrl(imageUrl),
      {},
      8000,
      `Image ${index + 1} trop lente a lire pour l'IA.`,
    );
    if (!imageResponse.ok) {
      throw new Error(`Image ${index + 1} impossible a lire pour l'IA.`);
    }

    const mimeType = imageResponse.headers.get("content-type")?.startsWith("image/")
      ? imageResponse.headers.get("content-type")
      : "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    imageParts.push(
      { text: `IMAGE ${index + 1}` },
      {
        inline_data: {
          mime_type: mimeType,
          data: imageBuffer.toString("base64"),
        },
      },
    );
  }

  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: productBatchAnalysisPrompt(imageUrls.length, voiceHint) },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: productBatchAnalysisSchema(),
        temperature: 0.12,
        maxOutputTokens: Math.max(2200, imageUrls.length * 850),
      },
    }),
  }, 22000, "Analyse Gemini en lot trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse Gemini en lot impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Analyse Gemini en lot vide.");
  }

  const parsed = parseJsonModelOutput(textOutput);
  const products = Array.isArray(parsed?.products) ? parsed.products : [];

  return imageUrls.map((_, index) => normalizeProductAnalysis(products[index] || {}));
}

async function analyzeProductImageWithOpenAI(imageUrl, voiceHint = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: productAnalysisPrompt(voiceHint),
            },
            {
              type: "input_image",
              image_url: getAiOptimizedImageUrl(imageUrl),
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tikchop_product_analysis",
          strict: true,
          schema: productAnalysisSchema(),
        },
      },
      max_output_tokens: 500,
    }),
  }, 18000, "Analyse OpenAI trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse IA impossible.");
  }

  const textOutput = data.output_text
    || data.output?.flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

  if (!textOutput) {
    throw new Error("Analyse IA vide.");
  }

  const analysis = parseJsonModelOutput(textOutput);

  return normalizeProductAnalysis(analysis);
}

async function analyzeProductImageWithOpenRouter(imageUrl, voiceHint = "") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-32b-instruct";

  if (!apiKey || !model) {
    throw new Error("OpenRouter vision non configure.");
  }

  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tikchop.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Tikchop",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                productAnalysisPrompt(voiceHint),
                "Retourne uniquement un JSON valide avec ces champs: name, description, category, colors, suggested_sizes, size, quantity, confidence.",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: {
                url: getAiOptimizedImageUrl(imageUrl),
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: 900,
    }),
  }, 20000, "Analyse OpenRouter trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse OpenRouter impossible.");
  }

  const content = data.choices?.[0]?.message?.content;
  const textOutput = Array.isArray(content)
    ? content.map((part) => part.text || "").join("\n")
    : content;

  if (!textOutput) {
    throw new Error("Analyse OpenRouter vide.");
  }

  return normalizeProductAnalysis(parseJsonModelOutput(textOutput));
}

function getVisionProviderOrder() {
  const configured = [
    process.env.GEMINI_API_KEY ? "gemini" : "",
    process.env.OPENROUTER_API_KEY ? "openrouter" : "",
    process.env.OPENAI_API_KEY ? "openai" : "",
  ].filter(Boolean);

  const preferred = String(process.env.AI_VISION_PROVIDER || "")
    .toLowerCase()
    .split(/[,\s>]+/)
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (preferred.length === 0) {
    return configured;
  }

  const ordered = preferred.filter((provider, index) => (
    configured.includes(provider) && preferred.indexOf(provider) === index
  ));

  return [...ordered, ...configured.filter((provider) => !ordered.includes(provider))];
}

function getAiOptimizedImageUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto:good,w_768,c_limit/");
}

function getCloudinaryCleanProductUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  return url.replace(
    "/image/upload/",
    "/image/upload/e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_limit,w_1400,h_1800/f_auto,q_auto:good/",
  );
}

function parseJsonModelOutput(textOutput) {
  const raw = String(textOutput || "").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objectMatch) throw new Error("Reponse IA non lisible.");
      return JSON.parse(objectMatch[0]);
    }
  }
}

function productAnalysisPrompt(voiceHint = "") {
  return [
    "Analyse cette photo de produit pour une boutique en ligne Tikchop a Abidjan.",
    "Retourne une fiche directement utile a une vendeuse: nom court, rayon clair, couleurs visibles, tailles possibles.",
    "Pense comme une assistante de catalogue WhatsApp: le resultat doit aider a publier vite, pas seulement decrire l'image.",
    "Si l'indication vendeur contient Type de boutique ou Contexte du lot, utilise-la comme priorite forte pour identifier l'objet vendu.",
    "Regarde d'abord l'objet au centre, l'objet tenu, porte ou pose pour la vente. Ignore le decor, les fleurs, le sol, le lit, le mur et les mains sauf s'ils sont le produit.",
    "Ne nomme jamais le decor comme produit: fleurs, jardin, plante, table, sol, mur, lit, cintre, mannequin ou main ne sont pas l'article sauf indication vendeur explicite.",
    "Si un bijou, une montre, un sac, une paire de chaussures ou un accessoire est petit dans l'image, privilegie cet objet plutot que l'arriere-plan.",
    "Exemples de noms utiles selon le type: Collier femme, Bracelet, Montre, Sac a main, Parfum, Creme visage, Chargeur USB-C, Ecouteurs, Plat attieke, Ustensile cuisine, Robe, Sandales.",
    "Categories simples a privilegier: Accessoires, Bijoux, Beaute, Telephones, Maison, Alimentation, Vetements, Chaussures, Sacs, Autre.",
    "Le nom doit etre vendable en francais simple, sans phrase longue, sans emoji et sans marque inventee.",
    "Si une personne porte le produit, nomme le vetement ou l'accessoire visible, pas la personne.",
    "La description doit etre courte, concrete et rassurante: 8 a 16 mots, avec coupe, couleur, matiere apparente ou usage si visible.",
    "Ne devine pas de marque si elle n'est pas clairement visible.",
    "Si la photo est ambigue, donne un nom generique utile plutot que de laisser vide.",
    "Ne remplis pas la taille definitive ni la quantite depuis la photo: le vendeur les renseigne au clavier ou au vocal.",
    "Retourne toujours size comme chaine vide et quantity comme 1, sauf si l'indication vocale du vendeur les donne explicitement.",
    "Si la photo montre seulement un detail ou un angle, decris le produit principal probable sans affirmer trop fort et baisse confidence.",
    "Si l'utilisateur donne une indication vendeur, utilise-la pour corriger le nom, la categorie et les suggested_sizes quand elle parle du produit.",
    voiceHint ? `Indication vendeur: ${voiceHint}` : "",
  ].filter(Boolean).join("\n");
}

function productBatchAnalysisPrompt(count, voiceHint = "") {
  return [
    `Analyse ${count} photos de produits pour une boutique Tikchop a Abidjan.`,
    "Retourne exactement une fiche par image, dans le meme ordre: IMAGE 1, IMAGE 2, etc.",
    "Chaque fiche doit avoir un nom court et vendable en francais simple.",
    "Fais comme une assistante catalogue: tu dois aider a publier vite un lot de photos, pas ecrire une description vague.",
    "Si l'indication vendeur contient Type de boutique ou Contexte du lot, utilise-la comme priorite forte pour nommer les articles.",
    "Dans chaque image, identifie l'objet vendu au centre, tenu, porte ou pose pour la vente. Ignore le decor et l'arriere-plan.",
    "Ne nomme jamais le decor comme produit: fleurs, jardin, plante, table, sol, mur, lit, cintre, mannequin ou main ne sont pas l'article sauf indication vendeur explicite.",
    "Si un accessoire est petit devant un decor charge, nomme l'accessoire et non le decor.",
    "Exemples de noms utiles selon le type: collier femme, bracelet, montre, sac a main, parfum, creme visage, chargeur USB-C, ecouteurs, plat attieke, ustensile cuisine, robe, sandales.",
    "Categories simples a privilegier: Accessoires, Bijoux, Beaute, Telephones, Maison, Alimentation, Vetements, Chaussures, Sacs, Autre.",
    "Si une personne porte un article, identifie l'article vendu visible, pas la personne.",
    "La description de chaque fiche doit etre courte et vendeuse: coupe, couleur, matiere apparente ou usage si visible.",
    "Ne mets jamais le prix: le vendeur le saisira lui-meme.",
    "Ne devine pas la marque. Si l'image est ambigue, donne un nom generique utile et baisse confidence.",
    "Pour les vetements, propose quelques tailles possibles dans suggested_sizes, mais laisse size vide sauf indication vocale.",
    "Si plusieurs images semblent etre des angles du meme article, garde le meme nom de base pour aider le vendeur a les fusionner ensuite.",
    voiceHint ? `Indication vendeur pour tout le lot: ${voiceHint}` : "",
  ].filter(Boolean).join("\n");
}

function productAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "Nom court et courant du produit." },
      description: { type: "string", description: "Description vendeuse courte." },
      category: { type: "string", description: "Categorie simple du produit." },
      colors: { type: "array", items: { type: "string" }, description: "Couleurs visibles." },
      suggested_sizes: { type: "array", items: { type: "string" }, description: "Tailles ou pointures possibles." },
      size: { type: "string", description: "Taille definitive seulement si donnee par le vendeur." },
      quantity: { type: "number", description: "Quantite definitive, 1 par defaut." },
      confidence: { type: "number", description: "Confiance entre 0 et 1." },
    },
    required: ["name", "description", "category", "colors", "suggested_sizes", "size", "quantity", "confidence"],
  };
}

function productBatchAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      products: {
        type: "array",
        items: productAnalysisSchema(),
      },
    },
    required: ["products"],
  };
}

function normalizeProductAnalysis(analysis) {
  return {
    name: String(analysis.name || "").trim(),
    description: String(analysis.description || "").trim(),
    category: String(analysis.category || "").trim(),
    colors: Array.isArray(analysis.colors) ? analysis.colors.filter(Boolean).map(String) : [],
    suggested_sizes: Array.isArray(analysis.suggested_sizes) ? analysis.suggested_sizes.filter(Boolean).map(String) : [],
    size: String(analysis.size || "").trim(),
    quantity: Number.isFinite(Number(analysis.quantity)) ? Number(analysis.quantity) : 1,
    confidence: Number.isFinite(Number(analysis.confidence)) ? Number(analysis.confidence) : 0,
  };
}

export async function createOrder(sellerId, cartItems, options = {}) {
  const { 
    paymentMethod = "CASH_ON_DELIVERY", 
    deliveryType = "DELIVERY", 
    deliveryZone = "", 
    deliveryAddress = "",
    customerPhone = "UNKNOWN",
    customerNote = ""
  } = options;

  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!sellerId || !Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Invalid order payload.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("fixed_delivery_fee, delivery_payment_timing, accepted_payment_methods, default_payment_method, paystack_subaccount_code, payout_status")
    .eq("id", sellerId)
    .single();

  if (sellerError) {
    console.warn("Delivery settings unavailable, using defaults:", sellerError.message);
  }

  let deliveryFee = deliveryType === "DELIVERY" ? (Number(seller?.fixed_delivery_fee) || 0) : 0;
  if (deliveryType === "DELIVERY" && deliveryZone) {
    const { data: zone, error: zoneError } = await supabaseAdmin
      .from("delivery_zones")
      .select("fee")
      .eq("seller_id", sellerId)
      .eq("name", deliveryZone)
      .eq("is_active", true)
      .maybeSingle();

    if (!zoneError && zone) {
      deliveryFee = Number(zone.fee || 0);
    } else if (zoneError && zoneError.code !== "PGRST205") {
      console.warn("Delivery zone lookup failed, using fixed fee:", zoneError.message);
    }
  }
  const isDeliveryIncluded = seller?.delivery_payment_timing === "INCLUDED";

  const requestedItems = cartItems
    .map((item) => ({
      productId: item.productId,
      quantity: Number.parseInt(item.quantity, 10),
    }))
    .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);

  if (requestedItems.length === 0) {
    throw new Error("No valid order items.");
  }

  const acceptedMethods = normalizeAcceptedPaymentMethods(seller?.accepted_payment_methods);
  const requestedPayment = getPaymentOption(paymentMethod);
  const paystackReady = onlinePaymentsEnabled() && Boolean(seller?.paystack_subaccount_code || seller?.payout_status === "paystack_ready");
  const availableMethods = acceptedMethods.filter((method) => method !== "PAYSTACK" || paystackReady);
  const safeAcceptedMethods = availableMethods.length > 0 ? availableMethods : ["CASH_ON_DELIVERY"];
  const requestedAllowed = availableMethods.includes(requestedPayment.value) && (!requestedPayment.online || paystackReady);
  const normalizedPaymentMethod = requestedAllowed
    ? requestedPayment.value
    : getSellerDefaultPaymentMethod(seller, safeAcceptedMethods);

  const productIds = requestedItems.map((item) => item.productId);
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, seller_id, name, price, stock_quantity")
    .eq("seller_id", sellerId)
    .in("id", productIds);

  if (productsError) {
    console.error("Error loading products:", productsError);
    throw new Error("Failed to load products");
  }

  const productById = new Map((products || []).map((product) => [product.id, product]));
  const orderItemsData = requestedItems.map((item) => {
    const product = productById.get(item.productId);

    if (!product) {
      throw new Error("Product not found for this seller.");
    }

    const stock = Number(product.stock_quantity || 0);
    if (stock < item.quantity) {
      throw new Error(`${product.name} does not have enough stock.`);
    }

    return {
      product,
      quantity: item.quantity,
      lineTotal: Number(product.price || 0) * item.quantity,
    };
  });

  const productsTotal = orderItemsData.reduce((total, item) => total + item.lineTotal, 0);
  const totalAmount = isDeliveryIncluded ? productsTotal + deliveryFee : productsTotal;

  const orderRef = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  let { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert([
      {
        seller_id: sellerId,
        order_ref: orderRef,
        customer_phone: customerPhone,
        status: "PENDING",
        total_amount: productsTotal,
        payment_method: normalizedPaymentMethod,
        delivery_type: deliveryType,
        delivery_zone: deliveryZone,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        delivery_status: "PENDING",
        customer_note: String(customerNote || "").trim() || null
      },
    ])
    .select("id, order_ref, total_amount")
    .single();

  if (orderError && /customer_note/i.test(orderError.message || "")) {
    const retryResult = await supabaseAdmin
      .from("orders")
      .insert([
        {
          seller_id: sellerId,
          order_ref: orderRef,
          customer_phone: customerPhone,
          status: "PENDING",
          total_amount: productsTotal,
          payment_method: normalizedPaymentMethod,
          delivery_type: deliveryType,
          delivery_zone: deliveryZone,
          delivery_address: deliveryAddress,
          delivery_fee: deliveryFee,
          delivery_status: "PENDING",
        },
      ])
      .select("id, order_ref, total_amount")
      .single();

    order = retryResult.data;
    orderError = retryResult.error;
  }

  if (orderError && /(order_ref|delivery_|fixed_delivery_fee|delivery_payment_timing|payment_method)/i.test(orderError.message || "")) {
    const fallbackResult = await supabaseAdmin
      .from("orders")
      .insert([
        {
          seller_id: sellerId,
          customer_phone: customerPhone,
          status: "PENDING",
          total_amount: productsTotal,
          payment_method: normalizedPaymentMethod === "PAYSTACK" ? "PAYSTACK" : "WAVE",
        },
      ])
      .select("id, total_amount")
      .single();

    order = fallbackResult.data ? { ...fallbackResult.data, order_ref: null } : null;
    orderError = fallbackResult.error;
  }

  if (orderError) {
    console.error("Error creating order:", orderError);
    throw new Error("Failed to create order");
  }

  const orderItems = orderItemsData.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    quantity: item.quantity,
    price_at_time: item.product.price,
  }));

  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);

  if (itemsError) {
    console.error("Error creating order items:", itemsError);
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    throw new Error("Failed to create order items");
  }

  // --- Décrémentation de stock ---
  // Tentative via RPC atomique (FOR UPDATE PostgreSQL, pas de race condition).
  // Si la migration 2026-05-13-security-and-atomic-stock.sql n'est pas encore appliquée,
  // la RPC est absente : on retombe sur l'optimistic lock manuel.
  let stockDecremented = false;

  try {
    // Méthode 1 : RPC atomique (recommandée)
    const stockResults = await Promise.all(
      orderItemsData.map((item) =>
        supabaseAdmin.rpc("decrement_stock_atomic", {
          p_product_id: item.product.id,
          p_seller_id: sellerId,
          p_quantity: item.quantity,
        })
      )
    );

    for (let i = 0; i < stockResults.length; i++) {
      const { data: rpcRows, error: rpcError } = stockResults[i];

      // RPC absente → basculer sur la méthode 2
      if (rpcError && /function.*does not exist|PGRST202/i.test(rpcError.message || "")) {
        stockDecremented = false;
        break;
      }

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row?.success) {
        const productName = orderItemsData[i].product.name;
        if (row?.error_code === "INSUFFICIENT_STOCK") {
          throw new Error(`${productName} vient d'etre commande. Verifiez le stock puis recommencez.`);
        }
        throw new Error(`${productName} : stock non mis a jour. Reessayez.`);
      }
      stockDecremented = true;
    }
  } catch (rpcErr) {
    // Ne relancer que si le stock a déjà été partiellement décrémenté (incohérence)
    if (stockDecremented) {
      await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(rpcErr.message || "Stock non mis a jour. Reessayez la commande.");
    }
    // Sinon : RPC absente, utiliser méthode 2 ci-dessous
  }

  // Méthode 2 : Optimistic lock manuel (fallback si RPC non déployée)
  if (!stockDecremented) {
    const decrementedProducts = [];
    try {
      for (const item of orderItemsData) {
        const currentStock = Number(item.product.stock_quantity || 0);
        const nextStock = Math.max(0, currentStock - item.quantity);
        const { data: updatedProduct, error: stockError } = await supabaseAdmin
          .from("products")
          .update({ stock_quantity: nextStock })
          .eq("id", item.product.id)
          .eq("seller_id", sellerId)
          .eq("stock_quantity", currentStock)
          .select("id")
          .maybeSingle();

        if (stockError) throw stockError;

        if (!updatedProduct) {
          throw new Error(`${item.product.name} vient d'etre commande. Verifiez le stock puis recommencez.`);
        }

        decrementedProducts.push({ id: item.product.id, previousStock: currentStock });
      }
    } catch (stockError) {
      console.error("Error updating product stock (fallback):", stockError);
      await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);

      for (const product of decrementedProducts.reverse()) {
        await supabaseAdmin
          .from("products")
          .update({ stock_quantity: product.previousStock })
          .eq("id", product.id);
      }

      throw new Error(stockError.message || "Stock non mis a jour. Reessayez la commande.");
    }
  }


  return {
    orderId: order.id,
    orderRef: order.order_ref || order.id.split("-")[0].toUpperCase(),
    productsTotal,
    deliveryFee,
    totalToPay: totalAmount,
  };
}

export async function initiatePayment(orderId) {
  try {
    if (!onlinePaymentsEnabled()) {
      throw new Error("Paiement en ligne indisponible pour le moment.");
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized.");
    }

    let { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_ref, total_amount, delivery_fee, customer_phone, sellers(name, delivery_payment_timing, paystack_subaccount_code, payout_status)")
      .eq("id", orderId)
      .single();

    let payableAmount = 0;
    let orderForPayment = order;

    if (error && /delivery_fee|delivery_payment_timing|paystack_subaccount_code|payout_status/i.test(error.message || "")) {
      const fallback = await supabaseAdmin
        .from("orders")
        .select("id, order_ref, total_amount, delivery_fee, customer_phone, sellers(name, delivery_payment_timing)")
        .eq("id", orderId)
        .single();

      if (!fallback.error && fallback.data) {
        order = fallback.data;
        orderForPayment = { ...fallback.data, delivery_fee: Number(fallback.data.delivery_fee || 0) };
      } else {
        const basicFallback = await supabaseAdmin
          .from("orders")
          .select("id, order_ref, total_amount, customer_phone, sellers(name)")
          .eq("id", orderId)
          .single();

        if (basicFallback.error || !basicFallback.data) {
          throw new Error("Order not found.");
        }

        order = basicFallback.data;
        orderForPayment = { ...basicFallback.data, delivery_fee: 0 };
      }
    } else if (error || !order) {
      throw new Error("Order not found.");
    }

    payableAmount = Number(orderForPayment.total_amount || 0);
    if (orderForPayment.sellers?.delivery_payment_timing === "INCLUDED") {
      payableAmount += Number(orderForPayment.delivery_fee || 0);
    }

    // Récupérer le vrai numéro de téléphone pour générer un email de reçu
    const cleanPhone = String(orderForPayment.customer_phone || "").replace(/[^\d]/g, "");
    const customerEmail = cleanPhone ? `client-${cleanPhone}@phone.tikchop.local` : `customer-${orderId}@tikchop.app`;

    const sellerSubaccount = orderForPayment.sellers?.paystack_subaccount_code || "";
    const splitBearer = sellerSubaccount && process.env.PAYSTACK_SPLIT_FEE_BEARER === "subaccount" ? "subaccount" : "account";

    const paymentData = await initializeTransaction({
      email: customerEmail,
      amount: payableAmount,
      metadata: {
        order_id: orderId,
        order_ref: orderForPayment.order_ref || orderId.split("-")[0].toUpperCase(),
        seller_name: orderForPayment.sellers?.name || "Tikchop",
        seller_payout: sellerSubaccount ? "split_subaccount" : "platform_account",
      },
      subaccount: sellerSubaccount || undefined
    });


    await savePaystackInitialization(orderId, paymentData, {
      subaccount: sellerSubaccount,
      bearer: sellerSubaccount ? splitBearer : "",
    });

    return { authorization_url: paymentData.authorization_url, reference: paymentData.reference };
  } catch (error) {
    console.error("Payment initialization error:", error);
    throw new Error("Impossible d'initialiser le paiement.");
  }
}

export async function updateOrderStatus(orderId, status, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const allowed = new Set(["PENDING", "PAID", "PREPARED", "DELIVERED", "CANCELLED"]);
  if (!orderId || !allowed.has(status)) {
    throw new Error("Invalid order status.");
  }

  const currentOrder = await requireOrderForSeller(orderId, accessToken);

  const deliveryStatusByOrderStatus = {
    PREPARED: "READY",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
  };
  const updatePayload = {
    status,
    ...(deliveryStatusByOrderStatus[status] ? { delivery_status: deliveryStatusByOrderStatus[status] } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("id, status, delivery_status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (currentOrder.status !== status && ["PAID", "PREPARED", "DELIVERED", "CANCELLED"].includes(status)) {
    try {
      await sendOrderLifecycleMessage(orderId, status);
    } catch (notificationError) {
      console.error("Order status WhatsApp notification failed:", notificationError);
    }
  }

  if (status === "PREPARED") {
    const driverShare = await autoSharePreparedOrderToDriver(orderId);
    if (driverShare) {
      return { ...data, ...driverShare };
    }
  }

  return data;
}

export async function assignOrderDriver(orderId, driverId, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!orderId || !driverId) {
    throw new Error("Invalid driver assignment.");
  }

  const order = await requireOrderForSeller(orderId, accessToken);

  const { data: driver, error: driverError } = await supabaseAdmin
    .from("delivery_drivers")
    .select("id, seller_id, name, phone_number, zone, is_active")
    .eq("id", driverId)
    .eq("seller_id", order.seller_id)
    .eq("is_active", true)
    .single();

  if (driverError || !driver) {
    throw new Error(driverError?.message || "Driver not found for this seller.");
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      delivery_driver_id: driver.id,
      delivery_status: "ASSIGNED",
    })
    .eq("id", orderId)
    .select("id, delivery_driver_id, delivery_status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  try {
    await sendOrderLifecycleMessage(orderId, "ASSIGNED", { driver });
  } catch (notificationError) {
    console.error("Customer delivery WhatsApp notification failed:", notificationError);
  }

  let driverNotified = false;
  try {
    const driverResult = await sendOrderToAssignedDriver(orderId, driver);
    driverNotified = Boolean(driverResult?.ok);
  } catch (driverNotificationError) {
    console.error("Driver WhatsApp notification failed:", driverNotificationError);
  }

  return { ...data, delivery_drivers: driver, driver_notified: driverNotified };
}

export async function markOrderSharedToDriver(orderId, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!orderId) {
    throw new Error("Invalid order.");
  }

  await requireOrderForSeller(orderId, accessToken);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ delivery_status: "ASSIGNED" })
    .eq("id", orderId)
    .select("id, delivery_status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getSellerOrders(slug, accessToken, { limit = 100, before } = {}) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug, evolution_instance");

  // Pagination curseur : `before` = valeur de created_at de la dernière commande vue
  let ordersQuery = supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        quantity,
        price_at_time,
        products (id, name, image_url)
      ),
      delivery_drivers (
        id,
        name,
        phone_number,
        zone
      )
    `)
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(limit) || 100, 200));

  if (before) {
    ordersQuery = ordersQuery.lt("created_at", before);
  }

  const [{ data, error }, handoffs] = await Promise.all([
    ordersQuery,
    getActiveSellerHandoffs(seller),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return attachHandoffsToOrders(data || [], handoffs);
}

export async function pauseBotForCustomer(slug, customerPhone, accessToken, durationMinutes = 24 * 60) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug, evolution_instance");
  const handoff = await saveSellerCustomerHandoff(seller, customerPhone, durationMinutes);
  return { handoff };
}

export async function resumeBotForCustomer(slug, customerPhone, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug, evolution_instance");
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  if (cleanPhone.length < 6) {
    throw new Error("Numero client invalide.");
  }

  const { error } = await supabaseAdmin
    .from("messages")
    .delete()
    .in("seller_slug", getHandoffSellerKeys(seller))
    .eq("statut", "human_pause")
    .eq("customer_phone", cleanPhone);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true, customer_phone: cleanPhone };
}

export async function sendSellerManualReply(slug, customerPhone, text, accessToken, durationMinutes = 24 * 60) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const message = String(text || "").trim();
  if (!message || message.length > 1200) {
    throw new Error("Message client invalide.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug, evolution_instance");
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  const handoff = await saveSellerCustomerHandoff(seller, cleanPhone, durationMinutes);
  const result = await sendEvolutionText({
    instanceName: getSellerEvolutionInstance(seller),
    number: cleanPhone,
    text: message,
  });

  if (!result?.ok) {
    throw new Error("Message non envoye. Verifiez la connexion WhatsApp de la boutique.");
  }

  const messageRow = {
    contenu: message,
    client: `${seller.slug} : Vendeur : ${cleanPhone}@s.whatsapp.net`,
    statut: "followup",
    seller_slug: seller.slug,
    customer_phone: cleanPhone,
  };

  const { data: savedMessage, error: messageError } = await supabaseAdmin
    .from("messages")
    .insert(messageRow)
    .select("id,contenu,client,statut,created_at,seller_slug,customer_phone,external_message_id")
    .maybeSingle();

  if (messageError && !/messages|seller_slug|schema cache|column/i.test(messageError.message || "")) {
    throw new Error(messageError.message);
  }

  return {
    ok: true,
    handoff,
    message: savedMessage ? normalizeStoredMessage(savedMessage) : normalizeStoredMessage({ ...messageRow, created_at: new Date().toISOString() }),
  };
}

export async function getSellerWhatsAppConversations(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, name, slug, evolution_instance");
  const sellerKeys = getHandoffSellerKeys(seller);
  const likeQueries = sellerKeys.map((sellerKey) => `${sellerKey} :%`);

  async function fetchMessages(queryFactory, schemaFallbackPattern = /messages|schema cache|column/i) {
    const mediaResult = await queryFactory(MESSAGE_SELECT_WITH_MEDIA);
    if (!mediaResult.error || !schemaFallbackPattern.test(mediaResult.error.message || "")) return mediaResult;
    return queryFactory(MESSAGE_SELECT_BASE).then((result) => (
      schemaFallbackPattern.test(result.error?.message || "") ? { data: [], error: null } : result
    ));
  }

  async function fetchOrdersForConversations() {
    const withCustomerName = await supabaseAdmin
      .from("orders")
      .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,delivery_address,created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(120);

    if (!withCustomerName.error || !/(customer_name|schema cache|column)/i.test(withCustomerName.error.message || "")) {
      return withCustomerName;
    }

    return supabaseAdmin
      .from("orders")
      .select("id,order_ref,customer_phone,status,total_amount,delivery_fee,delivery_zone,delivery_address,created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(120);
  }

  const [messagesBySlugResult, legacyMessageResults, ordersResult, handoffs] = await Promise.all([
    fetchMessages((select) => supabaseAdmin
      .from("messages")
      .select(select)
      .in("seller_slug", sellerKeys)
      .order("created_at", { ascending: false })
      .limit(300), /messages|seller_slug|schema cache|column/i),
    Promise.all(likeQueries.map((pattern) => fetchMessages((select) => supabaseAdmin
      .from("messages")
      .select(select)
      .ilike("client", pattern)
      .order("created_at", { ascending: false })
      .limit(300), /messages|client|schema cache|column/i))),
    fetchOrdersForConversations(),
    getActiveSellerHandoffs(seller),
  ]);

  if (messagesBySlugResult.error) throw new Error(messagesBySlugResult.error.message);
  const legacyError = legacyMessageResults.find((result) => result.error)?.error;
  if (legacyError) throw new Error(legacyError.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const rows = mergeMessageRows(
    messagesBySlugResult.data || [],
    ...legacyMessageResults.map((result) => result.data || []),
  );
  const messages = rows
    .map(normalizeStoredMessage)
    .filter((message) => (message.text || message.media) && String(message.status || "").toLowerCase() !== "human_pause")
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const handoffsByPhone = new Map((handoffs || []).map((handoff) => [handoffKey(handoff.customer_phone), handoff]));
  const conversations = new Map();

  function ensureConversation(phone, fallback = {}) {
    const cleanPhone = normalizeCustomerPhone(phone);
    const key = cleanPhone || fallback.key || "unknown";
    if (!conversations.has(key)) {
      conversations.set(key, {
        key,
        customer_phone: cleanPhone,
        display_phone: formatCustomerPhone(cleanPhone),
        customer_name: fallback.customer_name || fallback.customerName || "",
        messages: [],
        orders: [],
        last_message: null,
        last_at: fallback.created_at || null,
        handoff: handoffsByPhone.get(handoffKey(cleanPhone)) || null,
        bot_paused: Boolean(handoffsByPhone.get(handoffKey(cleanPhone))),
      });
    }

    const conversation = conversations.get(key);
    if (!conversation.customer_name && (fallback.customer_name || fallback.customerName)) {
      conversation.customer_name = fallback.customer_name || fallback.customerName;
    }
    if (!conversation.display_phone && cleanPhone) {
      conversation.display_phone = formatCustomerPhone(cleanPhone);
    }
    return conversation;
  }

  for (const message of messages) {
    const conversation = ensureConversation(message.customer_phone, {
      customer_name: message.customer_name,
      key: message.client,
      created_at: message.created_at,
    });
    conversation.messages.push(message);
    conversation.last_message = message;
    conversation.last_at = message.created_at || conversation.last_at;
  }

  for (const order of ordersResult.data || []) {
    const phone = normalizeCustomerPhone(order.customer_phone);
    const conversation = ensureConversation(phone, {
      customer_name: order.customer_name,
      key: order.id,
      created_at: order.created_at,
    });
    conversation.orders.push(order);
    if (!conversation.last_at || new Date(order.created_at || 0) > new Date(conversation.last_at || 0)) {
      conversation.last_at = order.created_at;
    }
  }

  return Array.from(conversations.values())
    .map((conversation) => ({
      ...conversation,
      customer_name: conversation.customer_name || conversation.display_phone || "Client WhatsApp",
      orders: conversation.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
      last_order: conversation.orders[0] || null,
      inbound_count: conversation.messages.filter((message) => message.direction === "in").length,
    }))
    .sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
}

export async function createDemoOrder(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, fixed_delivery_fee");

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (productsError) {
    throw new Error(productsError.message);
  }

  let product = products?.[0] || null;

  if (!product) {
    const demoProduct = {
      seller_id: seller.id,
      name: "Robe demo Tikchop",
      price: 17500,
      stock_quantity: 12,
      description: "Article exemple pour tester le cycle commande WhatsApp.",
    };

    const { data: createdProduct, error: createProductError } = await supabaseAdmin
      .from("products")
      .insert([demoProduct])
      .select("id, name, price, stock_quantity")
      .single();

    if (createProductError) {
      throw new Error(createProductError.message);
    }

    product = createdProduct;
  }

  const productPrice = Number(product.price || 0) || 17500;
  const deliveryFee = Number(seller.fixed_delivery_fee || 1000) || 1000;
  const orderRef = `DEMO${crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase()}`;
  let { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert([{
      seller_id: seller.id,
      order_ref: orderRef,
      customer_phone: "DEMO_CLIENT",
      status: "PAID",
      total_amount: productPrice,
      payment_method: "WAVE",
      delivery_type: "DELIVERY",
      delivery_zone: "Cocody Angre",
      delivery_address: "Carrefour Gestoci, immeuble bleu, appel avant depart",
      delivery_fee: deliveryFee,
      delivery_status: "PENDING",
    }])
    .select("id")
    .single();

  if (orderError && /(order_ref|delivery_|payment_method|schema cache|column)/i.test(orderError.message || "")) {
    const fallback = await supabaseAdmin
      .from("orders")
      .insert([{
        seller_id: seller.id,
        customer_phone: "DEMO_CLIENT",
        status: "PAID",
        total_amount: productPrice,
        payment_method: "WAVE",
      }])
      .select("id")
      .single();

    order = fallback.data;
    orderError = fallback.error;
  }

  if (orderError || !order) {
    throw new Error(orderError?.message || "Commande demo non creee.");
  }

  const { error: itemError } = await supabaseAdmin
    .from("order_items")
    .insert([{
      order_id: order.id,
      product_id: product.id,
      quantity: 1,
      price_at_time: productPrice,
    }]);

  if (itemError) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    throw new Error(itemError.message);
  }

  const { data: fullOrder, error: loadError } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        quantity,
        price_at_time,
        products (id, name, image_url)
      ),
      delivery_drivers (
        id,
        name,
        phone_number,
        zone
      )
    `)
    .eq("id", order.id)
    .single();

  if (loadError) {
    return { id: order.id };
  }

  return fullOrder;
}

export async function getSellerDeliverySettings(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "*");

  const { data: drivers, error: driversError } = await supabaseAdmin
    .from("delivery_drivers")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  if (driversError) {
    throw new Error(driversError.message);
  }

  let zones = [];
  const { data: zoneData, error: zonesError } = await supabaseAdmin
    .from("delivery_zones")
    .select("*")
    .eq("seller_id", seller.id)
    .order("name");

  if (!zonesError) {
    zones = zoneData || [];
  } else if (zonesError.code !== "PGRST205") {
    throw new Error(zonesError.message);
  }

  return {
    seller,
    drivers: drivers || [],
    zones,
  };
}

export async function getSellerPaymentSettings(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const select = [
    "id",
    "name",
    "slug",
    "phone_number",
    "payout_network",
    "payout_phone",
    "payout_bank_code",
    "payout_bank_name",
    "payout_status",
    "payout_last_error",
    "payout_confirmed_at",
    "paystack_subaccount_code",
    "paystack_subaccount_created_at",
    "accepted_payment_methods",
    "default_payment_method",
    "subscription_active",
    "subscription_status",
    "subscription_current_period_end",
  ].join(",");

  try {
    const seller = await requireSellerBySlug(slug, accessToken, select);
    return { seller };
  } catch (error) {
    if (/accepted_payment_methods|default_payment_method|payout_|subscription_|paystack_subaccount_created_at|schema cache|column/i.test(error.message || "")) {
      const seller = await requireSellerBySlug(slug, accessToken, "id,name,slug,phone_number,paystack_subaccount_code");
      return {
        seller: {
          ...seller,
          payout_network: "",
          payout_phone: seller.phone_number || "",
          payout_status: seller.paystack_subaccount_code ? "paystack_ready" : "not_configured",
          payout_last_error: "",
          accepted_payment_methods: ["CASH_ON_DELIVERY", "WAVE", "ORANGE_MONEY", "MTN_MONEY"],
          default_payment_method: "CASH_ON_DELIVERY",
          subscription_active: true,
          subscription_status: "trial",
        },
        needsMigration: true,
      };
    }
    throw error;
  }
}

export async function getSellerBusinessProfile(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const select = [
    "id",
    "name",
    "slug",
    "phone_number",
    "owner_email",
    "whatsapp_provider",
    "whatsapp_status",
    "evolution_instance",
    "payout_network",
    "payout_phone",
    "payout_status",
    "paystack_subaccount_code",
    "accepted_payment_methods",
    "default_payment_method",
    "delivery_enabled",
    "pickup_enabled",
    "fixed_delivery_fee",
    "delivery_payment_timing",
    "auto_share_to_driver",
    "bot_tone",
    "bot_greeting",
    "bot_payment_preferences",
    "bot_delivery_notes",
    "bot_special_rules",
    "logo_url",
    "brand_color",
    "physical_address",
  ].join(",");

  let seller;
  try {
    seller = await requireSellerBySlug(slug, accessToken, select);
  } catch (error) {
    if (!/owner_email|whatsapp_|payout_|accepted_payment_methods|default_payment_method|delivery_|pickup_|bot_|logo_url|brand_color|physical_address|schema cache|column/i.test(error.message || "")) {
      throw error;
    }
    seller = await requireSellerBySlug(slug, accessToken, "id,name,slug,phone_number");
  }

  const [{ data: zones }, { data: drivers }] = await Promise.all([
    supabaseAdmin
      .from("delivery_zones")
      .select("id,name,fee,is_active")
      .eq("seller_id", seller.id)
      .order("name")
      .then((result) => (/delivery_zones|schema cache|column/i.test(result.error?.message || "") ? { data: [] } : result)),
    supabaseAdmin
      .from("delivery_drivers")
      .select("id,name,phone_number,zone,is_active")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .then((result) => (/delivery_drivers|schema cache|column/i.test(result.error?.message || "") ? { data: [] } : result)),
  ]);

  return {
    seller: {
      ...seller,
      accepted_payment_methods: normalizeAcceptedPaymentMethods(seller.accepted_payment_methods),
      default_payment_method: getSellerDefaultPaymentMethod(seller, normalizeAcceptedPaymentMethods(seller.accepted_payment_methods)),
    },
    zones: zones || [],
    drivers: drivers || [],
  };
}

export async function saveSellerBusinessProfile(sellerId, profile, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken, "id");

  const payload = {
    name: String(profile?.name || "").trim(),
    phone_number: String(profile?.phone_number || "").replace(/[^\d+]/g, "").trim(),
    owner_email: String(profile?.owner_email || "").trim().toLowerCase() || null,
    bot_tone: String(profile?.bot_tone || "").trim(),
    bot_greeting: String(profile?.bot_greeting || "").trim(),
    bot_payment_preferences: String(profile?.bot_payment_preferences || "").trim(),
    bot_delivery_notes: String(profile?.bot_delivery_notes || "").trim(),
    bot_special_rules: String(profile?.bot_special_rules || "").trim(),
    logo_url: profile?.logo_url ? String(profile.logo_url).trim() : null,
    brand_color: profile?.brand_color ? String(profile.brand_color).trim() : "#008f5a",
    physical_address: profile?.physical_address ? String(profile.physical_address).trim() : null,
  };

  if (payload.name.length < 2) {
    throw new Error("Ajoute le nom de la boutique.");
  }

  if (payload.phone_number.replace(/\D/g, "").length < 8) {
    throw new Error("Ajoute un numero WhatsApp valide.");
  }

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId)
    .select("id,name,slug,phone_number,owner_email,bot_tone,bot_greeting,bot_payment_preferences,bot_delivery_notes,bot_special_rules,logo_url,brand_color,physical_address")
    .single();

  if (error && /owner_email|bot_|logo_url|brand_color|physical_address|schema cache|column/i.test(error.message || "")) {
    const fallback = await supabaseAdmin
      .from("sellers")
      .update({
        name: payload.name,
        phone_number: payload.phone_number,
      })
      .eq("id", sellerId)
      .select("id,name,slug,phone_number")
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveSellerPaymentSettings(sellerId, settings, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerById(
    sellerId,
    accessToken,
    "id,name,payout_network,payout_phone,paystack_subaccount_code",
  );

  const payoutNetwork = normalizePayoutNetwork(settings?.payout_network);
  const network = getPayoutNetworkConfig(payoutNetwork);
  const payoutPhone = normalizePayoutPhone(settings?.payout_phone);
  const acceptedPaymentMethods = normalizeAcceptedPaymentMethods(settings?.accepted_payment_methods)
    .filter((method) => method !== "PAYSTACK" || onlinePaymentsEnabled());
  const requestedDefaultPaymentMethod = String(settings?.default_payment_method || "").trim().toUpperCase();
  const defaultPaymentMethod = acceptedPaymentMethods.includes(requestedDefaultPaymentMethod)
    ? requestedDefaultPaymentMethod
    : getSellerDefaultPaymentMethod({ default_payment_method: settings?.default_payment_method }, acceptedPaymentMethods);
  const directPhoneNeeded = paymentMethodsNeedDirectPhone(acceptedPaymentMethods);

  if (directPhoneNeeded && !network) {
    throw new Error("Choisissez Wave, Orange Money ou MTN MoMo.");
  }

  if (directPhoneNeeded && (!payoutPhone || payoutPhone.length < 11)) {
    throw new Error("Numero de depot invalide. Ajoutez le numero qui recoit l'argent.");
  }

  const existingNetwork = normalizePayoutNetwork(seller.payout_network);
  const existingPhone = normalizePayoutPhone(seller.payout_phone);
  const payoutChanged = existingNetwork !== payoutNetwork || existingPhone !== payoutPhone;
  const status = directPhoneNeeded
    ? network.autoSubaccount ? "pending_confirmation" : "manual_review"
    : "not_configured";

  const payload = {
    accepted_payment_methods: acceptedPaymentMethods,
    default_payment_method: defaultPaymentMethod,
    payout_network: directPhoneNeeded ? payoutNetwork : null,
    payout_phone: directPhoneNeeded ? payoutPhone : null,
    payout_bank_code: directPhoneNeeded ? network.bankCode || null : null,
    payout_bank_name: directPhoneNeeded ? network.label : null,
    payout_status: status,
    payout_last_error: null,
    payout_confirmed_at: null,
    ...(payoutChanged ? {
      paystack_subaccount_code: null,
      paystack_subaccount_created_at: null,
    } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId)
    .select("id,payout_network,payout_phone,payout_status,payout_bank_name,paystack_subaccount_code,accepted_payment_methods,default_payment_method")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function activateSellerPayoutSubaccount(sellerId, accessToken) {
  if (!onlinePaymentsEnabled()) {
    throw new Error("Paiement carte indisponible pour le moment. Gardez Wave, Orange, MTN ou paiement a la livraison.");
  }

  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerById(
    sellerId,
    accessToken,
    "id,name,payout_network,payout_phone,payout_status,paystack_subaccount_code",
  );

  if (seller.paystack_subaccount_code) {
    return {
      ok: true,
      subaccountCode: seller.paystack_subaccount_code,
      status: "paystack_ready",
      alreadyReady: true,
    };
  }

  try {
    const subaccount = await createPaystackSubaccount({
      sellerId: seller.id,
      businessName: seller.name,
      payoutNetwork: seller.payout_network,
      payoutPhone: seller.payout_phone,
    });

    const { data, error } = await supabaseAdmin
      .from("sellers")
      .update({
        paystack_subaccount_code: subaccount.subaccount_code,
        paystack_subaccount_created_at: new Date().toISOString(),
        payout_status: "paystack_ready",
        payout_last_error: null,
        payout_confirmed_at: new Date().toISOString(),
      })
      .eq("id", seller.id)
      .select("id,payout_status,paystack_subaccount_code,payout_confirmed_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true, subaccountCode: data.paystack_subaccount_code, status: data.payout_status };
  } catch (error) {
    await supabaseAdmin
      .from("sellers")
      .update({
        payout_status: "failed",
        payout_last_error: String(error.message || "Activation impossible.").slice(0, 240),
      })
      .eq("id", seller.id)
      .then(() => null);

    throw new Error(error.message || "Compte de reception non active.");
  }
}

export async function getSellersForProductForm() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const user = await requireSellerUser();
  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

const PRODUCT_SELECT_LEGACY = "id, name, price, stock_quantity, image_url, description, created_at";
const PRODUCT_SELECT_BASIC = `${PRODUCT_SELECT_LEGACY}, product_variants, product_keywords`;
const PRODUCT_SELECT_FULL = `${PRODUCT_SELECT_BASIC}, is_active`;

function isSchemaColumnError(error) {
  return /schema cache|column|is_active|product_variants|product_keywords/i.test(error?.message || "");
}

function normalizeNumericString(value) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function normalizeProductPrice(value) {
  const normalized = normalizeNumericString(value);
  return Number(normalized || 0);
}

function normalizeProductStock(value, fallback = 1) {
  const normalized = Number.parseInt(normalizeNumericString(value), 10);
  return Number.isFinite(normalized) ? normalized : fallback;
}

async function updateProductWithFallback(productId, sellerId, payload) {
  let { data, error } = await supabaseAdmin
    .from("products")
    .update(payload)
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .select(PRODUCT_SELECT_FULL)
    .single();

  if (error && isSchemaColumnError(error)) {
    const { product_variants, product_keywords, is_active, ...fallbackPayload } = payload;
    const fallback = await supabaseAdmin
      .from("products")
      .update(fallbackPayload)
      .eq("id", productId)
      .eq("seller_id", sellerId)
      .select(PRODUCT_SELECT_LEGACY)
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addProduct(product, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(product?.seller_id, accessToken);

  const payload = {
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 0),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    seller_id: product.seller_id,
  };

  if (!payload.seller_id || !payload.name || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select("id")
    .single();

  if (error && /product_variants|product_keywords|schema cache|column/i.test(error.message || "")) {
    const { product_variants, product_keywords, ...fallbackPayload } = payload;
    const fallback = await supabaseAdmin
      .from("products")
      .insert([fallbackPayload])
      .select("id")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addProductsBulk(products, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const sellerIds = [...new Set((products || []).map((product) => product?.seller_id).filter(Boolean))];
  if (sellerIds.length !== 1) {
    throw new Error("Les produits doivent appartenir a une seule boutique.");
  }
  await requireSellerById(sellerIds[0], accessToken);

  const payload = (products || []).map((product) => ({
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 1),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    seller_id: product.seller_id,
  })).filter((product) => (
    product.seller_id
    && product.name
    && product.price >= 0
    && product.stock_quantity >= 0
  ));

  if (payload.length === 0) {
    throw new Error("Aucun produit valide a ajouter.");
  }

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert(payload)
    .select("id");

  if (error && /product_variants|product_keywords|schema cache|column/i.test(error.message || "")) {
    const fallbackPayload = payload.map(({ product_variants, product_keywords, ...product }) => product);
    const fallback = await supabaseAdmin
      .from("products")
      .insert(fallbackPayload)
      .select("id");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSellerProducts(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT_FULL)
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  if (error && isSchemaColumnError(error)) {
    const fallback = await supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT_LEGACY)
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data || [];
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateProduct(productId, product, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const payload = {
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 0),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    is_active: product.is_active === false ? false : true,
  };

  if (!productId || !payload.name || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  return updateProductWithFallback(productId, seller.id, payload);
}

export async function updateProductQuick(productId, updates, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates || {}, "stock_quantity")) {
    const stock = Number.parseInt(updates.stock_quantity ?? 0, 10);
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error("Stock invalide.");
    }
    payload.stock_quantity = stock;
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "is_active")) {
    payload.is_active = Boolean(updates.is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Aucune modification a enregistrer.");
  }

  return updateProductWithFallback(productId, seller.id, payload);
}

export async function duplicateProduct(productId, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  let { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT_FULL)
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .single();

  if (productError && isSchemaColumnError(productError)) {
    const fallback = await supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT_LEGACY)
      .eq("id", productId)
      .eq("seller_id", seller.id)
      .single();
    product = fallback.data;
    productError = fallback.error;
  }

  if (productError || !product) {
    throw new Error(productError?.message || "Article introuvable.");
  }

  const payload = {
    seller_id: seller.id,
    name: `${String(product.name || "Article").trim()} copie`,
    price: Number(product.price || 0),
    stock_quantity: Math.max(1, Number.parseInt(product.stock_quantity || 1, 10)),
    description: product.description || null,
    image_url: product.image_url || null,
    product_variants: Array.isArray(product.product_variants) ? product.product_variants : [],
    product_keywords: product.product_keywords || null,
    is_active: true,
  };

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select(PRODUCT_SELECT_FULL)
    .single();

  if (error && isSchemaColumnError(error)) {
    const { product_variants, product_keywords, is_active, ...fallbackPayload } = payload;
    const fallback = await supabaseAdmin
      .from("products")
      .insert([fallbackPayload])
      .select(PRODUCT_SELECT_LEGACY)
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addDeliveryZone(sellerId, zone, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const payload = {
    seller_id: sellerId,
    name: String(zone.name || "").trim(),
    fee: Number(zone.fee || 0),
    is_active: true,
  };

  if (!payload.seller_id || !payload.name || payload.fee < 0) {
    throw new Error("Invalid delivery zone.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDeliveryZone(zoneId, zone, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingZone, error: existingZoneError } = await supabaseAdmin
    .from("delivery_zones")
    .select("seller_id")
    .eq("id", zoneId)
    .single();

  if (existingZoneError || !existingZone) {
    throw new Error("Zone introuvable.");
  }

  await requireSellerById(existingZone.seller_id, accessToken);

  const payload = {
    name: String(zone.name || "").trim(),
    fee: Number(zone.fee || 0),
    is_active: zone.is_active ?? true,
  };

  if (!zoneId || !payload.name || payload.fee < 0) {
    throw new Error("Invalid delivery zone.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .update(payload)
    .eq("id", zoneId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addDeliveryZonesBulk(sellerId, zones, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const cleanZones = (zones || [])
    .map((zone) => ({
      seller_id: sellerId,
      name: String(zone.name || "").trim(),
      fee: Number(zone.fee || 0),
      is_active: true,
    }))
    .filter((zone) => zone.name && zone.fee >= 0);

  if (cleanZones.length === 0) {
    throw new Error("Aucune zone valide.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("delivery_zones")
    .select("name")
    .eq("seller_id", sellerId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingNames = new Set((existing || []).map((zone) => zone.name.toLowerCase()));
  const payload = cleanZones.filter((zone) => !existingNames.has(zone.name.toLowerCase()));

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .insert(payload)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function deleteDeliveryZone(zoneId, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingZone, error: existingZoneError } = await supabaseAdmin
    .from("delivery_zones")
    .select("seller_id")
    .eq("id", zoneId)
    .single();

  if (existingZoneError || !existingZone) {
    throw new Error("Zone introuvable.");
  }

  await requireSellerById(existingZone.seller_id, accessToken);

  const { error } = await supabaseAdmin
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

export async function getDashboardData(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug");
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sellerStateQuery = () => supabaseAdmin
    .from("sellers")
    .select("whatsapp_provider, whatsapp_status, evolution_instance, payout_status, payout_network, payout_phone, payout_bank_name, paystack_subaccount_code")
    .eq("id", seller.id)
    .maybeSingle()
    .then((result) => (/whatsapp_status|evolution_instance|payout_status|payout_network|payout_phone|payout_bank_name|paystack_subaccount_code|schema cache|column/i.test(result.error?.message || "") ? { data: null } : result));

  const [{ data: fastStats, error: fastStatsError }, { data: fastSellerState }] = await Promise.all([
    supabaseAdmin
      .rpc("get_seller_dashboard_stats", {
        p_seller_id: seller.id,
        p_seller_slug: seller.slug,
        p_week_ago: weekAgo,
      })
      .then((result) => (/get_seller_dashboard_stats|schema cache|function/i.test(result.error?.message || "") ? { data: null, error: result.error } : result)),
    sellerStateQuery(),
  ]);

  if (!fastStatsError && fastStats) {
    return {
      stats: {
        sales: Number(fastStats.sales || 0),
        orders: Number(fastStats.order_count || 0),
        products: Number(fastStats.product_count || 0),
        messagesReceived: Number(fastStats.order_count || 0),
        confirmedOrders: Number(fastStats.confirmed_order_count || 0),
        clientsFollowedUp: Number(fastStats.followup_count || 0),
        weeklyClientsHandled: Number(fastStats.weekly_order_count || 0),
        pendingOrders: Number(fastStats.pending_order_count || 0),
        paidOrders: Number(fastStats.paid_order_count || 0),
        preparedOrders: Number(fastStats.prepared_order_count || 0),
        deliveredOrders: Number(fastStats.delivered_order_count || 0),
        whatsappStatus: fastSellerState?.whatsapp_status || "unknown",
        whatsappConnected: fastSellerState?.whatsapp_provider === "tikchop_standard"
          || fastSellerState?.whatsapp_status === "standard_active"
          || fastSellerState?.whatsapp_status === "connected"
          || fastSellerState?.whatsapp_status === "open",
        evolutionInstance: fastSellerState?.evolution_instance || "",
        payoutStatus: fastSellerState?.payout_status || (fastSellerState?.paystack_subaccount_code ? "paystack_ready" : fastSellerState?.payout_phone ? "direct_ready" : "not_configured"),
        payoutReady: Boolean(fastSellerState?.paystack_subaccount_code || fastSellerState?.payout_status === "paystack_ready" || fastSellerState?.payout_phone),
        payoutNetwork: fastSellerState?.payout_network || "",
        payoutBankName: fastSellerState?.payout_bank_name || "",
      },
      recentOrders: Array.isArray(fastStats.recent_orders) ? fastStats.recent_orders : [],
    };
  }

  const [
    { count: productCount },
    { count: orderCount },
    { count: weeklyOrderCount },
    { count: confirmedOrderCount },
    { count: pendingOrderCount },
    { count: paidOrderCount },
    { count: preparedOrderCount },
    { count: deliveredOrderCount },
    { data: orders, error: ordersError },
    { data: paidOrders, error: paidOrdersError },
  ] = await Promise.all([
    supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("seller_id", seller.id),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).gte("created_at", weekAgo),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).in("status", ["PAID", "PREPARED", "DELIVERED"]),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).eq("status", "PENDING"),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).eq("status", "PAID"),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).eq("status", "PREPARED"),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id).eq("status", "DELIVERED"),
    supabaseAdmin
      .from("orders")
      .select("id, order_ref, customer_phone, total_amount, delivery_fee, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabaseAdmin
      .from("orders")
      .select("total_amount, delivery_fee")
      .eq("seller_id", seller.id)
      .in("status", ["PAID", "PREPARED", "DELIVERED"]),
  ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  if (paidOrdersError) {
    throw new Error(paidOrdersError.message);
  }

  const sales = (paidOrders || [])
    .reduce((total, order) => total + Number(order.total_amount || 0) + Number(order.delivery_fee || 0), 0);

  const [{ data: sellerState }, { count: followupCount }] = await Promise.all([
    sellerStateQuery(),
    supabaseAdmin
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("seller_slug", seller.slug)
      .eq("statut", "followup")
      .gte("created_at", weekAgo)
      .then((result) => (/messages|seller_slug|schema cache|column/i.test(result.error?.message || "") ? { count: 0 } : result)),
  ]);

  return {
    stats: {
      sales,
      orders: orderCount || 0,
      products: productCount || 0,
      messagesReceived: orderCount || 0,
      confirmedOrders: confirmedOrderCount || 0,
      clientsFollowedUp: followupCount || 0,
      weeklyClientsHandled: weeklyOrderCount || 0,
      pendingOrders: pendingOrderCount || 0,
      paidOrders: paidOrderCount || 0,
      preparedOrders: preparedOrderCount || 0,
      deliveredOrders: deliveredOrderCount || 0,
      whatsappStatus: sellerState?.whatsapp_status || "unknown",
      whatsappConnected: sellerState?.whatsapp_provider === "tikchop_standard"
        || sellerState?.whatsapp_status === "standard_active"
        || sellerState?.whatsapp_status === "connected"
        || sellerState?.whatsapp_status === "open",
      evolutionInstance: sellerState?.evolution_instance || "",
      payoutStatus: sellerState?.payout_status || (sellerState?.paystack_subaccount_code ? "paystack_ready" : sellerState?.payout_phone ? "direct_ready" : "not_configured"),
      payoutReady: Boolean(sellerState?.paystack_subaccount_code || sellerState?.payout_status === "paystack_ready" || sellerState?.payout_phone),
      payoutNetwork: sellerState?.payout_network || "",
      payoutBankName: sellerState?.payout_bank_name || "",
    },
    recentOrders: orders || [],
  };
}

export async function saveSellerDeliverySettings(sellerId, settings, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const payload = {
    delivery_enabled: Boolean(settings.delivery_enabled),
    pickup_enabled: Boolean(settings.pickup_enabled),
    fixed_delivery_fee: Number(settings.fixed_delivery_fee || 0),
    delivery_payment_timing: settings.delivery_payment_timing || "AT_RECEPTION",
    auto_share_to_driver: Boolean(settings.auto_share_to_driver),
  };

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addDeliveryDriver(sellerId, driver, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const payload = {
    seller_id: sellerId,
    name: String(driver.name || "").trim(),
    phone_number: String(driver.phone_number || "").trim(),
    zone: String(driver.zone || "").trim() || null,
    is_active: true,
  };

  if (!payload.name || !payload.phone_number) {
    throw new Error("Driver name and phone are required.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_drivers")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDeliveryDriver(driverId, driver, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingDriver, error: existingDriverError } = await supabaseAdmin
    .from("delivery_drivers")
    .select("seller_id")
    .eq("id", driverId)
    .single();

  if (existingDriverError || !existingDriver) {
    throw new Error("Livreur introuvable.");
  }

  await requireSellerById(existingDriver.seller_id, accessToken);

  const payload = {
    name: String(driver.name || "").trim(),
    phone_number: String(driver.phone_number || "").trim(),
    zone: String(driver.zone || "").trim() || null,
    is_active: driver.is_active ?? true,
  };

  if (!driverId || !payload.name || !payload.phone_number) {
    throw new Error("Driver name and phone are required.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_drivers")
    .update(payload)
    .eq("id", driverId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteDeliveryDriver(driverId, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingDriver, error: existingDriverError } = await supabaseAdmin
    .from("delivery_drivers")
    .select("seller_id")
    .eq("id", driverId)
    .single();

  if (existingDriverError || !existingDriver) {
    throw new Error("Livreur introuvable.");
  }

  await requireSellerById(existingDriver.seller_id, accessToken);

  const { error } = await supabaseAdmin
    .from("delivery_drivers")
    .delete()
    .eq("id", driverId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

export async function getPendingOrdersCount(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("seller_id", seller.id)
    .in("status", ["PENDING", "PAID", "PREPARED"]);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

