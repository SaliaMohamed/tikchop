"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ClipboardList,
  ExternalLink,
  MoveUpRight,
  MessageCircle,
  Package,
  ReceiptText,
  Store,
  TrendingUp,
  Truck,
} from "lucide-react";
import { getDashboardData } from "../actions";
import { getSellerInitials, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} CFA`;

const emptyStats = {
  sales: 0,
  orders: 0,
  products: 0,
  messagesReceived: 0,
  confirmedOrders: 0,
  clientsFollowedUp: 0,
  weeklyClientsHandled: 0,
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
        setStats(data.stats || emptyStats);
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [seller.slug]);

  const summary = useMemo(
    () => [
      { label: "Messages recus", value: stats.messagesReceived, icon: <MessageCircle size={19} /> },
      { label: "Confirmees", value: stats.confirmedOrders, icon: <ReceiptText size={19} /> },
      { label: "Clients relances", value: stats.clientsFollowedUp, icon: <ClipboardList size={19} /> },
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
          <Link href={`/${seller.slug}`} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--primary)] no-underline">
            {sellerInitials}
          </Link>
        </div>
      </header>

      <main className="space-y-7 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <section className="space-y-2">
          <p className="quiet-label text-[var(--primary)]">Espace vendeur</p>
          <h2 className="font-display text-3xl font-bold leading-9 text-[var(--text-main)]">Bonjour, {seller.name.split(" ")[0]}</h2>
          <p className="text-sm font-semibold leading-6 text-[var(--text-dim)]">
            Publie, confirme et livre sans perdre les clients qui ecrivent sur WhatsApp.
          </p>
        </section>

        <section className="relative overflow-hidden rounded-[28px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[#315bc7]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/48">Boutique active</p>
              <h3 className="mt-2 break-words font-display text-2xl font-bold leading-8">{seller.name}</h3>
              <p className="mt-1 text-sm font-bold text-[var(--primary-bright)]">/{seller.slug}</p>
            </div>
            <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--text-main)] no-underline shadow-sm" aria-label="Voir la boutique">
              <MoveUpRight size={21} />
            </Link>
          </div>
          <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
            <MiniMetric label="Clients" value={stats.weeklyClientsHandled || 0} />
            <MiniMetric label="Ventes" value={money(stats.sales).replace(" CFA", "")} />
            <MiniMetric label="Articles" value={stats.products || 0} />
          </div>
        </section>

        <section className="space-y-3">
          <Link href="/add-product" className="app-dashboard-hero block min-h-[126px] no-underline active:scale-[0.99]">
            <span className="relative z-10 flex items-center gap-4">
              <span className="flex h-15 w-15 shrink-0 items-center justify-center rounded-xl bg-white text-[#101814]">
                <Camera size={29} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-bold leading-8 text-white">Publier un article</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-white/70">Photo depuis galerie, IA, prix et quantite.</span>
              </span>
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white min-[390px]:flex">
                <ArrowRight size={21} />
              </span>
            </span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <SellerShortcut href="/orders" tone="blue" icon={<ClipboardList size={22} />} title="Commandes" subtitle="Preparer, livrer" />
            <SellerShortcut href={`/${seller.slug}`} tone="amber" icon={<ExternalLink size={22} />} title="Boutique" subtitle="Lien client" />
            <SellerShortcut href="/products" tone="green" icon={<Package size={22} />} title="Articles" subtitle="Prix et stock" />
            <SellerShortcut href="/whatsapp" tone="green" icon={<MessageCircle size={22} />} title="WhatsApp" subtitle="Assistant client" />
            <SellerShortcut href="/delivery-settings" tone="blue" icon={<Truck size={22} />} title="Livraison" subtitle="Zones, livreurs" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="app-card col-span-2 bg-[var(--text-main)] p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Preuve de resultat</p>
                <p className="mt-2 font-display text-2xl font-bold leading-8">
                  Tikchop a traite {stats.weeklyClientsHandled || 0} client{stats.weeklyClientsHandled > 1 ? "s" : ""} cette semaine.
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-white/62">
                  Commandes boutique et WhatsApp reunies pour montrer la valeur au vendeur.
                </p>
              </div>
              <span className="app-icon-pill shrink-0 bg-white text-[var(--text-main)]">
                <TrendingUp size={21} />
              </span>
            </div>
          </div>

          <div className="app-card col-span-2 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="quiet-label">Ventes estimees</p>
              <span className="app-icon-pill bg-[var(--accent-soft)] text-[var(--accent)]">
                <TrendingUp size={21} />
              </span>
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
              <div className="app-icon-pill bg-[var(--surface-mid)] text-[var(--secondary)]">
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
          <SectionTitle title="Commandes recentes" action="Voir tout" href="/orders" />
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

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
      <p className="font-display text-lg font-bold leading-none text-white">{value}</p>
      <p className="mt-1 truncate text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-white/48">{label}</p>
    </div>
  );
}

function SellerShortcut({ href, icon, title, subtitle, tone = "green" }) {
  const toneClass = {
    green: "bg-[var(--surface-soft)] text-[var(--primary)]",
    blue: "bg-[var(--info-soft)] text-[var(--info)]",
    amber: "bg-[var(--accent-soft)] text-[var(--accent)]",
  }[tone];

  return (
    <Link href={href} className="app-quick-tile flex-col justify-between bg-white no-underline active:scale-[0.99]">
      <span className={`app-icon-pill ${toneClass}`}>
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
      <span className="mr-3 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--primary)] min-[390px]:flex">
        <MessageCircle size={19} />
      </span>
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
