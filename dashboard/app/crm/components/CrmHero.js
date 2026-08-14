"use client";

import { Sparkles, UsersRound } from "lucide-react";
import { formatPrice } from "../../../lib/crm-utils";

export function CrmHero({ stats, totalCustomers }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-[26px] bg-[#0F2B20] p-5 text-white shadow-[0_4px_28px_rgba(15, 43, 32,0.25)]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[#34D399]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#34D399]/80">Carnet client</p>
          <h2 className="mt-1 font-display text-4xl font-black leading-none text-white">{totalCustomers}</h2>
          <p className="mt-1 text-sm font-bold leading-5 text-white/55">
            {totalCustomers > 0 ? "clients enregistres" : "Aucun client"}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-[#34D399] ring-1 ring-white/10">
          <UsersRound size={22} strokeWidth={2.4} />
        </div>
      </div>
      <div className="relative z-10 mt-5 rounded-[20px] bg-white/6 p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/50">
          <Sparkles size={14} className="text-[#34D399]" />
          <span>Ventes estimees</span>
        </div>
        <p className="mt-1 font-display text-2xl font-black text-[#34D399]">{formatPrice(stats.estimatedSales)}</p>
      </div>
    </div>
  );
}

export function StatTile({ label, value, tone = "soft" }) {
  const className = tone === "dark"
    ? "bg-[#0F2B20] text-white"
    : tone === "green"
      ? "bg-[#EAF8F0] text-[#047857]"
      : "bg-white text-[#0F2B20]";

  return (
    <div className={`p-3 text-center ${className}`}>
      <p className={`text-[0.62rem] font-black uppercase tracking-[0.1em] ${tone === "dark" ? "text-white/60" : tone === "green" ? "text-[#059669]" : "text-[#0F2B20]/50"}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-black leading-none">{value}</p>
    </div>
  );
}