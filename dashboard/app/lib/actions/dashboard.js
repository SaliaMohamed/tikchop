"use server";

import { supabaseAdmin } from "../../../lib/supabase-admin";

import { requireSellerBySlug, requireSellerById } from "./auth";

/**
 * Dashboard data & delivery driver management.
 */
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

