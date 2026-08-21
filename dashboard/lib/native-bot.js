/**
 * Djassaman natif - moteur de messagerie native Tikchop (sans n8n, sans Evolution).
 * Phase 2 : agent IA Gemini avec tool-calling (search_product, create_order, get_payment_link…).
 * Fallback sur le bot menu-rapide Phase 1 si Gemini est indisponible.
 */

import { supabaseAdmin } from "./supabase-admin";
import { formatCfa } from "../app/lib/actions/formatters";
import { buildNativeClientKey, CHANNEL_NATIVE } from "../app/lib/actions/channels";
import { getActiveSellerHandoffs } from "../app/lib/actions/shared";
import { runGeminiAgent } from "./native-bot-agent";
import { uploadChatMedia, transcribeAudio } from "./native-bot-tools";
import { sendPushToSeller } from "./push-notifications";

const PUBLIC_SELLER_SELECT = [
  "id",
  "name",
  "slug",
  "phone_number",
  "bot_greeting",
  "bot_tone",
  "bot_payment_preferences",
  "bot_delivery_notes",
  "fixed_delivery_fee",
  "delivery_enabled",
  "pickup_enabled",
].join(", ");

const PRODUCT_SELECT = ["id", "name", "price", "stock_quantity", "image_url"].join(", ");

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, 400);
}

function normalizeClientId(value) {
  return String(value || "").trim().replace(/\s+/g, "").slice(0, 64) || null;
}

function normalizeName(value) {
  return String(value || "").trim().slice(0, 60);
}

export async function getNativeSeller(slug) {
  if (!slug || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("sellers")
    .select(PUBLIC_SELLER_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  return error ? null : data;
}

async function getSellerProducts(sellerId) {
  if (!sellerId || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error && /is_active|schema cache|column/i.test(error.message || "")) {
    const fallback = await supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(30);
    return fallback.error ? [] : fallback.data || [];
  }
  return data || [];
}

export async function getNativeConversation(slug, clientId) {
  const cleanClient = normalizeClientId(clientId);
  if (!slug || !cleanClient) return { messages: [], seller: null };

  const seller = await getNativeSeller(slug);
  if (!seller) return { messages: [], seller: null };

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id,contenu,client,statut,created_at,external_message_id,seller_slug,customer_phone,channel,client_name,media_type,media_url,media_mime_type,media_caption,media_payload")
    .eq("seller_slug", slug)
    .eq("channel", CHANNEL_NATIVE)
    .eq("customer_phone", cleanClient)
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = (error ? [] : data || []).filter(
    (row) => String(row.statut || "").toLowerCase() !== "human_pause",
  );

  const messages = rows.map((row) => ({
    id: String(row.id || `${row.created_at}-${row.external_message_id || ""}`),
    text: String(row.contenu || "").trim(),
    channel: CHANNEL_NATIVE,
    status: row.statut || "",
    direction: /seller|manual|followup|out|from_me|vendeur/.test(String(row.statut || "").toLowerCase())
      ? "out"
      : /bot|assistant/.test(String(row.statut || "").toLowerCase())
        ? "bot"
        : "in",
    created_at: row.created_at || null,
    customer_phone: String(row.customer_phone || "").trim(),
    customer_name: String(row.client_name || "").trim(),
    media: normalizeNativeMedia(row),
  }));

  return { messages, seller };
}

function normalizeNativeMedia(row = {}) {
  const payload = row.media_payload && typeof row.media_payload === "object" ? row.media_payload : {};
  const mimeType = String(row.media_mime_type || payload.mimetype || "").trim();
  const explicitType = String(row.media_type || payload.type || "").toLowerCase();
  const type = explicitType
    || (mimeType.startsWith("image/") ? "image" : "")
    || (mimeType.startsWith("audio/") ? "audio" : "")
    || (mimeType.startsWith("video/") ? "video" : "")
    || (mimeType ? "document" : "");
  const url = String(row.media_url || payload.url || "").trim();
  if (!type && !url) return null;
  return {
    type: type || "document",
    url,
    mime_type: mimeType,
    caption: String(row.media_caption || payload.caption || "").trim(),
    name: String(payload.fileName || payload.filename || "Piece jointe").trim(),
  };
}

export async function sendNativeCustomerMessage({ slug, clientId, name, text, media = null }) {
  const cleanClient = normalizeClientId(clientId);
  if (!slug || !cleanClient) {
    throw new Error("Identifiant client invalide.");
  }

  const seller = await getNativeSeller(slug);
  if (!seller) {
    throw new Error("Boutique introuvable.");
  }

  const cleanName = normalizeName(name);
  let message = cleanText(text);

  let mediaType = media?.type || null;
  let mediaMimeType = media?.mimeType || media?.mime_type || null;
  let mediaUrl = media?.url || null;
  let mediaCaption = cleanText(media?.caption || text || "");

  // Si c'est un message vocal sans texte, on le transcrit d'abord
  if (media?.type === "audio" && media?.base64) {
    try {
      const transcription = await transcribeAudio({
        base64: media.base64,
        mimeType: mediaMimeType || "audio/webm",
      });
      if (transcription) {
        message = `[Vocal] ${transcription}`;
        mediaCaption = transcription;
      }
    } catch {
      // Keep fallback
    }
  }

  if (!message && media?.type === "image") {
    message = "Photo envoyée";
  } else if (!message && media?.type === "audio") {
    message = "Message vocal";
  }

  if (!message && !media) {
    throw new Error("Message vide.");
  }

  // Upload persistant sur Cloudinary (si base64 fourni)
  if (media?.base64 && !mediaUrl) {
    try {
      const uploaded = await uploadChatMedia({
        base64: media.base64,
        mimeType: mediaMimeType || (media.type === "audio" ? "audio/webm" : "image/jpeg"),
      });
      if (uploaded?.url) {
        mediaUrl = uploaded.url;
      }
    } catch {
      // Non-fatal
    }
  }

  const clientKey = buildNativeClientKey(slug, cleanName, cleanClient);

  const insertPayload = {
    contenu: message || "Pièce jointe",
    client: clientKey,
    statut: "in",
    channel: CHANNEL_NATIVE,
    external_message_id: `native:${slug}:${cleanClient}:${Date.now()}`,
    seller_slug: slug,
    customer_phone: cleanClient,
    client_name: cleanName || null,
  };

  if (mediaType || mediaUrl) {
    insertPayload.media_type = mediaType || (mediaMimeType?.startsWith("audio/") ? "audio" : "image");
    insertPayload.media_url = mediaUrl;
    insertPayload.media_mime_type = mediaMimeType;
    insertPayload.media_caption = mediaCaption || null;
  }

  const { data: saved, error: saveError } = await supabaseAdmin
    .from("messages")
    .insert(insertPayload)
    .select("id,contenu,client,statut,created_at,external_message_id,seller_slug,customer_phone,channel,client_name,media_type,media_url,media_mime_type,media_caption")
    .maybeSingle();

  if (saveError) {
    throw new Error(saveError.message);
  }

  // Notifier le vendeur en temps réel (Web Push) — non-bloquant
  const pushPreview = message
    ? message.slice(0, 60) + (message.length > 60 ? "…" : "")
    : media?.type === "audio" ? "🎤 Message vocal" : "📷 Photo";
  sendPushToSeller(
    { sellerId: seller.id },
    {
      title: `💬 Nouveau message${cleanName ? ` de ${cleanName}` : ""} — Djassaman`,
      body: pushPreview,
      url: "/messages",
    },
  ).catch(() => {}); // fire-and-forget

  const paused = await isNativePaused(seller, cleanClient);
  if (paused) {
    return { ok: true, paused: true, messages: [] };
  }

  const replyText = await runNativeBotReply({
    seller,
    clientId: cleanClient,
    text: message,
    name: cleanName,
    media,
  });

  if (!replyText) {
    return { ok: true, paused: false, messages: [] };
  }

  const { data: reply, error: replyError } = await supabaseAdmin
    .from("messages")
    .insert({
      contenu: replyText,
      client: clientKey,
      statut: "bot",
      channel: CHANNEL_NATIVE,
      external_message_id: `native-bot:${slug}:${cleanClient}:${Date.now()}`,
      seller_slug: slug,
      customer_phone: cleanClient,
      client_name: cleanName || null,
    })
    .select("id,contenu,client,statut,created_at,external_message_id,seller_slug,customer_phone,channel,client_name,media_type,media_url,media_mime_type,media_caption")
    .maybeSingle();

  if (replyError) {
    throw new Error(replyError.message);
  }

  return {
    ok: true,
    paused: false,
    messages: [saved, reply].filter(Boolean),
  };
}

async function isNativePaused(seller, clientId) {
  const handoffs = await getActiveSellerHandoffs(seller);
  return Array.isArray(handoffs) && handoffs.some((handoff) => String(handoff.customer_phone || "").trim() === clientId);
}

async function runNativeBotReply({ seller, clientId, text, name, media = null }) {
  // Phase 2 & 3 : agent IA Gemini multimodal avec tool-calling.
  // Si Gemini retourne null (quota épuisé, réseau, clé manquante) → fallback menu-rapide.
  try {
    const agentReply = await runGeminiAgent({ seller, clientId, text, name, media });
    if (agentReply !== null) return agentReply;
  } catch (err) {
    console.error("[native-bot] Gemini agent error, switching to menu fallback:", err.message);
  }

  // Fallback Phase 1 — menu rapide sans IA
  return runMenuFallback({ seller, clientId, text, name });
}

async function runMenuFallback({ seller, clientId, text, name }) {
  const products = await getSellerProducts(seller.id);
  const greetingText =
    String(seller.bot_greeting || "").trim() ||
    `Bonjour${name ? ` ${name}` : ""} ! Bienvenue chez ${seller.name}. Comment puis-je vous aider ?`;

  const intent = detectIntent(text, products);

  switch (intent) {
    case "greeting":
      return buildGreeting(seller, name, products, greetingText);
    case "catalog":
    case "search":
      return buildCatalogReply(seller, products, text);
    case "payment":
      return buildPaymentReply(seller);
    case "delivery":
      return buildDeliveryReply(seller);
    case "human":
      return `Je vous mets en relation avec un conseiller ${seller.name}. Le vendeur va vous répondre ici.`;
    case "order":
      return buildOrderReply(seller, products);
    case "thanks":
      return "Avec plaisir ! Revenez quand vous voulez, je suis là pour vous aider.";
    default:
      return buildMenuReply(seller, products);
  }
}

function buildMenuLines(seller, products) {
  const lines = [
    "Je peux vous aider à :",
    "",
    "1. Voir le catalogue (tapez un produit, ex: robe)",
    "2. Vérifier la disponibilité",
    "3. Payer (Wave, Orange, MTN, Djamo)",
    "4. Livraison & retrait",
    "5. Parler à un vendeur",
  ];
  return lines.join("\n");
}

function buildGreeting(seller, name, products, greetingText) {
  const menu = buildMenuLines(seller, products);
  return `${greetingText}\n\n${menu}`;
}

function detectIntent(text, products) {
  const t = String(text || "").toLowerCase();
  if (/(bonjour|salut|bonsoir|hello|bj\b|\bcc\b|yo|bonsoire)/.test(t)) return "greeting";
  if (/(merci|merci beaucoup|top|super|genial|ok merci|nice)/.test(t)) return "thanks";
  if (/(payer|paiement|mode de paiement|paystack|wave|orange money|mtn|djamo|je paie)/.test(t)) return "payment";
  if (/(livraison|livrer|retrait|adresse|zone|commune|delivery|livre)/.test(t)) return "delivery";
  if (/(vendeur|humain|conseiller|parler|joindre|appeler|assistance)/.test(t)) return "human";
  if (/(commander|achat|prendre|je veux|acheter|reserver|commande)/.test(t)) return "order";

  const productNames = (products || []).map((p) => String(p.name || "").toLowerCase()).filter(Boolean);
  if (t.includes("produit") || t.includes("catalogue") || t.includes("dispo") || t.includes("article") || t.includes("voir")) {
    return "catalog";
  }
  if (productNames.some((p) => t.split(/\s+/).some((word) => word.length >= 3 && p.includes(word)))) {
    return "search";
  }
  return "menu";
}

function searchProducts(products, text) {
  const t = String(text || "").toLowerCase();
  const words = t.split(/\s+/).filter((w) => w.length >= 3);
  const scored = (products || [])
    .map((product) => {
      const name = String(product.name || "").toLowerCase();
      let score = 0;
      for (const word of words) {
        if (name.includes(word)) score += 1;
      }
      if (name === t) score += 3;
      if (name.startsWith(t)) score += 2;
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((item) => item.product);
}

function formatProductLine(product) {
  const stock = Number(product.stock_quantity || 0);
  const availability = stock > 0 ? `En stock (${stock})` : "Rupture";
  return `• ${product.name} - ${formatCfa(product.price)} [${availability}]`;
}

function buildCatalogReply(seller, products, text) {
  if (!products.length) return `Le catalogue de ${seller.name} n'est pas encore publié. Écrivez « parler à un vendeur » pour être aidé.`;
  const matches = searchProducts(products, text);
  const list = (matches.length ? matches : products).slice(0, 10).map(formatProductLine).join("\n");
  return `Voici les articles de ${seller.name} :\n\n${list}\n\nTapez le nom d'un produit pour sa disponibilité, ou « payer » pour les options de paiement.`;
}

function buildPaymentReply(seller) {
  const prefs = String(seller.bot_payment_preferences || "").trim() || "Wave, Orange Money, MTN MoMo, Djamo, paiement à la livraison selon la zone.";
  return `Paiements acceptés chez ${seller.name} :\n\n${prefs}\n\nVous pouvez aussi commander ici puis régler à la livraison.`;
}

function buildDeliveryReply(seller) {
  const fee = Number(seller.fixed_delivery_fee || 0);
  const deliveryEnabled = seller.delivery_enabled !== false;
  const pickupEnabled = seller.pickup_enabled !== false;
  const lines = [];
  if (deliveryEnabled) lines.push(`Livraison disponible${fee > 0 ? ` (frais ${formatCfa(fee)})` : " (selon la commune)"}.`);
  if (pickupEnabled) lines.push("Retrait en boutique possible.");
  if (!lines.length) lines.push("La livraison est à confirmer avec la boutique.");
  return lines.join("\n") + "\n\nIndiquez votre commune pour une estimation.";
}

function buildOrderReply(seller, products) {
  if (!products.length) return `Je vois que le catalogue n'est pas encore publié. Écrivez « parler à un vendeur » pour commander directement.`;
  return `Bien sûr ! Dites-moi le nom du produit (ou tapez « voir le catalogue »), et je vérifie le stock et le prix pour passer commande.`;
}

function buildMenuReply(seller, products) {
  return buildMenuLines(seller, products);
}