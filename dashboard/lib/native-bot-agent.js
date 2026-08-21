/**
 * Djassaman natif — orchestrateur IA Gemini (Phase 2).
 * Remplace le bot menu-rapide par un agent Gemini avec tool-calling.
 *
 * Stratégie :
 *   1. Charge l'historique (20 derniers messages) depuis Supabase.
 *   2. Construit le prompt système personnalisé par boutique.
 *   3. Appelle Gemini generateContent en mode function calling AUTO.
 *   4. Boucle d'exécution des tools (max 3 tours).
 *   5. Retourne la réponse texte finale.
 *   6. Fallback sur le menu-rapide Phase 1 si Gemini est indisponible.
 */

import { supabaseAdmin } from "./supabase-admin";
import { formatCfa } from "../app/lib/actions/formatters";
import { parseLocalCommerceSettings } from "./local-commerce";
import { CHANNEL_NATIVE } from "../app/lib/actions/channels";
import {
  searchProduct,
  getProductDetail,
  createOrderFromBot,
  negotiatePrice,
  reserveWithDeposit,
  proposeProductExchange,
  proposeUsedItemSale,
  getPickupPoints,
  getPaymentLink,
  getDeliveryZones,
  handoffToSeller,
} from "./native-bot-tools";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_TOOL_TURNS = 5;
const HISTORY_LIMIT = 20;

// ---------------------------------------------------------------------------
// Définitions des tools (Gemini function declarations)
// ---------------------------------------------------------------------------

const TOOL_DECLARATIONS = [
  {
    name: "search_product",
    description:
      "Cherche des produits dans le catalogue de la boutique par mot-clé. Utilise ce tool quand le client demande un article, veut voir le catalogue, ou donne le nom d'un produit.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Mot-clé ou nom du produit à chercher (ex: robe, sneakers, iPhone).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_detail",
    description:
      "Obtient le détail complet d'un produit : prix exact, stock, description. Utilise l'ID retourné par search_product.",
    parameters: {
      type: "OBJECT",
      properties: {
        product_id: {
          type: "STRING",
          description: "ID UUID du produit.",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "negotiate_price",
    description:
      "Négocie le prix d'un produit (marchandage). Utilise ce tool quand le client demande un rabais, propose un prix inférieur ou demande le 'dernier prix'. Ne valide jamais un rabais sans appeler ce tool.",
    parameters: {
      type: "OBJECT",
      properties: {
        product_id: {
          type: "STRING",
          description: "ID UUID du produit concerné.",
        },
        offered_price: {
          type: "NUMBER",
          description: "Prix proposé par le client en F CFA.",
        },
        quantity: {
          type: "NUMBER",
          description: "Quantité demandée (optionnel, défaut 1).",
        },
      },
      required: ["product_id", "offered_price"],
    },
  },
  {
    name: "create_order",
    description:
      "Crée une commande pour le client. Appelle ce tool quand le client confirme son achat (avec prix standard ou négocié).",
    parameters: {
      type: "OBJECT",
      properties: {
        product_id: {
          type: "STRING",
          description: "ID UUID du produit à commander.",
        },
        quantity: {
          type: "NUMBER",
          description: "Quantité souhaitée (entier positif).",
        },
        unit_price: {
          type: "NUMBER",
          description: "Prix unitaire validé en F CFA (si un prix négocié a été accepté).",
        },
        payment_method: {
          type: "STRING",
          enum: ["CASH_ON_DELIVERY", "WAVE", "ORANGE_MONEY", "MTN_MONEY", "PAYSTACK", "DEPOSIT"],
          description: "Mode de règlement choisi par le client.",
        },
        delivery_type: {
          type: "STRING",
          enum: ["DELIVERY", "PICKUP"],
          description: "Mode de récupération : DELIVERY (livraison) ou PICKUP (retrait en boutique).",
        },
        delivery_zone: {
          type: "STRING",
          description: "Zone ou commune de livraison (optionnel, ex: Cocody, Yopougon).",
        },
        customer_name: {
          type: "STRING",
          description: "Prénom ou nom du client pour la commande.",
        },
        customer_phone: {
          type: "STRING",
          description: "Numéro de téléphone du client (si précisé dans la discussion).",
        },
      },
      required: ["product_id", "quantity", "delivery_type"],
    },
  },
  {
    name: "reserve_with_deposit",
    description:
      "Réserve un produit avec versement d'acompte (le reste est payé à la livraison). Utilise ce tool quand le client veut bloquer ou réserver un article avec acompte.",
    parameters: {
      type: "OBJECT",
      properties: {
        product_id: {
          type: "STRING",
          description: "ID UUID du produit à réserver.",
        },
        quantity: {
          type: "NUMBER",
          description: "Quantité à réserver.",
        },
        deposit_amount: {
          type: "NUMBER",
          description: "Montant de l'acompte souhaité en F CFA (optionnel).",
        },
        delivery_type: {
          type: "STRING",
          enum: ["DELIVERY", "PICKUP"],
          description: "DELIVERY ou PICKUP.",
        },
        delivery_zone: {
          type: "STRING",
          description: "Commune de livraison.",
        },
        customer_name: {
          type: "STRING",
          description: "Nom du client.",
        },
        customer_phone: {
          type: "STRING",
          description: "Téléphone du client.",
        },
      },
      required: ["product_id", "quantity"],
    },
  },
  {
    name: "propose_product_exchange",
    description:
      "Enregistre une proposition de troc ou d'échange de produit (avec ou sans soulte/différence financière).",
    parameters: {
      type: "OBJECT",
      properties: {
        client_item_description: {
          type: "STRING",
          description: "Description de l'article proposé par le client en échange.",
        },
        desired_product_id: {
          type: "STRING",
          description: "ID UUID du produit du catalogue souhaité en retour (optionnel).",
        },
        cash_difference_offered: {
          type: "NUMBER",
          description: "Montant supplémentaire ajouté en F CFA (optionnel).",
        },
        customer_name: {
          type: "STRING",
          description: "Nom du client.",
        },
      },
      required: ["client_item_description"],
    },
  },
  {
    name: "propose_used_item_sale",
    description:
      "Permet au client de proposer un article d'occasion pour rachat ou reprise par la boutique.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_description: {
          type: "STRING",
          description: "Description de l'article d'occasion proposé.",
        },
        asking_price: {
          type: "NUMBER",
          description: "Prix demandé par le client en F CFA (optionnel).",
        },
        customer_name: {
          type: "STRING",
          description: "Nom du client.",
        },
      },
      required: ["item_description"],
    },
  },
  {
    name: "get_pickup_points",
    description:
      "Donne l'adresse de la boutique physique et les consignes pour le retrait gratuit sur place.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_payment_link",
    description:
      "Génère un lien de paiement Paystack (Wave, Orange Money, MTN MoMo, Djamo) pour une commande créée. Appelle ce tool après create_order si le client veut payer en ligne.",
    parameters: {
      type: "OBJECT",
      properties: {
        order_id: {
          type: "STRING",
          description: "ID UUID de la commande (retourné par create_order).",
        },
        amount: {
          type: "NUMBER",
          description: "Montant total en F CFA (retourné par create_order).",
        },
        customer_name: {
          type: "STRING",
          description: "Prénom ou nom du client.",
        },
      },
      required: ["order_id", "amount"],
    },
  },
  {
    name: "get_delivery_zones",
    description:
      "Liste les zones de livraison actives et leurs frais. Utilise ce tool quand le client demande les frais de livraison, les zones, ou les options de livraison.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: [],
    },
  },
  {
    name: "handoff_to_seller",
    description:
      "Met le bot en pause et transfère la conversation à un vendeur humain.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description: "Raison du transfert (optionnel).",
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Chargement de l'historique (mémoire bornée)
// ---------------------------------------------------------------------------

async function loadHistory(slug, clientId) {
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("contenu, statut, created_at")
    .eq("seller_slug", slug)
    .eq("channel", CHANNEL_NATIVE)
    .eq("customer_phone", clientId)
    .not("statut", "in", '("human_pause","followup")')
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error || !data) return [];

  return data
    .reverse()
    .map((row) => {
      const isBot = /bot|assistant|out|followup|vendeur|manual/.test(
        String(row.statut || "").toLowerCase()
      );
      return {
        role: isBot ? "model" : "user",
        parts: [{ text: String(row.contenu || "").trim() }],
      };
    })
    .filter((m) => m.parts[0].text.length > 0);
}

// ---------------------------------------------------------------------------
// Construction du prompt système
// ---------------------------------------------------------------------------

async function buildSystemPrompt(seller, slug) {
  const [productsResult, zonesResult] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, price, stock_quantity")
      .eq("seller_id", seller.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("delivery_zones")
      .select("name, fee")
      .eq("seller_id", seller.id)
      .eq("is_active", true)
      .limit(10),
  ]);

  const products = productsResult.data || [];
  const zones = zonesResult.data || [];

  const catalogSummary =
    products.length > 0
      ? products
          .slice(0, 10)
          .map((p) => {
            const stock = Number(p.stock_quantity || 0);
            return `- ${p.name} (ID: ${p.id}) : ${formatCfa(p.price)} (${stock > 0 ? `en stock: ${stock}` : "rupture"})`;
          })
          .join("\n")
      : "Aucun produit publié pour le moment.";

  const zonesSummary =
    zones.length > 0
      ? zones.map((z) => `- ${z.name} : ${formatCfa(z.fee)}`).join("\n")
      : seller.fixed_delivery_fee
        ? `Frais fixes : ${formatCfa(seller.fixed_delivery_fee)}`
        : "À confirmer avec le vendeur.";

  const settings = parseLocalCommerceSettings(seller);
  const tone = String(seller.bot_tone || "").trim() || "professionnel, commerçant et chaleureux";
  const greeting = String(seller.bot_greeting || "").trim();
  const paymentPrefs =
    String(seller.bot_payment_preferences || "").trim() ||
    "Paiement à la livraison (espèces), Wave, Orange Money, MTN MoMo, Djamo.";
  const deliveryNotes = String(seller.bot_delivery_notes || "").trim();

  // Instructions personnalisées de commerce local
  const negotiationInstruction = settings.negotiation_enabled
    ? `Marchandage autorisé : réduction max ${settings.max_discount_pct}% (${settings.bulk_discount_pct}% pour 3+ articles). Appelle TOUJOURS 'negotiate_price' pour évaluer la proposition.`
    : `Marchandage : NON AUTORISÉ par cette boutique. Les prix sont fixes et non négociables.`;

  const depositInstruction = settings.deposit_enabled
    ? `Réservation avec acompte : AUTORISÉE (acompte recommandé ${settings.min_deposit_pct}%, min ${formatCfa(settings.min_deposit_amount)}). Utilise 'reserve_with_deposit'.`
    : `Réservation avec acompte : NON AUTORISÉE. Propose le paiement standard ou à la livraison.`;

  const exchangeInstruction = settings.exchange_enabled
    ? `Troc & Échange : AUTORISÉ. Utilise 'propose_product_exchange'.${settings.exchange_notes ? ` (Règle du vendeur : ${settings.exchange_notes})` : ""}`
    : `Troc & Échange : NON AUTORISÉ. La boutique vend uniquement des articles neufs du catalogue.`;

  const usedItemsInstruction = settings.used_items_enabled
    ? `Rachat d'occasion : AUTORISÉ. Utilise 'propose_used_item_sale'.${settings.used_items_notes ? ` (Précision : ${settings.used_items_notes})` : ""}`
    : `Rachat d'occasion : NON AUTORISÉ.`;

  const pickupInstruction = settings.pickup_enabled
    ? `Retrait en boutique : DISPONIBLE (Lieu : ${settings.pickup_address || "En boutique"}). Utilise 'get_pickup_points'.`
    : `Retrait en boutique : NON DISPONIBLE (Uniquement livraison).`;

  return `Tu es Djassaman, l'assistant commercial de la boutique "${seller.name}" sur Tikchop.
Ton rôle : accueillir les clients, trouver des produits, négocier cordialement (marchandage local), enregistrer les commandes et gérer les livraisons / retraits.
Ton ton : ${tone} (style commerçant ivoirien poli, chaleureux et efficace).
Langue : réponds en français clair, concis (maximum 3 phrases par réponse sauf si listing produits).
${greeting ? `Message d'accueil de la boutique : ${greeting}` : ""}

=== CATALOGUE (aperçu) ===
${catalogSummary}

=== LIVRAISON & RETRAIT ===
${deliveryNotes || ""}
Zones et frais :
${zonesSummary}
• ${pickupInstruction}

=== PAIEMENTS ACCEPTÉS ===
${paymentPrefs}

=== CONFIGURATION COMMERCIALE DU VENDEUR ===
1. **Négociation** : ${negotiationInstruction}
2. **Acompte** : ${depositInstruction}
3. **Échange / Troc** : ${exchangeInstruction}
4. **Occasion** : ${usedItemsInstruction}
5. **Retrait sur place** : ${pickupInstruction}
6. **Paiement à la livraison** : C'est le mode le plus populaire. Propose toujours le paiement à la livraison (espèces) ou le paiement en ligne (Wave, Orange Money, Paystack).
7. **Photos & Vocaux** : Tu traites directement les photos envoyées (vérification stock) et les messages vocaux.
8. **Prise de commande** : Dès que le client est d'accord sur le produit et le prix, demande sa commune de livraison et son nom, puis appelle 'create_order'.
9. Sois toujours bienveillant, direct et orienté satisfaction client.`;
}

// ---------------------------------------------------------------------------
// Appel REST Gemini generateContent
// ---------------------------------------------------------------------------

async function callGemini({ systemInstruction, contents }) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquant.");

  const url = `${GEMINI_API_BASE}/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    tools: [{ function_declarations: TOOL_DECLARATIONS }],
    tool_config: { function_calling_config: { mode: "AUTO" } },
    generation_config: {
      temperature: 0.3,
      max_output_tokens: 512,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Dispatch des tools
// ---------------------------------------------------------------------------

async function executeTool(toolName, args, { seller, clientId, clientKey }) {
  switch (toolName) {
    case "search_product":
      return searchProduct(seller, args.query);

    case "get_product_detail":
      return getProductDetail(seller, args.product_id);

    case "negotiate_price":
      return negotiatePrice({
        seller,
        productId: args.product_id,
        offeredPrice: args.offered_price,
        quantity: args.quantity || 1,
      });

    case "create_order":
      return createOrderFromBot({
        seller,
        productId: args.product_id,
        quantity: args.quantity,
        unitPrice: args.unit_price || null,
        paymentMethod: args.payment_method || "CASH_ON_DELIVERY",
        deliveryType: args.delivery_type || "DELIVERY",
        deliveryZone: args.delivery_zone || "",
        customerName: args.customer_name || "",
        customerPhone: args.customer_phone || "",
        clientId,
      });

    case "reserve_with_deposit":
      return reserveWithDeposit({
        seller,
        productId: args.product_id,
        quantity: args.quantity || 1,
        depositAmount: args.deposit_amount || null,
        deliveryType: args.delivery_type || "DELIVERY",
        deliveryZone: args.delivery_zone || "",
        customerName: args.customer_name || "",
        customerPhone: args.customer_phone || "",
        clientId,
      });

    case "propose_product_exchange":
      return proposeProductExchange({
        seller,
        clientItemDescription: args.client_item_description,
        desiredProductId: args.desired_product_id || "",
        cashDifferenceOffered: args.cash_difference_offered || 0,
        customerName: args.customer_name || "",
        customerPhone: args.customer_phone || "",
        clientId,
        clientKey,
      });

    case "propose_used_item_sale":
      return proposeUsedItemSale({
        seller,
        itemDescription: args.item_description,
        askingPrice: args.asking_price || 0,
        customerName: args.customer_name || "",
        customerPhone: args.customer_phone || "",
        clientId,
        clientKey,
      });

    case "get_pickup_points":
      return getPickupPoints(seller);

    case "get_payment_link":
      return getPaymentLink({
        orderId: args.order_id,
        amount: args.amount,
        customerName: args.customer_name || "",
        clientId,
        seller,
      });

    case "get_delivery_zones":
      return getDeliveryZones(seller);

    case "handoff_to_seller":
      return handoffToSeller({
        seller,
        clientId,
        clientKey,
        reason: args.reason || "",
      });

    default:
      return { error: `Tool inconnu : ${toolName}` };
  }
}


// ---------------------------------------------------------------------------
// Extraction du texte / tool calls depuis la réponse Gemini
// ---------------------------------------------------------------------------

function extractGeminiParts(geminiResponse) {
  const candidate = geminiResponse?.candidates?.[0];
  if (!candidate) return { text: null, toolCalls: [] };

  const parts = candidate?.content?.parts || [];
  let text = null;
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) {
      text = (text || "") + part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return { text: text?.trim() || null, toolCalls };
}

// ---------------------------------------------------------------------------
// Orchestrateur principal
// ---------------------------------------------------------------------------

export async function runGeminiAgent({ seller, clientId, text, name, media = null }) {
  const clientKey = `${seller.slug} : ${name || ""} : ${clientId}@native`;

  // 1. Historique
  const history = await loadHistory(seller.slug, clientId);

  // 2. Prompt système
  const systemInstruction = await buildSystemPrompt(seller, seller.slug);

  // 3. Construction des parts utilisateur (multimodal image/audio si présent)
  const userParts = [];
  if (media?.base64 && media?.mimeType) {
    userParts.push({
      inline_data: {
        mime_type: media.mimeType,
        data: media.base64,
      },
    });
  }

  const promptText = String(text || "").trim();
  if (promptText) {
    userParts.push({ text: promptText });
  } else if (media?.type === "image") {
    userParts.push({ text: "Voici une capture d'écran / photo d'un produit. Est-il disponible et quel est son prix ?" });
  } else if (media?.type === "audio") {
    userParts.push({ text: "Écoute ce message vocal et réponds à ma demande." });
  } else {
    userParts.push({ text: "Bonjour" });
  }

  // 4. Construction du fil de conversation Gemini
  const contents = [
    ...history,
    { role: "user", parts: userParts },
  ];

  // 4. Boucle tool-calling (max MAX_TOOL_TURNS tours)
  let turn = 0;
  let currentContents = contents;

  while (turn < MAX_TOOL_TURNS) {
    turn++;

    let geminiResponse;
    try {
      geminiResponse = await callGemini({ systemInstruction, contents: currentContents });
    } catch (err) {
      console.error("[native-bot-agent] Gemini call failed:", err.message);
      return null; // Signale au caller de basculer sur le fallback
    }

    const { text: responseText, toolCalls } = extractGeminiParts(geminiResponse);

    // Pas de tool calls → réponse texte finale
    if (!toolCalls.length) {
      // Si handoff a déjà été exécuté dans ce tour, le message a déjà été inséré.
      // On retourne le texte tel quel.
      return responseText || "Je n'ai pas compris. Pouvez-vous reformuler ?";
    }

    // Exécution de tous les tool calls en parallèle
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        const result = await executeTool(tc.name, tc.args, { seller, clientId, clientKey });
        return {
          name: tc.name,
          result,
        };
      })
    );

    // Si handoff_to_seller a été appelé → on retourne le message immédiatement
    // (le bot est mis en pause, on ne boucle pas)
    const handoffResult = toolResults.find((r) => r.name === "handoff_to_seller");
    if (handoffResult?.result?.message) {
      return handoffResult.result.message;
    }

    // Construction des messages pour le prochain tour :
    // - model turn avec les functionCalls
    // - user turn avec les functionResponses
    const modelParts = toolCalls.map((tc) => ({
      functionCall: { name: tc.name, args: tc.args },
    }));

    const functionResponseParts = toolResults.map((r) => ({
      functionResponse: {
        name: r.name,
        response: r.result,
      },
    }));

    currentContents = [
      ...currentContents,
      { role: "model", parts: modelParts },
      { role: "user", parts: functionResponseParts },
    ];
  }

  // Dépassement MAX_TOOL_TURNS → on demande une réponse finale sans tools
  try {
    const finalResponse = await callGemini({
      systemInstruction,
      contents: [
        ...currentContents,
        {
          role: "user",
          parts: [
            {
              text: "Réponds maintenant directement au client avec les informations que tu as obtenues.",
            },
          ],
        },
      ],
    });
    const { text: finalText } = extractGeminiParts(finalResponse);
    return finalText || "Je suis là pour vous aider ! Posez-moi votre question.";
  } catch {
    return null; // Fallback
  }
}
