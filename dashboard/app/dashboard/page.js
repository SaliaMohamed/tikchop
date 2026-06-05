"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Camera,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { getDashboardData } from "../actions";
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
      <div className="app-shell px-4 pb-32 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton h-12 w-12 rounded-[18px]" />
            <div className="space-y-2">
              <div className="skeleton skeleton-text w-24" />
              <div className="skeleton skeleton-text w-32" />
            </div>
          </div>
          <div className="skeleton h-11 w-11 rounded-[17px]" />
        </div>
        <div className="mt-6 skeleton h-[190px] rounded-[34px]" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="skeleton h-[116px] rounded-[28px]" />
          <div className="skeleton h-[116px] rounded-[28px]" />
          <div className="skeleton h-[116px] rounded-[28px]" />
          <div className="skeleton h-[116px] rounded-[28px]" />
        </div>
      </div>
    );
  }

  const openOrders = Number(stats.pendingOrders || 0) + Number(stats.paidOrders || 0) + Number(stats.preparedOrders || 0);
  const hasProducts = Number(stats.products || 0) > 0;
  const mainAction = !hasProducts
    ? {
        kicker: "A faire",
        title: "Ajoutez votre premier article",
        href: "/add-product",
        cta: "Publier",
        icon: <Camera size={20} />,
      }
    : openOrders > 0
      ? {
          kicker: "Aujourd'hui",
          title: `${openOrders} vente${openOrders > 1 ? "s" : ""} en cours`,
          href: "/orders",
          cta: "Traiter",
          icon: <ClipboardList size={20} />,
        }
      : !stats.whatsappConnected
        ? {
            kicker: "WhatsApp",
            title: "Connectez WhatsApp",
            href: "/whatsapp",
            cta: "Connecter",
            icon: <Bot size={20} />,
          }
        : {
            kicker: "Pret",
            title: "Boutique active",
            href: seller.slug ? `/${seller.slug}` : "/shop-info",
            cta: "Voir",
            icon: <Store size={20} />,
          };

  return (
    <div className="app-shell mx-auto max-w-[430px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4">
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#07120d] font-display text-sm font-black text-[#39f58e] shadow-[0_12px_26px_rgb(7_18_13_/_0.14)]">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              sellerInitials
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[var(--primary)]">Accueil</p>
            <h1 className="mt-0.5 truncate font-display text-xl font-black leading-6 text-[#07120d]">{seller.name || "Boutique Tikchop"}</h1>
          </div>
        </div>
        <Link
          href={`/${seller.slug}`}
          target="_blank"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#008f5a] shadow-[0_12px_30px_rgb(7_18_13_/_0.06)] ring-1 ring-[#07120d]/8"
          aria-label="Voir la boutique"
        >
          <Store size={20} strokeWidth={2.4} />
          {openOrders > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />}
        </Link>
      </header>

      <section className="mt-6 overflow-hidden rounded-[30px] bg-white p-4 shadow-[0_18px_50px_rgb(7_18_13_/_0.08)] ring-1 ring-[#07120d]/8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0 pt-1">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--primary)]">{mainAction.kicker}</p>
            <h2 className="mt-2 max-w-[16rem] font-display text-[2rem] font-black leading-[2.1rem] tracking-[-0.03em] text-[#07120d]">
              {mainAction.title}
            </h2>
          </div>
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#eafff3] text-[#008f5a] ring-1 ring-[#39f58e]/20">
            <ShoppingBagIcon />
          </span>
        </div>
        <Link
          href={mainAction.href}
          className="mt-5 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full bg-[#008f5a] px-5 text-base font-black text-white no-underline shadow-[0_18px_36px_rgb(0_143_90_/_0.22)] active:scale-[0.98]"
        >
          {mainAction.icon}
          {mainAction.cta}
          <ChevronRight size={18} />
        </Link>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2.5">
        <MiniStat value={stats.products || 0} label="Articles" icon={<PackageCheck size={15} />} />
        <MiniStat value={stats.orders || 0} label="Ventes" icon={<ClipboardList size={15} />} dot={openOrders > 0} />
        <MiniStat value={stats.whatsappConnected ? "On" : "Off"} label="WhatsApp" icon={<Bot size={15} />} />
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-black text-[#07120d]">A suivre</h3>
          {recentOrders.length > 0 && <Link href="/orders" className="text-xs font-black text-[#008f5a] no-underline">Tout voir</Link>}
        </div>
        {recentOrders.length > 0 && (
          <div className="space-y-2">
            {recentOrders.slice(0, 2).map((order) => {
                const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
                return (
                  <Link
                    key={order.id}
                    href="/orders"
                    className="grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] bg-white p-4 text-[#07120d] no-underline shadow-[0_12px_30px_rgb(7_18_13_/_0.04)] ring-1 ring-[#07120d]/6"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-black">{order.order_ref || order.id?.slice(0, 8).toUpperCase()}</strong>
                      <small className="text-xs font-semibold text-[#4e6055]/55">{order.customer_phone || "Client WhatsApp"}</small>
                    </span>
                    <span className="shrink-0 text-right">
                      <strong className="block text-sm font-black">{money(total)}</strong>
                      <small className="text-[0.62rem] font-black uppercase text-[#008f5a]">Vente</small>
                    </span>
                  </Link>
                );
              })}
          </div>
        )}
        {recentOrders.length === 0 && (
          <Link
            href={seller.slug ? `/${seller.slug}` : "/shop-info"}
            className="grid min-h-[78px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[24px] bg-white p-4 text-[#07120d] no-underline shadow-[0_12px_30px_rgb(7_18_13_/_0.04)] ring-1 ring-[#07120d]/6"
          >
            <span className="min-w-0">
              <strong className="block text-sm font-black">Aucune vente</strong>
              <small className="block truncate text-xs font-semibold text-[#4e6055]/60">Partagez la boutique.</small>
            </span>
            <ChevronRight className="text-[#008f5a]" size={18} />
          </Link>
        )}
      </section>

      {offlineMode && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-3 text-center text-xs font-bold text-amber-900 ring-1 ring-amber-100">
          Connexion lente. Les chiffres peuvent arriver dans quelques secondes.
        </div>
      )}
    </div>
  );
}

function MiniStat({ value, label, icon, dot = false }) {
  return (
    <div className="relative rounded-[22px] bg-white px-2.5 py-4 text-center shadow-[0_10px_26px_rgb(7_18_13_/_0.04)] ring-1 ring-[#07120d]/6">
      {dot && <span className="absolute right-4 top-3 h-1.5 w-1.5 rounded-full bg-[#008f5a]" />}
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#eafff3] text-[#008f5a]">
        {icon}
      </span>
      <strong className="mt-2 block font-display text-lg font-black leading-5 text-[#07120d]">{value}</strong>
      <span className="mt-1 block text-[0.65rem] font-black text-[#4e6055]">{label}</span>
    </div>
  );
}

function ShoppingBagIcon() {
  return <ShoppingBag size={42} strokeWidth={1.9} />;
}
