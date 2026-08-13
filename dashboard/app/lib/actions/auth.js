"use server";

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createClient } from "../../../lib/supabase/server";

/**
 * Authentication helpers for server actions.
 */

export async function requireSellerUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }
  return data.user;
}

export async function requireSellerBySlug(slug, _accessToken, select = "*") {
  const user = await requireSellerUser();
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

export async function requireSellerById(sellerId, _accessToken, select = "id") {
  const user = await requireSellerUser();
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

export async function requireOrderForSeller(orderId, accessToken) {
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
