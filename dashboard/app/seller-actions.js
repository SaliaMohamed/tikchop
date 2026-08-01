"use server";

import { supabaseAdmin } from "../lib/supabase-admin";
import { sendSellerWelcomeEmail } from "../lib/email";
import { createClient } from "../lib/supabase/server";
import { assertSafeSellerPassword } from "../lib/password-security";

const OWNER_SCHEMA_ERROR = /owner_user_id|owner_email|schema cache|column/i;
const OWNER_SCHEMA_MESSAGE = "Applique d'abord la migration des comptes vendeurs dans Supabase.";
const PAIRING_CODE_TTL_MINUTES = 3;

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
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return `+${digits}`;
  return `+225${digits}`;
}

function getPhoneAliasEmail(value) {
  const digits = cleanAuthPhone(value).replace(/\D/g, "");
  return digits ? `seller-${digits}@phone.tikchop.local` : "";
}

function cleanEvolutionPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return digits;
  if (digits.length === 10) return `225${digits}`;
  return digits;
}

function normalizeSellerWhatsAppNumber(value) {
  const digits = cleanEvolutionPhone(value);
  return digits ? `+${digits}` : "";
}

function requirePairingPhone(value, label = "generer la connexion WhatsApp") {
  const phoneDisplay = normalizeSellerWhatsAppNumber(value);
  const phone = cleanEvolutionPhone(phoneDisplay);

  if (phone.length < 11) {
    throw new Error(`Ajoute le numero WhatsApp vendeur avant de ${label}.`);
  }

  return { phoneDisplay, phone };
}

function getPairingExpiresAt() {
  return new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

function isOwnerSchemaError(error) {
  return OWNER_SCHEMA_ERROR.test(error?.message || "");
}

async function requireServerSellerUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }

  return data.user;
}

async function resolveSellerUser(accessToken = "") {
  const token = String(accessToken || "").trim();
  if (!token) {
    return requireServerSellerUser();
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }

  return data.user;
}

async function loadSellerByOwnerId(ownerUserId) {
  const userId = String(ownerUserId || "").trim();
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, phone_number")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

async function loadSellerByPhoneNumber(phoneNumber) {
  const phone = cleanPhone(phoneNumber);
  if (!phone) return null;

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, owner_user_id, phone_number")
    .eq("phone_number", phone)
    .maybeSingle();

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

async function loadSellerByOwnerEmail(ownerEmail) {
  const email = String(ownerEmail || "").trim().toLowerCase();
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, owner_user_id, owner_email")
    .eq("owner_email", email)
    .maybeSingle();

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
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
    || data?.instance?.connectionStatus
    || data?.state
    || data?.connectionState
    || data?.connectionStatus
    || data?.status
    || "disconnected",
  ).toLowerCase();
}

async function deleteEvolutionInstance(instanceName) {
  try {
    await evolutionRequest(`/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (!/not found|404|introuvable/i.test(error.message || "")) {
      throw error;
    }
  }
}

function findEvolutionString(value, wantedKeys) {
  if (!value || typeof value !== "object") return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEvolutionString(item, wantedKeys);
      if (found) return found;
    }
    return "";
  }

  for (const [key, item] of Object.entries(value)) {
    if (wantedKeys.includes(key.toLowerCase()) && typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  for (const item of Object.values(value)) {
    const found = findEvolutionString(item, wantedKeys);
    if (found) return found;
  }

  return "";
}

function normalizeEvolutionQrImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:image/")) return raw;

  const base64Part = raw.includes("base64,") ? raw.split("base64,").pop() : raw;
  if (/^[A-Za-z0-9+/=\s_-]+$/.test(base64Part) && base64Part.replace(/\s/g, "").length > 100) {
    return base64Part.replace(/\s/g, "");
  }

  return "";
}

function firstEvolutionValue(values, normalizer = (value) => value) {
  for (const value of values) {
    const normalized = normalizer(value);
    if (normalized) return normalized;
  }

  return "";
}

function normalizePairingCode(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 32) return "";
  return raw.replace(/\s+/g, "");
}

function parseEvolutionPairingPayload(connectData, createData = null, pairingError = "") {
  const connectQr = connectData?.qrcode || connectData?.qr || connectData;
  const createQr = createData?.qrcode || createData?.qr || createData;
  const pairingCode = firstEvolutionValue(
    [
      connectQr?.pairingCode,
      connectData?.pairingCode,
      findEvolutionString(connectData, ["pairingcode", "pairing_code", "pairing", "code"]),
      createQr?.pairingCode,
      createData?.pairingCode,
      findEvolutionString(createData, ["pairingcode", "pairing_code", "pairing", "code"]),
    ],
    normalizePairingCode,
  );
  const qrBase64 = firstEvolutionValue(
    [
      connectQr?.base64,
      connectQr?.qrcode,
      connectQr?.qrCode,
      connectData?.base64,
      connectData?.qrcode,
      connectData?.qrCode,
      findEvolutionString(connectData, ["base64", "qrcode", "qrcodebase64", "qrcode_base64", "qrbase64", "qr_code"]),
      createQr?.base64,
      createQr?.qrcode,
      createQr?.qrCode,
      createData?.base64,
      createData?.qrcode,
      createData?.qrCode,
      findEvolutionString(createData, ["base64", "qrcode", "qrcodebase64", "qrcode_base64", "qrbase64", "qr_code"]),
    ],
    normalizeEvolutionQrImage,
  );

  const missingPairingError = !pairingCode && !qrBase64
    ? "Evolution n'a renvoye ni QR ni code WhatsApp. Reessayez dans quelques secondes."
    : "";

  return {
    pairingCode,
    qrBase64,
    pairingError: pairingCode || qrBase64 ? "" : (pairingError || missingPairingError),
  };
}

async function saveSellerWhatsAppFields(seller, fields) {
  const slug = slugify(seller?.slug);
  if ((!seller?.id && !slug) || !supabaseAdmin) return;

  let query = supabaseAdmin
    .from("sellers")
    .update(fields);

  query = seller?.id ? query.eq("id", seller.id) : query.eq("slug", slug);

  const { error } = await query;

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

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
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
    bot_payment_preferences: String(input.bot_payment_preferences || "Paiement a la livraison en premier quand la zone le permet, puis Wave, Orange Money, MTN MoMo ou Djamo.").trim(),
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

// Retourne la boutique du vendeur authentifié (via accessToken).
// N'expose JAMAIS les boutiques des autres vendeurs.
export async function getSellerOptions(accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  if (!accessToken) {
    throw new Error("Session vendeur manquante. Reconnecte-toi.");
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    throw new Error("Session vendeur invalide. Reconnecte-toi.");
  }

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select("id, name, slug, phone_number")
    .eq("owner_user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
  }

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

  // tikchop_standard n'est plus supporté, on passe directement à la vérification Evolution API propre du vendeur

  const { n8nWebhookUrl } = getEvolutionConfig();
  let instanceName = sellerState.data?.evolution_instance || slug;
  const webhookUrl = `${n8nWebhookUrl}?seller=${encodeURIComponent(slug)}`;
  let state = "disconnected";
  let webhook = null;
  let errorMessage = "";
  const candidates = Array.from(new Set([
    sellerState.data?.evolution_instance,
    slug,
    `${slug}-test`,
  ].filter(Boolean)));

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
  const normalizedStatus = errorMessage ? "error" : isConnected ? "connected" : state;

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: normalizedStatus,
    whatsapp_last_error: errorMessage || null,
    ...(isConnected ? { whatsapp_connected_at: new Date().toISOString() } : {}),
  });

  return {
    provider: "evolution",
    instanceName,
    phone,
    state: normalizedStatus,
    isConnected,
    webhookUrl,
    webhookEnabled: Boolean(webhook?.enabled ?? webhook?.webhook?.enabled),
    webhookBase64: Boolean(webhook?.webhookBase64 ?? webhook?.base64 ?? webhook?.webhook?.base64),
    webhookEvents: webhook?.events || webhook?.webhook?.events || [],
    error: errorMessage,
  };
}

export async function activateSellerStandardAssistant(seller, accessToken) {
  throw new Error("L'assistant standard centralise n'est plus supporte. Vous devez connecter votre propre numero WhatsApp.");
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

  const sellerState = await supabaseAdmin
    .from("sellers")
    .select("evolution_instance")
    .eq("id", ownedSeller.id)
    .maybeSingle()
    .then((result) => (/evolution_instance|schema cache|column/i.test(result.error?.message || "") ? { data: null } : result));
  const candidates = Array.from(new Set([sellerState.data?.evolution_instance, slug, `${slug}-test`].filter(Boolean)));
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

export async function getSellerByOwner(ownerUserId, accessToken = "") {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const user = await resolveSellerUser(accessToken);
  const requestedOwnerUserId = String(ownerUserId || "").trim();
  if (requestedOwnerUserId && requestedOwnerUserId !== user.id) {
    throw new Error("Compte vendeur non autorise.");
  }

  return loadSellerByOwnerId(user.id);
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

  await assertSafeSellerPassword(password);

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

export async function createSellerAccountAndShop(payload) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const method = payload?.method === "PHONE" ? "PHONE" : "EMAIL";
  const email = String(payload?.email || "").trim().toLowerCase();
  const accountPhone = cleanAuthPhone(payload?.phone || payload?.account_phone);
  const password = String(payload?.password || "");
  const displayName = String(payload?.display_name || payload?.name || "").trim();
  const name = String(payload?.name || "").trim();
  const shopPhone = cleanPhone(payload?.phone_number || accountPhone);
  const requestedSlug = slugify(payload?.slug || name);
  const deliveryMode = payload?.delivery_mode || "BOTH";
  const deliveryFee = Number(payload?.fixed_delivery_fee || 0);
  const deliveryPaymentTiming = payload?.delivery_payment_timing || "AT_RECEPTION";

  if (method === "EMAIL" && !email.includes("@")) {
    throw new Error("Ajoute un email valide.");
  }

  if (method === "PHONE" && accountPhone.replace(/\D/g, "").length < 8) {
    throw new Error("Ajoute un numero de telephone valide avec indicatif pays.");
  }

  if (password.length < 6) {
    throw new Error("Le mot de passe doit avoir au moins 6 caracteres.");
  }

  if (name.length < 2) {
    throw new Error("Ajoute le nom de la boutique.");
  }

  if (shopPhone.length < 8) {
    throw new Error("Ajoute un numero WhatsApp valide.");
  }

  await assertSafeSellerPassword(password);

  const accountPayload = method === "PHONE"
    ? {
      email: getPhoneAliasEmail(accountPhone),
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || accountPhone,
        account_phone: accountPhone,
        store_name: name,
        shop_name: name,
        signup_method: "PHONE",
      },
    }
    : {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || email,
        store_name: name,
        shop_name: name,
        account_phone: shopPhone,
        signup_method: "EMAIL",
      },
    };

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(accountPayload);

  if (authError) {
    if (/already|registered|exists|existe|duplicate/i.test(authError.message || "")) {
      throw new Error("Ce compte existe deja. Appuyez sur 'Deja inscrit' puis connectez-vous.");
    }
    throw new Error(authError.message || "Impossible de creer le compte vendeur.");
  }

  const user = authData?.user;
  if (!user?.id) {
    throw new Error("Compte vendeur non cree. Reessayez.");
  }

  const ownerEmail = method === "EMAIL" ? email : "";

  try {
    const existingSeller = await loadSellerByOwnerId(user.id);
    if (existingSeller) {
      return {
        account: {
          id: user.id,
          email: user.email || (method === "PHONE" ? getPhoneAliasEmail(accountPhone) : email),
          phone: user.phone || accountPhone,
          method,
        },
        seller: existingSeller,
      };
    }

    const sellerWithPhone = await loadSellerByPhoneNumber(shopPhone);
    if (sellerWithPhone && sellerWithPhone.owner_user_id !== user.id) {
      throw new Error("Ce numero WhatsApp est deja utilise par une autre boutique.");
    }

    if (ownerEmail) {
      const sellerWithEmail = await loadSellerByOwnerEmail(ownerEmail);
      if (sellerWithEmail && sellerWithEmail.owner_user_id !== user.id) {
        throw new Error("Cet email est deja rattache a une autre boutique.");
      }
    }

    const slug = await uniqueSlug(requestedSlug);
    const sellerPayload = {
      name,
      slug,
      phone_number: shopPhone,
      delivery_enabled: deliveryMode !== "PICKUP",
      pickup_enabled: deliveryMode !== "DELIVERY",
      fixed_delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
      delivery_payment_timing: deliveryPaymentTiming,
      auto_share_to_driver: false,
      owner_user_id: user.id,
      ...(ownerEmail ? { owner_email: ownerEmail } : {}),
    };

    let sellerResult = await supabaseAdmin
      .from("sellers")
      .insert([sellerPayload])
      .select("id, name, slug, phone_number")
      .single();

    if (sellerResult.error && /idx_sellers_one_shop_per_owner|duplicate key|unique/i.test(sellerResult.error.message || "")) {
      const recovered = await loadSellerByOwnerId(user.id);
      if (recovered) {
        sellerResult = { data: recovered, error: null };
      }
    }

    if (sellerResult.error && /delivery_|pickup_|fixed_delivery_fee|auto_share_to_driver/i.test(sellerResult.error.message || "")) {
      sellerResult = await supabaseAdmin
        .from("sellers")
        .insert([{
          name,
          slug,
          phone_number: shopPhone,
          owner_user_id: user.id,
          ...(ownerEmail ? { owner_email: ownerEmail } : {}),
        }])
        .select("id, name, slug, phone_number")
        .single();
    }

    if (isOwnerSchemaError(sellerResult.error)) {
      throw new Error(OWNER_SCHEMA_MESSAGE);
    }

    if (sellerResult.error) {
      throw new Error(sellerResult.error.message);
    }

    if (method === "EMAIL") {
      sendSellerWelcomeEmail({ email, name: displayName || name }).catch((emailError) => {
        console.error("Welcome email failed:", emailError);
      });
    }

    return {
      account: {
        id: user.id,
        email: user.email || (method === "PHONE" ? getPhoneAliasEmail(accountPhone) : email),
        phone: user.phone || accountPhone,
        method,
      },
      seller: sellerResult.data,
    };
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
    throw error;
  }
}

export async function createSellerFromOnboarding(payload) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const user = await resolveSellerUser(payload?.access_token);
  const name = String(payload?.name || "").trim();
  const phone = cleanPhone(payload?.phone_number);
  const requestedSlug = slugify(payload?.slug || name);
  const deliveryMode = payload?.delivery_mode || "BOTH";
  const deliveryFee = Number(payload?.fixed_delivery_fee || 0);
  const deliveryPaymentTiming = payload?.delivery_payment_timing || "AT_RECEPTION";
  const requestedOwnerUserId = String(payload?.owner_user_id || "").trim();
  const ownerUserId = user.id;
  const ownerEmail = String(
    payload?.owner_email
    || (/@phone\.tikchop\.local$/i.test(user.email || "") ? "" : user.email || ""),
  ).trim().toLowerCase();

  if (requestedOwnerUserId && requestedOwnerUserId !== ownerUserId) {
    throw new Error("Session vendeur non autorisee pour cette boutique.");
  }

  if (name.length < 2) {
    throw new Error("Ajoute le nom de la boutique.");
  }

  if (phone.length < 8) {
    throw new Error("Ajoute un numero WhatsApp valide.");
  }

  const existingSeller = await loadSellerByOwnerId(ownerUserId);
  if (existingSeller) {
    return existingSeller;
  }

  const sellerWithPhone = await loadSellerByPhoneNumber(phone);
  if (sellerWithPhone && sellerWithPhone.owner_user_id !== ownerUserId) {
    throw new Error("Ce numero WhatsApp est deja utilise par une autre boutique.");
  }

  if (ownerEmail) {
    const sellerWithEmail = await loadSellerByOwnerEmail(ownerEmail);
    if (sellerWithEmail && sellerWithEmail.owner_user_id !== ownerUserId) {
      throw new Error("Cet email est deja rattache a une autre boutique.");
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
    owner_user_id: ownerUserId,
    ...(ownerEmail ? { owner_email: ownerEmail } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("sellers")
    .insert([sellerPayload])
    .select("id, name, slug, phone_number")
    .single();

  if (error && /idx_sellers_one_shop_per_owner|duplicate key|unique/i.test(error.message || "")) {
    const existingSeller = await loadSellerByOwnerId(ownerUserId);
    if (existingSeller) {
      return existingSeller;
    }

    throw new Error("Ce compte possede deja une boutique. Connecte-toi avec ce compte puis utilise la boutique existante.");
  }

  if (isOwnerSchemaError(error)) {
    throw new Error(OWNER_SCHEMA_MESSAGE);
  }

  if (error && /delivery_|pickup_|fixed_delivery_fee|auto_share_to_driver/i.test(error.message || "")) {
    const fallbackPayload = {
      name,
      slug,
      phone_number: phone,
      owner_user_id: ownerUserId,
      ...(ownerEmail ? { owner_email: ownerEmail } : {}),
    };
    const fallback = await supabaseAdmin
      .from("sellers")
      .insert([fallbackPayload])
      .select("id, name, slug, phone_number")
      .single();

    if (isOwnerSchemaError(fallback.error)) {
      throw new Error(OWNER_SCHEMA_MESSAGE);
    }

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

export async function requestSellerWhatsAppPairing(seller, accessToken, whatsappNumber = "") {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const { phoneDisplay, phone } = requirePairingPhone(whatsappNumber || ownedSeller.phone_number, "generer le QR");

  if (!slug) throw new Error("Boutique introuvable.");

  await saveSellerWhatsAppFields(ownedSeller, {
    phone_number: phoneDisplay,
    whatsapp_provider: "evolution",
    evolution_instance: slug,
    whatsapp_status: "pairing",
    whatsapp_last_pairing_at: new Date().toISOString(),
    whatsapp_last_error: null,
  });

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
  let existing = null;

  try {
    existing = asEvolutionInstanceRow(
      await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
    );
  } catch (error) {
    if (!/not found|404|introuvable/i.test(error.message || "")) {
      throw error;
    }
  }

  const existingState = normalizeEvolutionState(existing);
  if (["open", "connected"].includes(existingState)) {
    throw new Error("Ce numero WhatsApp est deja connecte a Tikchop.");
  }

  if (existing) {
    await deleteEvolutionInstance(instanceName);
  }

  try {
    data = await evolutionRequest("/instance/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!/already|exist|duplicate|unique|forbidden/i.test(error.message || "")) {
      throw error;
    }

    const duplicate = asEvolutionInstanceRow(
      await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
    );

    if (duplicate && !["open", "connected"].includes(normalizeEvolutionState(duplicate))) {
      await deleteEvolutionInstance(instanceName);

      data = await evolutionRequest("/instance/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } else if (isUnauthorizedEvolutionInstance(duplicate)) {
      await deleteEvolutionInstance(instanceName);

      data = await evolutionRequest("/instance/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } else {
      throw new Error("Ce numero WhatsApp est deja connecte a Tikchop.");
    }

  }

  await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ webhook: body.webhook }),
  });

  let connectData = null;
  let pairingError = "";

  try {
    connectData = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phone)}`);
  } catch (error) {
    pairingError = error.message || "Code de liaison indisponible.";
  }

  await saveSellerWhatsAppFields(ownedSeller, {
    phone_number: phoneDisplay,
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: "pairing",
    whatsapp_last_pairing_at: new Date().toISOString(),
    whatsapp_last_error: null,
  });

  const pairing = parseEvolutionPairingPayload(connectData, data, pairingError);

  return {
    instanceName,
    phone,
    phoneDisplay,
    pairingMode: "qr",
    pairingExpiresAt: getPairingExpiresAt(),
    ...pairing,
    webhookUrl,
  };
}

export async function refreshSellerWhatsAppPairingCode(seller, accessToken, whatsappNumber = "") {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const { phoneDisplay, phone } = requirePairingPhone(whatsappNumber || ownedSeller.phone_number, "regenerer le code");

  if (!slug) throw new Error("Boutique introuvable.");

  const sellerState = await supabaseAdmin
    .from("sellers")
    .select("evolution_instance")
    .eq("id", ownedSeller.id)
    .maybeSingle()
    .then((result) => (/evolution_instance|schema cache|column/i.test(result.error?.message || "") ? { data: null } : result));
  const instanceName = String(sellerState.data?.evolution_instance || "").trim() || slug;

  await saveSellerWhatsAppFields(ownedSeller, {
    phone_number: phoneDisplay,
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: "pairing",
    whatsapp_last_pairing_at: new Date().toISOString(),
    whatsapp_last_error: null,
  });

  const { n8nWebhookUrl } = getEvolutionConfig();
  const webhookUrl = `${n8nWebhookUrl}?seller=${encodeURIComponent(slug)}`;
  const body = {
    instanceName,
    qrcode: false,
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

  let createData = null;
  let existing = null;

  try {
    existing = asEvolutionInstanceRow(
      await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
    );
  } catch (error) {
    if (!/not found|404|introuvable/i.test(error.message || "")) {
      throw error;
    }
  }

  const existingState = normalizeEvolutionState(existing);
  if (["open", "connected"].includes(existingState)) {
    throw new Error("Ce numero WhatsApp est deja connecte a Tikchop.");
  }

  if (existing) {
    await deleteEvolutionInstance(instanceName);
  }

  try {
    createData = await evolutionRequest("/instance/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!/already|exist|duplicate|unique|forbidden/i.test(error.message || "")) {
      throw error;
    }

    await deleteEvolutionInstance(instanceName);
    createData = await evolutionRequest("/instance/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ webhook: body.webhook }),
  });

  let connectData = null;
  let pairingError = "";

  try {
    connectData = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phone)}`);
  } catch (error) {
    pairingError = error.message || "Code WhatsApp temporaire indisponible.";
  }

  const pairing = parseEvolutionPairingPayload(connectData, createData, pairingError);

  await saveSellerWhatsAppFields(ownedSeller, {
    phone_number: phoneDisplay,
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: "pairing",
    whatsapp_last_pairing_at: new Date().toISOString(),
    whatsapp_last_error: pairing.pairingError || null,
  });

  return {
    instanceName,
    phone,
    phoneDisplay,
    pairingMode: "code",
    pairingExpiresAt: getPairingExpiresAt(),
    ...pairing,
    webhookUrl,
  };
}

export async function disconnectSellerWhatsApp(seller, accessToken) {
  const ownedSeller = await requireOwnedSeller(seller, accessToken);
  const slug = slugify(ownedSeller.slug);
  const sellerState = await supabaseAdmin
    .from("sellers")
    .select("evolution_instance")
    .eq("id", ownedSeller.id)
    .maybeSingle()
    .then((result) => (/evolution_instance|schema cache|column/i.test(result.error?.message || "") ? { data: null } : result));
  const instanceName = sellerState.data?.evolution_instance || slug;

  try {
    await evolutionRequest(`/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });
  } catch {
    await deleteEvolutionInstance(instanceName);
  }

  await saveSellerWhatsAppFields(ownedSeller, {
    whatsapp_provider: "evolution",
    evolution_instance: instanceName,
    whatsapp_status: "disconnected",
    whatsapp_last_error: null,
  });

  return {
    instanceName,
    state: "disconnected",
    isConnected: false,
  };
}
