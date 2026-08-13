/**
 * Messages/conversation helpers (pure functions).
 */
export function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatDateTime(value) {
  if (!value) return "Maintenant";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export function getConversationTitle(conversation) {
  return conversation?.customer_name || conversation?.display_phone || "Client WhatsApp";
}

export function getPreview(conversation) {
  if (conversation?.last_message?.text) return conversation.last_message.text;
  if (conversation?.last_message?.media) return getMediaLabel(conversation.last_message.media);
  if (conversation?.last_order) return `Commande ${conversation.last_order.order_ref || conversation.last_order.id?.slice(0, 8)}`;
  return "Aucune discussion visible pour le moment.";
}

export function getMediaLabel(media) {
  if (!media) return "Piece jointe";
  if (media.type === "image") return "Photo client";
  if (media.type === "audio") return "Vocal client";
  if (media.type === "video") return "Video client";
  return media.name || "Document client";
}

export function getConversationStats(conversation) {
  const messages = conversation?.messages || [];
  const orders = conversation?.orders || [];
  const inbound = Number(conversation?.inbound_count || messages.filter((message) => message.direction === "in").length || 0);
  const outbound = messages.filter((message) => message.direction === "out" || message.direction === "bot").length;

  return {
    inbound,
    outbound,
    orderCount: orders.length,
  };
}

export function getConversationAction(conversation) {
  const stats = getConversationStats(conversation);

  if (conversation?.bot_paused) {
    return {
      label: "A vous",
      title: "Vous avez la main",
      detail: "Repondez, puis rendez au bot.",
      chipClass: "bg-amber-100 text-amber-800",
    };
  }

  if (stats.inbound > 0) {
    return {
      label: "A lire",
      title: "Client a lire",
      detail: "Ouvrez et verifiez si le bot a besoin d'aide.",
      chipClass: "bg-[var(--primary-bright)] text-[#06100a]",
    };
  }

  if (conversation?.last_order || stats.orderCount > 0) {
    return {
      label: "Vente",
      title: "Vente a suivre",
      detail: "Controlez le statut et la livraison.",
      chipClass: "bg-sky-100 text-sky-800",
    };
  }

  return {
    label: "Auto",
    title: "Bot actif",
    detail: "Tikchop surveille cette discussion.",
    chipClass: "bg-emerald-100 text-emerald-800",
  };
}

export function buildCustomerForTemplates(conversation) {
  const orderCount = conversation?.orders?.length || 0;

  return {
    ...conversation,
    lastOrder: conversation?.last_order,
    orderCount,
    isLoyal: orderCount >= 2,
  };
}

export function getDefaultResponseTemplates(sellerName) {
  const shopName = sellerName || "Tikchop";

  return [
    {
      id: "ask-product-photo",
      shortTitle: "Photo article",
      scenario: "Client demande un article",
      tone: "primary",
      text: `Bonjour, c'est ${shopName}. Envoyez-moi la photo ou le nom de l'article qui vous interesse. Je verifie la disponibilite tout de suite.`,
    },
    {
      id: "ask-size",
      shortTitle: "Taille",
      scenario: "Preciser taille ou couleur",
      tone: "soft",
      text: "Quelle taille ou couleur souhaitez-vous ? Je confirme la disponibilite avant de valider la commande.",
    },
    {
      id: "ask-delivery",
      shortTitle: "Livraison",
      scenario: "Adresse a completer",
      tone: "warning",
      text: "Pour la livraison, envoyez-moi votre commune, quartier, point de repere et heure de reception.",
    },
  ];
}

export function getTemplateToneClasses(tone) {
  if (tone === "success") return "bg-emerald-50 text-emerald-900 ring-emerald-100";
  if (tone === "warning") return "bg-amber-50 text-amber-900 ring-amber-100";
  if (tone === "danger") return "bg-rose-50 text-rose-900 ring-rose-100";
  if (tone === "info") return "bg-sky-50 text-sky-900 ring-sky-100";
  if (tone === "soft") return "bg-white text-[var(--text-main)] ring-[rgba(191,206,197,0.62)]";
  return "bg-[#07120d] text-white ring-[#07120d]";
}