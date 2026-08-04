"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Camera,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  LogOut,
  MessageCircle,
  Package,
  Share2,
  ShoppingBag,
  Store,
  Truck,
  User,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { getDashboardData } from "../actions";
import LaunchProgressPanel from "../components/LaunchProgressPanel";
import { clearActiveSeller, getSellerInitials, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { supabase } from "../../lib/supabase";
import { IllustrationWhatsApp, IllustrationCart, IllustrationEmptyShop } from "../components/TikchopIllustrations";

const emptyStats = {
  products: 0,
  pendingOrders: 0,
  paidOrders: 0,
  preparedOrders: 0,
  whatsappConnected: false,
  whatsappStatus: "unknown",
  payoutReady: false,
  payoutStatus: "not_configured",
};

export default function SellerMenuPage() {
  const seller = useActiveSeller();
  const initials = getSellerInitials(seller);
  const [stats, setStats] = useState(emptyStats);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadStatus() {
      if (!seller.slug) {
        setStatusLoading(false);
        return;
      }

      try {
        const token = await getSellerAccessToken();
        const data = await getDashboardData(seller.slug, token);
        if (alive) setStats({ ...emptyStats, ...(data.stats || {}) });
      } catch (error) {
        console.warn("Menu status unavailable:", error);
      } finally {
        if (alive) setStatusLoading(false);
      }
    }

    loadStatus();

    return () => {
      alive = false;
    };
  }, [seller.slug]);

  async function signOut() {
    clearActiveSeller();
    await supabase?.auth.signOut().catch(() => {});
    window.location.replace("/login");
  }

  const whatsappConnected = Boolean(stats.whatsappConnected);
  const payoutReady = Boolean(stats.payoutReady);
  const workCount = (stats.pendingOrders || 0) + (stats.paidOrders || 0) + (stats.preparedOrders || 0);
  const hasProducts = Number(stats.products || 0) > 0;

  if (!seller.slug) {
    return (
      <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8 px-4">
        <div className="flex flex-col items-center justify-center text-center p-8 bg-[#07120d] rounded-[32px] my-6 relative overflow-hidden text-white shadow-2xl">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(57,245,142,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(57,245,142,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative z-10 flex flex-col items-center max-w-xs">
            <IllustrationEmptyShop size={130} />
            <h2 className="mt-4 font-display text-2xl font-black text-white">Aucune boutique active</h2>
            <p className="mt-2 text-sm font-bold text-white/60 leading-relaxed">
              Créez votre boutique en 2 minutes pour commencer à vendre sur WhatsApp.
            </p>
            <Link
              href="/onboarding?new=1"
              className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#39f58e] text-base font-black text-[#07120d] shadow-[0_16px_36px_rgba(57,245,142,0.3)] active:scale-[0.98] transition no-underline"
            >
              <Store size={18} />
              Créer ma boutique
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="mt-4 text-xs font-bold text-white/40 hover:text-white/80 py-1 transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8">
      <MobileMenuCockpit
        seller={seller}
        stats={stats}
        hasProducts={hasProducts}
        payoutReady={payoutReady}
        whatsappConnected={whatsappConnected}
        workCount={workCount}
        onSignOut={signOut}
      />

      <div className="mt-3 md:hidden">
        <div className="hidden">
          <LaunchProgressPanel stats={stats} compact />
        </div>
      </div>

      <DesktopMenuHero seller={seller} initials={initials} stats={stats} payoutReady={payoutReady} whatsappConnected={whatsappConnected} />

      <main className="mt-4 grid gap-4 md:mt-5 md:gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <section className="hidden overflow-hidden rounded-[32px] bg-[#07120d] text-white shadow-[var(--shadow-lg)] ring-1 ring-black/10 md:block">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="p-5 md:p-7">
                <p className="quiet-label text-[var(--primary-bright)]">Ce qui vend vraiment</p>
                <h2 className="mt-2 font-display text-3xl font-black leading-[1.05] md:text-5xl">
                  La machine doit etre complete.
                </h2>
                <p className="mt-3 max-w-md text-sm font-bold leading-6 text-white/66">
                  Tikchop devient utile quand les articles, WhatsApp, la livraison et les commandes travaillent ensemble.
                </p>
                <Link
                  href={!hasProducts ? "/add-product" : !whatsappConnected ? "/whatsapp" : workCount > 0 ? "/orders" : !payoutReady ? "/payment-settings" : "/orders"}
                  className="mt-5 inline-flex min-h-[54px] items-center gap-2 rounded-2xl bg-[var(--primary-bright)] px-5 text-sm font-black text-[#07120d] no-underline shadow-[0_18px_42px_rgb(57_245_142_/_0.25)]"
                >
                  {!hasProducts ? "Ajouter les articles" : !whatsappConnected ? "Connecter WhatsApp" : workCount > 0 ? "Voir les commandes" : !payoutReady ? "Regler le paiement" : "Voir les commandes"}
                  <ChevronRight size={18} />
                </Link>
              </div>
              <div className="grid gap-2 bg-white/6 p-3 md:p-4">
                <FlowStep
                  href="/add-product"
                  icon={<Package size={20} />}
                  title="1. Articles"
                  text={hasProducts ? `${stats.products} article${stats.products > 1 ? "s" : ""} en ligne` : "Ajoutez photos + prix"}
                  done={hasProducts}
                />
                <FlowStep
                  href="/whatsapp"
                  icon={<Bot size={20} />}
                  title="2. WhatsApp"
                  text={whatsappConnected ? "Assistant pret a vendre" : "A connecter apres les articles"}
                  done={whatsappConnected}
                  urgent={hasProducts && !whatsappConnected}
                />
                <FlowStep
                  href="/orders"
                  icon={<ClipboardList size={20} />}
                  title="3. Commandes"
                  text={workCount > 0 ? `${workCount} commande${workCount > 1 ? "s" : ""} ouverte${workCount > 1 ? "s" : ""}` : "Rien en attente"}
                  done={workCount > 0}
                />
                <FlowStep
                  href="/payment-settings"
                  icon={<Wallet size={20} />}
                  title="4. Paiement"
                  text={payoutReady ? "Paiement direct pret" : "A regler en dernier"}
                  done={payoutReady}
                  urgent={hasProducts && whatsappConnected && !payoutReady}
                />
              </div>
            </div>
          </section>

          <section className="hidden rounded-[24px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(0,143,90,0.2)] md:block md:rounded-[28px] md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="quiet-label text-[var(--primary)]">Actions directes</p>
                <h2 className="font-display text-xl font-black text-[var(--text-main)] md:text-2xl">Ouvrir rapidement</h2>
              </div>
              <span className="rounded-full bg-[#eafff1] px-3 py-1.5 text-xs font-black text-[#005f3d]">Simple</span>
            </div>
            <div className="mt-3 grid gap-2 md:mt-4 md:grid-cols-2 md:gap-3">
              <MenuLink href="/products" icon={<Package size={20} />} title="Mes articles" text={`${stats.products || 0} en ligne`} tone="strong" />
              <MenuLink href="/add-product" icon={<Camera size={20} />} title="Ajouter articles" text="Photos, prix, stock" tone={!hasProducts ? "critical" : "default"} />
              <MenuLink href="/orders" icon={<ClipboardList size={20} />} title="Commandes" text={`${workCount} ouverte${workCount > 1 ? "s" : ""}`} tone={workCount > 0 ? "urgent" : "default"} />
              <MenuLink href="/messages" icon={<MessageCircle size={20} />} title="Messages" text="Lire et repondre" />
              <MenuLink href="/whatsapp" icon={<Bot size={20} />} title="Assistant WhatsApp" text={statusLoading ? "Verification..." : whatsappConnected ? "Connecte et actif" : "A connecter maintenant"} tone={whatsappConnected ? "success" : "critical"} badge={whatsappConnected ? "Actif" : "Off"} />
              <MenuLink href="/shop-info" icon={<Store size={20} />} title="Informations boutique" text="Nom, lien, bot, zones." tone="strong" />
              <MenuLink href="/social-sharing" icon={<Share2 size={20} />} title="Partager la boutique" text="WhatsApp, TikTok, Instagram" tone="strong" />
              <MenuLink href={seller.slug ? `/${seller.slug}` : "/onboarding"} icon={<Store size={20} />} title="Voir boutique" text="Comme le client la voit" />
            </div>
          </section>

          <section className="hidden rounded-[24px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(0,143,90,0.15)] md:block md:rounded-[28px] md:p-5">
            <p className="quiet-label text-[var(--primary)]">Reglages utiles</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <MenuLink href="/delivery-settings" icon={<Truck size={20} />} title="Livraison" text="Zones, frais, livreurs." />
              <MenuLink href="/crm" icon={<Users size={20} />} title="Clients" text="Relances et suivi simple." />
              <MenuLink href="/payment-settings" icon={<Wallet size={20} />} title="Paiement" text="Dernier reglage vendeur." />
              <MenuLink href="/shop-info" icon={<Store size={20} />} title="Fiche boutique" text="Infos que Tikchop utilise." />
              <MenuLink href="/social-sharing" icon={<Share2 size={20} />} title="Reseaux sociaux" text="Textes et liens prets." />
              <MenuLink href="/account" icon={<User size={20} />} title="Mon compte" text="Profil, email, securite." />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="hidden md:block">
            <LaunchProgressPanel stats={stats} />
          </div>

          <div className="hidden md:block">
            <WhatsAppStatusPanel connected={whatsappConnected} loading={statusLoading} />
          </div>

          <div className="hidden md:block">
            <SellerHealthPanel stats={stats} workCount={workCount} payoutReady={payoutReady} whatsappConnected={whatsappConnected} />
          </div>

        <section className="hidden rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)] md:block md:p-5">
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[20px] bg-[var(--surface-soft)] px-4 text-left text-[var(--text-main)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
                <LogOut size={20} />
              </span>
              <span>
                <strong className="block text-sm font-black">Se deconnecter</strong>
                <small className="mt-0.5 block text-xs font-bold text-[var(--text-dim)]">Changer de boutique.</small>
              </span>
            </span>
          </button>
        </section>
        </aside>
      </main>
    </div>
  );
}

function MobileMenuCockpit({ seller, stats, hasProducts, payoutReady, whatsappConnected, workCount, onSignOut }) {
  const shopName = seller.name || "Tikchop";
  const shopLink = seller.slug ? `/${seller.slug}` : "/onboarding";
  const nextAction = !hasProducts
    ? { href: "/add-product", label: "Publier", icon: <Camera size={20} /> }
    : workCount > 0
      ? { href: "/orders", label: "Voir ventes", icon: <ClipboardList size={20} /> }
      : !whatsappConnected
        ? { href: "/whatsapp", label: "Brancher WhatsApp", icon: <Bot size={20} /> }
        : { href: shopLink, label: "Voir boutique", icon: <Eye size={20} /> };

  return (
    <section className="mx-auto mt-3 w-full max-w-[430px] space-y-4 px-1 md:hidden">
      <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_50px_rgb(7_18_13_/_0.08)] ring-1 ring-[#07120d]/8">
        {/* Top gradient stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#008f5a] via-[#39f58e] to-[#008f5a]" />
        <div className="flex items-center gap-3 p-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#07120d] to-[#0d2318] font-display text-lg font-black text-[#39f58e] shadow-[0_14px_30px_rgb(7_18_13_/_0.22)]">
            {(shopName || "T").slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#39f58e] text-[#07120d]">
              <Zap size={10} strokeWidth={3} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.13em] text-[var(--primary)]">Boutique</p>
            <h1 className="mt-0.5 truncate font-display text-[1.55rem] font-black leading-7 text-[#07120d]">{shopName}</h1>
          </div>
          <Link
            href={nextAction.href}
            aria-label={nextAction.label}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#39f58e] text-[#07120d] no-underline shadow-[0_16px_34px_rgb(57_245_142_/_0.32)] active:scale-[0.97]"
          >
            {nextAction.icon}
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MobileMiniStat label="Articles" value={stats.products || 0} />
          <MobileMiniStat label="Ventes" value={workCount} active={workCount > 0} />
          <MobileMiniStat label="WhatsApp" value={whatsappConnected ? "OK" : "Off"} active={whatsappConnected} warn={!whatsappConnected && hasProducts} />
        </div>
      </section>

      {!whatsappConnected && hasProducts && (
        <Link
          href="/whatsapp"
          className="grid min-h-[68px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[24px] bg-[#eafff3] px-4 text-[#07120d] no-underline ring-1 ring-[#39f58e]/35 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#008f5a] text-white">
            <Bot size={20} />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-base font-black">Brancher WhatsApp</strong>
            <small className="block truncate text-xs font-bold text-[#4a6055]">Vente auto inactive</small>
          </span>
          <ChevronRight size={19} className="text-[var(--primary)]" />
        </Link>
      )}

      <MobileMenuSection title="Vendre">
        <MobileMenuItem href="/add-product" icon={<Camera size={21} />} title="Publier" text={hasProducts ? `${stats.products || 0} articles` : "Ajouter"} primary={!hasProducts} />
        <MobileMenuItem href="/orders" icon={<ClipboardList size={21} />} title="Ventes" text={workCount > 0 ? `${workCount} a faire` : "Aucune"} warn={workCount > 0} />
        <MobileMenuItem href={whatsappConnected ? "/messages" : "/whatsapp"} icon={<MessageCircle size={21} />} title="Clients" text={whatsappConnected ? "Messages" : "WhatsApp"} />
        <MobileMenuItem href={shopLink} icon={<Eye size={21} />} title="Boutique" text="Voir" />
      </MobileMenuSection>

      <MobileMenuSection title="Reglages">
        <MobileMenuItem href="/account" icon={<User size={21} />} title="Mon compte" text="Profil" />
        <MobileMenuItem href="/whatsapp" icon={<Bot size={21} />} title="WhatsApp" text={whatsappConnected ? "Connecte" : "Off"} />
        <MobileMenuItem href="/delivery-settings" icon={<Truck size={21} />} title="Livraison" text="Zones" />
        <MobileMenuItem href="/payment-settings" icon={<Wallet size={21} />} title="Paiement" text={payoutReady ? "Pret" : "Au choix"} />
        <MobileMenuItem href="/shop-info" icon={<Store size={21} />} title="Infos boutique" text="Modifier" />
        <MobileMenuItem href="/social-sharing" icon={<Share2 size={21} />} title="Partager" text="Lien" />
        <MobileMenuItem href="/install" icon={<Download size={21} />} title="Installer" text="Optionnel" />
      </MobileMenuSection>

      <button
        type="button"
        onClick={onSignOut}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-transparent text-sm font-black text-red-600 active:scale-[0.99]"
      >
        <LogOut size={18} />
        Sortir
      </button>
    </section>
  );
}

function MobileMiniStat({ label, value, active = false, warn = false }) {
  return (
    <div className={`min-w-0 rounded-[18px] px-2.5 py-3 text-center ring-1 ${
      warn
        ? "bg-[#fff7dc] text-[#7a4b00] ring-[#ffcf3d]/45"
        : active
          ? "bg-[#39f58e] text-[#07120d] ring-[#39f58e]"
          : "bg-[#f4fbf7] text-[#07120d] ring-[#07120d]/6"
    }`}>
      <strong className="block truncate font-display text-lg font-black leading-none">{value}</strong>
      <small className="mt-1 block truncate text-[0.62rem] font-black uppercase leading-3 text-current opacity-70">{label}</small>
    </div>
  );
}

function MobileIconTile({ href, icon, label, value, active = false, warn = false, compact = false }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`flex ${compact ? "min-h-[82px]" : "min-h-[92px]"} flex-col items-center justify-center rounded-[22px] p-2 text-center no-underline ring-1 active:scale-[0.98] ${
        active
          ? "bg-[#07120d] text-white ring-[#07120d]"
          : warn
            ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/60"
            : "bg-[var(--surface-soft)] text-[var(--text-main)] ring-[rgba(0,143,90,0.08)]"
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
        active
          ? "bg-[var(--primary-bright)] text-[#07120d]"
          : warn
            ? "bg-[#07120d] text-[#ffcf3d]"
            : "bg-white text-[var(--primary)] shadow-sm"
      }`}>
        {icon}
      </span>
      {value !== "" && value !== null && value !== undefined && (
        <strong className={`mt-1 font-display text-base font-black leading-none ${active ? "text-[var(--primary-bright)]" : "text-[var(--primary)]"}`}>
          {value}
        </strong>
      )}
      <small className={`mt-1 block max-w-full truncate text-[0.66rem] font-black uppercase leading-3 ${active ? "text-white/66" : "text-[var(--text-dim)]"}`}>
        {label}
      </small>
    </Link>
  );
}

function MobileStatusTile({ label, value, active, warn = false, dark = false }) {
  if (dark) {
    return (
      <div className={`min-w-0 rounded-2xl p-2 text-center ring-1 ${warn ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/50" : active ? "bg-[#39f58e] text-[#07120d] ring-[#39f58e]" : "bg-white/8 text-white ring-white/10"}`}>
        <strong className="block truncate font-display text-lg font-black leading-none">{value}</strong>
        <small className={`mt-1 block truncate text-[0.56rem] font-black uppercase leading-3 tracking-normal ${warn || active ? "text-[#365247]" : "text-white/48"}`}>{label}</small>
      </div>
    );
  }

  return (
    <div className={`min-w-0 rounded-2xl p-2 text-center ring-1 ${warn ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/50" : active ? "bg-[#dffff0] text-[#07120d] ring-emerald-200/50" : "bg-white text-[var(--text-main)] ring-[rgba(0,143,90,0.12)]"}`}>
      <strong className="block truncate font-display text-lg font-black leading-none">{value}</strong>
      <small className={`mt-1 block truncate text-[0.56rem] font-black uppercase leading-3 tracking-normal ${warn || active ? "text-[#365247]" : "text-[var(--text-dim)]"}`}>{label}</small>
    </div>
  );
}

function MobileMenuSection({ title, children }) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_44px_rgb(7_18_13_/_0.06)] ring-1 ring-[#07120d]/8">
      <p className="px-4 pb-1 pt-4 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--primary)]">{title}</p>
      <div className="divide-y divide-[#07120d]/8">
        {children}
      </div>
    </section>
  );
}

function MobileMenuItem({ href, icon, title, text, primary = false, warn = false, compact = false }) {
  if (compact) {
    return (
      <Link
        href={href}
        className={`flex min-h-[104px] min-w-0 flex-col justify-between overflow-hidden rounded-[22px] p-3 text-[var(--text-main)] no-underline ring-1 active:scale-[0.99] ${
          primary
            ? "bg-[#07120d] text-white ring-[#07120d]"
            : warn
              ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/60"
              : "bg-[var(--surface-soft)] ring-[rgba(0,143,90,0.08)]"
        }`}
      >
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            primary
              ? "bg-[var(--primary-bright)] text-[#07120d]"
              : warn
                ? "bg-[#07120d] text-[#ffcf3d]"
                : "bg-white text-[var(--primary)] shadow-sm"
          }`}>
            {icon}
          </span>
          <ChevronRight className={`${primary ? "text-[var(--primary-bright)]" : "text-[var(--primary)]"} shrink-0`} size={17} />
        </span>
        <span className="min-w-0">
          <strong className={`block truncate text-[0.98rem] font-black leading-5 ${primary ? "text-white" : "text-[var(--text-main)]"}`}>{title}</strong>
          <small className={`mt-0.5 block truncate text-[0.72rem] font-black leading-4 ${primary ? "text-white/62" : "text-[var(--text-dim)]"}`}>{text}</small>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${title} ${text || ""}`.trim()}
      className={`grid min-h-[58px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-2.5 text-[var(--text-main)] no-underline active:bg-[#f7fbf8] ${
        primary
          ? "bg-[#07120d] text-white"
          : warn
            ? "bg-[#fff7dc] text-[#171006]"
            : "bg-white"
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
        primary
          ? "bg-[var(--primary-bright)] text-[#07120d]"
        : warn
            ? "bg-white text-[#7a4b00] shadow-sm"
            : "bg-[#eafff3] text-[var(--primary)]"
      }`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className={`block truncate text-[0.96rem] font-black leading-5 ${primary ? "text-white" : "text-[var(--text-main)]"}`}>{title}</strong>
        <small className={`sr-only ${primary ? "text-white/62" : "text-[var(--text-dim)]"}`}>{text}</small>
      </span>
      <ChevronRight className={`${primary ? "text-[var(--primary-bright)]" : "text-[var(--primary)]"} shrink-0`} size={18} />
    </Link>
  );
}

function DesktopMenuHero({ seller, initials, stats, payoutReady, whatsappConnected }) {
  const workCount = (stats.pendingOrders || 0) + (stats.paidOrders || 0) + (stats.preparedOrders || 0);

  return (
    <section className="hidden overflow-hidden rounded-[34px] bg-white shadow-[var(--shadow-md)] ring-1 ring-[rgba(0,143,90,0.2)] md:grid md:grid-cols-[1fr_auto] md:items-center">
      <div className="p-6 lg:p-7">
        <p className="quiet-label text-[var(--primary)]">Centre de vente</p>
        <h1 className="mt-2 font-display text-4xl font-black leading-[1.02] text-[var(--text-main)] lg:text-5xl">
          {seller.name || "Boutique Tikchop"}
        </h1>
        <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[var(--text-dim)]">
          Votre boutique, WhatsApp et les commandes au meme endroit. La prochaine action doit toujours etre evidente.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusPill icon={<Package size={15} />} label={`${stats.products || 0} articles`} ok={Number(stats.products || 0) > 0} />
          <StatusPill icon={<Wallet size={15} />} label={payoutReady ? "Argent pret" : "Argent a regler"} ok={payoutReady} />
          <StatusPill icon={whatsappConnected ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} label={whatsappConnected ? "WhatsApp actif" : "WhatsApp off"} ok={whatsappConnected} />
          <StatusPill icon={<ClipboardList size={15} />} label={`${workCount} ouverte${workCount > 1 ? "s" : ""}`} ok={workCount > 0} neutral={workCount === 0} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/add-product" className="flex min-h-[50px] items-center gap-2 rounded-2xl bg-[var(--text-main)] px-4 text-sm font-black text-white no-underline">
            <Package size={18} />
            Ajouter articles
          </Link>
          <Link href={seller.slug ? `/${seller.slug}` : "/onboarding"} className="flex min-h-[50px] items-center gap-2 rounded-2xl bg-[var(--surface-soft)] px-4 text-sm font-black text-[var(--primary)] no-underline">
            <Store size={18} />
            Voir boutique
          </Link>
          <Link href="/payment-settings" className="flex min-h-[50px] items-center gap-2 rounded-2xl bg-[var(--surface-soft)] px-4 text-sm font-black text-[var(--primary)] no-underline">
            <Wallet size={18} />
            Argent
          </Link>
        </div>
      </div>
      <div className="relative m-5 flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#07120d] to-[#0d2318] shadow-[0_24px_54px_rgb(0_143_90_/_0.30)]">
        <IllustrationEmptyShop size={96} className="absolute opacity-20" />
        <span className="relative z-10 font-display text-4xl font-black text-[#39f58e]">{initials}</span>
      </div>
    </section>
  );
}

function StatusPill({ icon, label, ok, neutral = false }) {
  const tone = neutral ? "bg-[#edf5f0] text-[#365247]" : ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${tone}`}>
      {icon}
      {label}
    </span>
  );
}

function FlowStep({ href, icon, title, text, done, urgent = false }) {
  return (
    <Link
      href={href}
      className={`grid min-h-[98px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-4 no-underline ring-1 transition hover:translate-x-1 ${
        urgent
          ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/55"
          : done
            ? "bg-[#eafff1] text-[#07120d] ring-emerald-300/35"
            : "bg-white/10 text-white ring-white/10"
      }`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
        urgent ? "bg-[#07120d] text-[#ffcf3d]" : done ? "bg-[#07120d] text-[var(--primary-bright)]" : "bg-white/10 text-white"
      }`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block text-base font-black leading-5">{title}</strong>
        <small className={`mt-1 block text-sm font-bold leading-5 ${urgent || done ? "text-[#365247]" : "text-white/62"}`}>{text}</small>
      </span>
      {done ? <CheckCircle2 className={urgent ? "text-[#07120d]" : "text-[var(--primary)]"} size={20} /> : <ChevronRight size={20} />}
    </Link>
  );
}

function WhatsAppStatusPanel({ connected, loading }) {
  const title = loading ? "Verification WhatsApp..." : connected ? "WhatsApp connecte" : "WhatsApp non connecte";
  const text = connected
    ? "L'assistant repond, conseille et prend les commandes a votre place."
    : "Sans WhatsApp, Tikchop ne peut pas vendre automatiquement pour vous.";

  return (
    <section className={`overflow-hidden rounded-[26px] shadow-[var(--shadow-md)] ring-1 md:block ${
      connected
        ? "bg-[#07120d] text-white ring-[#39f58e]/15"
        : "bg-gradient-to-br from-[#fff8dc] to-[#fff0bd] text-[#171006] ring-[#ffb000]/40"
    }`}>
      <div className="flex items-start justify-between gap-2 p-5 pb-0">
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${
            connected ? "bg-[#39f58e]/15 text-[#39f58e]" : "bg-[#07120d] text-[#ffcf3d]"
          }`}>
            {connected ? "● ACTIF" : "○ A BRANCHER"}
          </span>
          <h2 className="mt-3 font-display text-2xl font-black leading-7">{title}</h2>
          <p className={`mt-2 text-sm font-bold leading-6 ${connected ? "text-white/62" : "text-[#4c3510]"}`}>{text}</p>
          <Link
            href="/whatsapp"
            className={`mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black no-underline ${
              connected ? "bg-[#39f58e] text-[#07120d]" : "bg-[#07120d] text-white"
            }`}
          >
            <Bot size={17} />
            {connected ? "Verifier la connexion" : "Connecter WhatsApp"}
          </Link>
        </div>
        <IllustrationWhatsApp size={80} className="shrink-0 opacity-80" />
      </div>
      <div className="h-5" />
    </section>
  );
}

function SellerHealthPanel({ stats, workCount, payoutReady, whatsappConnected }) {
  const items = [
    {
      label: "Articles",
      value: stats.products || 0,
      detail: Number(stats.products || 0) > 0 ? "Catalogue visible" : "Catalogue vide",
      href: "/add-product",
      ok: Number(stats.products || 0) > 0,
    },
    {
      label: "Argent",
      value: payoutReady ? "OK" : "A faire",
      detail: payoutReady ? "Paiement direct pret" : "Numero a configurer",
      href: "/payment-settings",
      ok: payoutReady,
    },
    {
      label: "WhatsApp",
      value: whatsappConnected ? "OK" : "Off",
      detail: whatsappConnected ? "Assistant actif" : "Vente auto inactive",
      href: "/whatsapp",
      ok: whatsappConnected,
    },
    {
      label: "Commandes",
      value: workCount,
      detail: workCount > 0 ? "A faire maintenant" : "Aucune urgence",
      href: "/orders",
      ok: workCount === 0,
      warn: workCount > 0,
    },
  ];

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(0,143,90,0.16)]">
      <p className="quiet-label text-[var(--primary)]">Etat boutique</p>
      <h2 className="mt-1 font-display text-2xl font-black text-[var(--text-main)]">Les signaux importants</h2>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-[#f5fff8] p-3 text-[var(--text-main)] no-underline ring-1 ring-emerald-100/70">
            <span>
              <strong className="block text-sm font-black">{item.label}</strong>
              <small className="mt-0.5 block text-xs font-bold text-[var(--text-dim)]">{item.detail}</small>
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${
              item.warn ? "bg-[#fff0bd] text-[#7a4b00]" : item.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
            }`}>
              {item.value}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MenuLink({ href, icon, title, text, tone = "default", badge = "" }) {
  const toneClass = {
    default: "bg-[#eafff1] text-[var(--text-main)] ring-transparent",
    strong: "bg-[#ddffeb] text-[var(--text-main)] ring-emerald-200/60",
    success: "bg-[#052015] text-white ring-emerald-300/25",
    urgent: "bg-[#fff0bd] text-[#171006] ring-[#ffb000]/45",
    critical: "bg-[#fff0bd] text-[#171006] ring-[#ffb000]/45",
  }[tone] || "bg-[#eafff1] text-[var(--text-main)] ring-transparent";
  const iconClass = tone === "success"
    ? "bg-[var(--primary-bright)] text-[#07120d]"
    : tone === "critical" || tone === "urgent"
      ? "bg-[#07120d] text-[#ffcf3d]"
      : "bg-white text-[var(--primary)] shadow-sm";

  return (
    <Link
      href={href}
      className={`grid min-h-[68px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] px-3 no-underline ring-1 transition active:scale-[0.99] ${toneClass}`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className={`block text-sm font-black leading-5 ${tone === "success" ? "text-white" : ""}`}>{title}</strong>
        <small className={`mt-0.5 block text-xs font-bold leading-4 ${tone === "success" ? "text-white/68" : "text-[var(--text-dim)]"}`}>{text}</small>
      </span>
      {badge ? (
        <span className={`rounded-full px-2 py-1 text-[0.62rem] font-black ${tone === "success" ? "bg-white/12 text-[var(--primary-bright)]" : "bg-[#07120d] text-[#ffcf3d]"}`}>{badge}</span>
      ) : (
        <ChevronRight className={tone === "success" ? "text-white/45" : "text-[var(--primary)]"} size={18} />
      )}
    </Link>
  );
}
