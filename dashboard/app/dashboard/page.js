"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  Plus,
  QrCode,
  Share2,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "../actions";
import { getSellerInitials, useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import TikchopLottie from "../components/TikchopLottie";

function formatCFA(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F CFA`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!seller.slug) {
        setLoading(false);
        return;
      }
      try {
        const token = await getSellerAccessToken();
        const data = await getDashboardData(seller.slug, token);
        setRecentOrders(data.recentOrders || []);
        setStats({ ...emptyStats, ...(data.stats || {}) });
      } catch (err) {
        console.warn("Dashboard data unavailable:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [seller.slug]);

  function copyShopLink() {
    if (!seller.slug) return;
    const url = `${window.location.origin}/${seller.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareOnWhatsApp() {
    if (!seller.slug) return;
    const url = `${window.location.origin}/${seller.slug}`;
    const text = `Découvrez ma boutique en ligne sur Tikchop : ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!seller.slug) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-xl">
          <TikchopLottie name="empty-box" size={140} />
          <h2 className="mt-4 font-display text-xl font-black text-white">
            Aucune boutique active
          </h2>
          <p className="mt-2 text-xs font-medium text-zinc-400">
            Créez votre boutique en quelques clics pour commencer à vendre en ligne.
          </p>
          <Link
            href="/onboarding?new=1"
            className="mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-zinc-950 no-underline shadow-lg"
          >
            <Store size={18} />
            <span>Créer ma boutique</span>
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = Number(stats.pendingOrders || 0);
  const totalSales = Number(stats.sales || 0);
  const productCount = Number(stats.products || 0);
  const isWhatsAppConnected = Boolean(stats.whatsappConnected);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3.5 pb-28 pt-2 md:px-0">
      {/* 1. Carte Bannière Boutique & Partage Express */}
      <section className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-zinc-200">
              {seller.logo_url ? (
                <Image
                  src={seller.logo_url}
                  alt={seller.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span className="text-sm font-black text-emerald-800">
                  {sellerInitials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-extrabold text-zinc-900">
                {seller.name}
              </h2>
              <p className="truncate text-xs font-semibold text-emerald-700">
                tikchop.ci/{seller.slug}
              </p>
            </div>
          </div>

          <Link
            href={`/${seller.slug}`}
            target="_blank"
            className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/60 no-underline hover:bg-emerald-100"
          >
            <span>Voir</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        {/* Boutons d'action de partage */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
          <button
            type="button"
            onClick={copyShopLink}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-800 transition active:scale-95"
          >
            {copied ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
            <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
          </button>
          <button
            type="button"
            onClick={shareOnWhatsApp}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/15 text-xs font-bold text-[#128C7E] transition active:scale-95"
          >
            <MessageCircle size={15} />
            <span>Partager WhatsApp</span>
          </button>
        </div>
      </section>

      {/* 2. Chiffres Clés du Vendeur */}
      <section className="grid grid-cols-2 gap-3">
        {/* Ventes */}
        <div className="rounded-3xl bg-zinc-900 p-4 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-zinc-400">
              Ventes totales
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-emerald-400">
              <ShoppingBag size={14} />
            </span>
          </div>
          <p className="mt-2 font-display text-xl font-black text-emerald-400">
            {formatCFA(totalSales)}
          </p>
          <p className="mt-0.5 text-[0.68rem] text-zinc-400">
            {stats.orders || 0} commande{stats.orders > 1 ? "s" : ""} passée{stats.orders > 1 ? "s" : ""}
          </p>
        </div>

        {/* Commandes à traiter */}
        <Link
          href="/orders?filter=PENDING"
          className="flex flex-col justify-between rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-zinc-500">
              À traiter
            </span>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
              pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-400"
            }`}>
              <Clock3 size={14} />
            </span>
          </div>
          <div>
            <p className={`font-display text-xl font-black ${
              pendingCount > 0 ? "text-amber-600" : "text-zinc-900"
            }`}>
              {pendingCount}
            </p>
            <p className="mt-0.5 text-[0.68rem] font-bold text-emerald-700">
              {pendingCount > 0 ? "Voir les commandes →" : "Aucune en attente"}
            </p>
          </div>
        </Link>
      </section>

      {/* 3. Statut WhatsApp / DJASSAMAN */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-zinc-900">
                Assistant IA DJASSAMAN
              </p>
              <p className="flex items-center gap-1 text-[0.68rem] font-semibold text-zinc-500">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  isWhatsAppConnected ? "bg-emerald-500" : "bg-amber-400"
                }`} />
                {isWhatsAppConnected ? "Connecté à WhatsApp" : "Prêt à répondre sur le chat"}
              </p>
            </div>
          </div>
          <Link
            href="/messages"
            className="flex h-8 items-center rounded-full bg-zinc-900 px-3 text-xs font-bold text-white no-underline hover:bg-zinc-800"
          >
            Ouvrir
          </Link>
        </div>
      </section>

      {/* 4. Raccourcis Rapides Vendeur */}
      <section className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
          Raccourcis
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/add-product"
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Plus size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-900">Publier</p>
              <p className="text-[0.65rem] text-zinc-500">Nouvel article</p>
            </div>
          </Link>

          <Link
            href="/products"
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-zinc-700">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-900">Stock ({productCount})</p>
              <p className="text-[0.65rem] text-zinc-500">Gérer catalogue</p>
            </div>
          </Link>

          <Link
            href="/delivery-settings"
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Truck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-900">Livraison</p>
              <p className="text-[0.65rem] text-zinc-500">Tarifs communes</p>
            </div>
          </Link>

          <Link
            href="/payment-settings"
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-900">Paiement</p>
              <p className="text-[0.65rem] text-zinc-500">Wave, Mobile, CoD</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. Activité Récente (Dernières Commandes) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Dernières commandes
          </h3>
          <Link href="/orders" className="text-xs font-bold text-emerald-700 no-underline">
            Voir tout →
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.slice(0, 3).map((order) => {
              const total =
                Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
              const isPaid = order.status === "PAID" || order.status === "DELIVERED";

              return (
                <Link
                  key={order.id}
                  href="/orders"
                  className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-200/80 no-underline transition active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-black text-zinc-900">
                        #{order.order_ref || order.id?.slice(0, 6).toUpperCase()}
                      </strong>
                      <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${
                        isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {order.status === "DELIVERED"
                          ? "Livrée"
                          : isPaid
                          ? "Payée"
                          : "À traiter"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[0.7rem] text-zinc-500">
                      {order.customer_phone || "Client WhatsApp"} · {order.delivery_zone || "Retrait"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-xs font-black text-zinc-900">
                      {formatCFA(total)}
                    </p>
                    <ChevronRight size={14} className="ml-auto text-zinc-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-zinc-200/80">
            <p className="text-xs font-bold text-zinc-700">Aucune commande pour l'instant</p>
            <p className="mt-1 text-[0.7rem] text-zinc-500">
              Partagez votre lien de boutique pour recevoir vos premières ventes.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
