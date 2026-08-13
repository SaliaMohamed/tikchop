"use client";

import { ArrowRight, CheckCircle2, ImagePlus, Share2 } from "lucide-react";
import Link from "next/link";

function Field({ label, icon, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-main)]">
        {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--primary)]">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

function HeroMiniStat({ icon, label }) {
  return (
    <span className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl bg-white/10 px-2 text-xs font-extrabold text-white/82">
      {icon}
      {label}
    </span>
  );
}

function NoticeBanner({ tone = "info", icon, title, text }) {
  const classes = tone === "danger"
    ? "border-red-100 bg-red-50 text-red-800"
    : "border-[var(--info)]/15 bg-[var(--info-soft)] text-[var(--text-main)]";

  return (
    <div className={`flex items-start gap-3 rounded-[20px] border p-4 shadow-[var(--shadow-sm)] ${classes}`}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-current">
        {icon}
      </span>
      <div>
        <p className="text-sm font-extrabold">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-5 opacity-80">{text}</p>
      </div>
    </div>
  );
}

function QuickValueButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 min-w-10 shrink-0 rounded-xl px-3 text-sm font-extrabold shadow-sm ring-1 ${
        active ? "bg-[#2b2219] text-white ring-[#2b2219]" : "bg-white text-[#2b2219] ring-[#e7dac2]"
      }`}
    >
      {label}
    </button>
  );
}

function ModeButton({ active, icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-[18px] border text-sm font-extrabold transition active:scale-[0.99] ${
        active ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]" : "border-[var(--outline)]/40 bg-white text-[var(--text-dim)] shadow-[var(--shadow-sm)]"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/12" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
        {icon}
      </span>
      <span>{label}</span>
      <span className={`text-[0.66rem] font-bold ${active ? "text-white/55" : "text-[var(--outline)]"}`}>{hint}</span>
    </button>
  );
}

function SellerShortcut({ icon, title, text }) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-white/92 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.26)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
        {icon}
      </span>
      <p className="mt-2 text-sm font-extrabold leading-4 text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-[0.68rem] font-bold leading-4 text-[var(--text-dim)]">{text}</p>
    </div>
  );
}

function PublishSuccess({ result, onAddMore }) {
  const shopHref = result.sellerSlug ? `/${result.sellerSlug}` : "/dashboard";

  return (
    <div className="app-shell min-h-screen pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <main className="flex min-h-[78vh] flex-col justify-center space-y-5">
        <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <span className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--primary-bright)] text-[var(--text-main)] shadow-sm">
            <CheckCircle2 size={32} />
          </span>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.14em] text-white/48">Article en ligne</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-[2.7rem] text-white">
            {result.count} article{result.count > 1 ? "s" : ""} publie{result.count > 1 ? "s" : ""}
          </h1>
          <p className="mt-3 text-base font-semibold leading-6 text-white/68">
            La boutique {result.sellerName || "Tikchop"} peut maintenant afficher ces produits aux clients.
          </p>
        </section>

        <section className="grid gap-3">
          <Link
            href="/social-sharing"
            className="flex min-h-[62px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-extrabold text-[var(--text-main)] no-underline shadow-[0_14px_34px_rgba(240, 149, 76,0.22)]"
          >
            <Share2 size={19} />
            Partager maintenant
            <ArrowRight size={19} />
          </Link>
          <Link
            href={shopHref}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-white px-4 text-sm font-extrabold text-[var(--primary)] no-underline shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35"
          >
            Voir la boutique
            <ArrowRight size={19} />
          </Link>
          <button
            type="button"
            onClick={onAddMore}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35"
          >
            <ImagePlus size={18} />
            Ajouter encore
          </button>
          <Link
            href="/products"
            className="flex min-h-[52px] items-center justify-center rounded-[18px] bg-[var(--surface-soft)] px-4 text-sm font-extrabold text-[var(--primary)] no-underline"
          >
            Gerer les articles
          </Link>
        </section>
      </main>
    </div>
  );
}

export { Field, HeroMiniStat, NoticeBanner, QuickValueButton, ModeButton, SellerShortcut, PublishSuccess };
