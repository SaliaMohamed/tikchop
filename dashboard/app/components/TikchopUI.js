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

export function TkTop({ eyebrow, title, action, avatar }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">{eyebrow}</p> : null}
        <h1 className="mt-0.5 truncate font-display text-[1.58rem] font-black leading-7 tracking-tight text-[#07120d]">
          {title}
        </h1>
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
    <span className={`flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[0_12px_26px_rgba(7,18,13,0.06)] ring-1 ${toneClasses[tone] || toneClasses.soft} ${className}`}>
      {icon}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className="no-underline active:scale-[0.97]">
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="active:scale-[0.97]">
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
      className={`grid min-h-[86px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[26px] p-3.5 no-underline shadow-[0_14px_34px_rgba(7,18,13,0.055)] ring-1 active:scale-[0.99] ${cardTone}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] ${tone === "dark" || tone === "green" ? "bg-white/14 text-white" : "bg-white text-[#008f5a] shadow-sm"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[1.02rem] font-black leading-5">{title}</strong>
        {label ? <small className="mt-1 block truncate text-xs font-black opacity-58">{label}</small> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {value !== undefined && value !== null ? <strong className="font-display text-lg font-black leading-none">{value}</strong> : null}
        <ChevronRight size={17} className="opacity-62" />
      </span>
    </Link>
  );
}

export function TkMetric({ icon, value, label, active = false, warn = false }) {
  return (
    <div className={`min-w-0 rounded-[22px] p-3 text-center ring-1 ${
      warn
        ? "bg-[#fff4cf] text-[#4d3200] ring-[#ffcf3d]/40"
        : active
          ? "bg-[#07120d] text-white ring-[#07120d]"
          : "bg-white text-[#07120d] ring-[#07120d]/8"
    }`}>
      <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[15px] ${
        active ? "bg-[#39f58e] text-[#07120d]" : "bg-[#eafff3] text-[#008f5a]"
      }`}>
        {icon}
      </span>
      <strong className="mt-2 block truncate font-display text-lg font-black leading-none">{value}</strong>
      <small className="mt-1 block truncate text-[0.62rem] font-black uppercase leading-3 opacity-60">{label}</small>
    </div>
  );
}

export function TkPrimary({ href, onClick, icon, label, disabled = false, className = "" }) {
  const classes = `flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[23px] bg-[#008f5a] px-5 text-base font-black text-white no-underline shadow-[0_18px_36px_rgba(0,143,90,0.22)] active:scale-[0.98] disabled:bg-[#07120d]/16 disabled:text-[#07120d]/35 disabled:shadow-none ${className}`;
  if (href) {
    return <Link href={href} className={classes}>{icon}{label}</Link>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={classes}>{icon}{label}</button>;
}
