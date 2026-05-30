"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Camera,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  ExternalLink,
  Loader2,
  MessageCircle,
  Package,
  Share2,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "../actions";
import BrandLogo from "../components/BrandLogo";
import LaunchProgressPanel from "../components/LaunchProgressPanel";
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
  const justCreated = searchParams.get("created") === "1";
  const hasProducts = Number(stats.products || 0) > 0;
  const starterMode = (!loading && !hasProducts && recentOrders.length === 0) || (justCreated && !hasProducts);

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

  return (
    <div className="app-shell seller-desktop-dashboard">
      <header className="mobile-top md:hidden">
        <div className="flex items-center justify-between">
          <Link href={`/${seller.slug}`} className="app-icon-button bg-white" aria-label="Voir la boutique">
            <Store size={20} strokeWidth={2.3} />
          </Link>
          <BrandLogo href="/dashboard" size="sm" />
          <Link href="/app" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--outline)] bg-white text-sm font-extrabold text-[var(--primary)] no-underline" aria-label="Ouvrir le menu vendeur">
            {sellerInitials}
          </Link>
        </div>
      </header>

      <main className="space-y-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:space-y-6 md:pb-10">
        <div className="md:hidden">
          <MobileDashboardControl seller={seller} stats={stats} />
        </div>

        <div className="hidden md:block">
          {starterMode ? (
            <>
              <SellerStarterLaunch seller={seller} justCreated={justCreated} />
              <div className="hidden md:block">
                <LaunchProgressPanel stats={stats} compact />
              </div>
            </>
          ) : (
            <>
              {justCreated && (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-950 md:px-5">
                  Votre boutique est creee. Ajoutez un article, puis partagez votre lien quand vous etes pret.
                </div>
              )}
              <SellerHero seller={seller} stats={stats} />
              <div className="hidden md:block">
                <LaunchProgressPanel stats={stats} />
              </div>
              <SellerEcosystemBoard seller={seller} stats={stats} />
              <div className="hidden gap-4 md:grid lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
                <SellerSimpleChecklist stats={stats} />
                <RecentOrdersBlock orders={recentOrders} loading={loading} />
              </div>
            </>
          )}
        </div>

        {offlineMode && (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            Les donnees ne se chargent pas pour le moment. Verifiez la connexion puis revenez ici dans quelques secondes.
          </div>
        )}
      </main>
    </div>
  );
}

function MobileDashboardControl({ seller, stats }) {
  const hasProducts = Number(stats.products || 0) > 0;
  const connected = Boolean(stats.whatsappConnected);
  const payoutReady = Boolean(stats.payoutReady);
  const workCount = (stats.pendingOrders || 0) + (stats.paidOrders || 0) + (stats.preparedOrders || 0);

  // Shop readiness progress calculation
  let readinessPercent = 15; // base level (signup complete)
  if (hasProducts) readinessPercent += 30; // catalogue added
  if (connected) readinessPercent += 30; // WhatsApp linked
  if (payoutReady) readinessPercent += 25; // payment configured

  const next = getHomeNextAction({ seller, connected, hasProducts, payoutReady, workCount });

  return (
    <div className="space-y-6 px-1">
      {/* 1. Welcoming En-tête (Aynid Style) */}
      <header className="flex items-center justify-between mt-3 mb-2 px-1">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#07120d] to-[#122b20] font-display text-sm font-extrabold text-white shadow-sm ring-1 ring-white/10 overflow-hidden">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt={seller.name || "Logo boutique"} className="h-full w-full object-cover" />
            ) : (
              seller.name?.slice(0, 2).toUpperCase() || "TC"
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[#07120d] font-display leading-tight">
              {seller.name || "Boutique"}
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#685f4f]/80 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#008f5a] animate-pulse" />
              tikchop.com/{seller.slug}
            </span>
          </div>
        </div>
        <Link 
          href={`/${seller.slug}`} 
          target="_blank"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#07120d] border border-[#e8dcc8]/40 shadow-[0_2px_8px_rgba(58,47,30,0.04)] hover:bg-[#fbf9f4] active:scale-[0.96] transition"
          aria-label="Voir la boutique"
        >
          <Eye size={18} strokeWidth={2.25} className="text-[#07120d]" />
        </Link>
      </header>

      {/* 2. Shop launch progress indicator (Aynid style) */}
      <section className="bg-white rounded-[30px] p-5 border border-[#e8dcc8]/50 shadow-[0_6px_24px_rgba(58,47,30,0.03)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[var(--primary)]">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
            </span>
            <span className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#685f4f]">
              Lancement de votre boutique
            </span>
          </div>
          <span className="text-xs font-black font-display text-[var(--primary)]">
            {readinessPercent}% prêt
          </span>
        </div>
        
        <div className="h-2.5 overflow-hidden rounded-full bg-[#fbf9f4] border border-[#e8dcc8]/30">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-bright)] transition-all duration-700 ease-out" 
            style={{ width: `${readinessPercent}%` }} 
          />
        </div>

        <p className="text-[0.68rem] font-semibold text-[#685f4f]/80 leading-normal">
          {readinessPercent < 100 
            ? "Complétez les étapes de l'écosystème ci-dessous pour lancer officiellement votre activité."
            : "Félicitations ! Votre boutique est entièrement configurée et prête pour recevoir des clients."}
        </p>
      </section>

      {/* 3. Action du jour (Single CTA - Aynid Style Card) */}
      <section className="bg-white rounded-[30px] p-5 border border-[#e8dcc8]/50 shadow-[0_6px_24px_rgba(58,47,30,0.03)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[var(--primary-bright)] to-[#008f5a]" />
        
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f4fbf4] text-[#008f5a]">
            <CheckCircle2 size={13} strokeWidth={3} />
          </span>
          <span className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">
            Action recommandée
          </span>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-[1.3rem] font-black font-display text-[#07120d] leading-6 tracking-tight">
            {next.title}
          </h3>
          <p className="text-xs font-semibold leading-relaxed text-[#685f4f]">
            {next.body}
          </p>
        </div>

        <Link 
          href={next.href} 
          className="flex h-13 items-center justify-between gap-3 rounded-xl bg-[#07120d] px-4 text-xs font-black text-white no-underline shadow-[0_8px_16px_rgba(7,18,13,0.1)] active:scale-[0.98] transition"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary-bright)] text-[#07120d]">
              {React.cloneElement(next.icon, { size: 14, strokeWidth: 2.5 })}
            </span>
            {next.label}
          </span>
          <ArrowRight size={16} className="text-[var(--primary-bright)]" />
        </Link>
      </section>

      {/* 4. Tableau de Bord Graphique (Micro SVG Trend Chart) */}
      <section className="bg-white rounded-[30px] p-5 border border-[#e8dcc8]/50 shadow-[0_6px_24px_rgba(58,47,30,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#685f4f]">
              Performance Ventes
            </h4>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-[#07120d] font-display">
                {money(stats.sales)}
              </span>
              <span className="text-[0.68rem] font-bold text-[#008f5a] bg-[#e9fff1] px-1.5 py-0.5 rounded-md">
                {stats.sales > 0 ? "+12%" : "Bientôt actif"}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <span className="block text-[0.64rem] font-bold text-[#685f4f]/70 uppercase">Commandes</span>
            <span className="block text-lg font-black text-[#07120d] font-display mt-0.5">
              {stats.orders || 0}
            </span>
          </div>
        </div>

        {/* Dynamic Smooth Spline SVG Chart */}
        <div className="h-24 w-full relative mt-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#008f5a" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#008f5a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1="0" y1="5" x2="100" y2="5" stroke="#e8dcc8" strokeWidth="0.15" strokeDasharray="1,2" />
            <line x1="0" y1="15" x2="100" y2="15" stroke="#e8dcc8" strokeWidth="0.15" strokeDasharray="1,2" />
            <line x1="0" y1="25" x2="100" y2="25" stroke="#e8dcc8" strokeWidth="0.15" strokeDasharray="1,2" />

            {/* Spline Area Fill */}
            <path
              d={stats.sales > 0 
                ? "M 0 30 C 15 25, 25 28, 40 18 C 55 8, 70 12, 85 4 C 95 0, 100 2, 100 2 L 100 30 Z"
                : "M 0 30 C 20 30, 40 28, 60 28 C 80 28, 90 29, 100 29 L 100 30 Z"}
              fill="url(#chartGrad)"
            />

            {/* Spline Stroke Line */}
            <path
              d={stats.sales > 0 
                ? "M 0 30 C 15 25, 25 28, 40 18 C 55 8, 70 12, 85 4 C 95 0, 100 2, 100 2"
                : "M 0 30 C 20 30, 40 28, 60 28 C 80 28, 90 29, 100 29"}
              fill="none"
              stroke="#008f5a"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive dot at the end */}
            <circle cx="100" cy={stats.sales > 0 ? "2" : "29"} r="1.5" fill="#008f5a" stroke="#fff" strokeWidth="0.5" />
            <circle cx="100" cy={stats.sales > 0 ? "2" : "29"} r="3.5" fill="#008f5a" fillOpacity="0.15" className="animate-pulse" />
          </svg>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-between text-[0.62rem] text-[#685f4f]/60 font-semibold px-0.5">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mer</span>
          <span>Jeu</span>
          <span>Ven</span>
          <span>Sam</span>
          <span>Dim</span>
        </div>
      </section>

      {/* 5. Simple List-based Tools (Aynid inspired) */}
      <section className="bg-white rounded-[30px] border border-[#e8dcc8]/50 shadow-[0_6px_24px_rgba(58,47,30,0.03)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8dcc8]/35 bg-[#fbf9f4]/50">
          <h4 className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#685f4f]">
            Écosystème Boutique
          </h4>
        </div>
        
        <div className="divide-y divide-[#e8dcc8]/20">
          <MobileToolRow 
            href="/products"
            icon={<Package size={18} />}
            label="Mon Catalogue"
            statusText={`${stats.products || 0} article${stats.products > 1 ? 's' : ''}`}
            badge={!hasProducts ? "À faire" : null}
          />
          <MobileToolRow 
            href="/orders"
            icon={<ClipboardList size={18} />}
            label="Mes Commandes"
            statusText={workCount > 0 ? `${workCount} en attente` : "Aucune en cours"}
            badge={workCount > 0 ? `${workCount} Nouvelles` : null}
            badgeTone="gold"
          />
          <MobileToolRow 
            href="/whatsapp"
            icon={<Bot size={18} />}
            label="Assistant WhatsApp"
            statusText={connected ? "Automatique" : "Désactivé"}
            badge={!connected ? "Recommandé" : "Actif"}
            badgeTone={connected ? "green" : "gold"}
          />
          <MobileToolRow 
            href="/social-sharing"
            icon={<Share2 size={18} />}
            label="Partager la boutique"
            statusText="Lien WhatsApp & TikTok"
          />
        </div>
      </section>

      {/* 6. Stats résumées secondaires */}
      <section className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-[22px] bg-white border border-[#e8dcc8]/50 shadow-[0_4px_16px_rgba(58,47,30,0.03)] p-3.5">
          <div>
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80">En cours</span>
            <strong className={`mt-1 block font-display text-[1.15rem] font-black leading-none ${workCount > 0 ? "text-amber-600" : "text-[#07120d]"}`}>{workCount}</strong>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ClipboardList size={16} />
          </span>
        </div>
        
        <div className="flex items-center justify-between rounded-[22px] bg-white border border-[#e8dcc8]/50 shadow-[0_4px_16px_rgba(58,47,30,0.03)] p-3.5">
          <div>
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80">Articles</span>
            <strong className="mt-1 block font-display text-[1.15rem] font-black text-[#07120d] leading-none">{stats.products || 0}</strong>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[var(--primary)]">
            <Package size={16} />
          </span>
        </div>
      </section>
    </div>
  );
}

function MobileToolRow({ href, icon, label, statusText, badge = null, badgeTone = "gray" }) {
  const badgeClasses = badgeTone === "green" 
    ? "bg-[#e9fff1] text-[#008f5a]" 
    : badgeTone === "gold" 
      ? "bg-[#fff0bd] text-[#7a5800]" 
      : "bg-[#07120d]/5 text-[#07120d]";

  return (
    <Link 
      href={href}
      className="flex items-center justify-between gap-4 p-4 no-underline hover:bg-[#fbf9f4]/20 active:bg-[#fbf9f4]/40 transition group"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf9f4] text-[#07120d] group-hover:bg-white border border-[#e8dcc8]/25 transition shadow-[0_2px_6px_rgba(58,47,30,0.02)]">
          {React.cloneElement(icon, { strokeWidth: 2.25 })}
        </span>
        <div className="min-w-0">
          <strong className="block text-sm font-black text-[#07120d] leading-5">
            {label}
          </strong>
          <span className="block text-xs font-semibold text-[#685f4f] mt-0.5">
            {statusText}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className={`text-[0.62rem] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg ${badgeClasses}`}>
            {badge}
          </span>
        )}
        <ChevronRight size={15} className="text-[#a49a88] group-hover:translate-x-0.5 transition" strokeWidth={2.5} />
      </div>
    </Link>
  );
}

function SellerStarterLaunch({ seller, justCreated }) {
  return (
    <section className="overflow-hidden rounded-[32px] bg-[#07120d] text-white shadow-[var(--shadow-lg)] ring-1 ring-black/10 md:rounded-[38px]">
      <div className="p-4 md:p-7">
        <div className="md:hidden">
          <p className="quiet-label text-[var(--primary-bright)]">{justCreated ? "Boutique creee" : "Commencer"}</p>
          <h1 className="mt-2 font-display text-[2.15rem] font-black leading-[2.15rem]">
            Publier un article
          </h1>
          <Link href="/add-product" className="mt-5 flex min-h-[62px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[#07120d] no-underline">
            <Camera size={20} />
            Ajouter une photo
            <ArrowRight size={19} />
          </Link>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStarterLink href="/social-sharing" icon={<Share2 size={18} />} label="Partager" />
            <MiniStarterLink href="/whatsapp" icon={<MessageCircle size={18} />} label="WhatsApp" />
          </div>
        </div>

        <div className="hidden md:block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="quiet-label text-[var(--primary-bright)]">{justCreated ? "Boutique creee" : "Demarrage"}</p>
            <h1 className="mt-2 max-w-3xl font-display text-[2.35rem] font-black leading-[2.35rem] md:text-6xl md:leading-[1.02]">
              Mettez juste un article en ligne.
            </h1>
            <p className="mt-3 max-w-xl text-base font-bold leading-6 text-white/68 md:text-lg md:leading-8">
              Pas besoin de tout regler maintenant. Un article visible suffit pour tester la boutique et recevoir les premieres ventes.
            </p>
          </div>
          <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-[var(--primary-bright)] md:inline-flex">
            3 gestes
          </span>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3 md:gap-3">
          <StarterStep
            href="/add-product"
            number="1"
            title="Publier un article"
            text="Prenez une photo, ajoutez le prix et la quantite."
            icon={<Camera size={20} />}
            primary
          />
          <StarterStep
            href="/social-sharing"
            number="2"
            title="Partager"
            text="Envoyez le lien sur WhatsApp, TikTok ou Instagram."
            icon={<Share2 size={20} />}
          />
          <StarterStep
            href="/whatsapp"
            number="3"
            title="Activer WhatsApp"
            text="A faire apres les premiers articles pour automatiser."
            icon={<MessageCircle size={20} />}
          />
        </div>

        <div className="mt-4 grid gap-2 rounded-[24px] bg-white/8 p-3 ring-1 ring-white/10 md:grid-cols-[1fr_auto] md:items-center">
          <p className="text-sm font-bold leading-5 text-white/62">
            Paiement, zones de livraison et livreurs peuvent etre ajustes plus tard dans Plus.
          </p>
          <Link href="/app" className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#07120d] no-underline">
            Ouvrir Plus
            <ChevronRight size={17} />
          </Link>
        </div>
        </div>
      </div>
    </section>
  );
}

function MiniStarterLink({ href, icon, label }) {
  return (
    <Link href={href} className="flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-white/10 px-3 text-sm font-black text-white no-underline ring-1 ring-white/10">
      <span className="text-[var(--primary-bright)]">{icon}</span>
      {label}
    </Link>
  );
}

function StarterStep({ href, number, title, text, icon, primary = false }) {
  return (
    <Link
      href={href}
      className={`grid min-h-[88px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[22px] p-3 no-underline active:scale-[0.99] md:min-h-[150px] md:grid-cols-1 md:items-start md:p-4 ${
        primary
          ? "bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]"
          : "bg-[var(--surface-soft)] text-[var(--text-main)] ring-1 ring-[rgba(191,206,197,0.38)]"
      }`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${primary ? "bg-[var(--primary-bright)] text-[#07120d]" : "bg-white text-[var(--primary)] shadow-sm"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-[0.66rem] font-black uppercase tracking-[0.1em] ${primary ? "text-[var(--primary-bright)]" : "text-[var(--primary)]"}`}>
          Etape {number}
        </span>
        <strong className={`mt-0.5 block text-base font-black leading-5 ${primary ? "text-white" : "text-[var(--text-main)]"}`}>
          {title}
        </strong>
        <small className={`mt-1 block text-xs font-bold leading-4 ${primary ? "text-white/62" : "text-[var(--text-dim)]"}`}>
          {text}
        </small>
      </span>
      <ArrowRight className={primary ? "text-[var(--primary-bright)] md:mt-auto" : "text-[var(--outline)] md:mt-auto"} size={18} />
    </Link>
  );
}

function SellerHero({ seller, stats }) {
  const connected = stats.whatsappConnected;
  const hasProducts = Number(stats.products || 0) > 0;
  const payoutReady = Boolean(stats.payoutReady);
  const workCount = (stats.pendingOrders || 0) + (stats.paidOrders || 0) + (stats.preparedOrders || 0);
  const next = getHomeNextAction({ seller, connected, hasProducts, payoutReady, workCount });

  return (
    <>
    <section className="relative overflow-hidden rounded-[30px] bg-white p-4 shadow-[var(--shadow-md)] ring-1 ring-[rgba(0,143,90,0.18)] md:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="quiet-label text-[var(--primary)]">Action du jour</p>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">
            /{seller.slug || "boutique"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#07120d] text-[var(--primary-bright)]">
          {next.icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[1.85rem] font-black leading-[2.05rem] text-[var(--text-main)]">
            {next.title}
          </h2>
        </div>
      </div>

      <Link href={next.href} className="mt-4 flex min-h-[60px] items-center justify-center gap-2 rounded-[22px] bg-[#07120d] px-5 text-base font-black text-white no-underline shadow-[0_18px_42px_rgba(8,18,13,0.18)]">
        {next.label}
        <ArrowRight size={19} />
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MobileQuickAction href="/add-product" icon={<Camera size={18} />} title="Publier" text="Photo" primary={!hasProducts} />
        <MobileQuickAction href="/orders" icon={<ClipboardList size={18} />} title="Commandes" text={workCount > 0 ? `${workCount} ouvertes` : "Suivi"} primary={workCount > 0} />
        <MobileQuickAction
          href={connected ? "/messages" : "/whatsapp"}
          icon={<MessageCircle size={18} />}
          title={connected ? "Clients" : "WhatsApp"}
          text={connected ? "Repondre" : "Activer"}
          primary={!connected && hasProducts}
        />
      </div>
    </section>

    <section className="hidden overflow-hidden rounded-[34px] bg-white text-[var(--text-main)] shadow-[var(--shadow-md)] ring-1 ring-[rgba(0,143,90,0.18)] md:block">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="quiet-label text-[var(--primary)]">Action du jour</p>
          <h2 className="mt-1 max-w-3xl font-display text-4xl font-black leading-[1.02] text-[var(--text-main)] md:text-6xl">
            {next.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--text-dim)] md:text-base md:leading-7">
            {next.body}
          </p>
          <Link
            href={next.href}
            className="mt-5 inline-flex min-h-[58px] items-center gap-2 rounded-2xl bg-[#07120d] px-5 text-sm font-black text-white no-underline shadow-[0_18px_42px_rgba(8,18,13,0.16)]"
          >
            <span className="text-[var(--primary-bright)]">Je fais ca</span>
            <span className="text-white/45">-</span>
            {next.label}
            <ArrowRight size={18} />
          </Link>
          <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
            <HeroMetric label="Articles" value={stats.products || 0} done={hasProducts} />
            <HeroMetric label="WhatsApp" value={connected ? "OK" : "Off"} done={connected} />
            <HeroMetric label="Argent" value={payoutReady ? "OK" : "Plus tard"} done={payoutReady} />
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-black text-[var(--primary)]">
          /{seller.slug || "boutique"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <HomeAction href="/messages" title="Clients" text="Lire et repondre" icon={<MessageCircle size={20} />} />
        <HomeAction href="/orders" title="Commandes" text="Preparer et livrer" icon={<ClipboardList size={20} />} />
        <HomeAction href="/add-product" title="Articles" text="Photo, prix, stock" icon={<Camera size={20} />} />
      </div>
      </div>

      <div className="hidden bg-[#f4fff7] p-4 md:p-5 lg:block">
        <div className={`rounded-[28px] p-5 ring-1 ${
          connected ? "bg-[#dffff0] text-[#07120d] ring-emerald-200" : "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/60"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              connected ? "bg-[#07120d] text-[var(--primary-bright)]" : "bg-[#07120d] text-[#ffcf3d]"
            }`}>
              <Bot size={25} />
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${connected ? "bg-emerald-100 text-emerald-800" : "bg-[#07120d] text-[#ffcf3d]"}`}>
              {connected ? "ACTIF" : "OFF"}
            </span>
          </div>
          <h3 className="mt-4 font-display text-2xl font-black leading-8">
            WhatsApp {connected ? "vend avec Tikchop" : "n'est pas branche"}
          </h3>
          <p className="mt-2 text-sm font-bold leading-6 text-[#365247]">
            {connected ? "L'assistant peut conseiller les clients et prendre les commandes." : "Connectez WhatsApp pour laisser Tikchop repondre et vendre automatiquement."}
          </p>
          <Link href="/whatsapp" className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] text-sm font-black text-white no-underline">
            {connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {connected ? "Verifier WhatsApp" : "Connecter WhatsApp"}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <HeroMetric label="Articles" value={stats.products || 0} done={hasProducts} />
          <HeroMetric label="WhatsApp" value={connected ? "OK" : "Off"} done={connected} />
          <HeroMetric label="Ouvertes" value={workCount} done={workCount > 0} />
        </div>
      </div>
      </div>
    </section>
    </>
  );
}

function MobileQuickAction({ href, icon, title, text, primary = false }) {
  return (
    <Link
      href={href}
      className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[20px] p-2 text-center no-underline ring-1 active:scale-[0.99] ${
        primary
          ? "bg-[#07120d] text-white ring-[#07120d]"
          : "bg-[var(--surface-soft)] text-[var(--text-main)] ring-[rgba(0,143,90,0.10)]"
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${primary ? "bg-[var(--primary-bright)] text-[#07120d]" : "bg-white text-[var(--primary)] shadow-sm"}`}>
        {icon}
      </span>
      <strong className={`text-[0.78rem] font-black leading-4 ${primary ? "text-white" : "text-[var(--text-main)]"}`}>{title}</strong>
      <small className={`hidden text-[0.64rem] font-black leading-3 ${primary ? "text-white/62" : "text-[var(--text-dim)]"}`}>{text}</small>
    </Link>
  );
}

function SellerEcosystemBoard({ seller, stats }) {
  const payoutReady = Boolean(stats.payoutReady);
  const modules = [
    {
      title: "Boutique",
      text: seller.slug ? `/${seller.slug}` : "Lien a creer",
      href: seller.slug ? `/${seller.slug}` : "/onboarding",
      icon: <Store size={20} />,
      value: stats.products || 0,
      label: "articles",
      tone: "green",
    },
    {
      title: "WhatsApp",
      text: stats.whatsappConnected ? "Assistant actif" : "A connecter",
      href: "/whatsapp",
      icon: <MessageCircle size={20} />,
      value: stats.whatsappConnected ? "OK" : "Off",
      label: "vente auto",
      tone: stats.whatsappConnected ? "green" : "gold",
    },
    {
      title: "Commandes",
      text: "Emballer et livrer",
      href: "/orders",
      icon: <Truck size={20} />,
      value: stats.pendingOrders || 0,
      label: "ouvertes",
      tone: "blue",
    },
    {
      title: "Paiement",
      text: payoutReady ? "Paiement direct pret" : "A regler plus tard",
      href: "/payment-settings",
      icon: <Wallet size={20} />,
      value: payoutReady ? "OK" : "A faire",
      label: "dernier reglage",
      tone: payoutReady ? "green" : "gold",
    },
  ];

  return (
    <section className="hidden gap-2.5 md:grid md:grid-cols-4 md:gap-3">
      {modules.map((module) => (
        <Link
          key={module.title}
          href={module.href}
          className={`group min-h-[142px] overflow-hidden rounded-[24px] bg-white p-3 text-[var(--text-main)] no-underline shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)] transition active:scale-[0.99] md:min-h-[166px] md:rounded-[26px] md:p-4 md:hover:-translate-y-0.5 md:hover:shadow-[var(--shadow-md)] seller-ecosystem-card tone-${module.tone}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--surface-soft)] text-[var(--primary)] md:h-12 md:w-12 md:rounded-2xl">
              {module.icon}
            </span>
            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-black text-[var(--primary)] md:text-xs">
              {module.value}
            </span>
          </div>
          <h3 className="mt-3 font-display text-[1.05rem] font-black leading-5 md:text-lg md:leading-6">{module.title}</h3>
          <p className="mt-1 text-xs font-bold leading-4 text-[var(--text-dim)] md:text-sm md:leading-5">{module.text}</p>
          <div className="mt-3 flex items-center justify-between gap-2 md:mt-4">
            <small className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--outline)]">{module.label}</small>
            <ChevronRight className="text-[var(--primary)] transition group-hover:translate-x-0.5" size={17} />
          </div>
        </Link>
      ))}
    </section>
  );
}

function HomeAction({ href, title, text, icon, primary = false }) {
  return (
    <Link
      href={href}
      className={`grid min-h-[76px] grid-cols-[auto_1fr] items-center gap-2.5 rounded-[20px] p-2.5 no-underline active:scale-[0.99] md:min-h-[102px] md:gap-3 md:rounded-[22px] md:p-3 ${
        primary
          ? "col-span-2 bg-[var(--primary-bright)] text-[#07120d] shadow-[0_18px_40px_rgba(57,245,142,0.22)] xl:col-span-1"
          : "bg-[var(--surface-soft)] text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.12)]"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl md:h-12 md:w-12 ${primary ? "bg-[#07120d] text-[var(--primary-bright)]" : "bg-white text-[var(--primary)] shadow-sm"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className={`block text-sm font-black leading-4 md:text-base md:leading-5 ${primary ? "text-[#07120d]" : "text-[var(--text-main)]"}`}>{title}</strong>
        <small className={`mt-1 block text-xs font-bold leading-4 ${primary ? "text-[#143326]" : "text-[var(--text-dim)]"}`}>{text}</small>
      </span>
    </Link>
  );
}

function getHomeNextAction({ seller, connected, hasProducts, payoutReady, workCount }) {
  if (!hasProducts) {
    return {
      title: "Publiez un article.",
      body: "Une photo, un prix, un stock. Rien d'autre n'est obligatoire pour commencer.",
      label: "Ajouter une photo",
      href: "/add-product",
      icon: <Camera size={19} />,
    };
  }

  if (workCount > 0) {
    return {
      title: "Avancez les commandes.",
      body: "Confirmez le client, emballez le colis, puis fermez la livraison apres reception.",
      label: "Voir commandes",
      href: "/orders",
      icon: <ClipboardList size={19} />,
    };
  }

  if (!connected) {
    return {
      title: "Partagez le lien.",
      body: "Vos articles sont visibles. Envoyez la boutique aux clients avant de regler les details.",
      label: "Partager",
      href: "/social-sharing",
      icon: <Share2 size={19} />,
    };
  }

  if (!payoutReady) {
    return {
      title: "Surveillez les commandes.",
      body: "Le paiement a la livraison suffit pour demarrer. Ajoutez les paiements directs plus tard.",
      label: "Voir commandes",
      href: "/orders",
      icon: <ClipboardList size={19} />,
    };
  }

  return {
    title: "Partagez votre boutique.",
    body: "Vos articles sont en ligne. Envoyez le lien aux clients TikTok, Instagram ou WhatsApp.",
    label: "Partager",
    href: "/social-sharing",
    icon: <Share2 size={19} />,
  };
}

function HeroMetric({ label, value, done, dark = false }) {
  return (
    <div className={`rounded-[18px] p-3 ring-1 ${
      dark
        ? done ? "bg-white/12 ring-white/10" : "bg-white/8 ring-white/8"
        : done ? "bg-emerald-50 ring-emerald-100" : "bg-[var(--surface-soft)] ring-[rgba(191,206,197,0.38)]"
    }`}>
      <p className={`font-display text-xl font-black leading-none ${
        dark ? done ? "text-[var(--primary-bright)]" : "text-white" : done ? "text-[var(--primary)]" : "text-[var(--text-main)]"
      }`}>{value}</p>
      <p className={`mt-1 text-[0.66rem] font-black uppercase tracking-[0.08em] ${dark ? "text-white/58" : "text-[var(--text-dim)]"}`}>{label}</p>
    </div>
  );
}

function SellerSimpleChecklist({ stats }) {
  const payoutReady = Boolean(stats.payoutReady);
  const hasProducts = Number(stats.products || 0) > 0;
  const whatsappReady = Boolean(stats.whatsappConnected);
  const activeHref = !hasProducts
    ? "/add-product"
    : !whatsappReady
      ? "/social-sharing"
      : !payoutReady
        ? "/payment-settings"
        : "/social-sharing";
  const steps = [
    {
      title: "Mettre les articles",
      text: "Photos, prix, stock.",
      href: "/add-product",
      done: hasProducts,
      icon: <Package size={18} />,
    },
    {
      title: "Partager le lien",
      text: "WhatsApp, TikTok, Instagram.",
      href: "/social-sharing",
      done: hasProducts,
      icon: <Share2 size={18} />,
    },
    {
      title: "Brancher WhatsApp",
      text: "Tikchop repond aux clients.",
      href: "/whatsapp",
      done: whatsappReady,
      icon: <MessageCircle size={18} />,
    },
    {
      title: "Regler le paiement",
      text: payoutReady ? "Paiement direct configure." : "Wave, Orange, MTN ou livraison.",
      href: "/payment-settings",
      done: payoutReady,
      icon: <Wallet size={18} />,
    },
  ];

  return (
    <section className="rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="quiet-label text-[var(--primary)]">Parcours simple</p>
          <h3 className="mt-1 font-display text-2xl font-black leading-8 text-[var(--text-main)]">
            Ce qu&apos;il faut faire
          </h3>
        </div>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">
          4 etapes
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:gap-3">
        {steps.map((step) => {
          const active = step.href === activeHref;
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

function RecentOrdersBlock({ orders, loading, compact = false }) {
  return (
    <section className={`rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)] md:sticky md:top-[6.7rem] md:p-5 ${compact ? "mt-0" : ""}`}>
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
