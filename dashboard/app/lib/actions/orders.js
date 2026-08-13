"use server";

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { savePaystackInitialization, sendOrderLifecycleMessage } from "../../../lib/order-payments";
import { initializeTransaction, createPaystackSubaccount } from "../../../lib/paystack";
import { sendEvolutionText } from "../../../lib/evolution";
import { getPaymentOption, getSellerDefaultPaymentMethod, normalizeAcceptedPaymentMethods, onlinePaymentsEnabled, paymentMethodsNeedDirectPhone } from "../../../lib/local-commerce";

import { requireSellerBySlug, requireOrderForSeller } from "./auth";
import { attachHandoffsToOrders, buildDriverDeliveryMessage, chooseDriverForOrder, parseStoredMessageClient, getMessagePhone, getMessageName, normalizeStoredMessage, mergeMessageRows, normalizeMessageMedia, getActiveSellerHandoffs, saveSellerCustomerHandoff, getHandoffSellerKeys, MESSAGE_SELECT_BASE, MESSAGE_SELECT_WITH_MEDIA } from "./shared";

/**
 * Order management, payments & WhatsApp conversations.
 */
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

  // --- D?cr?mentation de stock ---
  // Tentative via RPC atomique (FOR UPDATE PostgreSQL, pas de race condition).
  // Si la migration 2026-05-13-security-and-atomic-stock.sql n'est pas encore appliqu?e,
  // la RPC est absente : on retombe sur l'optimistic lock manuel.
  let stockDecremented = false;

  try {
    // M?thode 1 : RPC atomique (recommand?e)
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

      // RPC absente ? basculer sur la m?thode 2
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
    // Ne relancer que si le stock a d?j? ?t? partiellement d?cr?ment? (incoh?rence)
    if (stockDecremented) {
      await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(rpcErr.message || "Stock non mis a jour. Reessayez la commande.");
    }
    // Sinon : RPC absente, utiliser m?thode 2 ci-dessous
  }

  // M?thode 2 : Optimistic lock manuel (fallback si RPC non d?ploy?e)
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

    // R?cup?rer le vrai num?ro de t?l?phone pour g?n?rer un email de re?u
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

  // Pagination curseur : `before` = valeur de created_at de la derni?re commande vue
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
    brand_color: profile?.brand_color ? String(profile.brand_color).trim() : "#c2572b",
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

