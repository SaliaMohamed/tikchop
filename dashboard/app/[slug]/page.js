import React from "react";
import { notFound, redirect } from "next/navigation";
import ShopClient from "./ShopClient";
import { supabaseAdmin } from "../../lib/supabase-admin";

export const revalidate = 60;

const PUBLIC_SELLER_SELECT = [
  "id",
  "name",
  "slug",
  "phone_number",
  "owner_user_id",
  "brand_color",
  "logo_url",
  "delivery_enabled",
  "pickup_enabled",
  "fixed_delivery_fee",
  "delivery_payment_timing",
  "accepted_payment_methods",
  "default_payment_method",
  "payout_phone",
].join(", ");

const PUBLIC_PRODUCT_SELECT = [
  "id",
  "seller_id",
  "name",
  "description",
  "price",
  "stock_quantity",
  "image_url",
  "created_at",
].join(", ");

async function getSellerData(slug) {
  const supabase = supabaseAdmin;

  const { data: seller, error } = await supabase
    .from("sellers")
    .select(PUBLIC_SELLER_SELECT)
    .eq("slug", slug)
    .single();

  if (error || !seller) return null;

  const [products, deliveryZones] = await Promise.all([
    (async () => {
      let { data, error: productsError } = await supabase
        .from("products")
        .select(PUBLIC_PRODUCT_SELECT)
        .eq("seller_id", seller.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (productsError && /is_active|schema cache|column/i.test(productsError.message || "")) {
        const fallback = await supabase
          .from("products")
          .select(PUBLIC_PRODUCT_SELECT)
          .eq("seller_id", seller.id)
          .order("created_at", { ascending: false });
        data = fallback.data;
      }
      return data || [];
    })(),
    (async () => {
      const { data } = await supabase
        .from("delivery_zones")
        .select("id, name, fee")
        .eq("seller_id", seller.id)
        .eq("is_active", true)
        .order("name");
      return data || [];
    })()
  ]);

  return { seller, products, deliveryZones };
}

export default async function SellerShopPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getSellerData(slug);

  if (!data) {
    notFound();
  }

  const { seller, products, deliveryZones } = data;

  // QR Code / lien direct → chat natif Djassaman
  if (query?.chat === "1") {
    redirect(`/${slug}/chat`);
  }

  return (
    <div className="public-shop mx-auto max-w-[480px] pb-8 md:max-w-6xl">
      <ShopClient seller={seller} products={products} deliveryZones={deliveryZones} initialProductId={query?.product || ""} />

      <footer className="mt-8 hidden text-center text-xs font-bold text-zinc-400 md:block">
        Boutique publique propulsee par <span className="text-zinc-700">Tikchop</span>
      </footer>
    </div>
  );
}
