/**
 * Djassaman natif — implémentation des tools Gemini (Phase 2 + Phase 3).
 * Fonctions pures server-side, sans dépendances client.
 * Appelées par executeTool() dans native-bot-agent.js.
 */

import { supabaseAdmin } from "./supabase-admin";
import { initializeTransaction } from "./paystack";
import { formatCfa } from "../app/lib/actions/formatters";
import { parseLocalCommerceSettings } from "./local-commerce";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";


// ---------------------------------------------------------------------------
// Tool : search_product
// Cherche des produits dans le catalogue par mot-clé.
// ---------------------------------------------------------------------------
export async function searchProduct(seller, query) {
  if (!seller?.id) return { error: "Boutique introuvable." };

  const q = String(query || "").toLowerCase().trim();
  if (!q) return { error: "Mot-clé de recherche manquant." };

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, description, price, stock_quantity, image_url")
    .eq("seller_id", seller.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { error: "Impossible de charger le catalogue." };

  const products = (data || []);
  const words = q.split(/\s+/).filter((w) => w.length >= 2);

  const scored = products
    .map((p) => {
      const name = String(p.name || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();
      let score = 0;
      for (const word of words) {
        if (name === word) {
          score += 4;
        } else if (name.startsWith(word)) {
          score += 2.5;
        } else if (name.includes(word)) {
          score += 1.5;
        }
        if (desc.includes(word)) {
          score += 0.8;
        }
      }
      return { p, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.p);

  const list = scored.length > 0 ? scored : products.slice(0, 8);

  if (!list.length) {
    return { results: [], message: `Aucun produit trouvé pour « ${query} » chez ${seller.name}.` };
  }

  const lines = list.map((p) => {
    const stock = Number(p.stock_quantity || 0);
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      price_formatted: formatCfa(p.price),
      stock,
      available: stock > 0,
      image_url: p.image_url || null,
    };
  });

  return { results: lines };
}

// ---------------------------------------------------------------------------
// Tool : get_product_detail
// Retourne le détail d'un produit par son ID.
// ---------------------------------------------------------------------------
export async function getProductDetail(seller, productId) {
  if (!seller?.id || !productId) return { error: "Paramètres manquants." };

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity, image_url, description")
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .maybeSingle();

  if (error || !data) return { error: "Produit introuvable." };

  const stock = Number(data.stock_quantity || 0);
  return {
    id: data.id,
    name: data.name,
    price: data.price,
    price_formatted: formatCfa(data.price),
    stock,
    available: stock > 0,
    image_url: data.image_url || null,
    description: String(data.description || "").trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Tool : create_order
// Crée une commande au nom du client natif.
// Gère le prix normal ou négocié, le mode de paiement et l'acompte.
// ---------------------------------------------------------------------------
export async function createOrderFromBot({
  seller,
  productId,
  quantity,
  unitPrice = null,
  paymentMethod = "CASH_ON_DELIVERY",
  depositAmount = 0,
  deliveryType = "DELIVERY",
  deliveryZone = "",
  customerName = "",
  customerPhone = "",
  clientId,
}) {
  if (!seller?.id || !productId || !clientId) {
    return { error: "Paramètres de commande manquants." };
  }

  const qty = Number.parseInt(String(quantity || "1"), 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return { error: "Quantité invalide." };
  }

  // 1. Vérif stock
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity, seller_id")
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .maybeSingle();

  if (productError || !product) return { error: "Produit introuvable pour cette boutique." };

  const stock = Number(product.stock_quantity || 0);
  if (stock < qty) {
    return {
      error: `Stock insuffisant pour « ${product.name} » (disponible : ${stock}, demandé : ${qty}).`,
    };
  }

  // 2. Prix unitaire effectif (prix normal ou prix négocié validé)
  const officialPrice = Number(product.price || 0);
  let effectiveUnitPrice = officialPrice;
  if (unitPrice && Number(unitPrice) > 0) {
    // Vérification de garde-fou : le prix unitaire ne peut pas être inférieur à -20% du prix officiel
    const minAcceptable = Math.round(officialPrice * 0.80);
    effectiveUnitPrice = Math.max(minAcceptable, Number(unitPrice));
  }

  // 3. Frais de livraison
  let deliveryFee = Number(seller.fixed_delivery_fee || 0);
  if (deliveryType === "DELIVERY" && deliveryZone) {
    const { data: zone } = await supabaseAdmin
      .from("delivery_zones")
      .select("fee")
      .eq("seller_id", seller.id)
      .eq("name", deliveryZone)
      .eq("is_active", true)
      .maybeSingle();
    if (zone) deliveryFee = Number(zone.fee || 0);
  }

  const lineTotal = effectiveUnitPrice * qty;
  const totalAmount = lineTotal + (deliveryType === "DELIVERY" ? deliveryFee : 0);
  const orderRef = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

  const noteParts = [];
  if (customerName) noteParts.push(`Client : ${customerName}`);
  if (customerPhone) noteParts.push(`Tél : ${customerPhone}`);
  if (effectiveUnitPrice < officialPrice) {
    noteParts.push(`Prix négocié : ${formatCfa(effectiveUnitPrice)} (au lieu de ${formatCfa(officialPrice)})`);
  }
  if (depositAmount > 0) {
    noteParts.push(`Acompte versé/prévu : ${formatCfa(depositAmount)} - Solde à la livraison : ${formatCfa(totalAmount - depositAmount)}`);
  }

  // 4. Création commande
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert([
      {
        seller_id: seller.id,
        order_ref: orderRef,
        customer_phone: customerPhone || clientId,
        customer_note: noteParts.length ? noteParts.join(" | ") : "Client natif",
        status: "PENDING",
        total_amount: totalAmount,
        payment_method: paymentMethod || "CASH_ON_DELIVERY",
        delivery_type: deliveryType,
        delivery_zone: deliveryZone || null,
        delivery_fee: deliveryType === "DELIVERY" ? deliveryFee : 0,
        delivery_status: "PENDING",
      },
    ])
    .select("id, order_ref, total_amount")
    .single();

  if (orderError) {
    console.error("[native-bot] createOrderFromBot error:", orderError.message);
    return { error: "Impossible de créer la commande. Réessayez." };
  }

  // 5. Lignes de commande
  await supabaseAdmin.from("order_items").insert([
    {
      order_id: order.id,
      product_id: product.id,
      quantity: qty,
      price_at_time: effectiveUnitPrice,
    },
  ]);

  // 6. Décrément stock (best-effort)
  await supabaseAdmin
    .from("products")
    .update({ stock_quantity: Math.max(0, stock - qty) })
    .eq("id", product.id)
    .eq("seller_id", seller.id);

  return {
    order_id: order.id,
    order_ref: order.order_ref || orderRef,
    product_name: product.name,
    quantity: qty,
    unit_price: effectiveUnitPrice,
    line_total: lineTotal,
    delivery_fee: deliveryFee,
    total_amount: totalAmount,
    total_formatted: formatCfa(totalAmount),
    message: `Commande #${order.order_ref || orderRef} validée : ${qty} × ${product.name} = ${formatCfa(totalAmount)} (${paymentMethod === "CASH_ON_DELIVERY" ? "paiement à la livraison" : paymentMethod}).`,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 : Tool negotiate_price (Marchandage personnalisé par le vendeur)
// Négocie un prix dans la fourchette configurée par le commerçant
// ---------------------------------------------------------------------------
export async function negotiatePrice({ seller, productId, offeredPrice, quantity = 1 }) {
  if (!seller?.id || !productId || !offeredPrice) {
    return { error: "Informations incomplètes pour la négociation." };
  }

  const settings = parseLocalCommerceSettings(seller);

  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity")
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .maybeSingle();

  if (error || !product) {
    return { error: "Produit introuvable pour la négociation." };
  }

  const officialPrice = Number(product.price || 0);
  const offered = Number(offeredPrice || 0);
  const qty = Number.parseInt(String(quantity || "1"), 10) || 1;

  if (offered <= 0 || officialPrice <= 0) {
    return { error: "Montant invalide." };
  }

  // 1. Si le vendeur a désactivé le marchandage
  if (!settings.negotiation_enabled) {
    return {
      accepted: false,
      counter_offer: officialPrice,
      original_price: officialPrice,
      product_id: product.id,
      product_name: product.name,
      message: `Les prix chez ${seller.name} sont fixes et calculés au plus juste (${formatCfa(officialPrice)}). Nous ne proposons pas de réduction sur cet article, mais nous garantissons la qualité et une livraison rapide !`,
    };
  }

  // 2. Calcul du pourcentage de réduction configuré par le vendeur
  const maxDiscountPct = (qty >= 3 ? settings.bulk_discount_pct : settings.max_discount_pct) / 100;
  const floorPrice = Math.round(officialPrice * (1 - maxDiscountPct));

  // Si le client propose déjà un prix supérieur ou égal au prix officiel
  if (offered >= officialPrice) {
    return {
      accepted: true,
      agreed_price: officialPrice,
      product_id: product.id,
      product_name: product.name,
      message: `Le prix officiel est de ${formatCfa(officialPrice)}. Nous pouvons valider votre commande dès maintenant !`,
    };
  }

  // Si le prix proposé est dans la fourchette acceptable configurée
  if (offered >= floorPrice) {
    const discountAmount = officialPrice - offered;
    return {
      accepted: true,
      agreed_price: offered,
      original_price: officialPrice,
      discount_amount: discountAmount,
      product_id: product.id,
      product_name: product.name,
      message: `C'est d'accord pour ${formatCfa(offered)} par pièce ! Le patron valide cette remise de ${formatCfa(discountAmount)}. Souhaitez-vous que je valide la commande à ce prix ?`,
    };
  }

  // Si le prix proposé est trop bas → contre-proposition au prix plancher configuré
  return {
    accepted: false,
    counter_offer: floorPrice,
    original_price: officialPrice,
    product_id: product.id,
    product_name: product.name,
    message: `Le prix proposé (${formatCfa(offered)}) est un peu trop bas pour cet article (${formatCfa(officialPrice)}). Pour vous faire plaisir, le dernier prix que nous pouvons faire est ${formatCfa(floorPrice)}. Est-ce que cela vous convient ?`,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 : Tool reserve_with_deposit (Réservation personnalisable par le vendeur)
// Crée une réservation d'article avec versement d'acompte selon les paramètres vendeur
// ---------------------------------------------------------------------------
export async function reserveWithDeposit({
  seller,
  productId,
  quantity = 1,
  depositAmount = null,
  deliveryType = "DELIVERY",
  deliveryZone = "",
  customerName = "",
  customerPhone = "",
  clientId,
}) {
  if (!seller?.id || !productId || !clientId) {
    return { error: "Paramètres manquants pour la réservation." };
  }

  const settings = parseLocalCommerceSettings(seller);

  // Si le vendeur a désactivé la réservation par acompte
  if (!settings.deposit_enabled) {
    return {
      error: `La réservation avec acompte n'est pas activée chez ${seller.name}. Vous pouvez régler à la livraison ou payer en totalité en ligne.`,
    };
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock_quantity")
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .maybeSingle();

  if (!product) return { error: "Produit introuvable." };

  const qty = Number(quantity || 1);
  const unitPrice = Number(product.price || 0);
  const totalItems = unitPrice * qty;

  // Calcul de l'acompte selon la configuration vendeur (ex: 30%, min 2000 F CFA)
  const minDepositPct = settings.min_deposit_pct / 100;
  const minDepositAmount = settings.min_deposit_amount;
  const recommendedDeposit = Math.min(totalItems, Math.max(minDepositAmount, Math.round(totalItems * minDepositPct)));
  const deposit = depositAmount ? Math.min(totalItems, Math.max(1000, Number(depositAmount))) : recommendedDeposit;

  // Crée la commande avec note d'acompte
  const orderRes = await createOrderFromBot({
    seller,
    productId,
    quantity: qty,
    unitPrice,
    paymentMethod: "DEPOSIT",
    depositAmount: deposit,
    deliveryType,
    deliveryZone,
    customerName,
    customerPhone,
    clientId,
  });

  if (orderRes.error) return orderRes;

  // Génère le lien de paiement Paystack pour l'acompte uniquement
  const paymentRes = await getPaymentLink({
    orderId: orderRes.order_id,
    amount: deposit,
    customerName,
    clientId,
    seller,
  });

  const remaining = orderRes.total_amount - deposit;

  return {
    order_id: orderRes.order_id,
    order_ref: orderRes.order_ref,
    deposit_amount: deposit,
    deposit_formatted: formatCfa(deposit),
    remaining_balance: remaining,
    remaining_formatted: formatCfa(remaining),
    payment_url: paymentRes?.payment_url || null,
    message: `Réservation #${orderRes.order_ref} enregistrée pour ${qty} × ${product.name}.\n\n` +
      `• Acompte à régler : ${formatCfa(deposit)}\n` +
      `• Solde à la livraison : ${formatCfa(remaining)}\n` +
      (paymentRes?.payment_url ? `• Lien pour verser l'acompte : ${paymentRes.payment_url}` : "• Paiement de l'acompte possible par Wave ou Orange Money."),
  };
}

// ---------------------------------------------------------------------------
// Phase 4 : Tool propose_product_exchange (Troc / Échange d'article personnalisé)
// ---------------------------------------------------------------------------
export async function proposeProductExchange({
  seller,
  clientItemDescription,
  desiredProductId = "",
  cashDifferenceOffered = 0,
  customerName = "",
  customerPhone = "",
  clientId,
  clientKey,
}) {
  if (!seller?.slug || !clientId || !clientItemDescription) {
    return { error: "Veuillez décrire l'article que vous proposez en échange." };
  }

  const settings = parseLocalCommerceSettings(seller);

  // Si le vendeur a désactivé le troc/échange
  if (!settings.exchange_enabled) {
    return {
      success: false,
      message: `${seller.name} ne fait pas de troc ni d'échange d'articles. Tous nos produits sont uniquement disponibles à la vente standard.`,
    };
  }

  let desiredProductName = "Un article du catalogue";
  if (desiredProductId) {
    const { data: p } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("id", desiredProductId)
      .eq("seller_id", seller.id)
      .maybeSingle();
    if (p) desiredProductName = p.name;
  }

  const diffText = Number(cashDifferenceOffered || 0) > 0
    ? ` + ajout de ${formatCfa(cashDifferenceOffered)}`
    : "";

  const exchangeSummary = `[PROPOSITION D'ÉCHANGE] Le client ${customerName || "Tikchop"} propose d'échanger : "${clientItemDescription}" contre "${desiredProductName}"${diffText}.`;

  // Insère dans la conversation pour que le vendeur soit immédiatement alerté
  await supabaseAdmin.from("messages").insert({
    contenu: exchangeSummary,
    client: clientKey || clientId,
    statut: "in",
    channel: "native",
    external_message_id: `native-exchange:${seller.slug}:${clientId}:${Date.now()}`,
    seller_slug: seller.slug,
    customer_phone: customerPhone || clientId,
    client_name: customerName || null,
  });

  const notesText = settings.exchange_notes ? `\n\n📌 Condition du vendeur : ${settings.exchange_notes}` : "";

  return {
    success: true,
    message: `Votre proposition d'échange pour « ${desiredProductName} » a bien été transmise à ${seller.name} !${notesText}\n\n` +
      `Conseil : Envoyez une photo claire de votre article ici (📷) pour que le vendeur puisse vérifier son état et vous répondre rapidement.`,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 : Tool propose_used_item_sale (Rachat / Reprise d'occasion personnalisé)
// ---------------------------------------------------------------------------
export async function proposeUsedItemSale({
  seller,
  itemDescription,
  askingPrice = 0,
  customerName = "",
  customerPhone = "",
  clientId,
  clientKey,
}) {
  if (!seller?.slug || !clientId || !itemDescription) {
    return { error: "Veuillez décrire l'article d'occasion que vous souhaitez proposer." };
  }

  const settings = parseLocalCommerceSettings(seller);

  // Si le vendeur a désactivé le rachat d'occasion
  if (!settings.used_items_enabled) {
    return {
      success: false,
      message: `${seller.name} ne fait pas de rachat ni de reprise d'articles d'occasion actuellement.`,
    };
  }

  const priceText = Number(askingPrice || 0) > 0 ? ` (Prix souhaité : ${formatCfa(askingPrice)})` : "";
  const resaleSummary = `[PROPOSITION VENTE OCCASION] Le client ${customerName || "Tikchop"} propose : "${itemDescription}"${priceText}.`;

  await supabaseAdmin.from("messages").insert({
    contenu: resaleSummary,
    client: clientKey || clientId,
    statut: "in",
    channel: "native",
    external_message_id: `native-resale:${seller.slug}:${clientId}:${Date.now()}`,
    seller_slug: seller.slug,
    customer_phone: customerPhone || clientId,
    client_name: customerName || null,
  });

  const notesText = settings.used_items_notes ? `\n\n📌 Précision du vendeur : ${settings.used_items_notes}` : "";

  return {
    success: true,
    message: `Votre article d'occasion a bien été soumis à ${seller.name} ! Le vendeur va étudier votre offre.${notesText}\n\n` +
      `N'hésitez pas à envoyer des photos (📷) sous différents angles pour accélérer la réponse.`,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 : Tool get_pickup_points (Point de retrait & boutique physique personnalisés)
// ---------------------------------------------------------------------------
export async function getPickupPoints(seller) {
  if (!seller?.id) return { message: "Boutique introuvable." };

  const settings = parseLocalCommerceSettings(seller);

  if (!settings.pickup_enabled) {
    return {
      pickup_enabled: false,
      message: `${seller.name} ne propose pas de retrait sur place actuellement. Seule la livraison à domicile ou au bureau est disponible.`,
    };
  }

  const address = settings.pickup_address || seller.physical_address || seller.address || seller.bot_delivery_notes || "Adresse communiquée sur confirmation de commande.";
  const city = seller.city || "Abidjan";

  return {
    pickup_enabled: true,
    address,
    city,
    message: `Retrait en boutique disponible chez ${seller.name} :\n\n` +
      `📍 Lieu : ${address}${city ? ` (${city})` : ""}\n` +
      `⏰ Horaires & retrait : Dès confirmation de commande, vos articles sont préparés pour retrait sans frais de livraison.`,
  };
}


// ---------------------------------------------------------------------------
// Tool : get_payment_link
// Génère un lien de paiement Paystack pour une commande native.
// ---------------------------------------------------------------------------
export async function getPaymentLink({ orderId, amount, customerName, clientId, seller }) {
  if (!orderId || !amount || !clientId) {
    return { error: "Paramètres de paiement manquants." };
  }

  // Email fictif mais valide pour Paystack
  const email = `client-${String(clientId).slice(0, 20)}@native.tikchop.app`;
  const amountNum = Number(amount);

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { error: "Montant invalide." };
  }

  try {
    const tx = await initializeTransaction({
      email,
      amount: amountNum,
      metadata: {
        order_id: orderId,
        seller_slug: seller?.slug || "",
        customer_name: customerName || "",
        channel: "native",
      },
    });

    // Enregistre la référence Paystack sur la commande (best-effort)
    if (tx?.reference) {
      await supabaseAdmin
        .from("orders")
        .update({ paystack_reference: tx.reference, payment_method: "PAYSTACK" })
        .eq("id", orderId);
    }

    return {
      payment_url: tx.authorization_url,
      reference: tx.reference,
      message: `Lien de paiement Paystack (Wave, Orange, MTN, Djamo) : ${tx.authorization_url}`,
    };
  } catch (err) {
    console.error("[native-bot] getPaymentLink error:", err.message);
    return {
      error: "Paiement en ligne indisponible pour le moment. Choisissez paiement à la livraison ou contactez le vendeur.",
    };
  }
}

// ---------------------------------------------------------------------------
// Tool : get_delivery_zones
// Liste les zones de livraison actives du vendeur.
// ---------------------------------------------------------------------------
export async function getDeliveryZones(seller) {
  if (!seller?.id) return { zones: [], message: "Boutique introuvable." };

  const deliveryEnabled = seller.delivery_enabled !== false;
  const pickupEnabled = seller.pickup_enabled !== false;

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .select("name, fee, is_active")
    .eq("seller_id", seller.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const zones = (error ? [] : data || []).map((z) => ({
    name: z.name,
    fee: z.fee,
    fee_formatted: formatCfa(z.fee),
  }));

  const lines = [];
  if (deliveryEnabled) {
    if (zones.length > 0) {
      lines.push("Zones de livraison :");
      for (const z of zones) lines.push(`  • ${z.name} — ${z.fee_formatted}`);
    } else if (Number(seller.fixed_delivery_fee || 0) > 0) {
      lines.push(`Livraison disponible — frais fixes : ${formatCfa(seller.fixed_delivery_fee)}`);
    } else {
      lines.push("Livraison disponible (frais à confirmer avec le vendeur).");
    }
  }
  if (pickupEnabled) lines.push("Retrait en boutique possible.");
  if (!lines.length) lines.push("La livraison est à confirmer directement avec le vendeur.");

  return {
    zones,
    delivery_enabled: deliveryEnabled,
    pickup_enabled: pickupEnabled,
    fixed_delivery_fee: seller.fixed_delivery_fee || 0,
    message: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Tool : handoff_to_seller
// Met le bot en pause et signale au vendeur qu'une reprise manuelle est demandée.
// ---------------------------------------------------------------------------
export async function handoffToSeller({ seller, clientId, clientKey, reason = "" }) {
  if (!seller?.slug || !clientId) return { error: "Paramètres manquants." };

  // INSERT un message human_pause (même mécanique que le WhatsApp)
  await supabaseAdmin.from("messages").insert({
    contenu: reason
      ? `[Handoff] Client demande un vendeur : ${reason}`
      : "[Handoff] Client demande à parler à un vendeur.",
    client: clientKey || clientId,
    statut: "human_pause",
    channel: "native",
    external_message_id: `native-handoff:${seller.slug}:${clientId}:${Date.now()}`,
    seller_slug: seller.slug,
    customer_phone: clientId,
  });

  return {
    paused: true,
    message: `Je vous mets en relation avec l'équipe ${seller.name}. Un conseiller va vous répondre ici sous peu.`,
  };
}

// ---------------------------------------------------------------------------
// Phase 3 : uploadChatMedia (Cloudinary)
// Upload une image ou un audio sur Cloudinary
// ---------------------------------------------------------------------------
export async function uploadChatMedia({ base64, mimeType = "image/jpeg" }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret || !base64) {
    return null;
  }

  try {
    const { createHash } = await import("node:crypto");
    const timestamp = Math.round(Date.now() / 1000);
    const isAudio = mimeType.startsWith("audio/");
    const resourceType = isAudio ? "video" : "image";
    const publicId = `tikchop/chat-media/${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const formData = new FormData();
    const dataUri = `data:${mimeType};base64,${base64}`;
    formData.append("file", dataUri);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("public_id", publicId);
    formData.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.warn("[uploadChatMedia] Cloudinary upload failed:", await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
    };
  } catch (err) {
    console.warn("[uploadChatMedia] Error:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 3 : transcribeAudio (Gemini Audio)
// Transcrit un message vocal audio (webm, mp4, ogg, wav) en texte français
// ---------------------------------------------------------------------------
export async function transcribeAudio({ base64, mimeType = "audio/webm" }) {
  if (!GEMINI_API_KEY || !base64) return "";

  try {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            {
              text: "Transcris fidèlement ce message audio en français (y compris expressions ivoiriennes et termes locaux comme 'combien ça coûte', 'livraison', 'dispo', 'pointure', etc.). Retourne UNIQUEMENT le texte transcrit, sans ponctuation superflue ni commentaire.",
            },
          ],
        },
      ],
      generation_config: {
        temperature: 0.1,
        max_output_tokens: 300,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn("[transcribeAudio] Gemini error:", await res.text().catch(() => ""));
      return "";
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } catch (err) {
    console.warn("[transcribeAudio] Error:", err.message);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Phase 3 : analyzeScreenshot (Gemini Vision)
// Analyse une capture d'écran / photo et la compare au catalogue de la boutique
// ---------------------------------------------------------------------------
export async function analyzeScreenshot({ seller, base64, mimeType = "image/jpeg", userText = "" }) {
  if (!GEMINI_API_KEY || !base64 || !seller?.id) return null;

  try {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock_quantity")
      .eq("seller_id", seller.id)
      .eq("is_active", true)
      .limit(30);

    const catalogSummary = (products || [])
      .map((p) => `- ${p.name} (ID: ${p.id}) : ${formatCfa(p.price)} [${Number(p.stock_quantity || 0) > 0 ? `En stock: ${p.stock_quantity}` : "Rupture"}]`)
      .join("\n");

    const prompt = `Tu es l'assistant de la boutique "${seller.name}".
Le client vient d'envoyer cette photo / capture d'écran d'un article.
${userText ? `Message du client : "${userText}"` : ""}

=== CATALOGUE DE LA BOUTIQUE ===
${catalogSummary || "Catalogue vide actuellement."}

=== INSTRUCTIONS ===
1. Décris brièvement le produit visible sur l'image (type, couleur, modèle).
2. Compare avec les produits du catalogue ci-dessus.
3. Si un produit correspond : indique son nom, son prix exact et sa disponibilité (en stock ou non). Propose de passer commande.
4. Si aucun produit ne correspond exactement : indique que cet article précis n'est pas au catalogue, mais propose l'article le plus proche ou invite à demander au vendeur.
5. Sois chaleureux, concis et direct (maximum 3 à 4 phrases).`;

    const url = `${GEMINI_API_BASE}/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generation_config: {
        temperature: 0.2,
        max_output_tokens: 450,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18_000),
    });

    if (!res.ok) {
      console.warn("[analyzeScreenshot] Gemini error:", await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    console.warn("[analyzeScreenshot] Error:", err.message);
    return null;
  }
}

