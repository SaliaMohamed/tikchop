"use client";

import { BadgeCheck, ImagePlus, Loader2, Sparkles } from "lucide-react";

function MobileProductStep({ icon, label, value, done, warn = false, dark = false }) {
  const className = warn
    ? "bg-[#f9e8b4] text-[#133327] ring-[#f4c13a]/50"
    : done
      ? dark
        ? "bg-white text-[#059669] ring-white"
        : "bg-white text-[#059669] ring-[#DCEFE3]"
      : dark
        ? "bg-white/10 text-white ring-white/10"
        : "bg-white text-[#0F2B20] ring-[#DCEFE3]";

  return (
    <div className={`flex-1 rounded-[18px] p-2 text-center ring-1 ${className}`}>
      <span className="tk-icon-badge mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-current">
        {icon}
      </span>
      <strong className="block font-display text-lg font-black leading-none">{value}</strong>
      <small className={`mt-1 block text-[0.62rem] font-black uppercase leading-3 ${dark && !warn && !done ? "text-white/48" : "text-[var(--text-dim)]"}`}>{label}</small>
    </div>
  );
}

function ImageQualitySwitch({
  backgroundAvailable = false,
  backgroundBusy = false,
  cleanAvailable,
  value,
  onChange,
  onCleanBackground,
}) {
  if (!cleanAvailable && !backgroundAvailable) return null;

  const options = [
    {
      value: "clean",
      label: "Photo claire",
      hint: "Lumiere et couleurs corrigees",
      icon: <Sparkles size={15} />,
    },
    {
      value: "original",
      label: "Originale",
      hint: "Photo prise au depart",
      icon: <ImagePlus size={15} />,
    },
  ].filter((option) => option.value !== "clean" || cleanAvailable);

  if (backgroundAvailable) {
    options.unshift({
      value: "background",
      label: "Fond propre",
      hint: "Fond neutre pret pour vendre",
      icon: <BadgeCheck size={15} />,
    });
  }

  return (
    <div className="rounded-[20px] bg-[#F1F8F3] p-3 ring-1 ring-[rgba(0,143,90,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Rendu boutique</p>
          <p className="mt-1 text-sm font-bold leading-5 text-[var(--text-dim)]">Choisissez la photo visible.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black text-[var(--primary)]">
          Photo
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${options.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-3 text-left text-xs font-black transition active:scale-[0.99] ${
                active
                  ? "bg-[#0F2B20] text-white"
                  : "bg-white text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]"
              }`}
            >
              {option.icon}
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                <span className={`mt-0.5 block text-[0.66rem] font-bold leading-3 ${active ? "text-white/60" : "text-[var(--text-dim)]"}`}>
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {onCleanBackground && (
        <button
          type="button"
          onClick={onCleanBackground}
          disabled={backgroundBusy}
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-[var(--primary)] ring-1 ring-[rgba(0,143,90,0.14)] disabled:opacity-60"
        >
          {backgroundBusy ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
          {backgroundAvailable ? "Refaire" : "Fond propre"}
        </button>
      )}
    </div>
  );
}

export { MobileProductStep, ImageQualitySwitch };
