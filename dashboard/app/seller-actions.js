"use server";

import { supabaseAdmin } from "../lib/supabase-admin";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function cleanEvolutionPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function getEvolutionConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL || "https://evolution-tikchop.76.13.59.214.sslip.io";
  const apiKey = process.env.EVOLUTION_API_KEY;
  const n8nWebhookUrl = process.env.N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL
    || "https://n8n.sakamomo.tech/webhook/tikchop-evolution-whatsapp";

  if (!apiKey) {
    throw new Error("Evolution API n'est pas configuree.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    n8nWebhookUrl,
  };
}

async function evolutionRequest(path, options = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Evolution API a refuse la demande.");
  }

  return data;
}

async function uniqueSlug(baseSlug) {
  const base = baseSlug || `boutique-${Date.now().toString(36)}`;

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabaseAdmin
      .from("sellers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function getSellerOptions() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, phone_number")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createSellerFromOnboarding(payload) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const name = String(payload?.name || "").trim();
  const phone = cleanPhone(payload?.phone_number);
  const requestedSlug = slugify(payload?.slug || name);
  const deliveryMode = payload?.delivery_mode || "BOTH";
  const deliveryFee = Number(payload?.fixed_delivery_fee || 0);
  const deliveryPaymentTiming = payload?.delivery_payment_timing || "AT_RECEPTION";

  if (name.length < 2) {
    throw new Error("Ajoute le nom de la boutique.");
  }

  if (phone.length < 8) {
    throw new Error("Ajoute un numero WhatsApp valide.");
  }

  const slug = await uniqueSlug(requestedSlug);
  const sellerPayload = {
    name,
    slug,
    phone_number: phone,
    delivery_enabled: deliveryMode !== "PICKUP",
    pickup_enabled: deliveryMode !== "DELIVERY",
    fixed_delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
    delivery_payment_timing: deliveryPaymentTiming,
    auto_share_to_driver: false,
  };

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .insert([sellerPayload])
    .select("id, name, slug, phone_number")
    .single();

  if (error && /delivery_|pickup_|fixed_delivery_fee|auto_share_to_driver/i.test(error.message || "")) {
    const fallbackPayload = {
      name,
      slug,
      phone_number: phone,
    };
    const fallback = await supabaseAdmin
      .from("sellers")
      .insert([fallbackPayload])
      .select("id, name, slug, phone_number")
      .single();

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return fallback.data;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function requestSellerWhatsAppPairing(seller) {
  const slug = slugify(seller?.slug);
  const phone = cleanEvolutionPhone(seller?.phone_number);

  if (!slug || phone.length < 8) {
    throw new Error("Boutique ou numero WhatsApp invalide.");
  }

  const { n8nWebhookUrl } = getEvolutionConfig();
  const instanceName = slug;
  const webhookUrl = `${n8nWebhookUrl}?seller=${encodeURIComponent(slug)}`;
  const body = {
    instanceName,
    qrcode: true,
    number: phone,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    },
  };

  let data;
  try {
    data = await evolutionRequest("/instance/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!/already|exist|duplicate|unique/i.test(error.message || "")) {
      throw error;
    }

    await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ webhook: body.webhook }),
    });

    data = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phone)}`);
  }

  const qrcode = data?.qrcode || data;
  const pairingCode = qrcode?.pairingCode || data?.pairingCode || "";

  return {
    instanceName,
    phone,
    pairingCode,
    qrBase64: qrcode?.base64 || data?.base64 || "",
  };
}
