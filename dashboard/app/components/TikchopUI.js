"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

const toneClasses = {
  dark: "bg-[var(--color-ink)] text-white ring-[var(--color-ink)]",
  green: "bg-[var(--color-primary)] text-[var(--color-ink)] ring-[var(--color-primary)]",
  soft: "bg-white text-[var(--color-ink)] ring-[var(--color-ink)]/6",
  mint: "bg-[var(--color-mint-soft)] text-[var(--color-ink)] ring-[var(--color-primary)]/20",
  cream: "bg-[var(--color-bg)] text-[var(--color-ink)] ring-[var(--color-ink)]/6",
  warn: "bg-[#fff6e0] text-[#6a4a1f] ring-[var(--color-gold-bright)]/35",
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
        {eyebrow ? (
          <p className="text-[0.63rem] font-black uppercase tracking-[0.18em]" style={{ color: "var(--primary-hover)" }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-0.5 truncate font-display text-[1.62rem] font-black leading-[1.08] tracking-tight" style={{ color: "var(--text-main)" }}>
          {title}
        </h1>
        {badge ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.62rem] font-black" style={{ background: "var(--gold-soft)", color: "var(--text-main)" }}>
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
    <span
      className={`flex h-12 w-12 items-center justify-center rounded-[20px] ring-1 transition-all active:scale-[0.93] ${toneClasses[tone] || toneClasses.soft} ${className}`}
      style={{ boxShadow: "0 6px 18px var(--ink-06)" }}
    >
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
  const isDark = tone === "dark" || tone === "green";
  return (
    <Link
      href={href}
      aria-label={`${title} ${label || ""}`.trim()}
      className={`tk-spring grid min-h-[88px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[28px] p-4 no-underline ring-1 transition-all active:scale-[0.97] ${cardTone}`}
      style={{
        boxShadow: isDark
          ? "0 16px 40px var(--ink-15), 0 4px 12px var(--ink-08)"
          : "0 4px 20px var(--ink-04), 0 2px 6px var(--ink-02)",
      }}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-[22px] ${isDark ? "" : "shadow-sm ring-1 ring-[var(--color-ink)]/5"}`}
        style={{
          height: "52px",
          width: "52px",
          background: isDark ? "rgba(255,255,255,0.1)" : "var(--surface-soft)",
          color: isDark ? "white" : "var(--primary-hover)",
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[1.04rem] font-black leading-5">{title}</strong>
        {label ? <small className="mt-1.5 block truncate text-xs font-bold opacity-55">{label}</small> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {value !== undefined && value !== null ? (
          <strong className="font-display text-lg font-black leading-none">{value}</strong>
        ) : null}
        <ChevronRight size={16} className="opacity-40" />
      </span>
    </Link>
  );
}

export function TkMetric({ icon, value, label, active = false, warn = false }) {
  return (
    <div
      className="min-w-0 rounded-[26px] p-4 text-center ring-1 transition-all"
      style={{
        background: warn ? "var(--gold-soft)" : active ? "var(--text-main)" : "var(--surface)",
        color: warn ? "var(--text-main)" : active ? "white" : "var(--text-main)",
        boxShadow: warn
          ? "0 8px 20px rgba(255, 196, 0, 0.12)"
          : active
          ? "0 16px 40px var(--ink-22)"
          : "0 4px 16px var(--ink-04)",
      }}
    >
      <span
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-[18px]"
        style={{
          background: warn
            ? "rgba(255, 196, 0, 0.2)"
            : active
            ? "var(--primary)"
            : "var(--surface-soft)",
          color: warn ? "#8a5d22" : active ? "var(--text-main)" : "var(--primary-hover)",
        }}
      >
        {icon}
      </span>
      <strong
        className="mt-2.5 block truncate font-display text-[1.4rem] font-black leading-none"
        style={active ? { color: "var(--primary)" } : {}}
      >
        {value}
      </strong>
      <small className="mt-1.5 block truncate text-[0.6rem] font-black uppercase tracking-wide leading-3 opacity-55">
        {label}
      </small>
    </div>
  );
}

export function TkPrimary({ href, onClick, icon, label, disabled = false, urgent = false, className = "" }) {
  const classes = `flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-[26px] px-5 text-base font-black no-underline transition-all active:scale-[0.97] disabled:opacity-30 disabled:shadow-none ${urgent ? "animate-pulse-glow" : ""} ${className}`;
  const style = {
    background: disabled ? "var(--ink-10)" : "var(--primary)",
    color: disabled ? "var(--ink-35)" : "var(--text-main)",
    boxShadow: disabled ? "none" : "0 12px 32px var(--primary-28)",
  };

  if (href) {
    return <Link href={href} className={classes} style={style}>{icon}{label}</Link>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={classes} style={style}>{icon}{label}</button>;
}
