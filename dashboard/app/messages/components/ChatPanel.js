"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
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
  UserRound,
  Video,
} from "lucide-react";
import {
  cleanPhone,
  formatDateTime,
  formatPrice,
  getConversationTitle,
  getMediaLabel,
  buildCustomerForTemplates,
  getDefaultResponseTemplates,
  getTemplateToneClasses,
} from "../../../lib/messages-utils";
import { getCustomerResponseTemplates } from "../../../lib/customer-response-playbook";
export function ChatPanel({ conversation, sellerName, reply, setReply, busy, mobileOpen, onBack, onSend, onPause, onResume }) {
  if (!conversation) {
    return (
      <section className="hidden min-h-[560px] items-center justify-center rounded-[28px] bg-[#F6FBF7] p-8 text-center ring-1 ring-[#0F2B20]/8 md:flex">
        <div>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#059669] shadow-sm">
            <MessageCircle size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-black text-[#0F2B20]">Choisis une discussion</h2>
        </div>
      </section>
    );
  }

  const isNative = conversation.channel === "native";
  const hasPhone = Boolean(cleanPhone(conversation.customer_phone));
  const canReply = Boolean(conversation.customer_phone);
  const lastOrder = conversation.last_order;
  const playbookTemplates = getCustomerResponseTemplates(buildCustomerForTemplates(conversation), {
    sellerName,
  });
  const responseTemplates = playbookTemplates.length ? playbookTemplates : getDefaultResponseTemplates(sellerName);
  const pauseHelp = conversation.bot_paused ? "Mode humain (vous avez la main)" : "Bot actif (DJASSAMAN répond)";

  return (
    <section className={`${mobileOpen ? "fixed flex" : "hidden"} inset-0 z-[220] flex-col bg-[#E7F1EA] md:static md:flex md:min-h-[640px] md:overflow-hidden md:rounded-[26px] md:bg-[#E7F1EA] md:ring-1 md:ring-[#0F2B20]/10`}>
      <div className="border-b border-[#0F2B20]/8 bg-[#F0F7F3] px-3 pb-2.5 pt-[calc(0.7rem+env(safe-area-inset-top,0px))] md:p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] md:hidden" aria-label="Retour aux discussions">
            <ArrowLeft size={20} />
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F8F2] text-[#059669]">
            <UserRound size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[1rem] font-extrabold leading-5 text-[#0C271C]">{getConversationTitle(conversation)}</h2>
              <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.62rem] font-black ${
                isNative ? "bg-[#E8F7EE] text-[#059669]" : "bg-[#25D366]/15 text-[#128C7E]"
              }`}>
                {isNative ? "🌐 Boutique" : "💬 WhatsApp"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-[#4C6B5E]">
              {isNative ? `Client web (${conversation.display_phone?.slice(0, 16) || "ID unique"})` : (conversation.display_phone || "Numéro inconnu")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canReply && (
            <button
              type="button"
              onClick={() => (conversation.bot_paused ? onResume(conversation) : onPause(conversation))}
              disabled={busy === "pause" || busy === "resume"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#059669] shadow-sm disabled:opacity-50"
              aria-label={conversation.bot_paused ? "Rendre au bot" : "Prendre la main"}
              title={conversation.bot_paused ? "Rendre au bot" : "Prendre la main"}
            >
              {busy === "pause" || busy === "resume" ? <Loader2 className="animate-spin" size={14} /> : conversation.bot_paused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
            </button>
            )}
            {hasPhone && (
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

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto bg-[#E7F1EA] px-3 py-3 md:px-5">
        {lastOrder && <OrderContext order={lastOrder} />}
        {(conversation.messages || []).length === 0 ? (
          <div className="mx-auto mt-4 max-w-[78%] rounded-[16px] bg-[#fbeec0] px-4 py-3 text-center text-[#54656f] shadow-[0_1px_1px_rgba(17,27,33,0.12)]">
            <MessageCircle className="mx-auto text-[var(--primary)]" size={30} />
            <p className="mt-2 text-sm font-extrabold text-[#0C271C]">{canReply ? "Prêt à répondre" : "Numéro manquant"}</p>
            <p className="mt-1 text-xs font-semibold leading-4">{canReply ? "Ecrivez en bas." : "Completez la vente."}</p>
          </div>
        ) : (
          (conversation.messages || []).map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="bg-[#F0F7F3] p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] md:p-3">
        {canReply && <QuickReplyRail templates={responseTemplates} onUseTemplate={setReply} compact />}
        <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={canReply ? "Message..." : "Numéro indisponible"}
            disabled={!canReply || busy === "send"}
            className="max-h-32 min-h-[44px] resize-none rounded-[22px] bg-white px-4 py-3 text-[0.92rem] font-medium leading-5 text-[#0C271C] shadow-sm outline-none placeholder:text-[#4C6B5E]/70 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canReply || !reply.trim() || busy === "send"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#059669] text-white shadow-sm disabled:bg-[#AFC4B8] disabled:opacity-70"
            aria-label="Envoyer le message"
          >
            {busy === "send" ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-1 px-2 text-[0.64rem] font-semibold leading-4 text-[#4C6B5E]">
          {pauseHelp}
        </p>
      </div>
    </section>
  );
}


export function SellerConversationHint({ paused, canReply }) {
  const content = !canReply
    ? {
      title: "Numéro à compléter",
      body: "La vente reste consultable.",
      className: "bg-white text-[#0F2B20] ring-1 ring-[#0F2B20]/8",
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
        className: "bg-[#EAF8F0] text-[#047857] ring-1 ring-emerald-200",
      };

  return (
    <div className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-bold leading-4 ${content.className}`}>
      <p className="font-black">{content.title}</p>
      <p className="mt-0.5 opacity-75">{content.body}</p>
    </div>
  );
}


export function QuickReplyRail({ templates, onUseTemplate, compact = false }) {
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


export function OrderContext({ order }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  return (
    <div className="mx-auto w-full max-w-[92%] rounded-[14px] bg-white/90 p-3 text-[#0C271C] shadow-[0_1px_1px_rgba(17,27,33,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.08em] text-[#059669]">
            <ShoppingBag size={15} />
            Vente
          </p>
          <p className="mt-1 text-[1rem] font-extrabold">{order.order_ref || order.id?.slice(0, 8)?.toUpperCase()}</p>
          <p className="mt-0.5 text-xs font-semibold text-[#4C6B5E]">{order.delivery_zone || order.delivery_address || "Livraison a confirmer"}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.95rem] font-extrabold text-[#059669]">{formatPrice(total)}</p>
          <Link href="/orders" className="mt-2 inline-flex rounded-full bg-[#E8F7EE] px-3 py-1.5 text-[0.68rem] font-extrabold text-[#059669] no-underline">
            Voir
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({ message }) {
  const isOut = message.direction === "out";
  const isBot = message.direction === "bot";
  const hasText = Boolean(String(message.text || "").trim());
  return (
    <div className={`flex ${isOut || isBot ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] px-3 py-2 shadow-[0_1px_1px_rgba(17,27,33,0.12)] ${
        isOut
          ? "rounded-[12px] rounded-br-sm bg-[#F0F8F2] text-[#0C271C]"
          : isBot
            ? "rounded-[12px] rounded-br-sm bg-[#f1e8da] text-[#0C271C]"
            : "rounded-[12px] rounded-bl-sm bg-white text-[#0C271C]"
      }`}
      >
        {message.media && <MessageMedia media={message.media} dark={isOut || isBot} />}
        {hasText && <p className={`${message.media ? "mt-2" : ""} whitespace-pre-wrap text-[0.92rem] font-medium leading-5`}>{message.text}</p>}
        {!hasText && message.media?.caption && (
          <p className="mt-2 whitespace-pre-wrap text-[0.92rem] font-medium leading-5">{message.media.caption}</p>
        )}
        <div className="mt-1 flex items-center justify-end gap-1 text-[0.62rem] font-semibold text-[#4C6B5E]">
          {isOut ? "Vous" : isBot ? "DJASSAMAN" : "Client"}
          <span>·</span>
          <Clock3 size={11} />
          {formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

export function MessageMedia({ media, dark }) {
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
