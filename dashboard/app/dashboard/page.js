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
import { TkActionCard, TkIconButton, TkMetric, TkPrimary, TkScreen, TkTop } from "../components/TikchopUI";
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
    <TkScreen>
      <TkTop
        eyebrow="Accueil"
        title={seller.name || "Boutique"}
        avatar={(
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#07120d] font-display text-sm font-black text-[#39f58e] shadow-[0_12px_26px_rgba(7,18,13,0.14)]">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : sellerInitials}
          </span>
        )}
        action={(
          <TkIconButton
            href={`/${seller.slug}`}
            label="Voir boutique"
            icon={<Store size={20} strokeWidth={2.5} />}
          />
        )}
      />

      <section className="mt-5 rounded-[32px] bg-[#07120d] p-4 text-white shadow-[0_24px_60px_rgba(7,18,13,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.15em] text-[#39f58e]">{mainAction.kicker}</p>
            <h2 className="mt-2 max-w-[15rem] font-display text-[2.15rem] font-black leading-[0.98] tracking-tight text-white">
              {mainAction.title}
            </h2>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/10 text-[#39f58e]">
            <ShoppingBag size={30} strokeWidth={2.1} />
          </span>
        </div>
        <TkPrimary href={mainAction.href} icon={mainAction.icon} label={mainAction.cta} className="mt-5" />
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2.5">
        <TkMetric value={stats.products || 0} label="Articles" icon={<PackageCheck size={15} />} active={hasProducts} />
        <TkMetric value={stats.orders || 0} label="Ventes" icon={<ClipboardList size={15} />} warn={openOrders > 0} />
        <TkMetric value={stats.whatsappConnected ? "OK" : "Off"} label="WhatsApp" icon={<Bot size={15} />} active={stats.whatsappConnected} />
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-lg font-black text-[#07120d]">A suivre</h3>
          {recentOrders.length > 0 && <Link href="/orders" aria-label="Toutes les ventes" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#008f5a] no-underline ring-1 ring-[#07120d]/8"><ChevronRight size={17} /></Link>}
        </div>
        {recentOrders.length > 0 && (
          <div className="space-y-2">
            {recentOrders.slice(0, 2).map((order) => {
                const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
                return (
                  <TkActionCard
                    key={order.id}
                    href="/orders"
                    icon={<ClipboardList size={19} />}
                    title={order.order_ref || order.id?.slice(0, 8).toUpperCase()}
                    label={order.customer_phone || "Client"}
                    value={money(total)}
                  />
                );
              })}
          </div>
        )}
        {recentOrders.length === 0 && (
          <TkActionCard
            href={seller.slug ? `/${seller.slug}` : "/shop-info"}
            icon={<Store size={19} />}
            title="Aucune vente"
            label="Partager"
            value=""
            tone="mint"
          />
        )}
      </section>

      {offlineMode && (
        <div className="mt-5 rounded-2xl bg-white p-3 text-center text-xs font-black text-[#07120d]/45 ring-1 ring-[#07120d]/7">
          Chiffres indisponibles
        </div>
      )}
    </TkScreen>
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
