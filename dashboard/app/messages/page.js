"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  PauseCircle,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRound,
  Zap,
} from "lucide-react";
import {
  getSellerWhatsAppConversations,
  pauseBotForCustomer,
  resumeBotForCustomer,
  sendSellerManualReply,
} from "../actions";
import { getSellerWhatsAppConnection } from "../seller-actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  formatPrice,
  getConversationTitle,
  getPreview,
  getConversationStats,
} from "../../lib/messages-utils";
import { ChatPanel } from "./components/ChatPanel";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
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
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  useEffect(() => {
    if (!seller.slug) return;
    let alive = true;
    getSellerAccessToken()
      .then((token) => getSellerWhatsAppConnection(seller, token))
      .then((data) => {
        if (alive) setWhatsappConnected(Boolean(data?.isConnected));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [seller]);

  const fetchConversations = useCallback(
    async function fetchConversations() {
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
        setSelectedKey((current) =>
          (data || []).some((c) => c.key === current)
            ? current
            : data?.[0]?.key || ""
        );
      } catch (err) {
        console.error("Messages fetch error:", err);
        const message = friendlyError(
          err,
          "Reconnectez-vous pour voir vos messages."
        );
        setError(
          /session vendeur/i.test(message)
            ? "Reconnectez-vous pour voir vos messages."
            : message
        );
      } finally {
        setLoading(false);
      }
    },
    [seller.slug]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime Supabase pour la boîte de réception
  useEffect(() => {
    if (!seller.slug) return;
    let active = true;
    let channel = null;

    async function setupSellerRealtime() {
      try {
        const { supabase } = await import("../../lib/supabase");
        if (!supabase) return;

        channel = supabase
          .channel(`seller-inbox:${seller.slug}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `seller_slug=eq.${seller.slug}`,
            },
            () => {
              if (active) {
                fetchConversations();
              }
            }
          )
          .subscribe();
      } catch {
        // fallback
      }
    }

    setupSellerRealtime();

    return () => {
      active = false;
      if (channel) {
        channel.unsubscribe().catch(() => {});
      }
    };
  }, [seller.slug, fetchConversations]);

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byText = !needle
      ? conversations
      : conversations.filter((c) =>
          [
            c.customer_name,
            c.display_phone,
            c.last_message?.text,
            c.last_order?.order_ref,
            c.last_order?.delivery_zone,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        );

    return byText.filter((c) => {
      const stats = getConversationStats(c);
      if (inboxFilter === "NATIVE") return c.channel === "native";
      if (inboxFilter === "WHATSAPP") return c.channel === "whatsapp";
      if (inboxFilter === "WAITING") return !c.bot_paused && stats.inbound > 0;
      if (inboxFilter === "HUMAN") return c.bot_paused;
      if (inboxFilter === "ORDERS")
        return Boolean(c.last_order || (c.orders || []).length > 0);
      return true;
    });
  }, [conversations, inboxFilter, query]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((c) => c.key === selectedKey) ||
      filteredConversations[0] ||
      null,
    [conversations, filteredConversations, selectedKey]
  );

  async function refreshAfterAction(msg) {
    await fetchConversations();
    if (msg) setNotice(msg);
  }

  async function pauseBot(c) {
    if (!c?.customer_phone) return;
    try {
      setBusy("pause");
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      await pauseBotForCustomer(seller.slug, c.customer_phone, token);
      await refreshAfterAction("Mode humain activé. DJASSAMAN est en pause pour ce client.");
    } catch (err) {
      setError(friendlyError(err, "Impossible de prendre la main."));
    } finally {
      setBusy("");
    }
  }

  async function resumeBot(c) {
    if (!c?.customer_phone) return;
    try {
      setBusy("resume");
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      await resumeBotForCustomer(seller.slug, c.customer_phone, token);
      await refreshAfterAction("Assistant IA DJASSAMAN réactivé.");
    } catch (err) {
      setError(friendlyError(err, "Impossible de réactiver le bot."));
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
      await sendSellerManualReply(
        seller.slug,
        selectedConversation.customer_phone,
        reply,
        token
      );
      setReply("");
      await refreshAfterAction("Message envoyé au client.");
    } catch (err) {
      setError(friendlyError(err, "Message non envoyé."));
    } finally {
      setBusy("");
    }
  }

  const showChatOnMobile = Boolean(selectedConversation && mobileChatOpen);
  const nativeCount = conversations.filter((c) => c.channel === "native").length;
  const whatsappCount = conversations.filter((c) => c.channel === "whatsapp").length;
  const waitingCount = conversations.filter(
    (c) => !c.bot_paused && getConversationStats(c).inbound > 0
  ).length;

  return (
    <div className="mx-auto max-w-6xl pb-24 md:pb-6">
      {/* Notifications / Alertes */}
      {(error || notice) && (
        <div
          className={`mb-3 rounded-2xl px-4 py-2.5 text-xs font-bold ${
            error
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
              : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
          }`}
        >
          {error || notice}
        </div>
      )}

      <main className="grid min-w-0 gap-3 md:grid-cols-[380px_minmax(0,1fr)]">
        {/* ── Liste des discussions (Style WhatsApp) ── */}
        <section
          className={`${
            showChatOnMobile ? "hidden md:block" : "block"
          } overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80`}
        >
          {/* Header Inbox */}
          <div className="border-b border-zinc-100 p-3.5 pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-black text-zinc-900">
                  Discussions
                </h1>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {conversations.length}
                </span>
              </div>
              <button
                type="button"
                onClick={fetchConversations}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 active:scale-95"
                aria-label="Actualiser"
              >
                <RefreshCw
                  className={loading ? "animate-spin text-emerald-600" : ""}
                  size={14}
                />
              </button>
            </div>

            {/* Barre de recherche WhatsApp */}
            <div className="mt-3 flex items-center gap-2 rounded-full bg-zinc-100 px-3.5 py-2">
              <Search size={15} className="shrink-0 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder="Rechercher un client ou commande..."
              />
            </div>

            {/* Filtres d'onglets */}
            <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <FilterChip
                label="Tous"
                active={inboxFilter === "ALL"}
                count={conversations.length}
                onClick={() => setInboxFilter("ALL")}
              />
              <FilterChip
                label="En attente"
                active={inboxFilter === "WAITING"}
                count={waitingCount}
                onClick={() => setInboxFilter("WAITING")}
              />
              <FilterChip
                label="WhatsApp"
                active={inboxFilter === "WHATSAPP"}
                count={whatsappCount}
                onClick={() => setInboxFilter("WHATSAPP")}
              />
              <FilterChip
                label="Boutique"
                active={inboxFilter === "NATIVE"}
                count={nativeCount}
                onClick={() => setInboxFilter("NATIVE")}
              />
            </div>
          </div>

          {/* Liste des conversations */}
          <div className="divide-y divide-zinc-100 overflow-y-auto max-h-[calc(100vh-220px)] md:max-h-[580px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="animate-spin text-emerald-600" size={24} />
                <p className="mt-2 text-xs font-bold text-zinc-400">Chargement...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Bot size={24} />
                </div>
                <h3 className="mt-3 text-xs font-bold text-zinc-800">
                  Aucun message trouvé
                </h3>
                <p className="mt-1 text-[0.7rem] text-zinc-500">
                  Partagez votre boutique pour recevoir vos premiers messages.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => (
                <WhatsAppChatRow
                  key={c.key}
                  conversation={c}
                  active={selectedConversation?.key === c.key}
                  onClick={() => {
                    setSelectedKey(c.key);
                    setMobileChatOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Panneau de discussion WhatsApp (ChatPanel) ── */}
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

// Ligne de conversation style WhatsApp
function WhatsAppChatRow({ conversation, active, onClick }) {
  const lastMsg = conversation.last_message;
  const lastOrder = conversation.last_order;
  const isNative = conversation.channel === "native";
  const title = getConversationTitle(conversation);
  const time = formatRelativeTime(
    lastMsg?.created_at || lastOrder?.created_at || conversation.updated_at
  );
  const isBotPaused = Boolean(conversation.bot_paused);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100 ${
        active ? "bg-emerald-50/70" : "bg-white"
      }`}
    >
      {/* Avatar avec badge de canal */}
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-black text-white shadow-sm">
        <span>{title.slice(0, 1).toUpperCase()}</span>
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            isNative ? "bg-emerald-500" : "bg-[#25D366]"
          }`}
          title={isNative ? "Client Web" : "WhatsApp"}
        />
      </div>

      {/* Détails du message */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-black text-zinc-900">{title}</p>
          <span className="shrink-0 text-[0.65rem] font-semibold text-zinc-400">
            {time}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 truncate text-[0.72rem] text-zinc-500">
            {lastMsg?.direction === "out" || lastMsg?.direction === "bot" ? (
              <CheckCheck size={13} className="shrink-0 text-[#53BDEB]" />
            ) : null}
            <span className="truncate">
              {lastOrder
                ? `🛍️ Commande #${lastOrder.order_ref || lastOrder.id?.slice(0, 6)}`
                : getPreview(conversation)}
            </span>
          </p>

          {isBotPaused ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.58rem] font-black text-amber-800">
              Manuel
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.58rem] font-black text-emerald-800">
              IA
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// Bouton filtre pill
function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-bold transition active:scale-95 ${
        active
          ? "bg-zinc-900 text-white shadow-sm"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.2 text-[0.58rem] font-black ${
            active ? "bg-white/25 text-white" : "bg-zinc-200 text-zinc-800"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}



