import { supabaseAdmin } from "./supabase-admin";
import { createHash } from "node:crypto";

const ALLOWED_ORDER_STATUS = new Set(["PENDING", "PAID", "PREPARED", "DELIVERED", "CANCELLED"]);

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

export async function getMobileOverview(request) {
  const { seller } = await requireMobileSeller(request);

  const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
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
  ]);

  if (productsError) throw new Error(productsError.message);
  if (ordersError) throw new Error(ordersError.message);

  return {
    source: "supabase",
    seller,
    products: products || [],
    orders: orders || [],
    stats: computeMobileStats(products || [], orders || [], seller),
  };
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
