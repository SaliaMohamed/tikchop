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

const segmentLabels = {
  ALL: "Tous",
  FOLLOW_UP: "A relancer",
  LOYAL: "Fideles",
  NEW: "Nouveaux",
};

const statusLabels = {
  PENDING: "A confirmer",
  PAID: "Payee",
  PREPARED: "Prete",
  DELIVERED: "Livree",
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

function buildFollowupMessage(customer, sellerName) {
  const shopName = sellerName || "votre boutique Tikchop";
  const ref = getOrderRef(customer.lastOrder);
  const total = formatPrice(getOrderTotal(customer.lastOrder));
  const lastStatus = customer.lastOrder?.status;

  if (lastStatus === "PENDING") {
    return `Bonjour, c'est ${shopName}. Votre commande ${ref} est bien reservee. Voulez-vous confirmer la livraison aujourd'hui ? Total: ${total}`;
  }

  if (lastStatus === "PREPARED") {
    return `Bonjour, c'est ${shopName}. Votre commande ${ref} est prete. Confirmez votre disponibilite pour la livraison s'il vous plait.`;
  }

  return `Bonjour, c'est ${shopName}. Merci pour votre dernier achat. J'ai de nouveaux articles disponibles, voulez-vous que je vous envoie les plus beaux choix ?`;
}

function whatsappHref(customer, sellerName) {
  const phone = cleanPhone(customer.phone);
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildFollowupMessage(customer, sellerName))}`;
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
      setError(friendlyError(err, "CRM non charge. Verifie la connexion puis actualise."));
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
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[var(--primary)]">CRM vendeur</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Tes clients</h1>
            <p className="mt-1 text-base font-semibold leading-6 text-[var(--text-dim)]">
              Retrouve les acheteurs, relance les commandes et repere les meilleurs clients.
            </p>
          </div>
          <button onClick={fetchCrm} className="app-icon-button" aria-label="Actualiser le CRM">
            <RefreshCw size={19} strokeWidth={2.5} />
          </button>
        </div>

        <CrmHero stats={stats} totalCustomers={customers.length} />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="A relancer" value={stats.followUpCount} tone="dark" />
          <StatTile label="Fideles" value={stats.loyalCount} tone="green" />
          <StatTile label="Actifs" value={stats.activeCount} />
        </div>

        <div className="mt-4 rounded-[22px] bg-white p-2 shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35">
          <label className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[var(--surface-soft)] px-3">
            <Search size={18} className="shrink-0 text-[var(--outline)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
              placeholder="Numero, zone, article..."
            />
          </label>
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["ALL", "FOLLOW_UP", "LOYAL", "NEW"].map((item) => (
            <button
              key={item}
              onClick={() => setSegment(item)}
              className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${
                segment === item
                  ? "border border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-sm"
                  : "border border-[var(--outline)]/40 bg-white text-[var(--text-dim)] shadow-sm"
              }`}
            >
              {segmentLabels[item]}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.68rem] ${
                segment === item ? "bg-white/14 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"
              }`}
              >
                {getSegmentCount(customers, item)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <p className="mt-2 text-xs">Le CRM se mettra a jour des que les commandes seront rechargees.</p>
        </div>
      )}

      <section className="mt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="mt-4 font-extrabold text-zinc-400">Chargement des clients...</p>
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
    <div className="relative mt-5 overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Carnet client</p>
          <h2 className="mt-2 font-display text-4xl font-bold leading-none text-white">{totalCustomers}</h2>
          <p className="mt-2 text-sm font-semibold leading-5 text-white/62">
            {totalCustomers > 0 ? "clients retrouves depuis tes commandes" : "tes clients apparaitront ici"}
          </p>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--primary-bright)] ring-1 ring-white/10">
          <UsersRound size={26} strokeWidth={2.4} />
        </div>
      </div>
      <div className="relative z-10 mt-5 rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-sm font-bold text-white/60">
          <Sparkles size={16} className="text-[var(--primary-bright)]" />
          <span>Ventes confirmees</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold text-[var(--primary-bright)]">{formatPrice(stats.estimatedSales)}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "soft" }) {
  const className = tone === "dark"
    ? "border-[var(--text-main)] bg-[var(--text-main)] text-white"
    : tone === "green"
      ? "border-[var(--primary)]/20 bg-[var(--surface-soft)] text-[var(--primary)]"
      : "border-[var(--outline)]/35 bg-white text-[var(--text-main)]";

  return (
    <div className={`rounded-[18px] border p-3 shadow-[var(--shadow-sm)] ${className}`}>
      <p className={`text-xs font-bold ${tone === "dark" ? "text-white/72" : "text-[var(--text-dim)]"}`}>{label}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

function CustomerCard({ customer, sellerName, onOpen }) {
  const followUrl = whatsappHref(customer, sellerName);
  const lastOrder = customer.lastOrder;
  const totalLabel = customer.totalSpent > 0 ? formatPrice(customer.totalSpent) : formatPrice(customer.totalEstimated);
  const action = customer.shouldFollowUp ? "Relancer" : customer.isLoyal ? "Soigner" : "Voir";

  return (
    <div className="overflow-hidden rounded-[26px] border border-white/80 bg-white/95 shadow-[0_16px_34px_rgba(13,23,18,0.08)] ring-1 ring-[rgba(191,206,197,0.34)]">
      <button type="button" onClick={onOpen} className="w-full p-4 text-left active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              customer.shouldFollowUp ? "bg-amber-100 text-amber-700" : customer.isLoyal ? "bg-green-100 text-green-700" : "bg-[var(--surface-soft)] text-[var(--primary)]"
            }`}
            >
              {customer.isLoyal ? <Star size={20} /> : <UserRound size={20} />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-[var(--text-main)]">{getCustomerName(customer)}</p>
              <p className="mt-0.5 truncate text-xs font-bold text-[var(--text-dim)]">
                Dernier achat {formatDate(lastOrder?.created_at)}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${
            customer.shouldFollowUp ? "bg-amber-100 text-amber-700" : "bg-[var(--surface-soft)] text-[var(--primary)]"
          }`}
          >
            {action}
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] p-3">
          <p className="truncate text-sm font-extrabold text-[var(--text-main)]">{getItemsLabel(lastOrder)}</p>
          <p className="mt-1 truncate text-xs font-bold text-[var(--text-dim)]">
            {customer.zone || customer.address || "Zone a confirmer"}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniMetric label="Commandes" value={customer.orderCount} />
          <MiniMetric label="Confirmees" value={customer.confirmedCount} />
          <MiniMetric label="Total" value={totalLabel} small />
        </div>
      </button>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-[var(--surface-mid)] bg-white p-3">
        <a
          href={followUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
            followUrl
              ? "bg-[var(--text-main)] text-white"
              : "pointer-events-none bg-zinc-100 text-zinc-400"
          }`}
        >
          <MessageCircle size={17} />
          Relancer
        </a>
        <button type="button" onClick={onOpen} className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, small = false }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white px-2 py-2 text-center shadow-sm ring-1 ring-[var(--outline)]/20">
      <p className="truncate text-[0.65rem] font-bold text-[var(--text-dim)]">{label}</p>
      <p className={`mt-1 truncate font-display font-bold text-[var(--text-main)] ${small ? "text-sm" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function CustomerSheet({ customer, sellerName, onClose }) {
  const followUrl = whatsappHref(customer, sellerName);
  const lastOrder = customer.lastOrder;
  const total = customer.totalSpent > 0 ? customer.totalSpent : customer.totalEstimated;
  const recommendation = getRecommendation(customer);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-[3px] md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[480px] overflow-hidden rounded-t-[30px] bg-white shadow-2xl md:rounded-[30px]">
        <div className="relative overflow-hidden bg-[var(--text-main)] p-5 text-white">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Fiche client</p>
              <h2 className="mt-2 truncate font-display text-2xl font-bold leading-8 text-white">{getCustomerName(customer)}</h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-white/62">{customer.zone || customer.address || "Adresse a confirmer"}</p>
            </div>
            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs font-bold text-white/45">Total client</p>
              <p className="mt-1 font-display text-xl font-bold text-[var(--primary-bright)]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs font-bold text-white/45">Commandes</p>
              <p className="mt-1 font-display text-xl font-bold text-white">{customer.orderCount}</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-4 overflow-y-auto p-5">
          <div className="rounded-[24px] bg-[var(--surface-soft)] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--primary)] shadow-sm">
                {recommendation.icon}
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-dim)]">Prochaine action</p>
                <p className="mt-1 font-display text-lg font-semibold leading-6 text-[var(--text-main)]">{recommendation.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">{recommendation.body}</p>
              </div>
            </div>
          </div>

          <section>
            <p className="quiet-label">Derniere commande</p>
            <div className="mt-3 rounded-[24px] bg-zinc-950 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-white">#{getOrderRef(lastOrder)}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white/60">{getItemsLabel(lastOrder)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
                  {statusLabels[lastOrder?.status] || lastOrder?.status || "Statut"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs font-bold text-white/45">Total</p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--primary-bright)]">{formatPrice(getOrderTotal(lastOrder))}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs font-bold text-white/45">Articles</p>
                  <p className="mt-1 font-display text-lg font-bold text-white">{getItemCount(lastOrder)}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="quiet-label">Historique</p>
            <div className="mt-3 space-y-2">
              {customer.orders.map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[var(--text-main)]">#{getOrderRef(order)}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-[var(--text-dim)]">{formatDate(order.created_at)} - {getItemsLabel(order)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-[var(--primary)]">{formatPrice(getOrderTotal(order))}</p>
                    <p className="mt-0.5 text-[0.65rem] font-bold text-[var(--outline)]">{statusLabels[order.status] || order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-3 border-t border-zinc-100 p-4">
          <a
            href={followUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[62px] w-full items-center justify-center gap-2 rounded-[22px] text-base font-extrabold shadow-[0_14px_34px_rgba(16,24,20,0.18)] active:scale-[0.99] ${
              followUrl
                ? "bg-[var(--primary-bright)] text-zinc-950"
                : "pointer-events-none bg-zinc-100 text-zinc-400"
            }`}
          >
            <MessageCircle size={20} />
            Envoyer une relance WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={customer.phone ? `tel:${cleanPhone(customer.phone)}` : undefined}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
                customer.phone ? "bg-white text-zinc-950 ring-1 ring-zinc-200" : "pointer-events-none bg-zinc-100 text-zinc-400"
              }`}
            >
              <Phone size={17} />
              Appeler
            </a>
            <button type="button" onClick={onClose} className="flex min-h-[52px] items-center justify-center rounded-2xl bg-white text-sm font-extrabold text-zinc-950 ring-1 ring-zinc-200">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRecommendation(customer) {
  if (customer.lastOrder?.status === "PENDING") {
    return {
      icon: <Clock3 size={20} />,
      title: "Confirme cette commande",
      body: "Le client a commence l'achat. Envoie un message court pour verifier adresse et paiement.",
    };
  }

  if (customer.lastOrder?.status === "PREPARED") {
    return {
      icon: <ShoppingBag size={20} />,
      title: "Finalise la livraison",
      body: "Le paquet semble pret. Confirme le passage du livreur et marque la commande livree apres reception.",
    };
  }

  if (customer.isLoyal) {
    return {
      icon: <Star size={20} />,
      title: "Client important",
      body: "Il a deja achete plusieurs fois. Envoie les nouveautes en priorite et garde le ton personnel.",
    };
  }

  return {
    icon: <CheckCircle2 size={20} />,
    title: "Garde le contact",
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
    <div className="app-card p-8 text-center md:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <UsersRound size={32} />
      </div>
      <h2 className="mt-4 text-xl font-black text-zinc-950">{query ? "Aucun client trouve" : "Pas encore de clients"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-zinc-500">
        Les clients apparaitront ici automatiquement apres les commandes boutique ou WhatsApp.
      </p>
    </div>
  );
}
