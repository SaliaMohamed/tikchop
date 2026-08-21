import { supabaseAdmin } from "./supabase-admin";
import { createHash } from "node:crypto";
import { sendEvolutionText } from "./evolution";
import {
  getActiveSellerHandoffs,
  mergeMessageRows,
  MESSAGE_SELECT_BASE,
  MESSAGE_SELECT_WITH_MEDIA,
  normalizeStoredMessage,
  CHANNEL_NATIVE,
  CHANNEL_WHATSAPP,
  NATIVE_DEFAULT_NAME,
} from "../app/lib/actions/shared";
import { formatCustomerPhone, handoffKey, normalizeCustomerPhone } from "../app/lib/actions/formatters";

const ALLOWED_ORDER_STATUS = new Set(["PENDING", "PAID", "PREPARED", "DELIVERED", "CANCELLED"]);
const DEFAULT_HANDOFF_MINUTES = 24 * 60;

class MobileApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
  }
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export function mobileErrorStatus(error, fallback = 400) {
  return Number.isInteger(error?.status) ? error.status : fallback;
}

export async function requireMobileSeller(request) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new MobileApiError("Session vendeur manquante.", 401);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new MobileApiError("Session vendeur invalide.", 401);
  }

  const { data: seller, error } = await supabaseAdmin
    .from("sellers")
    .select("id,name,slug,phone_number,whatsapp_status,evolution_instance,owner_user_id")
    .eq("owner_user_id", authData.user.id)
    .maybeSingle();

  if (error || !seller) {
    throw new MobileApiError(error?.message || "Aucune boutique liee a ce compte vendeur.", 403);
  }

  return { user: authData.user, seller };
}

export function computeMobileStats(products = [], orders = [], seller = {}) {
  const activeProducts = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const paidOrders = orders.filter((order) => order.status === "PAID").length;
  const preparedOrders = orders.filter((order) => order.status === "PREPARED").length;
  const today = new Date().toDateString();
  const revenueToday = orders
    .filter((order) => (order.created_at ? new Date(order.created_at).toDateString() === today : true))
    .reduce((sum, order) => sum + Number(order.total_amount || 0) + Number(order.delivery_fee || 0), 0);

  return {
    products: products.length,
    activeProducts,
    orders: orders.length,
    pendingOrders,
    paidOrders,
    preparedOrders,
    revenueToday,
    whatsappConnected: ["connected", "open", "standard_active"].includes(String(seller.whatsapp_status || "").toLowerCase()),
  };
}

function getSellerEvolutionInstance(seller) {
  return String(seller.evolution_instance || seller.slug || "").trim();
}

function getHandoffSellerKeys(seller) {
  return Array.from(new Set([seller.slug, getSellerEvolutionInstance(seller)].filter(Boolean)));
}

async function getActiveMobileHandoffs(seller) {
  const sellerKeys = getHandoffSellerKeys(seller);
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

function attachHandoffsToOrders(orders = [], handoffs = []) {
  const byPhone = new Map();
  for (const handoff of handoffs) {
    byPhone.set(handoffKey(handoff.customer_phone), handoff);
  }

  return orders.map((order) => ({
    ...order,
    handoff: byPhone.get(handoffKey(order.customer_phone)) || null,
  }));
}

async function saveMobileHandoff(seller, customerPhone, durationMinutes = DEFAULT_HANDOFF_MINUTES) {
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  if (cleanPhone.length < 6) {
    throw new MobileApiError("Numéro client invalide.", 400);
  }

  const minutes = Math.max(15, Math.min(Number.parseInt(durationMinutes, 10) || DEFAULT_HANDOFF_MINUTES, 7 * 24 * 60));
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

  if (error) throw new Error(error.message || "Pause bot indisponible.");
  return {
    seller_slug: seller.slug,
    customer_phone: cleanPhone,
    instance_name: instanceName || null,
    paused_until: pausedUntil,
    last_from_me_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function getMobileOverview(request) {
  const { seller } = await requireMobileSeller(request);

  const [
    { data: products, error: productsError },
    { data: orders, error: ordersError },
    handoffs,
  ] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,name,description,price,stock_quantity,image_url,category,created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("orders")
      .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(50),
    getActiveMobileHandoffs(seller),
  ]);

  if (productsError) throw new Error(productsError.message);
  if (ordersError) throw new Error(ordersError.message);
  const normalizedOrders = attachHandoffsToOrders(orders || [], handoffs);

  return {
    source: "supabase",
    seller,
    products: products || [],
    orders: normalizedOrders,
    stats: computeMobileStats(products || [], normalizedOrders, seller),
  };
}

async function fetchMobileMessages(sellerKeys, likeQueries) {
  async function fetchMessages(queryFactory, schemaFallbackPattern = /messages|schema cache|column/i) {
    const mediaResult = await queryFactory(MESSAGE_SELECT_WITH_MEDIA);
    if (!mediaResult.error || !schemaFallbackPattern.test(mediaResult.error.message || "")) return mediaResult;
    return queryFactory(MESSAGE_SELECT_BASE).then((result) => (
      schemaFallbackPattern.test(result.error?.message || "") ? { data: [], error: null } : result
    ));
  }

  const [bySlugResult, ...legacyResults] = await Promise.all([
    fetchMessages((select) => supabaseAdmin
      .from("messages")
      .select(select)
      .in("seller_slug", sellerKeys)
      .order("created_at", { ascending: false })
      .limit(300)),
    ...likeQueries.map((pattern) => fetchMessages((select) => supabaseAdmin
      .from("messages")
      .select(select)
      .ilike("client", pattern)
      .order("created_at", { ascending: false })
      .limit(300))),
  ]);

  return { bySlugResult, legacyResults };
}

function buildMobileConversations(seller, rows, orders, handoffs) {
  const messages = rows
    .map(normalizeStoredMessage)
    .filter((message) => (message.text || message.media) && String(message.status || "").toLowerCase() !== "human_pause")
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const handoffsByPhone = new Map((handoffs || []).map((handoff) => [handoffKey(handoff.customer_phone), handoff]));
  const conversations = new Map();

  function ensureConversation(phone, fallback = {}) {
    const channel = fallback.channel === CHANNEL_NATIVE ? CHANNEL_NATIVE : CHANNEL_WHATSAPP;
    const cleanPhone = channel === CHANNEL_NATIVE
      ? String(phone || "").trim()
      : normalizeCustomerPhone(phone);
    const key = cleanPhone || fallback.key || "unknown";
    if (!conversations.has(key)) {
      conversations.set(key, {
        key,
        channel,
        customer_phone: cleanPhone,
        display_phone: channel === CHANNEL_NATIVE ? cleanPhone : formatCustomerPhone(cleanPhone),
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
      conversation.display_phone = channel === CHANNEL_NATIVE ? cleanPhone : formatCustomerPhone(cleanPhone);
    }
    return conversation;
  }

  for (const message of messages) {
    const conversation = ensureConversation(message.customer_phone, {
      customer_name: message.customer_name,
      key: message.client,
      created_at: message.created_at,
      channel: message.channel,
    });
    conversation.messages.push(message);
    conversation.last_message = message;
    conversation.last_at = message.created_at || conversation.last_at;
  }

  for (const order of orders || []) {
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
      customer_name: conversation.customer_name || (conversation.channel === CHANNEL_NATIVE ? NATIVE_DEFAULT_NAME : conversation.display_phone || "Client WhatsApp"),
      orders: conversation.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
      last_order: conversation.orders[0] || null,
      inbound_count: conversation.messages.filter((message) => message.direction === "in").length,
    }))
    .sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
}

export async function getMobileConversations(request) {
  const { seller } = await requireMobileSeller(request);
  const sellerKeys = getHandoffSellerKeys(seller);
  const likeQueries = sellerKeys.map((sellerKey) => `${sellerKey} :%`);
  const handoffsPromise = getActiveSellerHandoffs(seller);
  const ordersPromise = supabaseAdmin
    .from("orders")
    .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,created_at")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .then((result) => result)
    .catch((error) => {
      throw new Error(error.message);
    });

  const { bySlugResult, legacyResults } = await fetchMobileMessages(sellerKeys, likeQueries);

  if (bySlugResult?.error) throw new Error(bySlugResult.error.message);
  const legacyError = legacyResults.find((result) => result.error)?.error;
  if (legacyError) throw new Error(legacyError.message);

  const [{ data: orders }, handoffs] = await Promise.all([ordersPromise, handoffsPromise]);

  const rows = mergeMessageRows(
    bySlugResult.data || [],
    ...legacyResults.map((result) => result.data || []),
  );

  return {
    seller,
    conversations: buildMobileConversations(seller, rows, orders || [], handoffs),
  };
}

export async function getMobileConversationMessages(request, customerPhone) {
  const { seller } = await requireMobileSeller(request);
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  if (cleanPhone.length < 6) {
    throw new MobileApiError("Numéro client invalide.", 400);
  }

  const sellerKeys = getHandoffSellerKeys(seller);
  const likeQueries = sellerKeys.map((sellerKey) => `${sellerKey} :%`);
  const handoffsPromise = getActiveSellerHandoffs(seller);

  const { bySlugResult, legacyResults } = await fetchMobileMessages(sellerKeys, likeQueries);

  if (bySlugResult?.error) throw new Error(bySlugResult.error.message);
  const legacyError = legacyResults.find((result) => result.error)?.error;
  if (legacyError) throw new Error(legacyError.message);

  const handoffs = await handoffsPromise;
  const rows = mergeMessageRows(
    bySlugResult.data || [],
    ...legacyResults.map((result) => result.data || []),
  );
  const messages = rows
    .map(normalizeStoredMessage)
    .filter((message) => (message.text || message.media) && String(message.status || "").toLowerCase() !== "human_pause")
    .filter((message) => normalizeCustomerPhone(message.customer_phone) === cleanPhone)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const conversations = buildMobileConversations(seller, rows, [], handoffs);
  const conversation = conversations.find((item) => normalizeCustomerPhone(item.customer_phone) === cleanPhone) || null;
  const handoff = (handoffs || []).find((item) => handoffKey(item.customer_phone) === handoffKey(cleanPhone)) || null;

  return {
    customer_phone: cleanPhone,
    customer_name: conversation?.customer_name || (conversation?.channel === CHANNEL_NATIVE ? NATIVE_DEFAULT_NAME : conversation?.display_phone || "Client WhatsApp"),
    messages,
    handoff,
    bot_paused: Boolean(handoff),
  };
}

export async function pauseMobileBotForCustomer(request, customerPhone) {
  const { seller } = await requireMobileSeller(request);
  const body = await request.json().catch(() => ({}));
  const handoff = await saveMobileHandoff(seller, customerPhone || body.customer_phone, body.duration_minutes);
  return { handoff };
}

export async function resumeMobileBotForCustomer(request, customerPhone) {
  const { seller } = await requireMobileSeller(request);
  const cleanPhone = normalizeCustomerPhone(customerPhone);
  if (cleanPhone.length < 6) {
    throw new MobileApiError("Numéro client invalide.", 400);
  }

  const { error } = await supabaseAdmin
    .from("messages")
    .delete()
    .in("seller_slug", getHandoffSellerKeys(seller))
    .eq("statut", "human_pause")
    .eq("customer_phone", cleanPhone);

  if (error) throw new Error(error.message || "Pause bot indisponible.");
  return { ok: true };
}

export async function sendMobileManualReply(request, customerPhone) {
  const { seller } = await requireMobileSeller(request);
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (text.length < 1 || text.length > 1200) {
    throw new MobileApiError("Message client invalide.", 400);
  }

  const cleanPhone = normalizeCustomerPhone(customerPhone || body.customer_phone);
  const handoff = await saveMobileHandoff(seller, cleanPhone, body.duration_minutes);
  const result = await sendEvolutionText({
    instanceName: getSellerEvolutionInstance(seller),
    number: cleanPhone,
    text,
  });

  if (!result?.ok) {
    throw new MobileApiError("Message non envoyé. Vérifiez la connexion WhatsApp de la boutique.", 503);
  }

  const messageRow = {
    contenu: text,
    client: `${seller.slug} : Vendeur : ${cleanPhone}@s.whatsapp.net`,
    statut: "followup",
    seller_slug: seller.slug,
    customer_phone: cleanPhone,
    external_message_id: `manual:${seller.slug}:${cleanPhone}:${Date.now()}`,
  };

  await supabaseAdmin
    .from("messages")
    .insert(messageRow)
    .then((insertResult) => {
      if (insertResult.error && !/messages|seller_slug|customer_phone|external_message_id|schema cache|column/i.test(insertResult.error.message || "")) {
        throw insertResult.error;
      }
      return insertResult;
    });

  return { ok: true, handoff };
}

export async function createMobileProduct(request) {
  const { seller } = await requireMobileSeller(request);
  const body = await request.json().catch(() => ({}));
  const payload = {
    seller_id: seller.id,
    name: String(body.name || "").trim(),
    price: Number(body.price || 0),
    stock_quantity: Number.parseInt(body.stock_quantity || 0, 10),
    description: String(body.description || "").trim() || null,
    image_url: String(body.image_url || "").trim() || null,
  };

  if (payload.name.length < 2 || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Article incomplet.");
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select("id,name,description,price,stock_quantity,image_url,category,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function uploadMobileProductImage(request) {
  await requireMobileSeller(request);
  const formData = await request.formData();
  const file = formData.get("image");

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
  if (!cloudinary.cloudName || !cloudinary.apiKey || !cloudinary.apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/mobile-products/${timestamp}-${createHash("sha1")
    .update(`${file.name || "mobile"}-${file.size}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${cloudinary.apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("api_key", cloudinary.apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
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

export async function updateMobileProductStock(request, productId) {
  const { seller } = await requireMobileSeller(request);
  const body = await request.json().catch(() => ({}));
  const stock = Number.parseInt(body.stock_quantity, 10);
  if (!productId || Number.isNaN(stock) || stock < 0) {
    throw new Error("Stock invalide.");
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({ stock_quantity: stock })
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .select("id,name,description,price,stock_quantity,image_url,category,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateMobileOrderStatus(request, orderId) {
  const { seller } = await requireMobileSeller(request);
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "").toUpperCase();
  if (!orderId || !ALLOWED_ORDER_STATUS.has(status)) {
    throw new Error("Statut de commande invalide.");
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("seller_id", seller.id)
    .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
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
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username || ""),
      apiSecret: decodeURIComponent(url.password || ""),
    };
  } catch {
    return directConfig;
  }
}

function getCloudinaryCleanProductUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  return url.replace(
    "/image/upload/",
    "/image/upload/e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_pad,w_1200,h_1200,b_rgb:f6fbf7/f_auto,q_auto:good/",
  );
}
