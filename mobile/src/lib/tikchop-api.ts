import { demoOverview } from "@/data/demo";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { CustomerHandoff, DashboardStats, Order, Product, Seller, TikchopOverview } from "@/types/tikchop";

const pilotSellerSlug = process.env.EXPO_PUBLIC_TIKCHOP_SELLER_SLUG || "salia";
const apiBaseUrl = (process.env.EXPO_PUBLIC_TIKCHOP_API_URL || "").replace(/\/$/, "");

async function getAccessToken() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function mobileApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error("API Tikchop mobile non configuree.");
  const token = await getAccessToken();
  if (!token) throw new Error("Session vendeur manquante.");

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erreur API ${response.status}`);
  }

  return payload as T;
}

function computeStats(products: Product[], orders: Order[], seller: Seller): DashboardStats {
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
    whatsappConnected: ["connected", "open"].includes(String(seller.whatsapp_status || "").toLowerCase()),
  };
}

type OverviewOptions = {
  sellerId?: string;
};

async function resolveSeller(sellerId?: string): Promise<Seller | null> {
  if (!supabase) return null;

  if (sellerId) {
    const { data, error } = await supabase
      .from("sellers")
      .select("id,name,slug,phone_number,whatsapp_status,evolution_instance,owner_user_id")
      .eq("id", sellerId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as Seller;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (userId) {
    const { data, error } = await supabase
      .from("sellers")
      .select("id,name,slug,phone_number,whatsapp_status,evolution_instance,owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (error && !/owner_user_id|schema cache|column/i.test(error.message || "")) throw error;
    if (data) return data as Seller;
  }

  const { data, error } = await supabase
    .from("sellers")
    .select("id,name,slug,phone_number,whatsapp_status,evolution_instance,owner_user_id")
    .eq("slug", pilotSellerSlug)
    .maybeSingle();
  if (error) throw error;
  return (data as Seller | null) || null;
}

export async function getTikchopOverview(options: OverviewOptions = {}): Promise<TikchopOverview> {
  if (!hasSupabaseConfig || !supabase) {
    return demoOverview;
  }

  try {
    if (apiBaseUrl) {
      const token = await getAccessToken();
      if (token) {
        return await mobileApi<TikchopOverview>("/api/mobile/overview");
      }
    }

    const seller = await resolveSeller(options.sellerId);

    if (!seller) {
      return {
        ...demoOverview,
        warning: "Aucune boutique trouvee pour ce compte. Mode demo affiche.",
      };
    }

    const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,description,price,stock_quantity,image_url,category")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("orders")
        .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,created_at")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const warning = productsError?.message || ordersError?.message || undefined;
    const normalizedProducts = (products || []) as Product[];
    const normalizedOrders = (orders || []) as Order[];
    const normalizedSeller = seller as Seller;

    return {
      source: "supabase",
      seller: normalizedSeller,
      products: normalizedProducts,
      orders: normalizedOrders,
      stats: computeStats(normalizedProducts, normalizedOrders, normalizedSeller),
      warning,
    };
  } catch (error) {
    return {
      ...demoOverview,
      warning: error instanceof Error ? error.message : "Lecture Supabase impossible. Mode demo affiche.",
    };
  }
}

export async function updateProductStock(productId: string, sellerId: string, stockQuantity: number) {
  if (apiBaseUrl) {
    const result = await mobileApi<{ product: Product }>(`/api/mobile/products/${productId}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ stock_quantity: stockQuantity }),
    });
    return result.product;
  }

  if (!supabase) throw new Error("Supabase n'est pas configure.");
  const stock = Number.parseInt(String(stockQuantity), 10);
  if (!productId || !sellerId || Number.isNaN(stock) || stock < 0) {
    throw new Error("Stock invalide.");
  }

  const { data, error } = await supabase
    .from("products")
    .update({ stock_quantity: stock })
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .select("id,name,price,stock_quantity,image_url,description,category,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as Product;
}

export async function uploadProductPhoto(uri: string) {
  if (!apiBaseUrl) throw new Error("API Tikchop mobile non configuree.");
  const token = await getAccessToken();
  if (!token) throw new Error("Session vendeur manquante.");

  const filename = uri.split("/").pop() || `product-${Date.now()}.jpg`;
  const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  const formData = new FormData();
  formData.append("image", {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const response = await fetch(`${apiBaseUrl}/api/mobile/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Photo non envoyee.");
  }

  return payload as { url: string; publicId?: string };
}

export async function createQuickProduct(sellerId: string, product: Pick<Product, "name" | "price" | "stock_quantity" | "description" | "image_url">) {
  if (apiBaseUrl) {
    const result = await mobileApi<{ product: Product }>("/api/mobile/products", {
      method: "POST",
      body: JSON.stringify(product),
    });
    return result.product;
  }

  if (!supabase) throw new Error("Supabase n'est pas configure.");
  const payload = {
    seller_id: sellerId,
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    stock_quantity: Number.parseInt(String(product.stock_quantity || 0), 10),
    description: String(product.description || "").trim() || null,
  };

  if (!payload.seller_id || payload.name.length < 2 || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Article incomplet.");
  }

  const { data, error } = await supabase
    .from("products")
    .insert([payload])
    .select("id,name,price,stock_quantity,image_url,description,category,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateOrderStatus(orderId: string, sellerId: string, status: "PENDING" | "PAID" | "PREPARED" | "DELIVERED" | "CANCELLED") {
  if (apiBaseUrl) {
    const result = await mobileApi<{ order: Order }>(`/api/mobile/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return result.order;
  }

  if (!supabase) throw new Error("Supabase n'est pas configure.");
  if (!orderId || !sellerId) throw new Error("Commande introuvable.");

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .select("id,order_ref,customer_name,customer_phone,status,total_amount,delivery_fee,delivery_zone,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as Order;
}

export async function pauseBotForCustomer(customerPhone: string, durationMinutes = 24 * 60) {
  if (!apiBaseUrl) throw new Error("API Tikchop mobile non configuree.");
  const result = await mobileApi<{ handoff: CustomerHandoff }>(`/api/mobile/conversations/${encodeURIComponent(customerPhone)}/handoff`, {
    method: "PATCH",
    body: JSON.stringify({ duration_minutes: durationMinutes }),
  });
  return result.handoff;
}

export async function resumeBotForCustomer(customerPhone: string) {
  if (!apiBaseUrl) throw new Error("API Tikchop mobile non configuree.");
  return mobileApi<{ ok: boolean }>(`/api/mobile/conversations/${encodeURIComponent(customerPhone)}/handoff`, {
    method: "DELETE",
  });
}

export async function sendManualReply(customerPhone: string, text: string, durationMinutes = 24 * 60) {
  if (!apiBaseUrl) throw new Error("API Tikchop mobile non configuree.");
  return mobileApi<{ ok: boolean; handoff: CustomerHandoff }>(`/api/mobile/conversations/${encodeURIComponent(customerPhone)}/reply`, {
    method: "POST",
    body: JSON.stringify({ text, duration_minutes: durationMinutes }),
  });
}
