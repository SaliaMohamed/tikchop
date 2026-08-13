"use client";

import { ArrowRight, MessageCircle, Star, UserRound } from "lucide-react";
import { getBestCustomerResponse } from "../../../lib/customer-response-playbook";
import { formatDate, formatPrice, getCustomerName, getItemsLabel, whatsappHref } from "../../../lib/crm-utils";

export function CustomerCard({ customer, sellerName, onOpen }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bestResponse = getBestCustomerResponse(customer, { sellerName, origin });
  const followUrl = whatsappHref(customer, sellerName);
  const lastOrder = customer.lastOrder;
  const totalLabel = customer.totalSpent > 0 ? formatPrice(customer.totalSpent) : formatPrice(customer.totalEstimated);
  const action = customer.shouldFollowUp ? "Relancer" : customer.isLoyal ? "Bon client" : bestResponse?.shortTitle || "Voir";

  return (
    <div className="overflow-hidden rounded-[24px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
      <button type="button" onClick={onOpen} className="w-full p-3 text-left active:scale-[0.99] transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              customer.shouldFollowUp ? "bg-amber-100 text-amber-800" : customer.isLoyal ? "bg-[#eafff5] text-[#005f3d]" : "bg-white text-[#008f5a] shadow-sm"
            }`}
            >
              {customer.isLoyal ? <Star size={18} /> : <UserRound size={18} />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black text-[#07120d]">{getCustomerName(customer)}</p>
              <p className="mt-0.5 truncate text-[0.68rem] font-bold text-[#07120d]/50">
                Achat {formatDate(lastOrder?.created_at)}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[0.62rem] font-black uppercase ${
            customer.shouldFollowUp ? "bg-amber-100 text-amber-800" : "bg-[#008f5a]/10 text-[#008f5a]"
          }`}
          >
            {action}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#07120d]/8">
          <p className="truncate text-xs font-black text-[#07120d]">{getItemsLabel(lastOrder)}</p>
          <p className="mt-0.5 truncate text-[0.65rem] font-bold text-[#07120d]/50">
            {customer.zone || customer.address || "Zone a confirmer"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniMetric label="Cmd" value={customer.orderCount} />
          <MiniMetric label="Conf" value={customer.confirmedCount} />
          <MiniMetric label="Total" value={totalLabel} small />
        </div>
      </button>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-[#07120d]/8 bg-[#fbf9f4] p-2.5">
        <a
          href={followUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] text-xs font-black ${
            followUrl
                ? "bg-[#07120d] text-white"
              : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30"
          }`}
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
        <button type="button" onClick={onOpen} className="flex h-[46px] w-[46px] items-center justify-center rounded-[18px] bg-white text-[#008f5a] shadow-sm">
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

export function MiniMetric({ label, value, small = false }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2 py-1.5 text-center ring-1 ring-[#07120d]/8">
      <p className="truncate text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#07120d]/40">{label}</p>
      <p className={`mt-0.5 truncate font-display font-black text-[#07120d] ${small ? "text-[0.8rem] leading-4 mt-1" : "text-base leading-4"}`}>{value}</p>
    </div>
  );
}