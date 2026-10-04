"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  PauseCircle,
  Phone,
  PlayCircle,
  Send,
  ShoppingBag,
  Sparkles,
  User,
  UserRound,
  Video,
  Zap,
} from "lucide-react";
import {
  cleanPhone,
  formatPrice,
  getConversationTitle,
  getMediaLabel,
  buildCustomerForTemplates,
  getDefaultResponseTemplates,
} from "../../../lib/messages-utils";
import { getCustomerResponseTemplates } from "../../../lib/customer-response-playbook";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  conversation,
  sellerName,
  reply,
  setReply,
  busy,
  mobileOpen,
  onBack,
  onSend,
  onPause,
  onResume,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <section className="hidden min-h-[600px] flex-col items-center justify-center rounded-3xl bg-[#F0F2F5] p-8 text-center ring-1 ring-zinc-200/80 md:flex">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
          <MessageCircle size={38} />
        </div>
        <h2 className="mt-5 font-display text-xl font-extrabold text-zinc-800">
          Sélectionnez une discussion
        </h2>
        <p className="mt-1.5 max-w-sm text-xs font-medium text-zinc-500">
          Répondez à vos clients en direct ou laissez l'assistant IA DJASSAMAN gérer les demandes et les ventes.
        </p>
      </section>
    );
  }

  const isNative = conversation.channel === "native";
  const rawPhone = cleanPhone(conversation.customer_phone);
  const hasPhone = Boolean(rawPhone);
  const canReply = Boolean(conversation.customer_phone);
  const isBotPaused = Boolean(conversation.bot_paused);
  const lastOrder = conversation.last_order;

  const playbookTemplates = getCustomerResponseTemplates(
    buildCustomerForTemplates(conversation),
    { sellerName }
  );
  const responseTemplates = playbookTemplates.length
    ? playbookTemplates
    : getDefaultResponseTemplates(sellerName);

  const whatsAppDirectUrl = hasPhone
    ? `https://wa.me/${rawPhone.startsWith("225") ? rawPhone : "225" + rawPhone}`
    : null;

  return (
    <section
      className={`${
        mobileOpen ? "fixed inset-0 z-[220] flex" : "hidden"
      } flex-col overflow-hidden bg-[#EFEAE2] md:static md:flex md:min-h-[640px] md:rounded-3xl md:ring-1 md:ring-zinc-300/80 shadow-md`}
      style={{
        backgroundImage: `radial-gradient(#d1d7db 0.75px, transparent 0.75px)`,
        backgroundSize: "20px 20px",
      }}
    >
      {/* ── WhatsApp Header ── */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-[#F0F2F5] px-3.5 py-2.5 pt-[calc(0.6rem+env(safe-area-inset-top,0px))] md:px-4 md:py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200/70 md:hidden"
            aria-label="Retour aux discussions"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar avec initiales */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold text-white shadow-sm">
            <span>{getConversationTitle(conversation).slice(0, 1).toUpperCase()}</span>
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#F0F2F5] ${
                isNative ? "bg-emerald-500" : "bg-[#25D366]"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-extrabold text-zinc-900 leading-tight">
                {getConversationTitle(conversation)}
              </h2>
              <span
                className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[0.6rem] font-black ${
                  isNative
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-[#25D366]/15 text-[#128C7E]"
                }`}
              >
                {isNative ? "Boutique Web" : "WhatsApp"}
              </span>
            </div>
            <p className="truncate text-[0.68rem] font-medium text-zinc-500">
              {isBotPaused ? (
                <span className="font-bold text-amber-700">👤 Vous avez la main</span>
              ) : (
                <span className="text-emerald-700 font-semibold">🤖 DJASSAMAN actif</span>
              )}
              {hasPhone ? ` · ${conversation.display_phone || rawPhone}` : ""}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton bascule IA / Humain */}
          {canReply && (
            <button
              type="button"
              onClick={() => (isBotPaused ? onResume(conversation) : onPause(conversation))}
              disabled={busy === "pause" || busy === "resume"}
              className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[0.68rem] font-bold shadow-sm transition active:scale-95 ${
                isBotPaused
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
              }`}
              title={isBotPaused ? "Rendre la main au Bot" : "Mettre en pause le Bot"}
            >
              {busy === "pause" || busy === "resume" ? (
                <Loader2 className="animate-spin" size={13} />
              ) : isBotPaused ? (
                <>
                  <PlayCircle size={13} />
                  <span className="hidden sm:inline">Rendre au bot</span>
                </>
              ) : (
                <>
                  <PauseCircle size={13} />
                  <span className="hidden sm:inline">Prendre la main</span>
                </>
              )}
            </button>
          )}

          {/* Lien direct WhatsApp */}
          {whatsAppDirectUrl && (
            <a
              href={whatsAppDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E] no-underline shadow-sm hover:bg-[#25D366]/25"
              aria-label="Ouvrir sur WhatsApp"
              title="Ouvrir sur WhatsApp"
            >
              <MessageCircle size={16} />
            </a>
          )}

          {/* Appel Téléphonique */}
          {hasPhone && (
            <a
              href={`tel:${rawPhone}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-700 no-underline shadow-sm hover:bg-zinc-100"
              aria-label="Appeler"
              title="Appeler"
            >
              <Phone size={15} />
            </a>
          )}
        </div>
      </header>

      {/* ── Chat Messages Body ── */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-3 py-3 md:px-5"
      >
        {/* Contexte de commande attachée si présente */}
        {lastOrder && <OrderContextCard order={lastOrder} />}

        {(conversation.messages || []).length === 0 ? (
          <div className="mx-auto my-8 max-w-xs rounded-2xl bg-white/90 p-5 text-center shadow-sm backdrop-blur-sm">
            <MessageCircle className="mx-auto text-emerald-600" size={32} />
            <p className="mt-2 text-xs font-bold text-zinc-900">Nouvelle discussion</p>
            <p className="mt-1 text-[0.72rem] text-zinc-500 leading-relaxed">
              Tapez un message ci-dessous ou utilisez une réponse rapide pour démarrer la vente.
            </p>
          </div>
        ) : (
          (conversation.messages || []).map((msg) => (
            <WhatsAppMessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* ── WhatsApp Bottom Input Bar ── */}
      <footer className="border-t border-zinc-200/80 bg-[#F0F2F5] p-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] md:p-3">
        {/* Rail de réponses rapides WhatsApp */}
        {canReply && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {responseTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setReply(tpl.text)}
                className="flex min-h-[30px] shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[0.68rem] font-bold text-zinc-800 shadow-sm ring-1 ring-zinc-200/90 transition hover:bg-zinc-50 active:scale-95"
              >
                <Zap size={11} className="text-emerald-600" />
                <span>{tpl.shortTitle || tpl.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input container style WhatsApp */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-zinc-200/80">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (reply.trim()) onSend();
                }
              }}
              placeholder={canReply ? "Écrire un message..." : "Numéro client manquant"}
              disabled={!canReply || busy === "send"}
              rows={1}
              className="max-h-24 min-h-[26px] flex-1 resize-none bg-transparent py-1 text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>

          {/* Bouton d'envoi rond WhatsApp */}
          <button
            type="button"
            onClick={onSend}
            disabled={!canReply || !reply.trim() || busy === "send"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-md transition hover:bg-[#008f6f] active:scale-95 disabled:bg-zinc-300 disabled:shadow-none"
            aria-label="Envoyer"
          >
            {busy === "send" ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <Send size={17} className="translate-x-0.5" />
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}

// Bulle de message style WhatsApp
function WhatsAppMessageBubble({ message }) {
  const isOut = message.direction === "out";
  const isBot = message.direction === "bot";
  const isSeller = isOut || isBot;
  const hasText = Boolean(String(message.text || "").trim());
  const time = formatTime(message.created_at);

  return (
    <div className={`flex ${isSeller ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[82%] rounded-2xl px-3.5 py-2 shadow-[0_1px_1.5px_rgba(11,20,26,0.14)] ${
          isSeller
            ? "rounded-tr-xs bg-[#D9FDD3] text-zinc-900"
            : "rounded-tl-xs bg-white text-zinc-900"
        }`}
      >
        {/* Badge expéditeur IA / Manuel */}
        {isSeller && (
          <div className="mb-1 flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.58rem] font-black ${
                isBot
                  ? "bg-emerald-600/10 text-emerald-800"
                  : "bg-zinc-800/10 text-zinc-800"
              }`}
            >
              {isBot ? <Bot size={10} /> : <User size={10} />}
              {isBot ? "DJASSAMAN IA" : "Vendeur"}
            </span>
          </div>
        )}

        {/* Média */}
        {message.media && <BubbleMedia media={message.media} />}

        {/* Texte du message */}
        {hasText && (
          <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed">
            {message.text}
          </p>
        )}

        {/* Heure et Double Checkmarks */}
        <div className="mt-1 flex items-center justify-end gap-1 text-[0.6rem] font-semibold text-zinc-500">
          <span>{time}</span>
          {isSeller && <CheckCheck size={13} className="text-[#53BDEB]" />}
        </div>
      </div>
    </div>
  );
}

// Composant Média WhatsApp
function BubbleMedia({ media }) {
  if (media.type === "image" && media.url) {
    return (
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        className="mb-1.5 block overflow-hidden rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.caption || "Image"}
          className="max-h-60 w-full object-cover"
        />
      </a>
    );
  }

  if (media.type === "audio" && media.url) {
    return (
      <div className="mb-1.5 rounded-xl bg-black/5 p-2">
        <div className="mb-1 flex items-center gap-1 text-[0.65rem] font-bold text-zinc-700">
          <Mic size={13} />
          <span>Message vocal</span>
        </div>
        <audio controls src={media.url} className="h-8 w-full" />
      </div>
    );
  }

  return (
    <a
      href={media.url || undefined}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-xl bg-black/5 p-2 text-xs font-bold text-zinc-800 no-underline"
    >
      <FileText size={16} />
      <span className="truncate">{getMediaLabel(media)}</span>
    </a>
  );
}

// Carte Contexte de Commande
function OrderContextCard({ order }) {
  const total =
    Number(order.total_amount || 0) + Number(order.delivery_fee || 0);

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl bg-white/95 p-3 shadow-sm backdrop-blur-sm ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShoppingBag size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-zinc-900">
              Commande #{order.order_ref || order.id?.slice(0, 6).toUpperCase()}
            </p>
            <p className="truncate text-[0.68rem] font-semibold text-emerald-700">
              {formatPrice(total)} · {order.delivery_zone || "Retrait"}
            </p>
          </div>
        </div>
        <Link
          href="/orders"
          className="flex h-7 items-center rounded-full bg-zinc-900 px-2.5 text-[0.65rem] font-bold text-white no-underline hover:bg-zinc-800"
        >
          Détails
        </Link>
      </div>
    </div>
  );
}
