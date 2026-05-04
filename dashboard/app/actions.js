"use server";

import { supabaseAdmin } from "../lib/supabase-admin";
import { initializeTransaction } from "../lib/paystack";

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
      .select("id, order_ref, total_amount, delivery_fee, sellers(name, delivery_payment_timing)")
      .eq("id", orderId)
      .single();

    let payableAmount = 0;
    let orderForPayment = order;

    if (error && /delivery_fee|delivery_payment_timing/i.test(error.message || "")) {
      const fallback = await supabaseAdmin
        .from("orders")
        .select("id, order_ref, total_amount, sellers(name)")
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
      }
    });

    return { authorization_url: paymentData.authorization_url, reference: paymentData.reference };
  } catch (error) {
    console.error("Payment initialization error:", error);
    throw new Error("Impossible d'initialiser le paiement.");
  }
}

export async function updateOrderStatus(orderId, status) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const allowed = new Set(["PENDING", "PAID", "PREPARED", "DELIVERED", "CANCELLED"]);
  if (!orderId || !allowed.has(status)) {
    throw new Error("Invalid order status.");
  }

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

  return data;
}

export async function assignOrderDriver(orderId, driverId) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!orderId || !driverId) {
    throw new Error("Invalid driver assignment.");
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, seller_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || "Order not found.");
  }

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

  return { ...data, delivery_drivers: driver };
}

export async function getSellerOrders(slug = "salia") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (sellerError) {
    throw new Error(sellerError.message);
  }

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

export async function getSellerDeliverySettings(slug = "salia") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (sellerError) {
    throw new Error(sellerError.message);
  }

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

export async function addProduct(product) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function addProductsBulk(products) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function getSellerProducts(slug = "salia") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (sellerError) {
    throw new Error(sellerError.message);
  }

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

export async function updateProduct(productId, product, slug = "salia") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (sellerError) {
    throw new Error(sellerError.message);
  }

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

export async function addDeliveryZone(sellerId, zone) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function updateDeliveryZone(zoneId, zone) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function deleteDeliveryZone(zoneId) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { error } = await supabaseAdmin
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

export async function getDashboardData(slug = "salia") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("sellers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (sellerError) {
    throw new Error(sellerError.message);
  }

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

export async function saveSellerDeliverySettings(sellerId, settings) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function addDeliveryDriver(sellerId, driver) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function updateDeliveryDriver(driverId, driver) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

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

export async function deleteDeliveryDriver(driverId) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { error } = await supabaseAdmin
    .from("delivery_drivers")
    .delete()
    .eq("id", driverId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}
