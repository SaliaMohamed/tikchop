"use client";

import { supabase } from "./supabase";

export async function getSellerAccessToken() {
  if (!supabase) {
    throw new Error("Supabase Auth n'est pas configure.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Session vendeur expiree. Reconnecte-toi.");
  }

  return data.session.access_token;
}
