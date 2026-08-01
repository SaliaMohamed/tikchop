"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

const toneClasses = {
  dark: "bg-[#07120d] text-white ring-[#07120d]",
  green: "bg-[#008f5a] text-white ring-[#008f5a]",
  soft: "bg-white text-[#07120d] ring-[#07120d]/8",
  mint: "bg-[#eafff3] text-[#07120d] ring-[#39f58e]/22",
  cream: "bg-[#fbf9f4] text-[#07120d] ring-[#07120d]/8",
  warn: "bg-[#fff4cf] text-[#4d3200] ring-[#ffcf3d]/40",
};

export function TkScreen({ children, className = "" }) {
  return (
    <div className={`app-shell mx-auto max-w-[430px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 ${className}`}>
      {children}
    </div>
  );
}

export function TkTop({ eyebrow, title, action, avatar, badge }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.63rem] font-black uppercase tracking-[0.16em] text-[#008f5a]">{eyebrow}</p> : null}
        <h1 className="mt-0.5 truncate font-display text-[1.62rem] font-black leading-[1.08] tracking-tight text-[#07120d]">
          {title}
        </h1>
        {badge ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#fff4cf] px-2.5 py-0.5 text-[0.62rem] font-black text-[#7a4f00]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {avatar}
      </div>
    </header>
  );
}

export function TkIconButton({ href, onClick, icon, label, tone = "soft", className = "" }) {
  const body = (
    <span className={`flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[0_8px_22px_rgba(7,18,13,0.07)] ring-1 transition-transform active:scale-[0.94] ${toneClasses[tone] || toneClasses.soft} ${className}`}>
      {icon}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className="no-underline">
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}>
      {body}
    </button>
  );
}

export function TkActionCard({ href, icon, title, value, label, tone = "soft", urgent = false }) {
  const cardTone = urgent ? toneClasses.warn : toneClasses[tone] || toneClasses.soft;
  return (
    <Link
      href={href}
      aria-label={`${title} ${label || ""}`.trim()}
      className={`tk-spring grid min-h-[88px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[28px] p-4 no-underline shadow-[0_8px_24px_rgba(7,18,13,0.05)] ring-1 transition-all active:scale-[0.98] hover:shadow-[0_14px_32px_rgba(7,18,13,0.08)] ${cardTone}`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-[22px] ${tone === "dark" || tone === "green" ? "bg-white/14 text-white" : "bg-white text-[#008f5a] shadow-sm ring-1 ring-[#07120d]/5"}`}
        style={{ height: "52px", width: "52px" }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[1.04rem] font-black leading-5">{title}</strong>
        {label ? <small className="mt-1.5 block truncate text-xs font-bold opacity-55">{label}</small> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {value !== undefined && value !== null ? <strong className="font-display text-lg font-black leading-none">{value}</strong> : null}
        <ChevronRight size={16} className="opacity-50" />
      </span>
    </Link>
  );
}

export function TkMetric({ icon, value, label, active = false, warn = false }) {
  return (
    <div className={`min-w-0 rounded-[24px] p-3.5 text-center ring-1 transition-all ${
      warn
        ? "bg-[#fff8dd] text-[#4d3200] ring-[#ffcf3d]/35 shadow-[0_4px_14px_rgba(255,176,0,0.10)]"
        : active
          ? "bg-[#07120d] text-white ring-[#07120d] shadow-[0_12px_28px_rgba(7,18,13,0.18)]"
          : "bg-white text-[#07120d] ring-[#07120d]/7 shadow-[0_4px_14px_rgba(7,18,13,0.04)]"
    }`}>
      <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-[18px] ${
        warn ? "bg-[#ffcf3d]/25 text-[#7a4f00]" : active ? "bg-[#39f58e] text-[#07120d]" : "bg-[#edfff5] text-[#008f5a]"
      }`}>
        {icon}
      </span>
      <strong className="mt-2.5 block truncate font-display text-[1.35rem] font-black leading-none">{value}</strong>
      <small className="mt-1.5 block truncate text-[0.6rem] font-black uppercase tracking-wide leading-3 opacity-55">{label}</small>
    </div>
  );
}

export function TkPrimary({ href, onClick, icon, label, disabled = false, urgent = false, className = "" }) {
  const classes = `flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-[24px] bg-[#008f5a] px-5 text-base font-black text-white no-underline shadow-[0_14px_32px_rgba(0,143,90,0.24)] transition-all active:scale-[0.98] disabled:bg-[#07120d]/16 disabled:text-[#07120d]/35 disabled:shadow-none ${urgent ? "animate-pulse-glow" : ""} ${className}`;
  if (href) {
    return <Link href={href} className={classes}>{icon}{label}</Link>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={classes}>{icon}{label}</button>;
}
