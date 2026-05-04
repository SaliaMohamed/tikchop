import React from "react";
import { notFound } from "next/navigation";
import ShopClient from "./ShopClient";
import { supabase } from "../../lib/supabase";

export const revalidate = 60;

async function getSellerData(slug) {
  if (!supabase) return null;

  const { data: seller, error } = await supabase
    .from("sellers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !seller) return null;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  const { data: deliveryZones } = await supabase
    .from("delivery_zones")
    .select("id, name, fee")
    .eq("seller_id", seller.id)
    .eq("is_active", true)
    .order("name");

  return { seller, products: products || [], deliveryZones: deliveryZones || [] };
}

export default async function SellerShopPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getSellerData(slug);

  if (!data) {
    notFound();
  }

  const { seller, products, deliveryZones } = data;

  return (
    <div className="mx-auto max-w-[480px] pb-8 md:max-w-6xl">
      <ShopClient seller={seller} products={products} deliveryZones={deliveryZones} initialProductId={query?.product || ""} />

      <footer className="mt-8 text-center text-xs font-bold text-zinc-400">
        Propulse par <span className="text-zinc-700">Tikchop</span>
      </footer>
    </div>
  );
}
