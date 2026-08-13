"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircle,
  PauseCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRound,
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
import {
  formatDateTime,
  formatPrice,
  getConversationTitle,
  getPreview,
  getConversationStats,
  getConversationAction,
} from "../../lib/messages-utils";
import { ChatPanel } from "./components/ChatPanel";

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
      const message = friendlyError(err, "Reconnectez-vous pour voir vos clients.");
      setError(/session vendeur/i.test(message) ? "Reconnectez-vous pour voir vos clients." : message);
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
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#2b2219] text-[#f0954c] shadow-[0_12px_28px_rgb(43_34_25_/_0.12)]">
              <MessageCircle size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">DJASSAMAN</p>
              <h1 className="mt-0.5 truncate font-display text-xl font-black leading-6 text-[#2b2219]">{headerLabel}</h1>
            </div>
          </div>
          <button onClick={fetchConversations} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#c2572b] shadow-[0_12px_28px_rgb(43_34_25_/_0.06)] ring-1 ring-[#2b2219]/8" aria-label="Actualiser les discussions">
            <RefreshCw className={loading ? "animate-spin" : ""} size={19} />
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`mt-3 rounded-[18px] px-3 py-2 text-xs font-black leading-4 ${error ? "bg-[#fdf3d6] text-[#7a5425] ring-1 ring-[#f4ce60]/45" : "bg-[#fbeee0] text-[#96451f] ring-1 ring-emerald-200"}`}>
          {error || notice}
        </div>
      )}

      <main className="mt-2 grid min-w-0 gap-4 md:mt-4 md:grid-cols-[370px_minmax(0,1fr)]">
        <section className={`${showChatOnMobile ? "hidden md:block" : ""} min-w-0`}>
          <div className="space-y-2.5">
            <label className="flex min-h-[50px] items-center gap-2 rounded-full bg-white px-4 shadow-[0_10px_24px_rgb(43_34_25_/_0.045)] ring-1 ring-[#2b2219]/7">
              <Search size={17} className="shrink-0 text-[#c2572b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[0.95rem] font-bold text-[#2b2219] outline-none placeholder:text-[#2b2219]/32"
                placeholder="Rechercher"
              />
            </label>
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

            <div className="min-w-0 overflow-hidden rounded-[26px] bg-white shadow-[0_12px_30px_rgb(43_34_25_/_0.05)] ring-1 ring-[#2b2219]/7">
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
    { key: "ALL", label: "Tous", icon: MessageCircle },
    { key: "WAITING", label: "Lire", icon: Search },
    { key: "HUMAN", label: "Moi", icon: PauseCircle },
    { key: "ORDERS", label: "Vente", icon: ShoppingBag },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((item) => {
        const active = value === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-label={item.label}
            title={item.label}
            className={`flex min-h-[40px] min-w-0 items-center justify-center gap-1 rounded-[15px] px-1 text-[0.66rem] font-black transition-colors ${
              active
                ? "bg-[#2b2219] text-white shadow-[0_10px_20px_rgb(43_34_25_/_0.12)]"
                : "bg-white text-[#2b2219] ring-1 ring-[#2b2219]/7"
            }`}
          >
            <Icon size={15} />
            <span className="min-w-0 truncate">{item.label}</span>
            <span className={`rounded-full px-1 py-0.5 text-[0.55rem] font-black ${active ? "bg-white/18 text-white" : "bg-[#c2572b]/10 text-[#c2572b]"}`}>
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
      <Loader2 className="animate-spin text-[#c2572b]" size={30} />
      <p className="mt-3 text-sm font-black text-[#2b2219]/50">Chargement...</p>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#fbf6ee] rounded-[24px] border border-[#2b2219]/5 shadow-[0_2px_16px_rgba(13,23,18,0.03)] my-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c2572b]/10 text-[#c2572b] mb-4">
        <Bot size={28} />
      </div>
      <h3 className="font-display text-xl font-bold text-[#2b2219]">Aucun message encore</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#2b2219]/60 max-w-[280px]">
        Vos conversations WhatsApp apparaissent ici quand les clients ecrivent a votre boutique. DJASSAMAN repond automatiquement.
      </p>
      <Link href="/crm" className="mt-6 flex min-h-[50px] w-full max-w-[260px] items-center justify-center gap-2 rounded-xl bg-[#c2572b] text-sm font-extrabold text-white transition active:scale-[0.98] shadow-[0_12px_24px_rgba(0,143,90,0.15)] no-underline">
        <Bot size={16} />
        Connecter WhatsApp
      </Link>
    </div>
  );
}

function ConversationCard({ conversation, active, onClick }) {
  const lastOrder = conversation.last_order;
  const action = getConversationAction(conversation);
  const total = Number(lastOrder?.total_amount || 0) + Number(lastOrder?.delivery_fee || 0);
  const lastTime = conversation.last_message?.created_at || lastOrder?.created_at || conversation.updated_at;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-[#2b2219]/5 px-3.5 py-3 text-left transition-colors last:border-b-0 active:bg-[#f7f0e4] ${
        active ? "bg-[#f7f0e4]" : "bg-white"
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
          active ? "bg-[#2b2219] text-[#f0954c]" : "bg-[#f7f0e4] text-[#c2572b]"
        }`}>
          <UserRound size={18} />
          {conversation.bot_paused && (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-white" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.96rem] font-black leading-5 text-[#2b2219]">{getConversationTitle(conversation)}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.78rem] font-semibold text-[#2b2219]/50">
            {lastOrder ? <ShoppingBag size={13} className="shrink-0 text-[#c2572b]" /> : null}
            <span className="min-w-0 truncate">{lastOrder ? `Vente ${formatPrice(total)}` : getPreview(conversation)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[0.64rem] font-bold text-[#2b2219]/35">{formatDateTime(lastTime).split(",").pop()?.trim() || ""}</span>
          <span className={`rounded-full px-2 py-0.5 text-[0.56rem] font-black ${action.chipClass}`}>
            {action.label}
          </span>
        </span>
      </div>
    </button>
  );
}


