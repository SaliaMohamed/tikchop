"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  MessageCircle,
  Package,
  Store,
  Truck,
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
};

export default function Dashboard() {
  const searchParams = useSearchParams();
  const seller = useActiveSeller();
  const sellerInitials = getSellerInitials(seller);
  const [stats, setStats] = useState(emptyStats);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const justCreated = searchParams.get("created") === "1";

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const token = await getSellerAccessToken();
        const data = await getDashboardData(seller.slug, token);
        setRecentOrders(data.recentOrders || []);
        setStats({ ...emptyStats, ...(data.stats || {}) });
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [seller.slug]);

  return (
    <div className="app-shell max-w-[980px]">
      <header className="mobile-top md:mb-5">
        <div className="flex items-center justify-between">
          <Link href={`/${seller.slug}`} className="app-icon-button bg-white" aria-label="Voir la boutique">
            <Store size={20} strokeWidth={2.3} />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-[var(--primary)]">Tikchop</h1>
          <Link href={`/${seller.slug}`} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--primary)] no-underline">
            {sellerInitials}
          </Link>
        </div>
      </header>

      <main className="space-y-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        {justCreated && (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-950">
            Votre boutique est creee. Vous etes maintenant dans votre espace vendeur Tikchop.
          </div>
        )}
        <SellerHero seller={seller} stats={stats} />
        <SellerActionStrip seller={seller} stats={stats} />
        <SellerSimpleChecklist seller={seller} stats={stats} />
        <RecentOrdersBlock orders={recentOrders} loading={loading} />

        {offlineMode && (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            Les donnees ne se chargent pas pour le moment. Verifiez la connexion puis revenez ici dans quelques secondes.
          </div>
        )}
      </main>
    </div>
  );
}

function SellerHero({ seller, stats }) {
  const connected = stats.whatsappConnected;
  const hasProducts = Number(stats.products || 0) > 0;
  const headline = hasProducts
    ? "Votre boutique peut vendre."
    : "Ajoutez vos articles. Tikchop vend.";

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)] md:grid md:grid-cols-[1fr_250px] md:gap-6 md:p-7">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
      <div>
        <p className="quiet-label text-white/52">Espace vendeur</p>
        <h2 className="mt-2 max-w-2xl font-display text-[2.4rem] font-black leading-[2.55rem] text-white md:text-5xl md:leading-[3.2rem]">
          {headline}
        </h2>
        <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white/70 md:text-base">
          Mettez les photos, les prix et les stocks. Tikchop presente, repond, prend les commandes et prepare le suivi.
        </p>
        <div className="mt-5 grid gap-2 min-[420px]:grid-cols-2">
          <Link href="/add-product" className="flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] bg-[var(--primary-bright)] px-4 text-sm font-black text-[#07120d] no-underline shadow-[0_18px_38px_rgba(57,245,142,0.22)]">
            <Camera size={19} />
            Ajouter des articles
          </Link>
          <Link href={connected ? "/orders" : "/whatsapp"} className="flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] bg-white/10 px-4 text-sm font-black text-white no-underline ring-1 ring-white/12">
            {connected ? <ClipboardList size={19} /> : <MessageCircle size={19} />}
            {connected ? "Voir les commandes" : "Activer WhatsApp"}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 md:mt-0 md:grid-cols-1">
        <HeroMetric label="Articles" value={stats.products || 0} done={hasProducts} />
        <HeroMetric label="WhatsApp" value={connected ? "OK" : "Off"} done={connected} />
        <HeroMetric label="A traiter" value={(stats.pendingOrders || 0) + (stats.paidOrders || 0) + (stats.preparedOrders || 0)} done={Number(stats.orders || 0) > 0} />
      </div>
    </section>
  );
}

function HeroMetric({ label, value, done }) {
  return (
    <div className="rounded-[18px] bg-white/10 p-3 ring-1 ring-white/10">
      <p className={`font-display text-xl font-black leading-none ${done ? "text-[var(--primary-bright)]" : "text-white"}`}>{value}</p>
      <p className="mt-1 text-[0.66rem] font-black uppercase tracking-[0.08em] text-white/48">{label}</p>
    </div>
  );
}

function SellerActionStrip({ seller, stats }) {
  return (
    <section className="grid grid-cols-3 gap-2">
      <ActionTile href="/add-product" icon={<Camera size={21} />} title="Photos" text="Ajouter" primary />
      <ActionTile href="/orders" icon={<ClipboardList size={21} />} title="Commandes" text={`${stats.orders || 0} total`} />
      <ActionTile href={`/${seller.slug}`} icon={<ExternalLink size={21} />} title="Boutique" text="Voir" />
    </section>
  );
}

function ActionTile({ href, icon, title, text, primary = false }) {
  return (
    <Link
      href={href}
      className={`min-h-[108px] rounded-[22px] p-3 no-underline shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.38)] active:scale-[0.99] ${
        primary ? "bg-[var(--text-main)] text-white" : "bg-white text-[var(--text-main)]"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${primary ? "bg-[var(--primary-bright)] text-[#07120d]" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
        {icon}
      </span>
      <span className="mt-3 block text-sm font-black leading-5">{title}</span>
      <span className={`mt-0.5 block text-xs font-bold ${primary ? "text-white/62" : "text-[var(--text-dim)]"}`}>{text}</span>
    </Link>
  );
}

function SellerSimpleChecklist({ seller, stats }) {
  const steps = [
    {
      title: "Mettre les articles",
      text: "Photos, prix, stock.",
      href: "/add-product",
      done: Number(stats.products || 0) > 0,
      icon: <Package size={18} />,
    },
    {
      title: "Brancher WhatsApp",
      text: "Tikchop repond aux clients.",
      href: "/whatsapp",
      done: Boolean(stats.whatsappConnected),
      icon: <MessageCircle size={18} />,
    },
    {
      title: "Partager le lien",
      text: `/${seller.slug}`,
      href: seller.slug ? `/${seller.slug}` : "/onboarding",
      done: Boolean(seller.slug),
      icon: <ExternalLink size={18} />,
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <section className="rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="quiet-label text-[var(--primary)]">Parcours simple</p>
          <h3 className="mt-1 font-display text-2xl font-black leading-8 text-[var(--text-main)]">
            Ce qu&apos;il faut faire
          </h3>
        </div>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">
          3 etapes
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => {
          const active = index === nextIndex;
          return (
            <Link
              key={step.title}
              href={step.href}
              className={`grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] p-3 no-underline ${
                active ? "bg-[var(--text-main)] text-white" : "bg-[var(--surface-soft)] text-[var(--text-main)]"
              }`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${step.done ? "bg-white text-[var(--primary)]" : active ? "bg-[var(--primary-bright)] text-[#07120d]" : "bg-white text-[var(--primary)]"}`}>
                {step.done ? <CheckCircle2 size={19} /> : step.icon}
              </span>
              <span className="min-w-0">
                <strong className={`block text-sm font-black leading-5 ${active ? "text-white" : "text-[var(--text-main)]"}`}>
                  {active ? "Maintenant: " : ""}{step.title}
                </strong>
                <small className={`mt-0.5 block truncate text-xs font-bold ${active ? "text-white/66" : "text-[var(--text-dim)]"}`}>{step.text}</small>
              </span>
              <ArrowRight className={active ? "text-[var(--primary-bright)]" : "text-[var(--outline)]"} size={18} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RecentOrdersBlock({ orders, loading }) {
  return (
    <section className="rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="quiet-label text-[var(--primary)]">Suivi</p>
          <h3 className="font-display text-xl font-black text-[var(--text-main)]">Commandes</h3>
        </div>
        <Link href="/orders" className="text-sm font-black text-[var(--primary)] no-underline">Tout voir</Link>
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex min-h-[86px] items-center justify-center rounded-[20px] bg-[var(--surface-soft)] text-[var(--primary)]">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : orders.length > 0 ? (
          orders.slice(0, 3).map((order) => <OrderLine key={order.id} order={order} />)
        ) : (
          <div className="grid min-h-[110px] grid-cols-[auto_1fr] items-center gap-3 rounded-[20px] bg-[var(--surface-soft)] p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--primary)] shadow-sm">
              <Truck size={21} />
            </span>
            <span>
              <strong className="block text-sm font-black text-[var(--text-main)]">Aucune commande pour le moment</strong>
              <small className="mt-1 block text-xs font-bold leading-4 text-[var(--text-dim)]">
                Ajoutez des articles puis partagez le lien boutique. Les commandes arriveront ici.
              </small>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function OrderLine({ order }) {
  const paid = order.status === "PAID" || order.status === "DELIVERED";

  return (
    <Link href="/orders" className="grid min-h-[74px] grid-cols-[1fr_auto] items-center gap-3 rounded-[18px] bg-[var(--surface-soft)] p-3 no-underline">
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <strong className="truncate text-sm font-black text-[var(--text-main)]">#{order.order_ref || order.id?.slice(0, 8)}</strong>
          <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black uppercase ${paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {paid ? "Paye" : "A confirmer"}
          </span>
        </span>
        <small className="mt-1 block truncate text-xs font-bold text-[var(--text-dim)]">{order.customer_phone || "Client non renseigne"}</small>
      </span>
      <span className="text-right">
        <strong className="block font-display text-sm font-black text-[var(--text-main)]">{money(order.total_amount)}</strong>
        <small className="text-xs font-bold text-[var(--text-dim)]">Voir</small>
      </span>
    </Link>
  );
}
