"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  UserRound,
  Video,
} from "lucide-react";
import {
  getSellerWhatsAppConversations,
  pauseBotForCustomer,
  resumeBotForCustomer,
  sendSellerManualReply,
} from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getCustomerResponseTemplates } from "../../lib/customer-response-playbook";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatDateTime(value) {
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

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function getConversationTitle(conversation) {
  return conversation?.customer_name || conversation?.display_phone || "Client WhatsApp";
}

function getPreview(conversation) {
  if (conversation?.last_message?.text) return conversation.last_message.text;
  if (conversation?.last_message?.media) return getMediaLabel(conversation.last_message.media);
  if (conversation?.last_order) return `Commande ${conversation.last_order.order_ref || conversation.last_order.id?.slice(0, 8)}`;
  return "Aucune discussion visible pour le moment.";
}

function getMediaLabel(media) {
  if (!media) return "Piece jointe";
  if (media.type === "image") return "Photo client";
  if (media.type === "audio") return "Vocal client";
  if (media.type === "video") return "Video client";
  return media.name || "Document client";
}

function getConversationStats(conversation) {
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

function getConversationAction(conversation) {
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

function buildCustomerForTemplates(conversation) {
  const orderCount = conversation?.orders?.length || 0;

  return {
    ...conversation,
    lastOrder: conversation?.last_order,
    orderCount,
    isLoyal: orderCount >= 2,
  };
}

function getDefaultResponseTemplates(sellerName) {
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

function getTemplateToneClasses(tone) {
  if (tone === "success") return "bg-emerald-50 text-emerald-900 ring-emerald-100";
  if (tone === "warning") return "bg-amber-50 text-amber-900 ring-amber-100";
  if (tone === "danger") return "bg-rose-50 text-rose-900 ring-rose-100";
  if (tone === "info") return "bg-sky-50 text-sky-900 ring-sky-100";
  if (tone === "soft") return "bg-white text-[var(--text-main)] ring-[rgba(191,206,197,0.62)]";
  return "bg-[#07120d] text-white ring-[#07120d]";
}

export default function MessagesPage() {
  const seller = useActiveSeller();
  const [conversations, setConversations] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("ALL");

  const fetchConversations = useCallback(async function fetchConversations() {
    if (!seller.slug) {
      setConversations([]);
      setSelectedKey("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const data = await getSellerWhatsAppConversations(seller.slug, token);
      setConversations(data || []);
      setSelectedKey((current) => (
        (data || []).some((conversation) => conversation.key === current) ? current : data?.[0]?.key || ""
      ));
    } catch (err) {
      console.error("Messages fetch error:", err);
      setError(friendlyError(err, "Les discussions ne se chargent pas. Reessayez dans quelques secondes."));
    } finally {
      setLoading(false);
    }
  }, [seller.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchConversations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchConversations]);

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byText = !needle ? conversations : conversations.filter((conversation) => [
      conversation.customer_name,
      conversation.display_phone,
      conversation.last_message?.text,
      conversation.last_order?.order_ref,
      conversation.last_order?.delivery_zone,
    ].join(" ").toLowerCase().includes(needle));

    return byText.filter((conversation) => {
      const stats = getConversationStats(conversation);
      if (inboxFilter === "WAITING") return !conversation.bot_paused && stats.inbound > 0;
      if (inboxFilter === "HUMAN") return conversation.bot_paused;
      if (inboxFilter === "ORDERS") return Boolean(conversation.last_order || (conversation.orders || []).length > 0);
      return true;
    });
  }, [conversations, inboxFilter, query]);

  const selectedConversation = useMemo(() => (
    conversations.find((conversation) => conversation.key === selectedKey) || filteredConversations[0] || null
  ), [conversations, filteredConversations, selectedKey]);

  async function refreshAfterAction(message) {
    await fetchConversations();
    if (message) setNotice(message);
  }

  async function pauseBot(conversation) {
    if (!conversation?.customer_phone) return;
    try {
      setBusy("pause");
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      await pauseBotForCustomer(seller.slug, conversation.customer_phone, token);
      await refreshAfterAction("Vous avez la main. Le bot ne repond plus a ce client pour le moment.");
    } catch (err) {
      setError(friendlyError(err, "Impossible de reprendre la main sur cette discussion."));
    } finally {
      setBusy("");
    }
  }

  async function resumeBot(conversation) {
    if (!conversation?.customer_phone) return;
    try {
      setBusy("resume");
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      await resumeBotForCustomer(seller.slug, conversation.customer_phone, token);
      await refreshAfterAction("Bot reactive pour ce client.");
    } catch (err) {
      setError(friendlyError(err, "Impossible de reactiver le bot."));
    } finally {
      setBusy("");
    }
  }

  async function sendReply() {
    if (!selectedConversation?.customer_phone || !reply.trim()) return;
    try {
      setBusy("send");
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      await sendSellerManualReply(seller.slug, selectedConversation.customer_phone, reply, token);
      setReply("");
      await refreshAfterAction("Message envoye. Tikchop vous laisse la main sur cette conversation.");
    } catch (err) {
      setError(friendlyError(err, "Message non envoye. Verifiez que WhatsApp est connecte."));
    } finally {
      setBusy("");
    }
  }

  const showChatOnMobile = Boolean(selectedConversation && mobileChatOpen);
  const waitingCount = conversations.filter((conversation) => !conversation.bot_paused && getConversationStats(conversation).inbound > 0).length;
  const pausedCount = conversations.filter((conversation) => conversation.bot_paused).length;
  const orderConversationCount = conversations.filter((conversation) => conversation.last_order || (conversation.orders || []).length > 0).length;

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:max-w-[1180px]">
      <header className={`mobile-top ${showChatOnMobile ? "hidden md:block" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[#008f5a]">Boite clients</p>
            <h1 className="mt-1 font-display text-3xl font-black leading-10 text-[#07120d]">Messages</h1>
          </div>
          <button onClick={fetchConversations} className="app-icon-button bg-[#07120d] text-white" aria-label="Actualiser les discussions">
            <RefreshCw className={loading ? "animate-spin" : ""} size={19} />
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`mt-4 rounded-[22px] p-4 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#eafff1] text-[#005f3d] ring-1 ring-emerald-200"}`}>
          {error || notice}
        </div>
      )}

      <main className="mt-5 grid gap-4 md:grid-cols-[370px_minmax(0,1fr)]">
        <section className={`${showChatOnMobile ? "hidden md:block" : ""}`}>
          <MobileMessagesFocus
            total={conversations.length}
            waitingCount={waitingCount}
            pausedCount={pausedCount}
            orderCount={orderConversationCount}
            onFilter={setInboxFilter}
          />
          <div className="overflow-hidden rounded-[26px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
            <label className="flex min-h-[50px] items-center gap-2 border-b border-[#07120d]/8 px-4">
              <Search size={17} className="shrink-0 text-[#008f5a]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#07120d] outline-none placeholder:text-[#07120d]/35"
                placeholder="Rechercher un client..."
              />
            </label>
            <div className="px-3 py-2">
            <InboxFilterRail
              value={inboxFilter}
              onChange={setInboxFilter}
              counts={{
                ALL: conversations.length,
                WAITING: waitingCount,
                HUMAN: pausedCount,
                ORDERS: orderConversationCount,
              }}
            />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {loading ? (
              <LoadingState />
            ) : filteredConversations.length === 0 ? (
              <EmptyMessages />
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationCard
                  key={conversation.key}
                  conversation={conversation}
                  active={selectedConversation?.key === conversation.key}
                  onClick={() => {
                    setSelectedKey(conversation.key);
                    setMobileChatOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </section>

        <ChatPanel
          conversation={selectedConversation}
          sellerName={seller.name}
          reply={reply}
          setReply={setReply}
          busy={busy}
          mobileOpen={showChatOnMobile}
          onBack={() => setMobileChatOpen(false)}
          onSend={sendReply}
          onPause={pauseBot}
          onResume={resumeBot}
        />
      </main>
    </div>
  );
}

function MobileMessagesFocus({ total, waitingCount, pausedCount, orderCount, onFilter }) {
  const title = total === 0
    ? "Aucun client a lire"
    : waitingCount > 0
      ? `${waitingCount} client${waitingCount > 1 ? "s" : ""} a lire`
      : pausedCount > 0
        ? `${pausedCount} client${pausedCount > 1 ? "s" : ""} a vous`
        : orderCount > 0
          ? `${orderCount} vente${orderCount > 1 ? "s" : ""} a suivre`
          : "Tout est calme";
  const body = total === 0
    ? "Aucun message pour l'instant."
    : waitingCount > 0
      ? "Une reponse peut debloquer la vente."
      : pausedCount > 0
        ? "Le bot attend votre feu vert."
        : orderCount > 0
          ? "Suivez les ventes en cours."
          : "Rien d'urgent.";

  return (
    <section className="mb-3 overflow-hidden rounded-[26px] bg-[#07120d] text-white md:hidden">
      <div className="p-4">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#39f58e]/80">Priorite</p>
        <h2 className="mt-1.5 font-display text-2xl font-black leading-7">{title}</h2>
        <p className="mt-1 text-sm font-bold leading-5 text-white/60">{body}</p>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-white/8 bg-white/8">
        <MobileMessageMetric label="A lire" value={waitingCount} onClick={() => onFilter("WAITING")} />
        <MobileMessageMetric label="A moi" value={pausedCount} onClick={() => onFilter("HUMAN")} />
        <MobileMessageMetric label="Ventes" value={orderCount || total} onClick={() => onFilter(orderCount > 0 ? "ORDERS" : "ALL")} />
      </div>
    </section>
  );
}

function InboxFilterRail({ value, onChange, counts }) {
  const items = [
    { key: "ALL", label: "Tous" },
    { key: "WAITING", label: "A lire" },
    { key: "HUMAN", label: "Vous" },
    { key: "ORDERS", label: "Ventes" },
  ];

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-black transition-colors ${
              active
                ? "bg-[#07120d] text-white"
                : "bg-white text-[#07120d] ring-1 ring-[#07120d]/10"
            }`}
          >
            {item.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[0.58rem] font-black ${active ? "bg-white/15 text-white" : "bg-[#008f5a]/10 text-[#008f5a]"}`}>
              {counts[item.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MobileMessageMetric({ label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="bg-[#07120d] p-3 text-center active:bg-white/5">
      <strong className="block font-display text-xl font-black leading-none text-white">{value}</strong>
      <small className="mt-1 block text-[0.6rem] font-black uppercase leading-3 text-white/55">{label}</small>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] bg-[#fbf9f4] p-6 text-center ring-1 ring-[#07120d]/8">
      <Loader2 className="animate-spin text-[#008f5a]" size={30} />
      <p className="mt-3 text-sm font-black text-[#07120d]/50">Chargement des discussions...</p>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="rounded-[24px] bg-[#fbf9f4] p-6 text-center ring-1 ring-[#07120d]/8">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#008f5a] shadow-sm">
        <MessageCircle size={26} />
      </span>
      <h2 className="mt-4 font-display text-xl font-black text-[#07120d]">Pas encore de discussion</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-[#07120d]/50">
        Les prochaines discussions apparaitront ici.
      </p>
    </div>
  );
}

function ConversationCard({ conversation, active, onClick }) {
  const lastOrder = conversation.last_order;
  const stats = getConversationStats(conversation);
  const action = getConversationAction(conversation);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] p-3 text-left ring-1 active:scale-[0.99] transition-colors ${
        active ? "bg-[#07120d] text-white ring-[#07120d]" : "bg-[#fbf9f4] text-[#07120d] ring-[#07120d]/8"
      }`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-white/10 text-[#39f58e]" : "bg-white text-[#008f5a] shadow-sm"}`}>
          <UserRound size={19} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-black">{action.title}</span>
          <span className={`mt-0.5 block truncate text-xs font-bold ${active ? "text-white/55" : "text-[#07120d]/50"}`}>
            {getConversationTitle(conversation)}
          </span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[0.63rem] font-black ${active ? "bg-white/12 text-white" : action.chipClass}`}>
          {action.label}
        </span>
      </div>
      <p className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-black leading-4 ${active ? "bg-white/8 text-white/75" : "bg-white text-[#008f5a] ring-1 ring-[#008f5a]/10"}`}>
        {action.detail}
      </p>
      <p className={`mt-2 line-clamp-2 text-xs font-semibold leading-4 ${active ? "text-white/60" : "text-[#07120d]/55"}`}>
        {getPreview(conversation)}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={`flex items-center gap-2 text-[0.65rem] font-bold ${active ? "text-white/40" : "text-[#07120d]/35"}`}>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} />
            {stats.inbound}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShoppingBag size={11} />
            {stats.orderCount}
          </span>
          {formatDateTime(conversation.last_at)}
        </span>
        {lastOrder && (
          <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${active ? "bg-white/10 text-white" : "bg-[#008f5a]/10 text-[#008f5a]"}`}>
            {lastOrder.status || "Commande"}
          </span>
        )}
      </div>
    </button>
  );
}

function ChatPanel({ conversation, sellerName, reply, setReply, busy, mobileOpen, onBack, onSend, onPause, onResume }) {
  if (!conversation) {
    return (
      <section className="hidden min-h-[560px] items-center justify-center rounded-[28px] bg-[#fbf9f4] p-8 text-center ring-1 ring-[#07120d]/8 md:flex">
        <div>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#008f5a] shadow-sm">
            <MessageCircle size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-black text-[#07120d]">Choisis une discussion</h2>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-5 text-[#07120d]/50">Touchez un client pour ouvrir la discussion.</p>
        </div>
      </section>
    );
  }

  const canReply = Boolean(cleanPhone(conversation.customer_phone));
  const lastOrder = conversation.last_order;
  const playbookTemplates = getCustomerResponseTemplates(buildCustomerForTemplates(conversation), {
    sellerName,
  });
  const responseTemplates = playbookTemplates.length ? playbookTemplates : getDefaultResponseTemplates(sellerName);
  const pauseHelp = conversation.bot_paused ? "Mode humain actif." : "Envoi = bot en pause.";

  return (
    <section className={`${mobileOpen ? "fixed flex" : "hidden"} inset-0 z-[220] flex-col bg-[#fbf9f4] md:static md:flex md:min-h-[640px] md:overflow-hidden md:rounded-[26px] md:bg-[#fbf9f4] md:ring-1 md:ring-[#07120d]/10`}>
      <div className="border-b border-[#07120d]/8 bg-[#fbf9f4] px-4 pb-3 pt-[calc(0.85rem+env(safe-area-inset-top,0px))] md:p-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="app-icon-button bg-white text-[#07120d] shadow-sm md:hidden" aria-label="Retour aux discussions">
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#008f5a] shadow-sm">
            <UserRound size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-black text-[#07120d]">{getConversationTitle(conversation)}</h2>
            <p className="mt-0.5 truncate text-xs font-bold text-[#07120d]/50">{conversation.display_phone || "Numero client inconnu"}</p>
          </div>
          <BotStatus paused={conversation.bot_paused} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => (conversation.bot_paused ? onResume(conversation) : onPause(conversation))}
            disabled={!canReply || busy === "pause" || busy === "resume"}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-xs font-black text-white disabled:opacity-50"
          >
            {busy === "pause" || busy === "resume" ? <Loader2 className="animate-spin" size={16} /> : conversation.bot_paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            {conversation.bot_paused ? "Rendre au bot" : "Prendre la main"}
          </button>
          <a
            href={canReply ? `tel:${cleanPhone(conversation.customer_phone)}` : undefined}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black no-underline ring-1 ${
              canReply ? "bg-white text-[#07120d] ring-[#07120d]/12" : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30 ring-transparent"
            }`}
          >
            <Phone size={15} />
            Appeler
          </a>
        </div>

        <SellerConversationHint paused={conversation.bot_paused} canReply={canReply} />
        <ConversationStatusStrip conversation={conversation} />
      </div>

      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
        {lastOrder && <OrderContext order={lastOrder} />}
        <QuickReplyRail templates={responseTemplates} onUseTemplate={setReply} />
        {(conversation.messages || []).length === 0 ? (
          <div className="rounded-[24px] bg-white p-5 text-center shadow-sm ring-1 ring-[rgba(191,206,197,0.42)]">
            <MessageCircle className="mx-auto text-[var(--primary)]" size={30} />
            <p className="mt-3 text-sm font-black text-[var(--text-main)]">Aucun message sauvegarde</p>
            <p className="mt-1 text-xs font-bold leading-4 text-[var(--text-dim)]">Tu peux quand meme envoyer un message si le numero client est connu.</p>
          </div>
        ) : (
          (conversation.messages || []).map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="border-t border-[#07120d]/8 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:p-4">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2 overflow-hidden rounded-[22px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10 p-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={canReply ? "Ecrire au client..." : "Numero client indisponible"}
            disabled={!canReply || busy === "send"}
            className="max-h-32 min-h-[46px] resize-none bg-transparent px-3 py-3 text-sm font-bold text-[#07120d] outline-none placeholder:text-[#07120d]/35 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canReply || !reply.trim() || busy === "send"}
            className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#008f5a] text-white shadow-sm disabled:opacity-40"
            aria-label="Envoyer le message"
          >
            {busy === "send" ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[0.68rem] font-bold leading-4 text-[#07120d]/40">
          {pauseHelp}
        </p>
      </div>
    </section>
  );
}

function SellerConversationHint({ paused, canReply }) {
  const content = !canReply
    ? {
      title: "Numero manquant",
      body: "Reponse bloquee.",
      className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    }
    : paused
      ? {
        title: "Mode humain actif",
        body: "Vous avez la main.",
        className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
      }
      : {
        title: "Bot actif",
        body: "Tikchop gere.",
        className: "bg-[#eafff5] text-[#005f3d] ring-1 ring-emerald-200",
      };

  return (
    <div className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-bold leading-4 ${content.className}`}>
      <p className="font-black">{content.title}</p>
      <p className="mt-0.5 opacity-75">{content.body}</p>
    </div>
  );
}

function ConversationStatusStrip({ conversation }) {
  const stats = getConversationStats(conversation);
  const items = [
    {
      label: "Mode",
      value: conversation.bot_paused ? "Vous" : "Auto",
      icon: Bot,
      className: conversation.bot_paused ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900",
    },
    {
      label: "Messages",
      value: `${stats.inbound}/${stats.outbound}`,
      icon: MessageCircle,
      className: "bg-[var(--surface-soft)] text-[var(--text-main)]",
    },
    {
      label: "Ventes",
      value: String(stats.orderCount),
      icon: ShoppingBag,
      className: "bg-[var(--surface-soft)] text-[var(--text-main)]",
    },
  ];

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={`min-w-0 rounded-2xl px-3 py-2 ${item.className}`}>
            <div className="flex items-center gap-1 text-[0.64rem] font-black uppercase tracking-[0.08em] opacity-70">
              <Icon size={12} />
              <span className="truncate">{item.label}</span>
            </div>
            <p className="mt-1 truncate font-display text-sm font-black">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function BotStatus({ paused }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-black ${
      paused ? "bg-amber-100 text-amber-800" : "bg-[#eafff5] text-[#005f3d]"
    }`}>
      {paused ? <PauseCircle size={13} /> : <CheckCircle2 size={13} />}
      {paused ? "Vous" : "Bot"}
    </span>
  );
}

function QuickReplyRail({ templates, onUseTemplate }) {
  if (!templates?.length) return null;

  return (
    <div className="overflow-hidden rounded-[22px] bg-[#fbf9f4] ring-1 ring-[#07120d]/8">
      <div className="flex items-center justify-between gap-3 border-b border-[#07120d]/8 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">
          <MessageCircle size={13} />
          Messages prets
        </p>
        <span className="text-[0.65rem] font-black text-[#07120d]/35">1 touche</span>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto p-3 pb-3">
        {templates.slice(0, 6).map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onUseTemplate(template.text)}
            className={`min-w-[136px] rounded-[18px] p-3 text-left text-xs font-black ring-1 active:scale-[0.98] ${getTemplateToneClasses(template.tone)}`}
          >
            <span className="block truncate font-display text-sm">{template.shortTitle || template.title}</span>
            <span className="mt-1 line-clamp-2 block text-[0.65rem] font-bold leading-4 opacity-70">{template.scenario || "Message pret"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderContext({ order }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  return (
    <div className="rounded-[24px] bg-[#07120d] p-4 text-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary-bright)]">
            <ShoppingBag size={15} />
            Vente liee
          </p>
          <p className="mt-2 font-display text-xl font-black">{order.order_ref || order.id?.slice(0, 8)?.toUpperCase()}</p>
          <p className="mt-1 text-xs font-bold text-white/58">{order.delivery_zone || order.delivery_address || "Livraison a confirmer"}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-black text-[var(--primary-bright)]">{formatPrice(total)}</p>
          <p className="mt-1 rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-black text-white">{order.status || "Statut"}</p>
          <Link href="/orders" className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[0.68rem] font-black text-[#07120d] no-underline">
            Voir vente
          </Link>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isOut = message.direction === "out";
  const isBot = message.direction === "bot";
  const hasText = Boolean(String(message.text || "").trim());
  return (
    <div className={`flex ${isOut || isBot ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-[24px] px-4 py-3 shadow-sm ${
        isOut
          ? "rounded-br-md bg-[var(--primary)] text-white"
          : isBot
            ? "rounded-br-md bg-[#07120d] text-white"
            : "rounded-bl-md bg-white text-[var(--text-main)] ring-1 ring-[rgba(191,206,197,0.42)]"
      }`}
      >
        {message.media && <MessageMedia media={message.media} dark={isOut || isBot} />}
        {hasText && <p className={`${message.media ? "mt-2" : ""} whitespace-pre-wrap text-sm font-semibold leading-5`}>{message.text}</p>}
        {!hasText && message.media?.caption && (
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-5">{message.media.caption}</p>
        )}
        <div className={`mt-2 flex items-center gap-1 text-[0.66rem] font-black ${isOut || isBot ? "text-white/58" : "text-[var(--outline)]"}`}>
          {isOut ? "Vous" : isBot ? "Bot" : "Client"}
          <span>-</span>
          <Clock3 size={11} />
          {formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

function MessageMedia({ media, dark }) {
  const commonText = dark ? "text-white/80" : "text-[var(--text-dim)]";
  const shell = dark ? "bg-white/12" : "bg-[var(--surface-soft)]";

  if (media.type === "image" && media.url) {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt={media.caption || "Photo envoyee par le client"} className="max-h-72 w-full min-w-40 object-cover" />
      </a>
    );
  }

  if (media.type === "audio" && media.url) {
    return (
      <div className={`rounded-2xl ${shell} p-3`}>
        <div className={`mb-2 flex items-center gap-2 text-xs font-black ${commonText}`}>
          <Mic size={15} />
          Vocal client
        </div>
        <audio controls src={media.url} className="w-full" />
      </div>
    );
  }

  if (media.type === "video" && media.url) {
    return (
      <video controls src={media.url} className="max-h-72 w-full min-w-40 rounded-2xl bg-black" />
    );
  }

  const Icon = media.type === "image" ? ImageIcon : media.type === "video" ? Video : FileText;
  return (
    <a
      href={media.url || undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-2xl ${shell} p-3 text-sm font-black no-underline ${dark ? "text-white" : "text-[var(--text-main)]"}`}
    >
      <Icon size={18} />
      <span className="min-w-0 truncate">{getMediaLabel(media)}</span>
    </a>
  );
}
