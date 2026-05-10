"use server";

import { supabaseAdmin } from "../lib/supabase-admin";
import { sendSellerWelcomeEmail } from "../lib/email";

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

function cleanAuthPhone(value) {
  const phone = cleanPhone(value);
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function getPhoneAliasEmail(value) {
  const digits = cleanAuthPhone(value).replace(/\D/g, "");
  return digits ? `seller-${digits}@phone.tikchop.local` : "";
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
    throw new Error("La connexion WhatsApp automatique n'est pas encore activee cote serveur.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    n8nWebhookUrl,
  };
}

function getStandardWhatsAppNumber() {
  return cleanEvolutionPhone(process.env.NEXT_PUBLIC_TIKCHOP_WHATSAPP || process.env.TIKCHOP_WHATSAPP_NUMBER || "");
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
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(message || data?.error || "Le service WhatsApp a refuse la demande.");
  }

  return data;
}

function asEvolutionInstanceRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function isUnauthorizedEvolutionInstance(instance) {
  const reason = String(instance?.disconnectionReasonCode || "");
  const detail = String(instance?.disconnectionObject || "");
  const status = String(instance?.connectionStatus || "").toLowerCase();

  return status === "close" && (reason === "401" || /unauthorized|connection failure/i.test(detail));
}

function normalizeEvolutionState(data) {
  return String(
    data?.instance?.state
    || data?.state
    || data?.connectionState
    || data?.status
    || "disconnected",
  ).toLowerCase();
}

async function saveSellerWhatsAppFields(seller, fields) {
  const slug = slugify(seller?.slug);
  if (!slug || !supabaseAdmin) return;

  const { error } = await supabaseAdmin
    .from("sellers")
    .update(fields)
    .eq("slug", slug);

  if (error && /whatsapp_|evolution_|schema cache|column/i.test(error.message || "")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function requireOwnedSeller(seller, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!accessToken) {
    throw new Error("Session vendeur manquante. Reconnecte-toi.");
  }

  const slug = slugify(seller?.slug);
  if (!slug) {
    throw new Error("Boutique introuvable.");
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, phone_number")
    .eq("slug", slug)
    .eq("owner_user_id", authData.user.id)
    .maybeSingle();

  if (error && /owner_user_id|schema cache|column/i.test(error.message || "")) {
    throw new Error("Applique d'abord la migration des comptes vendeurs dans Supabase.");
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Cette boutique n'est pas liee a votre compte vendeur.");
  }

  return data;
}

function normalizeChatbotSettings(input = {}) {
  return {
    bot_tone: String(input.bot_tone || "Francais ivoirien simple, poli, direct.").trim(),
    bot_greeting: String(input.bot_greeting || "").trim(),
    bot_payment_preferences: String(input.bot_payment_preferences || "Wave, Orange Money, MTN MoMo, Djamo, paiement a la livraison selon la zone.").trim(),
    bot_delivery_notes: String(input.bot_delivery_notes || "").trim(),
    bot_special_rules: String(input.bot_special_rules || "").trim(),
  };
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

export async function getSellerWhatsAppConnection(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const phone = cleanEvolutionPhone(ownedSeller.phone_number);

  const sellerState = await supabaseAdmin
    .from("sellers")
    .select("whatsapp_provider, whatsapp_status, evolution_instance, whatsapp_last_error")
    .eq("id", ownedSeller.id)
    .maybeSingle()
    .then((result) => (/whatsapp_provider|whatsapp_status|evolution_instance|schema cache|column/i.test(result.error?.message || "") ? { data: null } : result));

  if (sellerState.data?.whatsapp_provider === "tikchop_standard") {
    return {
      provider: "tikchop_standard",
      instanceName: sellerState.data.evolution_instance || "",
      phone,
      state: sellerState.data.whatsapp_status || "standard_active",
      isConnected: true,
      standardNumber: getStandardWhatsAppNumber(),
      webhookUrl: "",
      webhookEnabled: true,
      webhookBase64: true,
      webhookEvents: ["MESSAGES_UPSERT"],
      error: sellerState.data.whatsapp_last_error || "",
    };
  }

  const { n8nWebhookUrl } = getEvolutionConfig();
  let instanceName = slug;
  const webhookUrl = `${n8nWebhookUrl}?seller=${encodeURIComponent(slug)}`;
  let state = "disconnected";
  let webhook = null;
  let errorMessage = "";
  const candidates = [slug, `${slug}-test`].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const data = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(candidate)}`);
      instanceName = candidate;
      state = normalizeEvolutionState(data);
      errorMessage = "";
      break;
    } catch (error) {
      const message = error.message || "";
      errorMessage = /not found|404|introuvable/i.test(message) ? "" : (message || "Connexion WhatsApp introuvable.");
    }
  }

  try {
    webhook = await evolutionRequest(`/webhook/find/${encodeURIComponent(instanceName)}`);
  } catch {
    webhook = null;
  }

  const isConnected = ["open", "connected"].includes(state);

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: isConnected ? "connected" : state,
    whatsapp_last_error: errorMessage || null,
    ...(isConnected ? { whatsapp_connected_at: new Date().toISOString() } : {}),
  });

  return {
    provider: "evolution",
    instanceName,
    phone,
    state,
    isConnected,
    webhookUrl,
    webhookEnabled: Boolean(webhook?.enabled ?? webhook?.webhook?.enabled),
    webhookBase64: Boolean(webhook?.webhookBase64 ?? webhook?.base64 ?? webhook?.webhook?.base64),
    webhookEvents: webhook?.events || webhook?.webhook?.events || [],
    error: errorMessage,
  };
}

export async function activateSellerStandardAssistant(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const standardNumber = getStandardWhatsAppNumber();

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "tikchop_standard",
    evolution_instance: null,
    whatsapp_status: "standard_active",
    whatsapp_connected_at: new Date().toISOString(),
    whatsapp_last_error: null,
  });

  return {
    provider: "tikchop_standard",
    state: "standard_active",
    isConnected: true,
    standardNumber,
    message: standardNumber
      ? "Assistant Standard active. Les clients peuvent passer par le numero Tikchop."
      : "Assistant Standard active. Le support Tikchop ajoutera le numero central pour afficher le lien WhatsApp.",
  };
}

export async function getSellerChatbotSettings(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("bot_tone, bot_greeting, bot_payment_preferences, bot_delivery_notes, bot_special_rules")
    .eq("id", ownedSeller.id)
    .maybeSingle();

  if (error && /bot_|schema cache|column/i.test(error.message || "")) {
    return normalizeChatbotSettings();
  }

  if (error) {
    throw new Error(error.message);
  }

  return normalizeChatbotSettings(data || {});
}

export async function saveSellerChatbotSettings(seller, settings, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const payload = normalizeChatbotSettings(settings);

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .update(payload)
    .eq("id", ownedSeller.id)
    .select("bot_tone, bot_greeting, bot_payment_preferences, bot_delivery_notes, bot_special_rules")
    .maybeSingle();

  if (error && /bot_|schema cache|column/i.test(error.message || "")) {
    throw new Error("Applique la migration des reglages chatbot dans Supabase.");
  }

  if (error) {
    throw new Error(error.message);
  }

  return normalizeChatbotSettings(data || payload);
}

export async function repairSellerWhatsAppWebhook(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const { n8nWebhookUrl } = getEvolutionConfig();
  const webhookUrl = `${n8nWebhookUrl}?seller=${encodeURIComponent(slug)}`;
  const webhook = {
    enabled: true,
    url: webhookUrl,
    byEvents: false,
    base64: true,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  };

  const candidates = [slug, `${slug}-test`].filter(Boolean);
  let lastError = null;

  for (const instanceName of candidates) {
    try {
      await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ webhook }),
      });

      await saveSellerWhatsAppFields(ownedSeller, {
        whatsapp_provider: "evolution",
        evolution_instance: instanceName,
        whatsapp_last_error: null,
      });

      return {
        instanceName,
        webhookUrl,
        webhookEnabled: true,
        webhookBase64: true,
        webhookEvents: webhook.events,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Connexion WhatsApp non reparee.");
}

export async function getSellerByOwner(ownerUserId) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const userId = String(ownerUserId || "").trim();
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, phone_number")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error && /owner_user_id/i.test(error.message || "")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

export async function createSellerAccount(payload) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const method = payload?.method === "PHONE" ? "PHONE" : "EMAIL";
  const email = String(payload?.email || "").trim().toLowerCase();
  const phone = cleanAuthPhone(payload?.phone);
  const password = String(payload?.password || "");
  const displayName = String(payload?.display_name || "").trim();

  if (method === "EMAIL" && !email.includes("@")) {
    throw new Error("Ajoute un email valide.");
  }

  if (method === "PHONE" && phone.replace(/\D/g, "").length < 8) {
    throw new Error("Ajoute un numero de telephone valide avec indicatif pays.");
  }

  if (password.length < 6) {
    throw new Error("Le mot de passe doit avoir au moins 6 caracteres.");
  }

  const accountPayload = method === "PHONE"
    ? {
      email: getPhoneAliasEmail(phone),
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || phone,
        account_phone: phone,
        signup_method: "PHONE",
      },
    }
    : {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || email,
        signup_method: "EMAIL",
      },
    };

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    ...accountPayload,
  });

  if (error) {
    if (/already|registered|exists|existe|duplicate/i.test(error.message || "")) {
      throw new Error("Ce compte existe deja. Appuyez sur 'Deja inscrit' puis connectez-vous.");
    }
    throw new Error(error.message || "Impossible de creer le compte vendeur.");
  }

  if (method === "EMAIL") {
    sendSellerWelcomeEmail({ email, name: displayName }).catch((emailError) => {
      console.error("Welcome email failed:", emailError);
    });
  }

  return {
    id: data.user?.id || "",
    email: data.user?.email || (method === "PHONE" ? getPhoneAliasEmail(phone) : email),
    phone: data.user?.phone || phone,
    method,
  };
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
  const ownerUserId = String(payload?.owner_user_id || "").trim();
  const ownerEmail = String(payload?.owner_email || "").trim().toLowerCase();

  if (name.length < 2) {
    throw new Error("Ajoute le nom de la boutique.");
  }

  if (phone.length < 8) {
    throw new Error("Ajoute un numero WhatsApp valide.");
  }

  if (ownerUserId) {
    const existingSeller = await getSellerByOwner(ownerUserId);
    if (existingSeller) {
      return existingSeller;
    }
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
    ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
    ...(ownerEmail ? { owner_email: ownerEmail } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .insert([sellerPayload])
    .select("id, name, slug, phone_number")
    .single();

  if (error && ownerUserId && /idx_sellers_one_shop_per_owner|duplicate key|unique/i.test(error.message || "")) {
    const existingSeller = await getSellerByOwner(ownerUserId);
    if (existingSeller) {
      return existingSeller;
    }

    throw new Error("Ce compte possede deja une boutique. Connecte-toi avec ce compte puis utilise la boutique existante.");
  }

  if (error && /delivery_|pickup_|fixed_delivery_fee|auto_share_to_driver|owner_user_id|owner_email/i.test(error.message || "")) {
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

export async function requestSellerWhatsAppPairing(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const phone = cleanEvolutionPhone(ownedSeller.phone_number);

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
    if (!/already|exist|duplicate|unique|forbidden/i.test(error.message || "")) {
      throw error;
    }

    const existing = asEvolutionInstanceRow(
      await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
    );

    if (isUnauthorizedEvolutionInstance(existing)) {
      await evolutionRequest(`/instance/delete/${encodeURIComponent(instanceName)}`, {
        method: "DELETE",
      });

      data = await evolutionRequest("/instance/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ webhook: body.webhook }),
    });

    data = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phone)}`);
  }

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: "pairing",
    whatsapp_last_pairing_at: new Date().toISOString(),
    whatsapp_last_error: null,
  });

  const qrcode = data?.qrcode || data;
  const pairingCode = qrcode?.pairingCode || data?.pairingCode || "";

  return {
    instanceName,
    phone,
    pairingCode,
    qrBase64: qrcode?.base64 || data?.base64 || "",
    webhookUrl,
  };
}

export async function disconnectSellerWhatsApp(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);

  await evolutionRequest(`/instance/logout/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "evolution",
    evolution_instance: slug,
    whatsapp_status: "disconnected",
    whatsapp_last_error: null,
  });

  return {
    instanceName: slug,
    state: "disconnected",
    isConnected: false,
  };
}
