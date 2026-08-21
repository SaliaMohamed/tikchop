"use client";

import { CheckCircle2, Loader2, Save } from "lucide-react";

// ─── Design system des pages de réglages ─────────────────────────────────────
// Couleurs partagées : vert bouteille #0F2B20, vert vif #059669, vert clair
// #34D399, fond doux #F6FBF7. Uniformise l'en-tête, les cartes, les toggles,
// les pastilles de statut et la barre d'enregistrement.

export function SettingsHeader({ label, title, text, action }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {label && <p className="quiet-label text-[#059669]">{label}</p>}
        <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[#0F2B20]">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-base font-semibold leading-6 text-[#0F2B20]/55">{text}</p>}
      </div>
      {action}
    </header>
  );
}

export function SettingsSection({ icon, title, sub, right, children, tone = "primary", className = "" }) {
  return (
    <section className={`overflow-hidden rounded-[26px] bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10 ${className}`}>
      {(title || sub) && (
        <div className="flex items-center gap-2.5 border-b border-[#0F2B20]/8 px-4 py-3">
          {icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              tone === "dark" ? "bg-[#0F2B20] text-[#34D399]" : "bg-[#059669]/10 text-[#059669]"
            }`}>
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {sub && <p className={`text-[0.68rem] font-black uppercase tracking-[0.12em] ${
              tone === "dark" ? "text-[#34D399]/80" : "text-[#059669]"
            }`}>{sub}</p>}
            {title && <h2 className="font-display text-lg font-black text-[#0F2B20]">{title}</h2>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#059669]">
        {label}
        {hint && <span className="text-[0.6rem] font-bold normal-case tracking-normal text-[#0F2B20]/50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ToggleRow({ title, text, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[70px] w-full items-center justify-between gap-4 px-4 py-3 text-left active:bg-[#EAF8F0]"
    >
      <div>
        <p className="text-sm font-black text-[#0F2B20]">{title}</p>
        {text && <p className="mt-0.5 text-xs font-bold leading-4 text-[#0F2B20]/50">{text}</p>}
      </div>
      <span className={`flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${active ? "bg-[#059669]" : "bg-[#0F2B20]/15"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

// Pastille de statut : verte (OK), ambre (à faire), grise (neutre).
export function StatusPill({ ok, warning = false, children }) {
  const tone = ok
    ? "bg-[#059669]/10 text-[#059669] ring-[#059669]/20"
    : warning
      ? "bg-[#fdf2d4] text-[#8a5c22] ring-[#f4c13a]/45"
      : "bg-[#0F2B20]/6 text-[#0F2B20]/50 ring-[#0F2B20]/8";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.66rem] font-black uppercase tracking-[0.08em] ring-1 ${tone}`}>
      {ok && <CheckCircle2 size={12} />}
      {children}
    </span>
  );
}

export function Notice({ children, tone = "success", className = "" }) {
  const tones = {
    success: "bg-[#E7F6ED] text-[#047857] ring-emerald-200",
    error: "bg-amber-50 text-amber-900 ring-amber-200",
  }[tone];
  return (
    <div className={`rounded-2xl p-4 text-sm font-bold leading-5 ring-1 ${tones} ${className}`}>
      {children}
    </div>
  );
}

export function SaveBar({ saving, disabled = false, onClick, label = "Enregistrer", hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled}
      className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[24px] bg-[#0F2B20] px-5 text-base font-black text-white shadow-[0_16px_38px_rgba(15,43,32,0.18)] active:scale-[0.99] disabled:opacity-50"
    >
      {saving ? <Loader2 className="animate-spin" size={19} /> : <Save size={19} />}
      {saving ? "Enregistrement…" : label}
    </button>
  );
}

// Grille de boutons-options (select mono-choix, ex. "Quand payer ?").
export function ChoiceButton({ active, label, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition-colors ${
        active ? "border-[#059669]/40 bg-[#EAF8F0]" : "border-[#0F2B20]/10 bg-white"
      }`}
    >
      <div>
        <p className="text-sm font-black text-[#0F2B20]">{label}</p>
        {text && <p className="mt-0.5 text-xs font-bold leading-4 text-[#0F2B20]/50">{text}</p>}
      </div>
      {active && <CheckCircle2 className="shrink-0 text-[#059669]" size={19} />}
    </button>
  );
}

export function StatCard({ icon, label, value, tone = "primary" }) {
  const tones = {
    primary: "bg-[#059669]/10 text-[#059669]",
    green: "bg-[#059669]/10 text-[#059669]",
    orange: "bg-[#FFF1D7] text-[#df941e]",
    blue: "bg-[#e9f0fc] text-[#4e7db5]",
    purple: "bg-[#f0eafa] text-[#8065bb]",
    info: "bg-blue-50 text-blue-600",
    accent: "bg-amber-50 text-amber-600",
  }[tone];
  return (
    <div className="rounded-[18px] bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/8">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones}`}>{icon}</span>
      <p className="mt-3 font-display text-lg font-bold leading-none text-[#0F2B20]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#0F2B20]/50">{label}</p>
    </div>
  );
}