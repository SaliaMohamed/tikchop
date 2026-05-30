"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

const ORDER_STATUSES = new Set(["PENDING", "PAID", "PREPARED", "DELIVERED", "CANCELLED"]);
const DELIVERY_STATUSES = new Set(["PENDING", "ASSIGNED", "READY", "DELIVERED", "CANCELLED"]);
const PAYMENT_METHODS = new Set(["CASH", "WAVE", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "PAYSTACK", "CARD"]);
const WHATSAPP_STATUSES = new Set(["connected", "standard_active", "pairing", "pending", "disconnected", "error"]);

function parseAdminEmails() {
  return String(process.env.TIKCHOP_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function getAdminContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  const email = String(user?.email || "").toLowerCase();
  const allowedEmails = parseAdminEmails();

  return {
    user,
    email,
    configured: allowedEmails.length > 0,
    allowed: Boolean(user && email && allowedEmails.includes(email)),
  };
}

async function requireAdmin() {
  const context = await getAdminContext();
  if (!context.user) throw new Error("Connexion admin requise.");
  if (!context.configured) throw new Error("Aucun email admin configure.");
  if (!context.allowed) throw new Error("Acces admin refuse.");
  if (!supabaseAdmin) throw new Error("Supabase admin client not initialized.");
  return context;
}

async function countRows(table, configure = (query) => query) {
  if (!supabaseAdmin) return 0;
  const { count } = await configure(supabaseAdmin.from(table).select("*", { count: "exact", head: true }));
  return count || 0;
}

async function safeSelect(table, select, configure = (query) => query, fallbackSelect = "") {
  if (!supabaseAdmin) return [];
  const result = await configure(supabaseAdmin.from(table).select(select));
  if (!result.error) return result.data || [];
  if (!fallbackSelect || !/schema cache|column|relationship|foreign key/i.test(result.error.message || "")) {
    return [];
  }

  const fallback = await configure(supabaseAdmin.from(table).select(fallbackSelect));
  return fallback.data || [];
}

function sumRevenue(orders = []) {
  return orders.reduce((sum, order) => {
    const status = String(order.status || "").toUpperCase();
    if (!["PAID", "PREPARED", "DELIVERED"].includes(status)) return sum;
    return sum + Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  }, 0);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function rowMatches(row, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch([
    row?.name,
    row?.slug,
    row?.owner_email,
    row?.phone_number,
    row?.customer_name,
    row?.customer_phone,
    row?.order_ref,
    row?.payment_method,
    row?.delivery_zone,
    row?.sellers?.name,
    row?.sellers?.slug,
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

export async function getAdminDashboardData(filters = {}) {
  const context = await getAdminContext();
  if (!context.user) return { auth: "signed_out" };
  if (!context.configured) return { auth: "not_configured", email: context.email };
  if (!context.allowed) return { auth: "denied", email: context.email };
  if (!supabaseAdmin) return { auth: "error", message: "Supabase admin client not initialized." };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    sellerCount,
    productCount,
    activeProductCount,
    orderCount,
    pendingOrderCount,
    paidOrderCount,
    connectedSellerCount,
    disconnectedSellerCount,
    unownedSellerCount,
    payoutMissingCount,
    lowStockProductCount,
    recentSellers,
    recentProducts,
    recentOrders,
    recentMessages,
  ] = await Promise.all([
    countRows("sellers"),
    countRows("products"),
    countRows("products", (query) => query.eq("is_active", true)),
    countRows("orders"),
    countRows("orders", (query) => query.eq("status", "PENDING")),
    countRows("orders", (query) => query.in("status", ["PAID", "PREPARED", "DELIVERED"])),
    countRows("sellers", (query) => query.in("whatsapp_status", ["connected", "open", "standard_active"])),
    countRows("sellers", (query) => query.not("whatsapp_status", "in", '("connected","open","standard_active")')),
    countRows("sellers", (query) => query.is("owner_user_id", null)),
    countRows("sellers", (query) => query.or("payout_status.is.null,payout_status.eq.not_configured")),
    countRows("products", (query) => query.lte("stock_quantity", 2)),
    safeSelect(
      "sellers",
      "id,name,slug,phone_number,owner_email,owner_user_id,whatsapp_provider,whatsapp_status,evolution_instance,payout_status,paystack_subaccount_code,created_at",
      (query) => query.order("created_at", { ascending: false }).limit(80),
      "id,name,slug,phone_number,owner_email,created_at",
    ),
    safeSelect(
      "products",
      "id,name,price,stock_quantity,is_active,image_url,created_at,sellers(id,name,slug)",
      (query) => query.order("created_at", { ascending: false }).limit(80),
      "id,name,price,stock_quantity,image_url,created_at,seller_id",
    ),
    safeSelect(
      "orders",
      "id,order_ref,customer_name,customer_phone,status,delivery_status,total_amount,delivery_fee,payment_method,delivery_zone,delivery_address,created_at,sellers(id,name,slug)",
      (query) => query.order("created_at", { ascending: false }).limit(100),
      "id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,payment_method,delivery_zone,delivery_address,created_at,seller_id",
    ),
    safeSelect(
      "messages",
      "id,contenu,statut,seller_slug,customer_phone,created_at",
      (query) => query.gte("created_at", since).order("created_at", { ascending: false }).limit(10),
    ),
  ]);

  const search = String(filters.search || "").trim();
  const orderFilter = String(filters.orderStatus || "all").toUpperCase();
  const sellerFilter = String(filters.sellerStatus || "all").toLowerCase();
  const productFilter = String(filters.productStatus || "all").toLowerCase();

  const filteredSellers = recentSellers.filter((seller) => {
    const status = String(seller.whatsapp_status || "").toLowerCase();
    const matchesStatus = sellerFilter === "all"
      || (sellerFilter === "connected" && ["connected", "open", "standard_active"].includes(status))
      || (sellerFilter === "attention" && !["connected", "open", "standard_active"].includes(status))
      || (sellerFilter === "payment" && !seller.paystack_subaccount_code && !["paystack_ready", "direct_ready"].includes(String(seller.payout_status || "").toLowerCase()));
    return matchesStatus && rowMatches(seller, search);
  });

  const filteredOrders = recentOrders.filter((order) => (
    (orderFilter === "ALL" || String(order.status || "").toUpperCase() === orderFilter) && rowMatches(order, search)
  ));

  const filteredProducts = recentProducts.filter((product) => {
    const stock = Number(product.stock_quantity || 0);
    const matchesStatus = productFilter === "all"
      || (productFilter === "visible" && product.is_active !== false)
      || (productFilter === "hidden" && product.is_active === false)
      || (productFilter === "low_stock" && stock <= 2)
      || (productFilter === "out" && stock <= 0);
    return matchesStatus && rowMatches(product, search);
  });

  const attention = {
    disconnectedSellers: recentSellers.filter((seller) => !["connected", "open", "standard_active"].includes(String(seller.whatsapp_status || "").toLowerCase())).slice(0, 5),
    pendingOrders: recentOrders.filter((order) => String(order.status || "").toUpperCase() === "PENDING").slice(0, 5),
    lowStockProducts: recentProducts.filter((product) => Number(product.stock_quantity || 0) <= 2).slice(0, 5),
  };

  return {
    auth: "ok",
    email: context.email,
    filters: { search, orderStatus: orderFilter, sellerStatus: sellerFilter, productStatus: productFilter },
    stats: {
      sellers: sellerCount,
      products: productCount,
      activeProducts: activeProductCount,
      orders: orderCount,
      pendingOrders: pendingOrderCount,
      paidOrders: paidOrderCount,
      connectedSellers: connectedSellerCount,
      disconnectedSellers: disconnectedSellerCount,
      unownedSellers: unownedSellerCount,
      payoutMissing: payoutMissingCount,
      lowStockProducts: lowStockProductCount,
      revenueSample: sumRevenue(recentOrders),
      messages7d: recentMessages.length,
    },
    attention,
    recentSellers: filteredSellers,
    recentProducts: filteredProducts,
    recentOrders: filteredOrders,
  };
}

export async function adminUpdateOrderStatus(formData) {
  await requireAdmin();
  const orderId = String(formData.get("order_id") || "");
  const status = String(formData.get("status") || "").toUpperCase();
  if (!orderId || !ORDER_STATUSES.has(status)) throw new Error("Statut commande invalide.");
  const deliveryStatus = String(formData.get("delivery_status") || "").toUpperCase();
  const paymentMethod = String(formData.get("payment_method") || "").toUpperCase();
  const deliveryZone = String(formData.get("delivery_zone") || "").trim();
  const deliveryAddress = String(formData.get("delivery_address") || "").trim();

  const payload = { status };
  if (DELIVERY_STATUSES.has(deliveryStatus)) payload.delivery_status = deliveryStatus;
  if (PAYMENT_METHODS.has(paymentMethod)) payload.payment_method = paymentMethod;
  if (formData.has("delivery_zone")) payload.delivery_zone = deliveryZone || null;
  if (formData.has("delivery_address")) payload.delivery_address = deliveryAddress || null;

  const { error } = await supabaseAdmin
    .from("orders")
    .update(payload)
    .eq("id", orderId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminUpdateSellerProfile(formData) {
  await requireAdmin();
  const sellerId = String(formData.get("seller_id") || "");
  if (!sellerId) throw new Error("Boutique invalide.");

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone_number") || "").replace(/[^\d+]/g, "").trim();
  const ownerEmail = String(formData.get("owner_email") || "").trim().toLowerCase();

  const payload = {};
  if (name) payload.name = name;
  if (formData.has("phone_number")) payload.phone_number = phone || null;
  if (formData.has("owner_email")) payload.owner_email = ownerEmail || null;

  if (!Object.keys(payload).length) return;

  const { error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminSetSellerAssistantMode(formData) {
  await requireAdmin();
  const sellerId = String(formData.get("seller_id") || "");
  const mode = String(formData.get("mode") || "");
  if (!sellerId) throw new Error("Boutique invalide.");

  const payload = mode === "standard"
    ? {
        whatsapp_provider: "tikchop_standard",
        whatsapp_status: "standard_active",
        whatsapp_connected_at: new Date().toISOString(),
        whatsapp_last_error: null,
      }
    : {
        whatsapp_provider: "evolution",
        whatsapp_status: "disconnected",
        whatsapp_last_error: "Assistant stoppe depuis l'admin Tikchop.",
      };

  const { error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminBulkSetSellerProducts(formData) {
  await requireAdmin();
  const sellerId = String(formData.get("seller_id") || "");
  const isActive = String(formData.get("is_active") || "") === "true";
  if (!sellerId) throw new Error("Boutique invalide.");

  const { error } = await supabaseAdmin
    .from("products")
    .update({ is_active: isActive })
    .eq("seller_id", sellerId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminUpdateProductCommercials(formData) {
  await requireAdmin();
  const productId = String(formData.get("product_id") || "");
  if (!productId) throw new Error("Article invalide.");

  const price = Number(formData.get("price") || 0);
  const stock = Number.parseInt(String(formData.get("stock_quantity") || "0"), 10);
  const isActive = String(formData.get("is_active") || "") === "true";

  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
    throw new Error("Prix ou stock invalide.");
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update({ price, stock_quantity: stock, is_active: isActive && stock > 0 })
    .eq("id", productId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminToggleProductVisibility(formData) {
  await requireAdmin();
  const productId = String(formData.get("product_id") || "");
  const isActive = String(formData.get("is_active") || "") === "true";
  if (!productId) throw new Error("Article invalide.");

  const { error } = await supabaseAdmin
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminUpdateSellerWhatsAppStatus(formData) {
  await requireAdmin();
  const sellerId = String(formData.get("seller_id") || "");
  const whatsappStatus = String(formData.get("whatsapp_status") || "").toLowerCase();
  if (!sellerId || !WHATSAPP_STATUSES.has(whatsappStatus)) throw new Error("Statut WhatsApp invalide.");

  const { error } = await supabaseAdmin
    .from("sellers")
    .update({
      whatsapp_status: whatsappStatus,
      whatsapp_last_error: whatsappStatus === "disconnected" ? "Deconnecte depuis l'admin Tikchop." : null,
    })
    .eq("id", sellerId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
