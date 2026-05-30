"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { getSellerOrders } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  buildWhatsappHref,
  getBestCustomerResponse,
  getCustomerResponseTemplates,
} from "../../lib/customer-response-playbook";

const segmentLabels = {
  ALL: "Tous",
  FOLLOW_UP: "A relancer",
  LOYAL: "Bons clients",
  NEW: "Nouveaux",
};

const statusLabels = {
  PENDING: "Nouveau client",
  PAID: "A emballer",
  PREPARED: "Livreur",
  DELIVERED: "Finie",
  CANCELLED: "Annulee",
};

const confirmedStatuses = new Set(["PAID", "PREPARED", "DELIVERED"]);

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function getOrderTotal(order) {
  return Number(order?.total_amount || 0) + Number(order?.delivery_fee || 0);
}

function getOrderRef(order) {
  return order?.order_ref || order?.id?.slice(0, 8)?.toUpperCase() || "TIKCHOP";
}

function getOrderItems(order) {
  return order?.order_items || [];
}

function getItemCount(order) {
  const count = getOrderItems(order).reduce((total, item) => total + Number(item.quantity || 0), 0);
  return count || getOrderItems(order).length || 1;
}

function getItemsLabel(order) {
  const items = getOrderItems(order);
  if (items.length === 0) return "Article Tikchop";
  return items
    .slice(0, 2)
    .map((item) => `${item.quantity || 1} x ${item.products?.name || "Article"}`)
    .join(", ");
}

function getCustomerName(customer) {
  if (customer.phone) return customer.phone;
  return "Client sans numero";
}

function isUnknownPhone(phone) {
  const value = String(phone || "").trim().toUpperCase();
  return !value || value === "UNKNOWN";
}

function needsFollowUp(customer) {
  const status = customer.lastOrder?.status;
  const age = daysSince(customer.lastOrder?.created_at);
  if (status === "PENDING") return true;
  if (status === "PREPARED") return true;
  if (status === "DELIVERED" && age >= 7) return true;
  return customer.orderCount === 1 && age >= 3 && status !== "CANCELLED";
}

function isLoyal(customer) {
  return customer.orderCount >= 2 || customer.totalSpent >= 25000;
}

function buildCustomers(orders) {
  const map = new Map();

  (orders || []).forEach((order) => {
    const phone = isUnknownPhone(order.customer_phone) ? "" : String(order.customer_phone).trim();
    const key = cleanPhone(phone) || `order-${order.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        phone,
        orderCount: 0,
        confirmedCount: 0,
        totalSpent: 0,
        totalEstimated: 0,
        lastOrder: null,
        orders: [],
        zone: "",
        address: "",
      });
    }

    const customer = map.get(key);
    customer.orders.push(order);
    customer.orderCount += 1;
    customer.totalEstimated += getOrderTotal(order);

    if (confirmedStatuses.has(order.status)) {
      customer.confirmedCount += 1;
      customer.totalSpent += getOrderTotal(order);
    }

    if (!customer.lastOrder || new Date(order.created_at || 0) > new Date(customer.lastOrder.created_at || 0)) {
      customer.lastOrder = order;
    }

    customer.zone = order.delivery_zone || customer.zone;
    customer.address = order.delivery_address || customer.address;
  });

  return Array.from(map.values())
    .map((customer) => ({
      ...customer,
      orders: customer.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
      shouldFollowUp: needsFollowUp(customer),
      isLoyal: isLoyal(customer),
    }))
    .sort((a, b) => new Date(b.lastOrder?.created_at || 0) - new Date(a.lastOrder?.created_at || 0));
}

function whatsappHref(customer, sellerName) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bestResponse = getBestCustomerResponse(customer, { sellerName, origin });
  return buildWhatsappHref(customer.phone, bestResponse?.text);
}

export default function CrmPage() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCrm = useCallback(async function fetchCrm() {
    if (!seller.slug) return;

    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const orderData = await getSellerOrders(seller.slug, token);
      setOrders(orderData || []);
    } catch (err) {
      console.error("CRM fetch error:", err);
      setError(friendlyError(err, "Les clients ne se chargent pas. Verifiez la connexion puis actualisez."));
    } finally {
      setLoading(false);
    }
  }, [seller.slug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCrm();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchCrm]);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSegment = segment === "ALL"
        || (segment === "FOLLOW_UP" && customer.shouldFollowUp)
        || (segment === "LOYAL" && customer.isLoyal)
        || (segment === "NEW" && customer.orderCount === 1);

      if (!matchesSegment) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        customer.phone,
        customer.zone,
        customer.address,
        getItemsLabel(customer.lastOrder),
        getOrderRef(customer.lastOrder),
      ].join(" ").toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [customers, query, segment]);

  const stats = useMemo(() => {
    const followUpCount = customers.filter((customer) => customer.shouldFollowUp).length;
    const loyalCount = customers.filter((customer) => customer.isLoyal).length;
    const activeCount = customers.filter((customer) => daysSince(customer.lastOrder?.created_at) <= 30).length;
    const estimatedSales = customers.reduce((total, customer) => total + customer.totalSpent, 0);

    return {
      followUpCount,
      loyalCount,
      activeCount,
      estimatedSales,
    };
  }, [customers]);

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className={`mobile-top ${selectedCustomer ? "hidden md:block" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[#008f5a]">Carnet vendeur</p>
            <h1 className="mt-1 font-display text-3xl font-black leading-10 text-[#07120d]">Clients</h1>
          </div>
          <button onClick={fetchCrm} className="app-icon-button bg-[#07120d] text-white" aria-label="Actualiser les clients">
            <RefreshCw size={19} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <CrmHero stats={stats} totalCustomers={customers.length} />

        <div className="mt-4 grid grid-cols-3 gap-px bg-[#07120d]/8 overflow-hidden rounded-[20px] ring-1 ring-[#07120d]/10">
          <StatTile label="A relancer" value={stats.followUpCount} tone="dark" />
          <StatTile label="Bons clients" value={stats.loyalCount} tone="green" />
          <StatTile label="Actifs" value={stats.activeCount} />
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
          <label className="flex min-h-[48px] items-center gap-2 px-3">
            <Search size={17} className="shrink-0 text-[#008f5a]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#07120d] outline-none placeholder:text-[#07120d]/40"
              placeholder="Rechercher un client..."
            />
          </label>
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["ALL", "FOLLOW_UP", "LOYAL", "NEW"].map((item) => {
            const active = segment === item;
            return (
              <button
                key={item}
                onClick={() => setSegment(item)}
                className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition-colors ${
                  active
                    ? "bg-[#07120d] text-white"
                    : "bg-white text-[#07120d] ring-1 ring-[#07120d]/10"
                }`}
              >
                {segmentLabels[item]}
                <span className={`rounded-full px-1.5 py-0.5 text-[0.58rem] font-black ${
                  active ? "bg-white/15 text-white" : "bg-[#008f5a]/10 text-[#008f5a]"
                }`}>
                  {getSegmentCount(customers, item)}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <p className="mt-2 text-xs">La liste se remettra a jour des que les commandes seront rechargees.</p>
        </div>
      )}

      <section className="mt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#008f5a] border-t-transparent" />
            <p className="mt-4 font-black text-[#07120d]/40">Chargement...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyCrm query={query} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.key}
                customer={customer}
                sellerName={seller.name}
                onOpen={() => setSelectedCustomer(customer)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedCustomer && (
        <CustomerSheet
          customer={selectedCustomer}
          sellerName={seller.name}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function CrmHero({ stats, totalCustomers }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-[26px] bg-[#07120d] p-5 text-white shadow-[0_4px_28px_rgba(7,18,13,0.25)]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[#39f58e]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#39f58e]/80">Carnet client</p>
          <h2 className="mt-1 font-display text-4xl font-black leading-none text-white">{totalCustomers}</h2>
          <p className="mt-1 text-sm font-bold leading-5 text-white/55">
            {totalCustomers > 0 ? "clients enregistres" : "Aucun client"}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-[#39f58e] ring-1 ring-white/10">
          <UsersRound size={22} strokeWidth={2.4} />
        </div>
      </div>
      <div className="relative z-10 mt-5 rounded-[20px] bg-white/6 p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/50">
          <Sparkles size={14} className="text-[#39f58e]" />
          <span>Ventes estimees</span>
        </div>
        <p className="mt-1 font-display text-2xl font-black text-[#39f58e]">{formatPrice(stats.estimatedSales)}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "soft" }) {
  const className = tone === "dark"
    ? "bg-[#07120d] text-white"
    : tone === "green"
      ? "bg-[#eafff5] text-[#005f3d]"
      : "bg-white text-[#07120d]";

  return (
    <div className={`p-3 text-center ${className}`}>
      <p className={`text-[0.62rem] font-black uppercase tracking-[0.1em] ${tone === "dark" ? "text-white/60" : tone === "green" ? "text-[#008f5a]" : "text-[#07120d]/50"}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

function CustomerCard({ customer, sellerName, onOpen }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bestResponse = getBestCustomerResponse(customer, { sellerName, origin });
  const followUrl = whatsappHref(customer, sellerName);
  const lastOrder = customer.lastOrder;
  const totalLabel = customer.totalSpent > 0 ? formatPrice(customer.totalSpent) : formatPrice(customer.totalEstimated);
  const action = customer.shouldFollowUp ? "Relancer" : customer.isLoyal ? "Bon client" : bestResponse?.shortTitle || "Voir";

  return (
    <div className="overflow-hidden rounded-[24px] bg-[#fbf9f4] ring-1 ring-[#07120d]/10">
      <button type="button" onClick={onOpen} className="w-full p-3 text-left active:scale-[0.99] transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              customer.shouldFollowUp ? "bg-amber-100 text-amber-800" : customer.isLoyal ? "bg-[#eafff5] text-[#005f3d]" : "bg-white text-[#008f5a] shadow-sm"
            }`}
            >
              {customer.isLoyal ? <Star size={18} /> : <UserRound size={18} />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black text-[#07120d]">{getCustomerName(customer)}</p>
              <p className="mt-0.5 truncate text-[0.68rem] font-bold text-[#07120d]/50">
                Achat {formatDate(lastOrder?.created_at)}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[0.62rem] font-black uppercase ${
            customer.shouldFollowUp ? "bg-amber-100 text-amber-800" : "bg-[#008f5a]/10 text-[#008f5a]"
          }`}
          >
            {action}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#07120d]/8">
          <p className="truncate text-xs font-black text-[#07120d]">{getItemsLabel(lastOrder)}</p>
          <p className="mt-0.5 truncate text-[0.65rem] font-bold text-[#07120d]/50">
            {customer.zone || customer.address || "Zone a confirmer"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniMetric label="Cmd" value={customer.orderCount} />
          <MiniMetric label="Conf" value={customer.confirmedCount} />
          <MiniMetric label="Total" value={totalLabel} small />
        </div>
      </button>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-[#07120d]/8 bg-[#fbf9f4] p-2.5">
        <a
          href={followUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] text-xs font-black ${
            followUrl
                ? "bg-[#07120d] text-white"
              : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30"
          }`}
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
        <button type="button" onClick={onOpen} className="flex h-[46px] w-[46px] items-center justify-center rounded-[18px] bg-white text-[#008f5a] shadow-sm">
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, small = false }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2 py-1.5 text-center ring-1 ring-[#07120d]/8">
      <p className="truncate text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#07120d]/40">{label}</p>
      <p className={`mt-0.5 truncate font-display font-black text-[#07120d] ${small ? "text-[0.8rem] leading-4 mt-1" : "text-base leading-4"}`}>{value}</p>
    </div>
  );
}

function CustomerSheet({ customer, sellerName, onClose }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const responseTemplates = getCustomerResponseTemplates(customer, { sellerName, origin });
  const bestResponse = responseTemplates[0] || null;
  const followUrl = buildWhatsappHref(customer.phone, bestResponse?.text);
  const lastOrder = customer.lastOrder;
  const total = customer.totalSpent > 0 ? customer.totalSpent : customer.totalEstimated;
  const recommendation = getRecommendation(customer);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[480px] overflow-hidden rounded-[28px] bg-[#fbf9f4] shadow-2xl ring-1 ring-white/20">
        <div className="relative overflow-hidden bg-[#07120d] p-5 text-white">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#39f58e]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#39f58e]/80">Fiche client</p>
              <h2 className="mt-1 truncate font-display text-2xl font-black leading-8 text-white">{getCustomerName(customer)}</h2>
              <p className="mt-0.5 text-xs font-bold leading-5 text-white/55">{customer.zone || customer.address || "Adresse a confirmer"}</p>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Fermer">
              <X size={17} />
            </button>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-white/6 p-3 ring-1 ring-white/10">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-white/50">Total client</p>
              <p className="mt-0.5 font-display text-lg font-black text-[#39f58e]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-[18px] bg-white/6 p-3 ring-1 ring-white/10">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-white/50">Commandes</p>
              <p className="mt-0.5 font-display text-lg font-black text-white">{customer.orderCount}</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-4 overflow-y-auto p-4">
          <div className="rounded-[22px] bg-white p-3 ring-1 ring-[#07120d]/8">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fbf9f4] text-[#008f5a] ring-1 ring-[#07120d]/5">
                {recommendation.icon}
              </span>
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">Action</p>
                <p className="mt-0.5 font-display text-base font-black leading-5 text-[#07120d]">{recommendation.title}</p>
                <p className="mt-0.5 text-xs font-bold leading-4 text-[#07120d]/60">{recommendation.body}</p>
              </div>
            </div>
          </div>

          <CustomerResponseRail templates={responseTemplates} phoneNumber={customer.phone} />

          <section>
            <div className="flex items-center gap-2 border-b border-[#07120d]/8 pb-2">
              <ShoppingBag size={14} className="text-[#008f5a]" />
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Derniere Commande</p>
            </div>
            <div className="mt-3 rounded-[22px] bg-white p-4 ring-1 ring-[#07120d]/8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-black text-[#07120d]">#{getOrderRef(lastOrder)}</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-[#07120d]/60">{getItemsLabel(lastOrder)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#fbf9f4] px-2.5 py-1 text-[0.65rem] font-black uppercase text-[#008f5a] ring-1 ring-[#07120d]/10">
                  {statusLabels[lastOrder?.status] || lastOrder?.status || "Statut"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[16px] bg-[#fbf9f4] p-2.5 ring-1 ring-[#07120d]/5">
                  <p className="text-[0.62rem] font-black uppercase text-[#07120d]/50">Total</p>
                  <p className="mt-0.5 font-display text-base font-black text-[#008f5a]">{formatPrice(getOrderTotal(lastOrder))}</p>
                </div>
                <div className="rounded-[16px] bg-[#fbf9f4] p-2.5 ring-1 ring-[#07120d]/5">
                  <p className="text-[0.62rem] font-black uppercase text-[#07120d]/50">Articles</p>
                  <p className="mt-0.5 font-display text-base font-black text-[#07120d]">{getItemCount(lastOrder)}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 border-b border-[#07120d]/8 pb-2">
              <Clock3 size={14} className="text-[#008f5a]" />
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Historique</p>
            </div>
            <div className="mt-3 space-y-2">
              {customer.orders.map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[18px] bg-white p-3 ring-1 ring-[#07120d]/8">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-black text-[#07120d]">#{getOrderRef(order)}</p>
                    <p className="mt-0.5 truncate text-[0.65rem] font-bold text-[#07120d]/50">{formatDate(order.created_at)} - {getItemsLabel(order)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-black text-[#008f5a]">{formatPrice(getOrderTotal(order))}</p>
                    <p className="mt-0.5 text-[0.62rem] font-black text-[#07120d]/40">{statusLabels[order.status] || order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-2 border-t border-[#07120d]/8 bg-[#fbf9f4] p-3">
          <a
            href={followUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[20px] text-sm font-black active:scale-[0.99] ${
              followUrl
                ? "bg-[#008f5a] text-white shadow-sm"
                : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30"
            }`}
          >
            <MessageCircle size={18} />
            {bestResponse?.title || "Envoyer une relance WhatsApp"}
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={customer.phone ? `tel:${cleanPhone(customer.phone)}` : undefined}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] text-xs font-black ${
                customer.phone ? "bg-white text-[#07120d] ring-1 ring-[#07120d]/10 shadow-sm" : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30"
              }`}
            >
              <Phone size={16} />
              Appeler
            </a>
            <button type="button" onClick={onClose} className="flex min-h-[46px] items-center justify-center rounded-[18px] bg-white text-xs font-black text-[#07120d] ring-1 ring-[#07120d]/10 shadow-sm">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerResponseRail({ templates, phoneNumber }) {
  if (!templates.length) return null;

  return (
    <section>
      <div className="flex items-center gap-2 border-b border-[#07120d]/8 pb-2">
        <MessageCircle size={14} className="text-[#008f5a]" />
        <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#008f5a]">Messages</p>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {templates.map((template) => {
          const href = buildWhatsappHref(phoneNumber, template.text);
          return (
            <a
              key={template.id}
              href={href || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`min-w-[140px] rounded-[20px] p-3 text-left no-underline ring-1 ${href ? getTemplateToneClass(template.tone) : "pointer-events-none bg-[#07120d]/5 text-[#07120d]/30 ring-transparent"}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/50 text-current">
                  <MessageCircle size={14} />
                </span>
                <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] opacity-80">{template.shortTitle}</span>
              </div>
              <p className="mt-2 font-display text-sm font-black leading-4">{template.title}</p>
              <p className="mt-1 text-[0.68rem] font-bold leading-3 opacity-75">{template.scenario}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function getTemplateToneClass(tone) {
  if (tone === "primary") return "bg-[#07120d] text-white ring-[#07120d]/20";
  if (tone === "success") return "bg-[#eafff5] text-[#005f3d] ring-[#008f5a]/20";
  if (tone === "warning") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (tone === "info") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (tone === "danger") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-white text-[#07120d] ring-[#07120d]/10";
}

function getRecommendation(customer) {
  if (customer.lastOrder?.status === "PENDING") {
    return {
      icon: <Clock3 size={20} />,
      title: "Confirmer ce client",
      body: "Le client a commence l'achat. Envoie un message court pour verifier adresse et paiement.",
    };
  }

  if (customer.lastOrder?.status === "PREPARED") {
    return {
      icon: <ShoppingBag size={20} />,
      title: "Finir la livraison",
      body: "Le paquet semble pret. Confirme le passage du livreur et ferme la commande apres reception.",
    };
  }

  if (customer.isLoyal) {
    return {
      icon: <Star size={20} />,
      title: "Bon client",
      body: "Il a deja achete plusieurs fois. Envoyez les nouveautes en priorite avec un message personnel.",
    };
  }

  return {
    icon: <CheckCircle2 size={20} />,
      title: "Garder le contact",
      body: "Une relance simple avec 2 ou 3 nouveaux articles peut ramener ce client vers la boutique.",
  };
}

function getSegmentCount(customers, segment) {
  if (segment === "ALL") return customers.length;
  if (segment === "FOLLOW_UP") return customers.filter((customer) => customer.shouldFollowUp).length;
  if (segment === "LOYAL") return customers.filter((customer) => customer.isLoyal).length;
  if (segment === "NEW") return customers.filter((customer) => customer.orderCount === 1).length;
  return 0;
}

function EmptyCrm({ query }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] bg-[#fbf9f4] p-8 text-center ring-1 ring-[#07120d]/8 md:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#008f5a] shadow-sm">
        <UsersRound size={30} />
      </div>
      <h2 className="mt-4 font-display text-xl font-black text-[#07120d]">{query ? "Aucun resultat" : "Aucun client"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-[#07120d]/50">Les premiers clients apparaitront apres commande.</p>
    </div>
  );
}
