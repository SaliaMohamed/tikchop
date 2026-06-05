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
  const headerLabel = conversations.length > 0
    ? `${conversations.length} client${conversations.length > 1 ? "s" : ""}`
    : "Clients";

  return (
    <div className="app-shell mx-auto max-w-[430px] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:max-w-[1180px]">
      <header className={`${showChatOnMobile ? "hidden md:block" : ""} hidden md:block`}>
        <div className="flex items-center justify-between gap-3 px-1 pt-1 md:px-0 md:pt-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#07120d] text-[#39f58e] shadow-[0_12px_28px_rgb(7_18_13_/_0.12)]">
              <MessageCircle size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">WhatsApp</p>
              <h1 className="mt-0.5 truncate font-display text-xl font-black leading-6 text-[#07120d]">{headerLabel}</h1>
            </div>
          </div>
          <button onClick={fetchConversations} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#008f5a] shadow-[0_12px_28px_rgb(7_18_13_/_0.06)] ring-1 ring-[#07120d]/8" aria-label="Actualiser les discussions">
            <RefreshCw className={loading ? "animate-spin" : ""} size={19} />
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`mt-4 rounded-[22px] p-4 text-sm font-bold leading-5 ${error ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-[#eafff1] text-[#005f3d] ring-1 ring-emerald-200"}`}>
          {error || notice}
        </div>
      )}

      <main className="mt-2 grid min-w-0 gap-4 md:mt-4 md:grid-cols-[370px_minmax(0,1fr)]">
        <section className={`${showChatOnMobile ? "hidden md:block" : ""} min-w-0`}>
          <div className="max-w-full overflow-hidden rounded-[30px] bg-white shadow-[0_12px_32px_rgb(7_18_13_/_0.055)] ring-1 ring-[#07120d]/8">
            <label className="flex min-h-[52px] items-center gap-2 border-b border-[#07120d]/6 px-4">
              <Search size={17} className="shrink-0 text-[#008f5a]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[0.95rem] font-bold text-[#07120d] outline-none placeholder:text-[#07120d]/32"
                placeholder="Chercher un client"
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

            <div className="min-w-0 divide-y divide-[#07120d]/6 border-t border-[#07120d]/6">
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

function InboxFilterRail({ value, onChange, counts }) {
  const items = [
    { key: "ALL", label: "Tous" },
    { key: "WAITING", label: "Lire" },
    { key: "HUMAN", label: "Moi" },
    { key: "ORDERS", label: "Vente" },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex min-h-[38px] min-w-0 items-center justify-center gap-1 rounded-[15px] px-1 text-[0.68rem] font-black transition-colors ${
              active
                ? "bg-[#07120d] text-white shadow-[0_10px_20px_rgb(7_18_13_/_0.12)]"
                : "bg-[#f5fbf7] text-[#07120d] ring-1 ring-[#07120d]/6"
            }`}
          >
            <span>{item.label}</span>
            <span className={`rounded-full px-1 py-0.5 text-[0.55rem] font-black ${active ? "bg-white/18 text-white" : "bg-[#008f5a]/10 text-[#008f5a]"}`}>
              {counts[item.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center bg-white p-6 text-center">
      <Loader2 className="animate-spin text-[#008f5a]" size={30} />
      <p className="mt-3 text-sm font-black text-[#07120d]/50">Chargement...</p>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#008f5a] shadow-sm">
        <MessageCircle size={26} />
      </span>
      <h2 className="mt-4 font-display text-xl font-black text-[#07120d]">Aucun client</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-[#07120d]/50">Les messages arriveront ici.</p>
    </div>
  );
}

function ConversationCard({ conversation, active, onClick }) {
  const lastOrder = conversation.last_order;
  const action = getConversationAction(conversation);
  const total = Number(lastOrder?.total_amount || 0) + Number(lastOrder?.delivery_fee || 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3.5 text-left transition-colors active:bg-[#f2fbf6] ${
        active ? "bg-[#f2fbf6]" : "bg-white"
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${
          active ? "bg-[#07120d] text-[#39f58e]" : "bg-[#f2fbf6] text-[#008f5a]"
        }`}>
          <UserRound size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.96rem] font-extrabold leading-5 text-[#07120d]">{getConversationTitle(conversation)}</span>
          <span className="mt-0.5 block truncate text-[0.78rem] font-semibold text-[#07120d]/48">
            {lastOrder ? `Vente ${lastOrder.order_ref || lastOrder.id?.slice(0, 8)}` : getPreview(conversation)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[0.56rem] font-black ${action.chipClass}`}>
            {action.label}
          </span>
          {lastOrder && (
            <span className="text-xs font-black text-[#008f5a]">{formatPrice(total)}</span>
          )}
        </span>
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
  const pauseHelp = conversation.bot_paused ? "Mode humain." : "Envoi = bot pause.";

  return (
    <section className={`${mobileOpen ? "fixed flex" : "hidden"} inset-0 z-[220] flex-col bg-[#efeae2] md:static md:flex md:min-h-[640px] md:overflow-hidden md:rounded-[26px] md:bg-[#efeae2] md:ring-1 md:ring-[#07120d]/10`}>
      <div className="border-b border-[#07120d]/8 bg-[#f0f2f5] px-3 pb-2.5 pt-[calc(0.7rem+env(safe-area-inset-top,0px))] md:p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] md:hidden" aria-label="Retour aux discussions">
            <ArrowLeft size={20} />
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-[#008f5a]">
            <UserRound size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1rem] font-extrabold leading-5 text-[#111b21]">{getConversationTitle(conversation)}</h2>
            <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-[#667781]">{conversation.display_phone || "Numero inconnu"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canReply && (
            <button
              type="button"
              onClick={() => (conversation.bot_paused ? onResume(conversation) : onPause(conversation))}
              disabled={busy === "pause" || busy === "resume"}
              className="flex h-9 min-w-12 items-center justify-center gap-1 rounded-full bg-white px-2 text-[0.7rem] font-extrabold text-[#008f5a] shadow-sm disabled:opacity-50"
            >
              {busy === "pause" || busy === "resume" ? <Loader2 className="animate-spin" size={14} /> : conversation.bot_paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              {conversation.bot_paused ? "Bot" : "Moi"}
            </button>
            )}
            {canReply && (
            <a
              href={`tel:${cleanPhone(conversation.customer_phone)}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#54656f] no-underline shadow-sm"
              aria-label="Appeler"
            >
              <Phone size={16} />
            </a>
            )}
          </div>
        </div>

        {!canReply && <SellerConversationHint paused={conversation.bot_paused} canReply={canReply} />}
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto bg-[#efeae2] px-3 py-3 md:px-5">
        {lastOrder && <OrderContext order={lastOrder} />}
        {(conversation.messages || []).length === 0 ? (
          <div className="mx-auto mt-4 max-w-[78%] rounded-[16px] bg-[#fff6c4] px-4 py-3 text-center text-[#54656f] shadow-[0_1px_1px_rgba(17,27,33,0.12)]">
            <MessageCircle className="mx-auto text-[var(--primary)]" size={30} />
            <p className="mt-2 text-sm font-extrabold text-[#111b21]">{canReply ? "Pret a repondre" : "Numero manquant"}</p>
            <p className="mt-1 text-xs font-semibold leading-4">{canReply ? "Ecrivez en bas." : "Completez la vente."}</p>
          </div>
        ) : (
          (conversation.messages || []).map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="bg-[#f0f2f5] p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] md:p-3">
        {canReply && <QuickReplyRail templates={responseTemplates} onUseTemplate={setReply} compact />}
        <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={canReply ? "Message..." : "Numero indisponible"}
            disabled={!canReply || busy === "send"}
            className="max-h-32 min-h-[44px] resize-none rounded-[22px] bg-white px-4 py-3 text-[0.92rem] font-medium leading-5 text-[#111b21] shadow-sm outline-none placeholder:text-[#667781]/70 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canReply || !reply.trim() || busy === "send"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#008f5a] text-white shadow-sm disabled:bg-[#b9c7bf] disabled:opacity-70"
            aria-label="Envoyer le message"
          >
            {busy === "send" ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-1 px-2 text-[0.64rem] font-semibold leading-4 text-[#667781]">
          {pauseHelp}
        </p>
      </div>
    </section>
  );
}

function SellerConversationHint({ paused, canReply }) {
  const content = !canReply
    ? {
      title: "Numero a completer",
      body: "La vente reste consultable.",
      className: "bg-white text-[#07120d] ring-1 ring-[#07120d]/8",
    }
    : paused
      ? {
        title: "Vous repondez",
        body: "Le bot attend.",
        className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
      }
      : {
        title: "Bot actif",
        body: "Tikchop suit.",
        className: "bg-[#eafff5] text-[#005f3d] ring-1 ring-emerald-200",
      };

  return (
    <div className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-bold leading-4 ${content.className}`}>
      <p className="font-black">{content.title}</p>
      <p className="mt-0.5 opacity-75">{content.body}</p>
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

function QuickReplyRail({ templates, onUseTemplate, compact = false }) {
  if (!templates?.length) return null;

  return (
    <div className={`no-scrollbar flex gap-1.5 overflow-x-auto ${compact ? "pb-0.5" : ""}`}>
        {templates.slice(0, 6).map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onUseTemplate(template.text)}
            className={`min-h-[34px] shrink-0 rounded-full px-3 text-[0.72rem] font-bold ring-1 active:scale-[0.98] ${getTemplateToneClasses(template.tone)}`}
          >
            {template.shortTitle || template.title}
          </button>
        ))}
    </div>
  );
}

function OrderContext({ order }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  return (
    <div className="mx-auto w-full max-w-[92%] rounded-[14px] bg-white/90 p-3 text-[#111b21] shadow-[0_1px_1px_rgba(17,27,33,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.08em] text-[#008f5a]">
            <ShoppingBag size={15} />
            Vente
          </p>
          <p className="mt-1 text-[1rem] font-extrabold">{order.order_ref || order.id?.slice(0, 8)?.toUpperCase()}</p>
          <p className="mt-0.5 text-xs font-semibold text-[#667781]">{order.delivery_zone || order.delivery_address || "Livraison a confirmer"}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.95rem] font-extrabold text-[#008f5a]">{formatPrice(total)}</p>
          <Link href="/orders" className="mt-2 inline-flex rounded-full bg-[#eafff3] px-3 py-1.5 text-[0.68rem] font-extrabold text-[#008f5a] no-underline">
            Voir
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
      <div className={`max-w-[82%] px-3 py-2 shadow-[0_1px_1px_rgba(17,27,33,0.12)] ${
        isOut
          ? "rounded-[12px] rounded-br-sm bg-[#d9fdd3] text-[#111b21]"
          : isBot
            ? "rounded-[12px] rounded-br-sm bg-[#e7f8ee] text-[#111b21]"
            : "rounded-[12px] rounded-bl-sm bg-white text-[#111b21]"
      }`}
      >
        {message.media && <MessageMedia media={message.media} dark={isOut || isBot} />}
        {hasText && <p className={`${message.media ? "mt-2" : ""} whitespace-pre-wrap text-[0.92rem] font-medium leading-5`}>{message.text}</p>}
        {!hasText && message.media?.caption && (
          <p className="mt-2 whitespace-pre-wrap text-[0.92rem] font-medium leading-5">{message.media.caption}</p>
        )}
        <div className="mt-1 flex items-center justify-end gap-1 text-[0.62rem] font-semibold text-[#667781]">
          {isOut ? "Vous" : isBot ? "Bot" : "Client"}
          <span>·</span>
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
