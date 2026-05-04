"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Copy,
  ImagePlus,
  Package,
  ReceiptText,
  Store,
  TrendingUp,
} from "lucide-react";
import { getDashboardData } from "./actions";

const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} CFA`;

const emptyStats = {
  sales: 0,
  orders: 0,
  products: 0,
};

export default function Dashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const data = await getDashboardData();
        setRecentOrders(data.recentOrders || []);
        setStats(data.stats || emptyStats);
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const summary = useMemo(
    () => [
      { label: "Commandes", value: stats.orders, icon: <ReceiptText size={19} /> },
      { label: "Produits actifs", value: stats.products, icon: <Package size={19} /> },
    ],
    [stats],
  );

  return (
    <div className="app-shell">
      <header className="mobile-top md:mb-6">
        <div className="flex items-center justify-between">
          <button className="app-icon-button bg-white" aria-label="Boutique">
            <Store size={20} strokeWidth={2.3} />
          </button>
          <h1 className="font-display text-xl font-extrabold text-[var(--primary)]">Tikchop</h1>
          <Link href="/salia" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--primary)] no-underline">
            SA
          </Link>
        </div>
      </header>

      <main className="space-y-7 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold leading-8 text-[var(--text-main)]">Bonjour, Salia</h2>
          <p className="text-sm leading-6 text-[var(--text-dim)]">
            Choisis une action. Le plus important reste en haut.
          </p>
        </section>

        <section className="space-y-3">
          <Link href="/add-product" className="flex min-h-[118px] items-center gap-4 rounded-xl bg-[var(--primary)] p-5 text-white no-underline shadow-[0_14px_34px_rgba(0,108,73,0.18)] active:scale-[0.99]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
              <ImagePlus size={27} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-bold leading-8">Ajouter un article</span>
              <span className="mt-1 block text-sm font-semibold leading-5 text-white/78">Photo, prix, stock. Vocal possible si besoin.</span>
            </span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <SellerShortcut href="/orders" icon={<ClipboardList size={22} />} title="Voir les commandes" subtitle="Clients et livraison" />
            <SellerShortcut href="/salia" icon={<Copy size={22} />} title="Lien boutique" subtitle="Partager aux clients" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="app-card col-span-2 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="quiet-label">Chiffre d&apos;affaires</p>
              <TrendingUp className="text-[var(--primary)]" size={21} />
            </div>
            <p className="font-display text-[2rem] font-bold leading-none text-[var(--text-main)]">
              {money(stats.sales)}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--primary-bright)]">
              {stats.orders > 0 ? `${stats.orders} commandes au total` : "Pret a recevoir les premieres ventes"}
            </p>
          </div>

          {summary.map((item) => (
            <div key={item.label} className="app-card flex min-h-[132px] flex-col justify-between p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--secondary)]">
                {item.icon}
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-[var(--text-main)]">{item.value}</p>
                <p className="mt-1 text-sm text-[var(--text-dim)]">{item.label}</p>
              </div>
            </div>
          ))}
        </section>

        {offlineMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            Supabase n&apos;est pas configure localement. Les donnees reelles apparaitront apres configuration.
          </div>
        )}

        <section>
          <SectionTitle title="Commandes récentes" action="Voir tout" href="/orders" />
          <div className="mt-4 space-y-4">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => <OrderLine key={order.id} order={order} />)
            ) : (
              <div className="app-card p-7 text-center">
                <p className="font-display text-lg font-bold text-[var(--text-main)]">{loading ? "Chargement..." : "Aucune commande"}</p>
                <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-5 text-[var(--text-dim)]">
                  Les commandes boutique et WhatsApp apparaitront ici.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SellerShortcut({ href, icon, title, subtitle }) {
  return (
    <Link href={href} className="app-card flex min-h-[104px] flex-col justify-between p-4 no-underline active:scale-[0.99]">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--primary)]">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold leading-5 text-[var(--text-main)]">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-4 text-[var(--text-dim)]">{subtitle}</span>
      </span>
    </Link>
  );
}

function SectionTitle({ title, action, href }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-display text-xl font-semibold text-[var(--text-main)]">{title}</h3>
      {href && (
        <Link href={href} className="text-sm font-semibold text-[var(--primary)] no-underline">
          {action}
        </Link>
      )}
    </div>
  );
}

function OrderLine({ order }) {
  const paid = order.status === "PAID" || order.status === "DELIVERED";

  return (
    <div className="app-card flex items-center p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display font-semibold text-[var(--text-main)]">#{order.order_ref || order.id?.slice(0, 8)}</p>
          <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase ${paid ? "bg-emerald-100 text-emerald-800" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
            {paid ? "Paye" : "En attente"}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-[var(--text-dim)]">{order.customer_phone || "Client non renseigne"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display font-semibold text-[var(--text-main)]">{money(order.total_amount)}</p>
        <p className="text-xs text-[var(--text-dim)]">Recent</p>
      </div>
    </div>
  );
}
