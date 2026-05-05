"use server";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase-admin";
import { initializeTransaction } from "../lib/paystack";
import { savePaystackInitialization, sendOrderLifecycleMessage } from "../lib/order-payments";
import { sendEvolutionText } from "../lib/evolution";

async function requireSellerUser(accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!accessToken) {
    throw new Error("Session vendeur manquante.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }

  return data.user;
}

async function requireSellerBySlug(slug, accessToken, select = "*") {
  const user = await requireSellerUser(accessToken);
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

async function requireSellerById(sellerId, accessToken, select = "id") {
  const user = await requireSellerUser(accessToken);
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

function buildDriverDeliveryMessage(order, driver) {
  const orderRef = order.order_ref || order.id?.slice(0, 8)?.toUpperCase();
  const items = (order.order_items || [])
    .map((item) => `- ${item.quantity} x ${item.products?.name || "Article"}`)
    .join("\n");
  const deliveryFee = Number(order.delivery_fee || 0);
  const productPaid = order.status === "PAID" || order.payment_method === "PAYSTACK";

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
Paiement produit: ${productPaid ? "PAYE" : "A verifier"}

Quand c'est livre, informe la boutique.`;
}

function chooseDriverForOrder(order, drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) return null;

  const zone = String(order.delivery_zone || "").trim().toLowerCase();
  if (zone) {
    const exact = drivers.find((driver) => String(driver.zone || "").trim().toLowerCase() === zone);
    if (exact) return exact;

    const close = drivers.find((driver) => {
      const driverZone = String(driver.zone || "").trim().toLowerCase();
      return driverZone && (zone.includes(driverZone) || driverZone.includes(zone));
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
    publicId: data.public_id,
  };
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

  if (process.env.GEMINI_API_KEY) {
    return analyzeProductImageWithGemini(imageUrl, voiceHint);
  }

  if (process.env.OPENAI_API_KEY) {
    return analyzeProductImageWithOpenAI(imageUrl, voiceHint);
  }

  throw new Error("IA non configuree. Ajoute GEMINI_API_KEY ou OPENAI_API_KEY.");
}

async function analyzeProductImageWithGemini(imageUrl, voiceHint = "") {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Image impossible a lire pour l'IA.");
  }

  const mimeType = imageResponse.headers.get("content-type")?.startsWith("image/")
    ? imageResponse.headers.get("content-type")
    : "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const imageBase64 = imageBuffer.toString("base64");
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse Gemini impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Analyse Gemini vide.");
  }

  return normalizeProductAnalysis(JSON.parse(textOutput));
}

async function analyzeProductImageWithOpenAI(imageUrl, voiceHint = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
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
              image_url: imageUrl,
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
  });

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

  const analysis = JSON.parse(textOutput);

  return normalizeProductAnalysis(analysis);
}

function productAnalysisPrompt(voiceHint = "") {
  return [
    "Analyse cette photo de produit pour une mini-boutique mobile en Afrique francophone.",
    "Retourne un nom usuel court, une petite description vendeuse, la categorie, les couleurs visibles, les tailles possibles si c'est un vetement.",
    "Ne devine pas de marque si elle n'est pas clairement visible.",
    "Ne remplis pas la taille definitive ni la quantite depuis la photo: le vendeur les renseigne au clavier ou au vocal.",
    "Retourne toujours size comme chaine vide et quantity comme 1, sauf si l'indication vocale du vendeur les donne explicitement.",
    "Si l'utilisateur donne une indication vocale, utilise-la pour corriger le nom seulement si elle parle du produit.",
    voiceHint ? `Indication vendeur: ${voiceHint}` : "",
  ].filter(Boolean).join("\n");
}

function productAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      colors: { type: "array", items: { type: "string" } },
      suggested_sizes: { type: "array", items: { type: "string" } },
      size: { type: "string" },
      quantity: { type: "number" },
      confidence: { type: "number" },
    },
    required: ["name", "description", "category", "colors", "suggested_sizes", "size", "quantity", "confidence"],
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
    paymentMethod = "WAVE", 
    deliveryType = "DELIVERY", 
    deliveryZone = "", 
    deliveryAddress = "",
    customerPhone = "UNKNOWN"
  } = options;

  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!sellerId || !Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Invalid order payload.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("fixed_delivery_fee, delivery_payment_timing")
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
        payment_method: paymentMethod === "PAYSTACK" ? "PAYSTACK" : "WAVE",
        delivery_type: deliveryType,
        delivery_zone: deliveryZone,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        delivery_status: "PENDING"
      },
    ])
    .select("id, order_ref, total_amount")
    .single();

  if (orderError && /(order_ref|delivery_|fixed_delivery_fee|delivery_payment_timing)/i.test(orderError.message || "")) {
    const fallbackResult = await supabaseAdmin
      .from("orders")
      .insert([
        {
          seller_id: sellerId,
          customer_phone: customerPhone,
          status: "PENDING",
          total_amount: productsTotal,
          payment_method: paymentMethod === "PAYSTACK" ? "PAYSTACK" : "WAVE",
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
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized.");
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_ref, total_amount, delivery_fee, sellers(name, delivery_payment_timing, paystack_subaccount_code)")
      .eq("id", orderId)
      .single();

    let payableAmount = 0;
    let orderForPayment = order;

    if (error && /delivery_fee|delivery_payment_timing/i.test(error.message || "")) {
      const fallback = await supabaseAdmin
        .from("orders")
        .select("id, order_ref, total_amount, sellers(name, paystack_subaccount_code)")
        .eq("id", orderId)
        .single();

      if (fallback.error || !fallback.data) {
        throw new Error("Order not found.");
      }

      orderForPayment = { ...fallback.data, delivery_fee: 0 };
    } else if (error || !order) {
      throw new Error("Order not found.");
    }

    payableAmount = Number(orderForPayment.total_amount || 0);
    if (orderForPayment.sellers?.delivery_payment_timing === "INCLUDED") {
      payableAmount += Number(orderForPayment.delivery_fee || 0);
    }

    const paymentData = await initializeTransaction({
      email: `customer-${orderId}@tikchop.app`, // Email fictif pour Paystack
      amount: payableAmount,
      metadata: {
        order_id: orderId,
        order_ref: orderForPayment.order_ref || orderId.split("-")[0].toUpperCase(),
        seller_name: orderForPayment.sellers?.name || "Tikchop"
      },
      subaccount: orderForPayment.sellers?.paystack_subaccount_code || undefined
    });

    await savePaystackInitialization(orderId, paymentData);

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
    console.error("Delivery WhatsApp notification failed:", notificationError);
  }

  return { ...data, delivery_drivers: driver };
}

export async function getSellerOrders(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const { data, error } = await supabaseAdmin
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
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
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

export async function getSellersForProductForm() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function addProduct(product, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(product?.seller_id, accessToken);

  const payload = {
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    stock_quantity: Number.parseInt(product.stock_quantity || 0, 10),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    seller_id: product.seller_id,
  };

  if (!payload.seller_id || !payload.name || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select("id")
    .single();

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
    price: Number(product.price || 0),
    stock_quantity: Number.parseInt(product.stock_quantity || 1, 10),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
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

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert(payload)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSellerProducts(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity, image_url, description, created_at")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

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
    price: Number(product.price || 0),
    stock_quantity: Number.parseInt(product.stock_quantity || 0, 10),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
  };

  if (!productId || !payload.name || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(payload)
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .select("id, name, price, stock_quantity, image_url, description, created_at")
    .single();

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

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const [
    { count: productCount },
    { count: orderCount },
    { data: orders, error: ordersError },
    { data: paidOrders, error: paidOrdersError },
  ] = await Promise.all([
    supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("seller_id", seller.id),
    supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", seller.id),
    supabaseAdmin
      .from("orders")
      .select("id, order_ref, customer_phone, total_amount, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabaseAdmin
      .from("orders")
      .select("total_amount, delivery_fee")
      .eq("seller_id", seller.id)
      .in("status", ["PAID", "DELIVERED"]),
  ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  if (paidOrdersError) {
    throw new Error(paidOrdersError.message);
  }

  const sales = (paidOrders || [])
    .reduce((total, order) => total + Number(order.total_amount || 0) + Number(order.delivery_fee || 0), 0);

  return {
    stats: {
      sales,
      orders: orderCount || 0,
      products: productCount || 0,
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
