"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  Camera,
  ChevronRight,
  ClipboardList,
  Eye,
  Loader2,
} from "lucide-react";
import { getDashboardData } from "../actions";
import BrandLogo from "../components/BrandLogo";
import { getSellerInitials, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;

const emptyStats = {
  sales: 0,
  orders: 0,
  products: 0,
  pendingOrders: 0,
  paidOrders: 0,
  preparedOrders: 0,
  whatsappConnected: false,
  whatsappStatus: "unknown",
  payoutReady: false,
  payoutStatus: "not_configured",
};

export default function Dashboard() {
  const searchParams = useSearchParams();
  const seller = useActiveSeller();
  const sellerInitials = getSellerInitials(seller);
  const [stats, setStats] = useState(emptyStats);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const token = await getSellerAccessToken();
        const data = await getDashboardData(seller.slug, token);
        setRecentOrders(data.recentOrders || []);
        setStats({ ...emptyStats, ...(data.stats || {}) });
      } catch (err) {
        console.warn("Dashboard data unavailable:", err);
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [seller.slug]);

  if (loading) {
    return (
      <div className="app-shell px-4 pt-6 pb-32">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="skeleton h-11 w-11 rounded-[16px]" />
            <div className="space-y-2">
              <div className="skeleton skeleton-text w-32" />
              <div className="skeleton skeleton-text w-24" style={{ height: '0.7em' }} />
            </div>
          </div>
          <div className="skeleton h-10 w-10 rounded-[14px]" />
        </div>
        {/* Skeleton CA */}
        <div className="py-10 text-center">
          <div className="skeleton skeleton-text mx-auto w-20 mb-3" style={{ height: '0.7em' }} />
          <div className="skeleton skeleton-text mx-auto w-48" style={{ height: '2.8rem' }} />
          <div className="skeleton skeleton-text mx-auto w-32 mt-3" style={{ height: '0.7em' }} />
        </div>
        {/* Skeleton Actions */}
        <div className="space-y-2">
          <div className="skeleton h-[58px] w-full rounded-[22px]" />
          <div className="skeleton h-[58px] w-full rounded-[22px]" />
          <div className="skeleton h-[58px] w-full rounded-[22px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] px-4">
      {/* 1. Header minimaliste */}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#07120d] font-display text-sm font-extrabold text-white overflow-hidden shadow-sm">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              sellerInitials
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black text-[#07120d] leading-none truncate">{seller.name}</h1>
            <a href={`/${seller.slug}`} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-[#008f5a] hover:underline mt-1 truncate">
              tikchop.com/{seller.slug}
            </a>
          </div>
        </div>
        <Link href={`/${seller.slug}`} target="_blank" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#07120d]/5 text-[#07120d] active:scale-95 transition">
          <Eye size={18} strokeWidth={1.5} />
        </Link>
      </header>

      {/* 2. CA Géant (Extreme Contrast) */}
      <section className="py-10 text-center animate-rise-in stagger-1">
        <span className="text-[0.7rem] font-black uppercase tracking-[0.15em] text-[#4e6055]">Chiffre d'affaires</span>
        <h2 className="mt-2 font-display text-5xl font-black text-[#07120d] leading-none tracking-[-0.04em] md:text-6xl">
          {money(stats.sales)}
        </h2>
        <p className="mt-3 text-xs font-semibold text-[#4e6055]/70">
          {stats.orders || 0} commande{stats.orders > 1 ? "s" : ""} au total
        </p>
      </section>

      {/* 3. Actions Rapides — Stagger */}
      <section className="space-y-2 pt-2">
        <Link
          href="/add-product"
          className="animate-rise-in stagger-2 flex min-h-[58px] w-full items-center justify-between rounded-[22px] bg-[#07120d] px-5 text-white active:scale-[0.98] transition shadow-[0_12px_32px_rgba(7,18,13,0.1)]"
        >
          <span className="flex items-center gap-3">
            <Camera size={18} strokeWidth={1.5} className="text-[#39f58e]" />
            <span className="font-display text-[0.95rem] font-black">Publier un article</span>
          </span>
          <ChevronRight size={16} strokeWidth={1.5} className="text-[#39f58e]" />
        </Link>

        <Link
          href="/orders"
          className="animate-rise-in stagger-3 flex min-h-[58px] w-full items-center justify-between rounded-[22px] bg-white border border-[#07120d]/10 px-5 text-[#07120d] active:scale-[0.98] transition"
        >
          <span className="flex items-center gap-3 min-w-0">
            <ClipboardList size={18} strokeWidth={1.5} className="shrink-0 text-[#008f5a]" />
            <span className="font-display text-[0.95rem] font-black truncate">Gérer mes commandes</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 ml-2">
            {stats.pendingOrders > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-extrabold text-amber-800 whitespace-nowrap">
                {stats.pendingOrders} nouvelle{stats.pendingOrders > 1 ? "s" : ""}
              </span>
            )}
            <ChevronRight size={16} strokeWidth={1.5} className="text-[#07120d]/30" />
          </span>
        </Link>

        <Link
          href="/whatsapp"
          className="animate-rise-in stagger-4 flex min-h-[58px] w-full items-center justify-between rounded-[22px] bg-white border border-[#07120d]/10 px-5 text-[#07120d] active:scale-[0.98] transition"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Bot size={18} strokeWidth={1.5} className="shrink-0 text-[#008f5a]" />
            <span className="font-display text-[0.95rem] font-black">Assistant WhatsApp</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 ml-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-extrabold whitespace-nowrap ${stats.whatsappConnected ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
              {stats.whatsappConnected ? "Actif" : "À brancher"}
            </span>
            <ChevronRight size={16} strokeWidth={1.5} className="text-[#07120d]/30" />
          </span>
        </Link>
      </section>

      {/* 4. Commandes Récentes (Strict Minimalist List) */}
      <section className="mt-10 animate-fade-in">
        <div className="flex items-center justify-between px-1 mb-4">
          <h3 className="font-display text-base font-black text-[#07120d]">Suivi des commandes</h3>
          {recentOrders.length > 0 && (
            <Link href="/orders" className="text-xs font-black text-[#008f5a] hover:underline">
              Tout voir
            </Link>
          )}
        </div>

        <div className="space-y-2">
          {recentOrders.length > 0 ? (
            recentOrders.slice(0, 3).map((order) => {
              const isPaid = ["PAID", "PREPARED", "DELIVERED"].includes(order.status);
              return (
                <Link
                  key={order.id}
                  href="/orders"
                  className="flex items-center justify-between gap-3 rounded-[22px] bg-white border border-[#07120d]/6 p-4 active:scale-[0.99] transition no-underline"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-black text-[#07120d] truncate">
                      #{order.order_ref || order.id?.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs font-semibold text-[#4e6055]/70 mt-1 truncate">
                      {order.customer_phone || "Client"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-sm font-black text-[#07120d]">{money(order.total_amount)}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase whitespace-nowrap ${isPaid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {isPaid ? "Confirmée" : "À valider"}
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-[22px] bg-white border border-[#07120d]/6 p-5 text-center">
              <p className="text-sm font-bold text-[#4e6055]">Aucune commande pour l'instant.</p>
              <p className="text-[0.7rem] font-semibold text-[#4e6055]/60 mt-1">
                Les commandes apparaissent ici dès que vos clients achètent.
              </p>
            </div>
          )}
        </div>
      </section>

      {offlineMode && (
        <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-xs font-semibold text-amber-900 text-center ring-1 ring-amber-100 animate-pulse">
          Mode hors-ligne. Les données peuvent mettre quelques secondes à s'actualiser.
        </div>
      )}
    </div>
  );
}
