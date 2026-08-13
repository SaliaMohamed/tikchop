"use client";

import { ArrowRight, BadgeCheck, MessageCircle, PackagePlus, Truck, Upload } from "lucide-react";
import { getBackgroundProgressAdvice, getBulkReviewStats } from "../../../lib/product-analysis-utils";

function NextActionCard({ assistant }) {
  return (
    <section className={`rounded-[20px] border p-4 shadow-[var(--shadow-sm)] ${assistant.strong ? "border-[var(--text-main)] bg-[var(--text-main)] text-white" : "border-[var(--line)] bg-white text-[var(--text-main)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${assistant.strong ? "bg-white text-[var(--text-main)]" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
          {assistant.step}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`quiet-label ${assistant.strong ? "text-white/55" : "text-[var(--primary)]"}`}>A faire maintenant</p>
          <h2 className="mt-1 font-display text-xl font-bold leading-7">{assistant.title}</h2>
          <p className={`mt-1 text-sm leading-5 ${assistant.strong ? "text-white/68" : "text-[var(--text-dim)]"}`}>{assistant.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={assistant.onClick}
        disabled={assistant.disabled}
        className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold active:scale-[0.99] disabled:opacity-70 ${
          assistant.strong ? "bg-[var(--primary-bright)] text-zinc-950" : "bg-[var(--text-main)] text-white"
        }`}
      >
        {assistant.icon}
        {assistant.label}
        {!assistant.disabled && <ArrowRight size={18} />}
      </button>
    </section>
  );
}

function AfterPublishStrip() {
  const items = [
    { icon: <BadgeCheck size={15} />, label: "Boutique mise a jour" },
    { icon: <MessageCircle size={15} />, label: "WhatsApp presente et encaisse" },
    { icon: <Truck size={15} />, label: "Commande envoyee au livreur" },
  ];

  return (
    <section className="rounded-[20px] border border-[var(--primary)]/15 bg-[var(--surface-soft)] p-3 shadow-[var(--shadow-sm)]">
      <p className="quiet-label text-[var(--primary)]">Apres publication</p>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-extrabold text-[var(--text-main)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--text-main)] text-[var(--primary-bright)]">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DesktopPublishPanel({ loading, canSubmit, mode, count, hint }) {
  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoutez les prix"
      : "Mettre en ligne";

  return (
    <section className="rounded-[24px] border border-[var(--text-main)] bg-[var(--text-main)] p-4 text-white shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="quiet-label text-white/50">Mise en vente</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-8">Publier sur la boutique</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${canSubmit ? "bg-[var(--primary-bright)] text-[var(--text-main)]" : "bg-white/10 text-white/70"}`}>
          {canSubmit ? "Pret" : "A completer"}
        </span>
      </div>
      {hint ? <p className="mt-3 text-sm font-semibold leading-5 text-white/64">{hint}</p> : null}
      <button
        form="add-product-form"
        type="submit"
        disabled={loading || !canSubmit}
        className={`mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-55 ${
          loading || !canSubmit ? "bg-white/14 text-white" : "bg-[var(--primary-bright)] text-[var(--text-main)] hover:translate-y-[-1px]"
        }`}
      >
        <Upload size={19} />
        {label}
        {!loading && canSubmit && <ArrowRight size={18} />}
      </button>
    </section>
  );
}

function PublishDock({ loading, canSubmit, mode, count }) {
  if (!loading && !canSubmit) return null;

  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoutez les prix"
      : "Mettre en ligne";

  return (
    <div id="publish-dock" className="fixed inset-x-0 bottom-0 z-[120] border-t border-white/70 bg-white/92 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_44px_rgb(13_23_18_/_0.13)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto max-w-[460px]">
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className={`flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] text-base font-extrabold shadow-[0_14px_34px_rgba(0,108,73,0.22)] transition ${
            loading || !canSubmit ? "bg-[var(--outline)] text-white" : "bg-[var(--primary)] text-white active:scale-[0.98]"
          }`}
        >
          <Upload size={20} />
          {label}
          {!loading && canSubmit && <ArrowRight size={19} />}
        </button>
      </div>
    </div>
  );
}

function BatchReviewSummary({ items, backgroundProgress }) {
  return (
    <div className="rounded-[20px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[#07120d]/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-[var(--text-main)]">Photos de vos articles</p>
          <p className="text-sm leading-5 text-[var(--text-dim)]">Choisissez les photos. Mettez surtout le prix. Tikchop prepare le reste.</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--text-main)] text-[var(--primary-bright)]">
          <PackagePlus size={20} />
        </span>
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm">
            <span className="font-semibold text-[var(--text-dim)]">Validation rapide</span>
            <strong className="text-[var(--primary)]">{getBulkReviewStats(items)}</strong>
          </div>

          {backgroundProgress && (
            <div className="rounded-2xl bg-white px-3 py-2 text-center text-xs font-extrabold text-[var(--text-dim)] ring-1 ring-[var(--outline)]/25">
              {getBackgroundProgressAdvice(backgroundProgress)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { NextActionCard, AfterPublishStrip, DesktopPublishPanel, PublishDock, BatchReviewSummary };
