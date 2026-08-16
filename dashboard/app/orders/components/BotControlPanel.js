"use client";

import { useState } from "react";
import { Bot, Loader2, MessageCircle, PauseCircle, PlayCircle, Send } from "lucide-react";
import { buildWhatsappHref } from "../../../lib/customer-response-playbook";
import { isHandoffActive, formatPauseUntil } from "../../../lib/order-utils";
export function BotControlPanel({ order, bestResponse, disabled, onPauseBot, onResumeBot, onManualReply }) {
  const [message, setMessage] = useState(bestResponse?.text || "");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const active = isHandoffActive(order.handoff);
  const pauseUntil = formatPauseUntil(order.handoff?.paused_until);

  async function runAction(kind, action) {
    try {
      setBusy(kind);
      setNotice("");
      setNoticeIsError(false);
      await action();
    } catch (err) {
      setNotice(err?.message || "Action impossible. Réessayez.");
      setNoticeIsError(true);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={`rounded-[24px] p-4 shadow-[var(--shadow-sm)] ring-1 ${
      active
        ? "bg-[#091D14] text-white ring-[#34D399]/20"
        : "bg-white text-[var(--text-main)] ring-[var(--outline)]/20"
    }`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          active ? "bg-[var(--primary-bright)] text-[#091D14]" : "bg-[var(--surface-soft)] text-[var(--primary)]"
        }`}>
          <Bot size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-extrabold uppercase tracking-[0.14em] ${active ? "text-white/52" : "text-[var(--primary)]"}`}>
            Bot WhatsApp
          </p>
          <h3 className={`mt-1 font-display text-lg font-bold ${active ? "text-white" : "text-[var(--text-main)]"}`}>
            {active ? "Vous répondez vous-même" : "Le bot peut répondre"}
          </h3>
          <p className={`mt-1 text-sm font-semibold leading-5 ${active ? "text-white/68" : "text-[var(--text-dim)]"}`}>
            {disabled
              ? "Ajoutez un vrai numéro client pour gérer la conversation depuis Tikchop."
              : active
                ? `Le bot ne répond plus à ce client${pauseUntil ? ` jusqu'à ${pauseUntil}` : ""}.`
                : "Pausez le bot si vous voulez reprendre cette discussion à la main."}
          </p>
        </div>
      </div>

      {!disabled && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {active ? (
              <button
                type="button"
                onClick={() => runAction("resume", async () => {
                  await onResumeBot(order);
                  setNotice("Bot réactivé pour ce client.");
                  setNoticeIsError(false);
                })}
                disabled={Boolean(busy)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-[#091D14] ring-1 ring-white/20 disabled:opacity-60"
              >
                {busy === "resume" ? <Loader2 className="animate-spin" size={17} /> : <PlayCircle size={17} />}
                Relancer le bot
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runAction("pause", async () => {
                  await onPauseBot(order);
                  setNotice("Vous avez la main pendant 24h. Le bot ne répond plus à ce client.");
                  setNoticeIsError(false);
                })}
                disabled={Boolean(busy)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--text-main)] text-sm font-extrabold text-white disabled:opacity-60"
              >
                {busy === "pause" ? <Loader2 className="animate-spin" size={17} /> : <PauseCircle size={17} />}
                Reprendre 24h
              </button>
            )}
            <a
              href={buildWhatsappHref(order.customer_phone, message) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--surface-soft)] text-sm font-extrabold text-[var(--primary)] no-underline ring-1 ring-[var(--primary)]/10"
            >
              <MessageCircle size={17} />
              WhatsApp
            </a>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Écrivez votre réponse au client..."
            className={`mt-3 min-h-[112px] w-full resize-none rounded-[20px] border-0 p-3 text-sm font-semibold leading-5 outline-none ring-1 focus:ring-2 ${
              active
                ? "bg-white/10 text-white placeholder:text-white/35 ring-white/12 focus:ring-[var(--primary-bright)]"
                : "bg-[var(--surface-soft)] text-[var(--text-main)] placeholder:text-[var(--outline)] ring-[var(--outline)]/20 focus:ring-[var(--primary)]/30"
            }`}
          />

          <button
            type="button"
            onClick={() => runAction("reply", async () => {
              await onManualReply(order, message);
              setNotice("Message envoyé. Le bot reste en pause 24h.");
              setNoticeIsError(false);
            })}
            disabled={Boolean(busy) || !message.trim()}
            className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary-bright)] text-sm font-extrabold text-[#091D14] shadow-[0_12px_28px_rgba(52, 211, 153,0.20)] disabled:opacity-55"
          >
            {busy === "reply" ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            Envoyer moi-même
          </button>
        </>
      )}

      {notice && (
        <p
          role={noticeIsError ? "alert" : "status"}
          aria-live="polite"
          className={`mt-3 rounded-2xl px-3 py-2 text-sm font-bold ring-1 ${
            noticeIsError
              ? "bg-[#FEF3F2] text-[#B3261E] ring-[#F5C6C2]"
              : active
                ? "bg-white/10 text-white/78 ring-white/10"
                : "bg-[var(--surface-soft)] text-[var(--text-dim)] ring-[var(--outline)]/20"
          }`}
        >
          {notice}
        </p>
      )}
    </section>
  );
}