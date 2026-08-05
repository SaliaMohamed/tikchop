"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Camera,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  LogOut,
  MessageCircle,
  Package,
  Share2,
  Store,
  Truck,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { getDashboardData } from "../actions";
import { clearActiveSeller, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { supabase } from "../../lib/supabase";
import { IllustrationEmptyShop } from "../components/TikchopIllustrations";

const emptyStats = {
  products: 0,
  pendingOrders: 0,
  paidOrders: 0,
  preparedOrders: 0,
  whatsappConnected: false,
  payoutReady: false,
};

export default function SellerMenuPage() {
  const seller = useActiveSeller();
  const [stats, setStats] = useState(emptyStats);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function loadStatus() {
      if (!seller.slug) { setStatusLoading(false); return; }
      try {
        const token = await getSellerAccessToken();
        const data = await getDashboardData(seller.slug, token);
        if (alive) setStats({ ...emptyStats, ...(data.stats || {}) });
      } catch { /* silent */ } finally {
        if (alive) setStatusLoading(false);
      }
    }
    loadStatus();
    return () => { alive = false; };
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
  const shopLink = seller.slug ? `/${seller.slug}` : "/onboarding";

  if (!seller.slug) {
    return (
      <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] px-4">
        <div className="flex flex-col items-center justify-center text-center p-8 bg-[#07120d] rounded-[32px] my-6 relative overflow-hidden text-white shadow-2xl">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(57,245,142,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(57,245,142,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative z-10 flex flex-col items-center max-w-xs">
            <IllustrationEmptyShop size={130} />
            <h2 className="mt-4 font-display text-2xl font-black text-white">Aucune boutique</h2>
            <Link
              href="/onboarding?new=1"
              className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#39f58e] text-base font-black text-[#07120d] shadow-[0_16px_36px_rgba(57,245,142,0.3)] active:scale-[0.98] transition no-underline"
            >
              <Store size={18} />
              Créer ma boutique
            </Link>
            <button type="button" onClick={signOut} className="mt-4 text-xs font-bold text-white/40 py-1">
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] px-4 space-y-3 pt-2">

      {/* Boutique card */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgb(7_18_13_/_0.07)] ring-1 ring-[#07120d]/8">
        <div className="h-1 w-full bg-gradient-to-r from-[#008f5a] via-[#39f58e] to-[#008f5a]" />
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#07120d] font-display text-base font-black text-[#39f58e]">
            {(seller.name || "T").slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#39f58e] text-[#07120d]">
              <Zap size={8} strokeWidth={3} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#008f5a]">Ma boutique</p>
            <h1 className="truncate font-display text-xl font-black text-[#07120d]">{seller.name || "Boutique"}</h1>
          </div>
          <Link
            href={shopLink}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eafff3] text-[#008f5a] no-underline"
          >
            <Eye size={17} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          <MiniStat label="Articles" value={stats.products || 0} active={hasProducts} />
          <MiniStat label="Ventes" value={workCount} active={workCount > 0} warn={workCount > 0} />
          <MiniStat label="WhatsApp" value={whatsappConnected ? "OK" : "Off"} active={whatsappConnected} warn={!whatsappConnected && hasProducts} />
        </div>
      </div>

      {/* Action rapide si WhatsApp manquant */}
      {!whatsappConnected && hasProducts && (
        <Link
          href="/whatsapp"
          className="flex items-center gap-3 rounded-[22px] bg-[#eafff3] px-4 py-3 text-[#07120d] no-underline ring-1 ring-[#39f58e]/35 active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#008f5a] text-white shrink-0">
            <Bot size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">Brancher WhatsApp</strong>
            <small className="block text-xs font-bold text-[#4a6055]">Vente auto inactive</small>
          </span>
          <ChevronRight size={17} className="text-[#008f5a] shrink-0" />
        </Link>
      )}

      {/* Vendre */}
      <MenuSection title="Vendre">
        <MenuItem href="/add-product" icon={<Camera size={20} />} label="Publier un article" sub={hasProducts ? `${stats.products} en ligne` : "Aucun article"} accent={!hasProducts} />
        <MenuItem href="/orders" icon={<ClipboardList size={20} />} label="Ventes" sub={workCount > 0 ? `${workCount} à traiter` : "Aucune"} warn={workCount > 0} />
        <MenuItem href="/messages" icon={<MessageCircle size={20} />} label="Messages clients" sub="" />
        <MenuItem href={shopLink} icon={<Store size={20} />} label="Voir ma boutique" sub="Vue client" />
      </MenuSection>

      {/* Réglages */}
      <MenuSection title="Réglages">
        <MenuItem href="/whatsapp" icon={<Bot size={20} />} label="Assistant WhatsApp" sub={statusLoading ? "…" : whatsappConnected ? "Connecté" : "Non connecté"} />
        <MenuItem href="/delivery-settings" icon={<Truck size={20} />} label="Livraison" sub="Zones et frais" />
        <MenuItem href="/payment-settings" icon={<Wallet size={20} />} label="Paiement" sub={payoutReady ? "Configuré" : "À configurer"} />
        <MenuItem href="/shop-info" icon={<Store size={20} />} label="Infos boutique" sub="Nom, lien, bot" />
        <MenuItem href="/social-sharing" icon={<Share2 size={20} />} label="Partager" sub="Lien boutique" />
        <MenuItem href="/account" icon={<User size={20} />} label="Mon compte" sub="Profil" />
        <MenuItem href="/install" icon={<Download size={20} />} label="Installer l'app" sub="Optionnel" />
      </MenuSection>

      {/* Se déconnecter */}
      <button
        type="button"
        onClick={signOut}
        className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[20px] bg-white text-sm font-black text-red-600 ring-1 ring-red-100 active:scale-[0.99]"
      >
        <LogOut size={16} />
        Se déconnecter
      </button>
    </div>
  );
}

function MiniStat({ label, value, active = false, warn = false }) {
  return (
    <div className={`rounded-[16px] px-2 py-2.5 text-center ring-1 ${
      warn && !active ? "bg-[#fff7dc] text-[#7a4b00] ring-[#ffcf3d]/45"
      : active ? "bg-[#39f58e] text-[#07120d] ring-[#39f58e]"
      : "bg-[#f4fbf7] text-[#07120d] ring-[#07120d]/6"
    }`}>
      <strong className="block truncate font-display text-base font-black leading-none">{value}</strong>
      <small className="mt-1 block truncate text-[0.6rem] font-black uppercase leading-3 opacity-70">{label}</small>
    </div>
  );
}

function MenuSection({ title, children }) {
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_16px_40px_rgb(7_18_13_/_0.05)] ring-1 ring-[#07120d]/8">
      <p className="px-4 pt-3 pb-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">{title}</p>
      <div className="divide-y divide-[#07120d]/6">{children}</div>
    </section>
  );
}

function MenuItem({ href, icon, label, sub, accent = false, warn = false }) {
  return (
    <Link
      href={href}
      className={`grid min-h-[54px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 no-underline active:bg-[#f7fbf8] ${
        accent ? "bg-[#07120d]" : warn ? "bg-[#fff9ea]" : "bg-white"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
        accent ? "bg-[#39f58e] text-[#07120d]"
        : warn ? "bg-white text-[#8a5500] shadow-sm"
        : "bg-[#eafff3] text-[#008f5a]"
      }`}>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className={`block truncate text-sm font-black ${accent ? "text-white" : "text-[#07120d]"}`}>{label}</strong>
        {sub && <small className={`block truncate text-xs font-bold ${accent ? "text-white/60" : "text-[#6b8070]"}`}>{sub}</small>}
      </span>
      <ChevronRight size={16} className={accent ? "text-[#39f58e]" : warn ? "text-[#8a5500]" : "text-[#008f5a]"} />
    </Link>
  );
}
