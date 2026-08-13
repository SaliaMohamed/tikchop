"use client";

import { Sparkles, UsersRound } from "lucide-react";
import { formatPrice } from "../../../lib/crm-utils";

export function CrmHero({ stats, totalCustomers }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-[26px] bg-[#07120d] p-5 text-white shadow-[0_4px_28px_rgba(7,18,13,0.25)]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[#39f58e]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#39f58e]/80">Carnet client</p>
          <h2 className="mt-1 font-display text-4xl font-black leading-none text-white">{totalCustomers}</h2>
          <p className="mt-1 text-sm font-bold leading-5 text-white/55">
            {totalCustomers > 0 ? "clients enregistres" : "Aucun client"}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-[#39f58e] ring-1 ring-white/10">
          <UsersRound size={22} strokeWidth={2.4} />
        </div>
      </div>
      <div className="relative z-10 mt-5 rounded-[20px] bg-white/6 p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/50">
          <Sparkles size={14} className="text-[#39f58e]" />
          <span>Ventes estimees</span>
        </div>
        <p className="mt-1 font-display text-2xl font-black text-[#39f58e]">{formatPrice(stats.estimatedSales)}</p>
      </div>
    </div>
  );
}

export function StatTile({ label, value, tone = "soft" }) {
  const className = tone === "dark"
    ? "bg-[#07120d] text-white"
    : tone === "green"
      ? "bg-[#eafff5] text-[#005f3d]"
      : "bg-white text-[#07120d]";

  return (
    <div className={`p-3 text-center ${className}`}>
      <p className={`text-[0.62rem] font-black uppercase tracking-[0.1em] ${tone === "dark" ? "text-white/60" : tone === "green" ? "text-[#008f5a]" : "text-[#07120d]/50"}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-black leading-none">{value}</p>
    </div>
  );
}