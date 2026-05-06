"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Send,
  Share2,
  Truck,
  X,
} from "lucide-react";
import { assignOrderDriver, getSellerDeliverySettings, getSellerOrders, updateOrderStatus } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

const statusLabels = {
  ALL: "Toutes",
  WORK: "A faire",
  PENDING: "A confirmer",
  PAID: "Paquet a faire",
  PREPARED: "A livrer",
  DELIVERED: "Livrees",
  CANCELLED: "Annulees",
};

const statusHints = {
  PENDING: "Verifier client et paiement",
  PAID: "Mettre les articles dans le sachet",
  PREPARED: "Envoyer au livreur ou livrer",
  DELIVERED: "Terminee",
  CANCELLED: "Annule",
};

const statusClasses = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  PREPARED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-zinc-100 text-zinc-500",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState("WORK");
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async function fetchOrders() {
    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();

      const [orderData, deliveryData] = await Promise.all([
        getSellerOrders(seller.slug, token),
        getSellerDeliverySettings(seller.slug, token),
      ]);

      setOrders(orderData || []);
      setDrivers(deliveryData?.drivers || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(friendlyError(err, "Commandes non chargees. Verifie la connexion puis actualise."));
    } finally {
      setLoading(false);
    }
  }, [seller.slug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  async function markStatus(order, status) {
    try {
      const token = await getSellerAccessToken();
      const result = await updateOrderStatus(order.id, status, token);
      await fetchOrders();
      setSelectedOrder((current) => current ? { ...current, ...result, status: result?.status || status } : current);
    } catch (err) {
      alert(friendlyError(err, "Statut non mis a jour. Garde la commande ouverte puis relance l'action."));
    }
  }

  async function markDriverAssigned(order, driver) {
    try {
      const token = await getSellerAccessToken();
      const result = await assignOrderDriver(order.id, driver.id, token);
      setOrders((current) => current.map((item) => (
        item.id === order.id
          ? { ...item, ...result, delivery_drivers: driver }
          : item
      )));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, ...result, delivery_drivers: driver } : current);
    } catch (err) {
      alert(friendlyError(err, "Partage livreur non fait. Verifie le numero du livreur."));
    }
  }

  const filteredOrders = useMemo(() => {
    if (filter === "WORK") return orders.filter((order) => ["PENDING", "PAID", "PREPARED"].includes(order.status));
    if (filter === "ALL") return orders;
    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);
  const activeCount = orders.filter((order) => ["PENDING", "PAID"].includes(order.status)).length;
  const verifyCount = orders.filter((order) => order.status === "PENDING").length;
  const prepareCount = orders.filter((order) => order.status === "PAID").length;
  const readyCount = orders.filter((order) => order.status === "PREPARED").length;
  const doneCount = orders.filter((order) => order.status === "DELIVERED").length;
  const nextOrder = getNextOrder(orders);

  function getFilterCount(item) {
    if (item === "WORK") return activeCount + readyCount;
    if (item === "PENDING") return verifyCount;
    if (item === "PREPARED") return readyCount;
    if (item === "DELIVERED") return doneCount;
    if (item === "ALL") return orders.length;
    return orders.filter((order) => order.status === item).length;
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[var(--primary)]">Commandes</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Travail du jour</h1>
            <p className="mt-1 text-base font-semibold leading-6 text-[var(--text-dim)]">Une commande avance simplement: confirmer, preparer, livrer.</p>
          </div>
          <button onClick={fetchOrders} className="app-icon-button" aria-label="Actualiser">
            <RefreshCw size={19} strokeWidth={2.5} />
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {["WORK", "PENDING", "PAID", "PREPARED", "DELIVERED", "ALL"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${
                filter === item ? "border border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-sm" : "border border-[var(--outline)]/40 bg-white text-[var(--text-dim)] shadow-sm"
              }`}
            >
              {statusLabels[item]}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.68rem] ${filter === item ? "bg-white/14 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
                {getFilterCount(item)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <p className="mt-2 text-xs">Tes commandes restent sauvegardees. Actualise quand la connexion revient.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <section className="mt-5 space-y-4">
          {nextOrder && (
            <NextOrderHero order={nextOrder} onOpen={() => setSelectedOrder(nextOrder)} />
          )}
          <div className="grid grid-cols-3 gap-2">
            <WorkTile title="Confirmer" value={verifyCount} tone="primary" />
            <WorkTile title="Preparer" value={prepareCount} tone="accent" />
            <WorkTile title="Livrer" value={readyCount} />
          </div>
        </section>
      )}

      <section className="mt-5 md:mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="app-card p-8 text-center md:py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Package size={32} />
            </div>
            <h2 className="mt-4 text-xl font-black text-zinc-950">Aucune commande</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-zinc-500">Les commandes boutique et WhatsApp apparaitront ici avec le client, le total et les infos de livraison.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
                onPrepared={() => markStatus(order, "PREPARED")}
                onDelivered={() => markStatus(order, "DELIVERED")}
              />
            ))}
          </div>
        )}
      </section>

      {selectedOrder && (
        <OrderSheet
          order={selectedOrder}
          drivers={drivers}
          sellerName={seller.name}
          onClose={() => setSelectedOrder(null)}
          onPrepared={() => markStatus(selectedOrder, "PREPARED")}
          onDelivered={() => markStatus(selectedOrder, "DELIVERED")}
          onDriverShared={markDriverAssigned}
        />
      )}
    </div>
  );
}

function NextOrderHero({ order, onOpen }) {
  const action = getNextAction(order);
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const itemCount = getOrderItemCount(order);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full overflow-hidden rounded-[28px] bg-[var(--text-main)] p-5 text-left text-white shadow-[var(--shadow-lg)] active:scale-[0.99]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/48">Prochaine commande</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-8 text-white">{action.title}</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-white/62">#{order.order_ref || order.id?.slice(0, 8)} - {itemCount} article{itemCount > 1 ? "s" : ""}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-[var(--text-main)]">
          {formatPrice(total)}
        </span>
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[22px] bg-white/10 p-3 ring-1 ring-white/10">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{order.customer_phone && order.customer_phone !== "UNKNOWN" ? order.customer_phone : "Client WhatsApp"}</p>
          <p className="mt-1 truncate text-xs font-semibold text-white/55">{order.delivery_zone || order.delivery_address || "Adresse a confirmer"}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[var(--text-main)]">
          <ChevronRight size={22} />
        </span>
      </div>
    </button>
  );
}

function OrderCard({ order, onClick, onPrepared, onDelivered }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const primaryLine = order.customer_phone && order.customer_phone !== "UNKNOWN"
    ? order.customer_phone
    : "Client WhatsApp";
  const action = getNextAction(order);
  const quickAction = getQuickAction(order, onPrepared, onDelivered);
  const itemCount = getOrderItemCount(order);

  return (
    <div className="w-full overflow-hidden rounded-[24px] border border-white/80 bg-white/95 text-left shadow-[0_16px_34px_rgba(13,23,18,0.08)] ring-1 ring-[rgba(191,206,197,0.34)]">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left transition active:scale-[0.99]"
      >
        <div className="p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${action.iconTone}`}>
                  {action.icon}
                </span>
                <div>
                  <p className="font-display text-base font-semibold text-[var(--text-main)]">#{order.order_ref || order.id?.slice(0, 8)}</p>
                  <p className="text-xs font-bold text-[var(--text-dim)]">{primaryLine}</p>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold text-[var(--primary)]">{formatPrice(total)}</p>
              <p className="mt-1 text-xs text-[var(--outline)]">
                {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <div className="min-w-0 rounded-2xl bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--text-dim)]">{statusHints[order.status] || "Action"}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-main)]">
                {itemCount} article{itemCount > 1 ? "s" : ""} dans la commande
              </p>
            </div>
            <span className={`self-start rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${statusClasses[order.status] || "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
              {statusLabels[order.status] || order.status}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1 text-sm text-[var(--text-dim)]">
            <MapPin size={16} className="shrink-0 text-[var(--outline)]" />
            <span className="truncate">{order.delivery_zone || order.delivery_address || "Adresse a confirmer"}</span>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 px-4 py-3 ${action.barClass}`}>
          <span className="min-w-0 text-sm font-bold">{action.title}</span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold">
            Details
            <ChevronRight size={16} />
          </span>
        </div>
      </button>

      <div className="border-t border-[var(--surface-mid)] bg-white p-3">
        {quickAction ? (
          <button
            type="button"
            onClick={quickAction.onClick}
            className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-sm active:scale-[0.99] ${quickAction.className}`}
          >
            {quickAction.icon}
            {quickAction.label}
          </button>
        ) : (
          <div className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-extrabold text-zinc-500">
            <CheckCircle2 size={17} />
            Effectuee
          </div>
        )}
      </div>
    </div>
  );
}

function getQuickAction(order, onPrepared, onDelivered) {
  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      label: "Marquer livree",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[var(--primary-bright)] text-zinc-950",
      onClick: onDelivered,
    };
  }

  if (order.status === "PENDING" || order.status === "PAID") {
    return {
      label: order.status === "PENDING" ? "Verifier et marquer pret" : "Paquet pret",
      icon: <Package size={18} />,
      className: "bg-[var(--text-main)] text-white",
      onClick: onPrepared,
    };
  }

  return null;
}

function getOrderItemCount(order) {
  const count = (order.order_items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
  return count || (order.order_items || []).length || 1;
}

function getNextOrder(orders) {
  const priority = { PENDING: 1, PAID: 2, PREPARED: 3 };
  return [...orders]
    .filter((order) => ["PENDING", "PAID", "PREPARED"].includes(order.status))
    .sort((a, b) => {
      const statusDiff = (priority[a.status] || 9) - (priority[b.status] || 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    })[0] || null;
}

function OrderSheet({ order, drivers, sellerName, onClose, onPrepared, onDelivered, onDriverShared }) {
  const items = order.order_items || [];
  const itemsText = items.map((item) => `- ${item.quantity} x ${item.products?.name || "Article"}`).join("\n");
  const deliveryAmount = Number(order.delivery_fee || 0);
  const deliveryText = deliveryAmount > 0 ? `${formatPrice(deliveryAmount)} a encaisser` : "Aucun frais";
  const clientPhone = cleanPhone(order.customer_phone);
  const displayClientPhone = order.customer_phone && order.customer_phone !== "UNKNOWN" ? order.customer_phone : "Client WhatsApp";
  const availableDrivers = drivers.filter((driver) => driver.is_active !== false);
  const isPrepared = order.status === "PREPARED" || order.delivery_status === "READY";
  const isDone = order.status === "DELIVERED";
  const nextAction = getNextAction(order);
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const driverMessage = encodeURIComponent(`FICHE LIVRAISON TIKCHOP

Boutique: ${sellerName || "Tikchop"}
Commande: ${order.order_ref || order.id?.slice(0, 8)}

Client: ${order.customer_phone || "Non renseigne"}
Zone: ${order.delivery_zone || "Non renseignee"}
Adresse: ${order.delivery_address || "Non renseignee"}

Articles:
${itemsText || "- Articles dans la commande"}

Livraison: ${deliveryText}
Paiement produit: ${order.status === "PAID" || order.payment_method === "PAYSTACK" ? "PAYE" : "A verifier"}
Total commande: ${formatPrice(total)}`);

  const clientMessage = encodeURIComponent(`Bonjour, votre commande Tikchop ${order.order_ref || order.id?.slice(0, 8)} est prise en charge.

Articles: ${items.length || 1}
Livraison: ${order.delivery_zone || "A confirmer"}
Total: ${formatPrice(total)}

Nous vous tenons informe pour la livraison.`);

  function openDriverWhatsapp(driver = null) {
    const phone = cleanPhone(driver?.phone_number);
    const url = phone ? `https://wa.me/${phone}?text=${driverMessage}` : `https://wa.me/?text=${driverMessage}`;
    window.open(url, "_blank", "noopener,noreferrer");

    if (driver) {
      onDriverShared(order, driver);
    }
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-[3px] md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[460px] overflow-hidden rounded-t-[30px] bg-white shadow-2xl md:rounded-[30px]">
        <div className="relative overflow-hidden bg-[var(--text-main)] p-5 text-white">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Commande #{order.order_ref || order.id?.slice(0, 8)}</p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-8 text-white">{nextAction.title}</h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-white/62">{nextAction.subtitle}</p>
            </div>
            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Fermer">
            <X size={18} />
            </button>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs font-bold text-white/45">Total</p>
              <p className="mt-1 font-display text-xl font-bold text-[var(--primary-bright)]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs font-bold text-white/45">Articles</p>
              <p className="mt-1 font-display text-xl font-bold text-white">{getOrderItemCount(order)}</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl bg-[var(--surface-soft)] p-3 text-sm font-bold leading-5 text-[var(--text-dim)]">
            {isPrepared || isDone
              ? "La commande est prete. Tu peux l'envoyer a un livreur, puis marquer livree apres reception client."
              : "Verifie les articles ci-dessous. Quand le paquet est pret, appuie sur le bouton principal en bas."}
          </div>

          <OrderProgress status={order.status} />

          <section>
            <SectionTitle step="1" title="Articles a preparer" />
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-zinc-950">{item.products?.name || "Article"}</p>
                    <p className="text-sm font-bold text-zinc-400">Quantite a mettre: {item.quantity}</p>
                  </div>
                  <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-white px-3 text-sm font-extrabold text-zinc-950 shadow-sm">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle step="2" title="Client et livraison" />
            <div className="mt-3 grid gap-2">
              <InfoBlock icon={<Phone size={18} />} label="Client" value={displayClientPhone} />
              <InfoBlock icon={<MapPin size={18} />} label="Adresse" value={`${order.delivery_zone || "Zone non renseignee"} - ${order.delivery_address || "Adresse non renseignee"}`} />
              <InfoBlock icon={<Truck size={18} />} label="Livreur" value={order.delivery_drivers?.name || "Pas encore assigne"} />
            </div>
          </section>

          <div className="rounded-[24px] bg-zinc-950 p-4 text-white">
            <div className="flex justify-between text-sm font-bold text-white/60">
              <span>Produits</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm font-bold text-white/60">
              <span>Livraison</span>
              <span>{formatPrice(order.delivery_fee)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-xl font-extrabold">
              <span>Total</span>
              <span className="text-green-400">{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-zinc-100 p-4">
          <p className="quiet-label">Action a faire maintenant</p>
          {!isPrepared && !isDone ? (
            <button onClick={onPrepared} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] text-base font-extrabold text-zinc-950 shadow-[0_14px_34px_rgba(0,108,73,0.20)] active:scale-[0.99]">
              <Package size={20} />
              {order.status === "PENDING" ? "Verifier et marquer pret" : "Paquet pret"}
            </button>
          ) : isDone ? (
            <div className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-sm font-extrabold text-zinc-500">
              <CheckCircle2 size={18} />
              Commande terminee
            </div>
          ) : (
            <button onClick={() => openDriverWhatsapp()} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-zinc-950 text-base font-extrabold text-white shadow-[0_14px_34px_rgba(16,24,20,0.18)] active:scale-[0.99]">
              <Share2 size={19} />
              Envoyer la fiche au livreur
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a href={clientPhone ? `https://wa.me/${clientPhone}?text=${clientMessage}` : undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${clientPhone ? "bg-white text-zinc-950 ring-1 ring-zinc-200" : "pointer-events-none bg-zinc-100 text-zinc-400"}`}>
              <Send size={17} />
              Message client
            </a>
            <button onClick={onDelivered} disabled={!isPrepared || isDone} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${isPrepared && !isDone ? "bg-[var(--surface-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/15" : "bg-zinc-100 text-zinc-400"}`}>
              <CheckCircle2 size={17} />
              Livree
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-100 px-4 pb-4">
          {isPrepared || isDone ? (
            <>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-400">Envoyer a un livreur</p>
              {availableDrivers.length === 0 ? (
                <Link href="/delivery-settings" className="flex min-h-[48px] items-center justify-center rounded-lg bg-zinc-50 text-sm font-extrabold text-zinc-500 ring-1 ring-zinc-100">
                  Ajouter un livreur
                </Link>
              ) : (
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {availableDrivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => openDriverWhatsapp(driver)}
                      className={`min-h-[48px] shrink-0 rounded-lg px-4 text-left text-sm font-extrabold ring-1 ${
                        order.delivery_driver_id === driver.id
                          ? "bg-green-50 text-green-700 ring-green-200"
                          : "bg-zinc-50 text-zinc-950 ring-zinc-100"
                      }`}
                    >
                      <span className="block">{driver.name}</span>
                      <span className="block text-xs font-bold text-zinc-400">{driver.zone || "Toutes zones"}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-500 ring-1 ring-zinc-100">
              Le livreur vient apres le bouton Commande prete.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkTile({ title, value, tone = "default" }) {
  const className = tone === "primary"
    ? "border-[var(--text-main)] bg-[var(--text-main)] text-white"
    : tone === "accent"
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-main)]"
      : "border-[var(--outline)]/35 bg-white text-[var(--text-main)]";

  return (
    <div className={`rounded-[18px] border p-3 shadow-[var(--shadow-sm)] ${className}`}>
      <p className={`text-sm font-bold ${tone === "primary" ? "text-white/80" : "text-[var(--text-dim)]"}`}>{title}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

function OrderProgress({ status }) {
  const steps = [
    { key: "CHECK", label: "Verifier", active: ["PENDING", "PAID", "PREPARED", "DELIVERED"].includes(status) },
    { key: "READY", label: "Pret", active: ["PREPARED", "DELIVERED"].includes(status) },
    { key: "DONE", label: "Livre", active: status === "DELIVERED" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <div key={step.key} className={`rounded-2xl border p-3 text-center ${step.active ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : "border-zinc-100 bg-zinc-50 text-zinc-400"}`}>
          <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold ${step.active ? "bg-[var(--primary)] text-white" : "bg-white text-zinc-400"}`}>
            {step.active ? <CheckCircle2 size={16} /> : index + 1}
          </span>
          <p className="mt-1 text-xs font-extrabold">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function getNextAction(order) {
  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      title: "Envoyer au livreur",
      subtitle: "Le paquet est pret. Partage la fiche ou marque livree apres reception.",
      icon: <Truck size={17} />,
      iconTone: "bg-blue-100 text-blue-700",
      barClass: "bg-blue-50 text-blue-800",
    };
  }

  if (order.status === "DELIVERED") {
    return {
      title: "Commande livree",
      subtitle: "Cette commande est terminee.",
      icon: <CheckCircle2 size={17} />,
      iconTone: "bg-zinc-100 text-zinc-500",
      barClass: "bg-zinc-50 text-zinc-500",
    };
  }

  return {
    title: order.status === "PAID" ? "Faire le paquet" : "Confirmer la commande",
    subtitle: order.status === "PAID"
      ? "Paiement recu. Mets les articles dans le sachet."
      : "Verifie client, paiement et adresse avant preparation.",
    icon: order.status === "PAID" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />,
    iconTone: order.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
    barClass: order.status === "PAID" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800",
  };
}

function SectionTitle({ step, title }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-extrabold text-white">
        {step}
      </span>
      <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-zinc-500">{title}</h3>
    </div>
  );
}

function InfoBlock({ icon, label, value }) {
  return (
    <div className="flex gap-3 rounded-lg bg-zinc-50 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
        <p className="mt-1 font-extrabold leading-5 text-zinc-950">{value}</p>
      </div>
    </div>
  );
}
