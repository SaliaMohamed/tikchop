"use client";

import { getSellerWhatsAppConnection } from "../app/seller-actions";
import { getSellerAccessToken } from "./seller-auth-client";

/**
 * Résout la destination après connexion en fonction du niveau de configuration :
 * - pas de boutique → onboarding,
 * - WhatsApp non connecté → setup (parcours de configuration),
 * - WhatsApp connecté → discussions (page prioritaire).
 */
export async function resolveSellerLanding(seller) {
  if (!seller?.slug) return "/onboarding?step=account";

  try {
    const token = await getSellerAccessToken();
    const connection = await getSellerWhatsAppConnection(seller, token);
    return connection?.isConnected ? "/messages" : "/setup";
  } catch {
    return "/setup";
  }
}