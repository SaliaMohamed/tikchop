export function formatCfa(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

export function isKnownPhone(phoneNumber) {
  const raw = String(phoneNumber || "").trim();
  return Boolean(raw) && raw.toUpperCase() !== "UNKNOWN" && cleanPhone(raw).length >= 8;
}

export function buildWhatsappHref(phoneNumber, message) {
  const phone = cleanPhone(phoneNumber);
  if (!phone || !message) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function getOrderRef(order) {
  return order?.order_ref || order?.id?.slice(0, 8)?.toUpperCase() || "TIKCHOP";
}

export function getOrderTotal(order) {
  return Number(order?.total_amount || 0) + Number(order?.delivery_fee || 0);
}

function daysSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function getOrderItems(order) {
  return order?.order_items || [];
}

export function getOrderItemsSummary(order) {
  const items = getOrderItems(order);
  if (items.length === 0) return "Article Tikchop";

  return items
    .slice(0, 2)
    .map((item) => `${item.quantity || 1} x ${item.products?.name || "Article"}`)
    .join(", ");
}

export function getOrderItemsText(order) {
  const items = getOrderItems(order);
  if (items.length === 0) return "- Articles dans la commande";

  return items
    .map((item) => `- ${item.quantity || 1} x ${item.products?.name || "Article"}`)
    .join("\n");
}

export function getReceiptUrl(order, origin = "") {
  if (!order?.id || !origin) return "";
  return `${origin}/receipt?order=${order.id}`;
}

export function getDeliverySummary(order) {
  if (order?.delivery_type === "PICKUP") return "Retrait boutique";

  const zone = order?.delivery_zone || "";
  const address = order?.delivery_address || "";
  const fee = Number(order?.delivery_fee || 0);
  const feeText = fee > 0 ? ` - Livraison: ${formatCfa(fee)}` : "";

  if (zone && address) return `${zone}, ${address}${feeText}`;
  if (zone) return `${zone}${feeText}`;
  if (address) return `${address}${feeText}`;
  return `Adresse a confirmer${feeText}`;
}

export function getPaymentSummary(order) {
  if (order?.status === "PAID" || order?.payment_method === "PAYSTACK") return "Paiement produit confirme";
  if (order?.payment_method === "CASH_ON_DELIVERY") return "Paiement a la livraison, a encaisser a la remise";
  if (order?.payment_method === "WAVE") return "Paiement Wave a confirmer";
  if (order?.payment_method === "ORANGE_MONEY") return "Paiement Orange Money a confirmer";
  if (order?.payment_method === "MTN_MONEY") return "Paiement MTN Money a confirmer";
  return "Paiement a confirmer";
}

export function buildDriverShareMessage(order, { sellerName = "Tikchop", origin = "" } = {}) {
  const deliveryFee = Number(order?.delivery_fee || 0);
  const deliveryText = deliveryFee > 0 ? `${formatCfa(deliveryFee)} à encaisser` : "Aucun frais";
  const receiptUrl = getReceiptUrl(order, origin);
  const receiptLine = receiptUrl ? `\nReçu client: ${receiptUrl}` : "";

  return `FICHE LIVRAISON TIKCHOP

Boutique: ${sellerName || "Tikchop"}
Commande: ${getOrderRef(order)}

Client: ${order?.customer_phone || "Non renseigné"}
Zone: ${order?.delivery_zone || "Non renseignée"}
Adresse: ${order?.delivery_address || "Non renseignée"}

Articles:
${getOrderItemsText(order)}

Livraison: ${deliveryText}
Paiement produit: ${order?.payment_method === "CASH_ON_DELIVERY" ? "À ENCAISSER À LA LIVRAISON" : order?.status === "PAID" || order?.payment_method === "PAYSTACK" ? "PAYE" : "À vérifier"}
Total commande: ${formatCfa(getOrderTotal(order))}
${receiptLine}

Quand c'est livré, informe la boutique.`;
}

export function getOrderCaseNotes(order, { hasDrivers = true } = {}) {
  const notes = [];

  if (!isKnownPhone(order?.customer_phone)) {
    notes.push({
      id: "missing-phone",
      title: "Numéro client manquant",
      body: "Impossible d'envoyer WhatsApp directement. Demande ou complète le numéro avant la livraison.",
    });
  }

  if (order?.delivery_type !== "PICKUP" && !order?.delivery_zone && !order?.delivery_address) {
    notes.push({
      id: "missing-address",
      title: "Adresse à confirmer",
      body: "Avant d'emballer, demande commune, quartier, point de repère et heure de réception.",
    });
  }

  if (order?.status === "PENDING") {
    notes.push({
      id: "pending-payment",
      title: "Commande pas encore confirmée",
      body: "Confirme disponibilité, adresse et paiement avant de bloquer le stock trop longtemps.",
    });
  }

  if ((order?.status === "PREPARED" || order?.delivery_status === "READY") && order?.delivery_type !== "PICKUP" && !order?.delivery_driver_id) {
    notes.push({
      id: "driver-needed",
      title: "Livreur à assigner",
      body: hasDrivers ? "Choisissez un livreur ou partagez la fiche manuellement." : "Ajoutez un livreur dans Livraison pour accélérer les prochaines commandes.",
    });
  }

  if (order?.status === "CANCELLED") {
    notes.push({
      id: "cancelled",
      title: "Commande annulée",
      body: "Propose un remplacement si l'article revient ou remets le stock en vente si besoin.",
    });
  }

  if (notes.length === 0) {
    notes.push({
      id: "clear",
      title: "Aucun blocage visible",
      body: "La commande peut avancer normalement. Garde le client informé à chaque étape.",
    });
  }

  return notes;
}

export function getOrderResponseTemplates(order, { sellerName = "Tikchop", origin = "" } = {}) {
  const ref = getOrderRef(order);
  const total = formatCfa(getOrderTotal(order));
  const delivery = getDeliverySummary(order);
  const payment = getPaymentSummary(order);
  const receiptUrl = getReceiptUrl(order, origin);
  const receiptLine = receiptUrl ? `\nReçu: ${receiptUrl}` : "";
  const shopName = sellerName || "Tikchop";
  const templates = [];

  if (order?.delivery_type !== "PICKUP" && (!order?.delivery_zone || !order?.delivery_address)) {
    templates.push({
      id: "ask-address",
      shortTitle: "Adresse",
      title: "Demander l'adresse",
      scenario: "Adresse ou commune manquante",
      tone: "warning",
      priority: 1,
      text: `Bonjour, c'est ${shopName}. Pour finaliser votre commande ${ref}, envoyez-moi s'il vous plaît:

1. Commune
2. Quartier
3. Point de repere
4. Heure de réception

Total actuel: ${total}`,
    });
  }

  if (order?.status === "PENDING") {
    templates.push({
      id: "confirm-order",
      shortTitle: "Confirmer",
      title: "Confirmer la commande",
      scenario: "Commande reçue, détails à valider",
      tone: "primary",
      priority: 2,
      text: `Bonjour, c'est ${shopName}. Votre commande ${ref} est bien reçue.

Articles:
${getOrderItemsText(order)}

Livraison: ${delivery}
Paiement: ${payment}
Total: ${total}

Confirmez-vous la commande maintenant ?`,
    });

    templates.push({
      id: "payment-instructions",
      shortTitle: "Paiement",
      title: "Envoyer instructions paiement",
      scenario: "Paiement manuel ou à vérifier",
      tone: "soft",
      priority: 4,
      text: `Bonjour, pour valider la commande ${ref}, le total est ${total}.

Mode choisi: ${payment}
Livraison: ${delivery}

Après paiement, envoyez la preuve ici. Nous emballons la commande juste après confirmation.`,
    });
  }

  if (order?.status === "PAID") {
    templates.push({
      id: "paid-preparing",
      shortTitle: "Emballage",
      title: "Paiement reçu, emballage",
      scenario: "Commande confirmée",
      tone: "success",
      priority: 2,
      text: `Bonjour, votre paiement pour la commande ${ref} est confirmé.

Nous emballons maintenant:
${getOrderItemsText(order)}

Livraison: ${delivery}
Total: ${total}${receiptLine}`,
    });
  }

  if (order?.status === "PREPARED" || order?.delivery_status === "READY") {
    templates.push({
      id: "ready-delivery",
      shortTitle: "Livraison",
      title: "Commande prête",
      scenario: "Colis prêt pour livreur",
      tone: "info",
      priority: 2,
      text: `Bonjour, votre commande ${ref} est prête.

Livraison: ${delivery}
Total: ${total}

Confirmez votre disponibilité pour recevoir le livreur s'il vous plaît.${receiptLine}`,
    });
  }

  if (order?.status === "DELIVERED") {
    templates.push({
      id: "thank-you",
      shortTitle: "Merci",
      title: "Remercier après livraison",
      scenario: "Commande livrée",
      tone: "success",
      priority: 2,
      text: `Bonjour, merci pour votre achat chez ${shopName}.

Commande ${ref} livrée: ${getOrderItemsSummary(order)}

Si l'article vous plait, je peux aussi vous envoyer les nouveautes avant publication.`,
    });
  }

  if (order?.status === "CANCELLED") {
    templates.push({
      id: "cancelled",
      shortTitle: "Annulée",
      title: "Répondre après annulation",
      scenario: "Commande annulée ou article indisponible",
      tone: "danger",
      priority: 2,
      text: `Bonjour, la commande ${ref} est annulée pour le moment.

Si vous voulez, je peux vous proposer un article similaire ou vous prevenir quand celui-ci revient.`,
    });
  }

  if (receiptUrl) {
    templates.push({
      id: "receipt",
      shortTitle: "Reçu",
      title: "Envoyer le reçu",
      scenario: "Client demande une preuve",
      tone: "soft",
      priority: 8,
      text: `Bonjour, voici le reçu de votre commande ${ref}:
${receiptUrl}

Total: ${total}
Merci pour votre confiance.`,
    });
  }

  return templates.sort((a, b) => a.priority - b.priority);
}

export function getBestOrderResponse(order, context = {}) {
  return getOrderResponseTemplates(order, context)[0] || null;
}

export function getCustomerResponseTemplates(customer, context = {}) {
  const templates = getOrderResponseTemplates(customer?.lastOrder, context);
  const shopName = context.sellerName || "Tikchop";

  if (customer?.isLoyal) {
    templates.push({
      id: "loyal-new-items",
      shortTitle: "VIP",
      title: "Nouveautés client fidèle",
      scenario: "Client qui achète souvent",
      tone: "success",
      priority: 3,
      text: `Bonjour, c'est ${shopName}. Je vous écris en priorité parce que vous faites partie de nos meilleurs clients.

J'ai de nouveaux articles disponibles. Voulez-vous que je vous envoie une petite sélection ?`,
    });
  }

  if (customer?.orderCount === 1) {
    templates.push({
      id: "first-buyer",
      shortTitle: "2e achat",
      title: "Transformer premier achat",
      scenario: "Client qui a acheté une seule fois",
      tone: "soft",
      priority: 5,
      text: `Bonjour, c'est ${shopName}. Merci encore pour votre premier achat.

Je peux vous envoyer les nouveautés ou vous aider à trouver une taille/couleur précise.`,
    });
  }

  const lastAge = daysSince(customer?.lastOrder?.created_at);
  if (lastAge >= 14) {
    templates.push({
      id: "winback",
      shortTitle: "Retour",
      title: "Relance douce",
      scenario: "Client inactif depuis plusieurs jours",
      tone: "warning",
      priority: 4,
      text: `Bonjour, c'est ${shopName}. J'espère que vous allez bien.

J'ai de nouveaux articles disponibles cette semaine. Voulez-vous recevoir les photos ?`,
    });
  }

  return templates.sort((a, b) => a.priority - b.priority);
}

export function getBestCustomerResponse(customer, context = {}) {
  return getCustomerResponseTemplates(customer, context)[0] || null;
}
