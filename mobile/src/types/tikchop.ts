export type Seller = {
  id: string;
  name: string;
  slug: string;
  phone_number?: string | null;
  whatsapp_status?: string | null;
  evolution_instance?: string | null;
  owner_user_id?: string | null;
};

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock_quantity?: number | null;
  image_url?: string | null;
  category?: string | null;
};

export type CustomerHandoff = {
  seller_slug: string;
  customer_phone: string;
  instance_name?: string | null;
  paused_until: string;
  last_from_me_at?: string | null;
  updated_at?: string | null;
};

export type Order = {
  id: string;
  order_ref?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: string;
  total_amount?: number | null;
  delivery_fee?: number | null;
  delivery_zone?: string | null;
  created_at?: string | null;
  handoff?: CustomerHandoff | null;
};

export type DashboardStats = {
  products: number;
  activeProducts: number;
  orders: number;
  pendingOrders: number;
  paidOrders: number;
  preparedOrders: number;
  revenueToday: number;
  whatsappConnected: boolean;
};

export type TikchopOverview = {
  seller: Seller;
  products: Product[];
  orders: Order[];
  stats: DashboardStats;
  source: "supabase" | "demo";
  warning?: string;
};
