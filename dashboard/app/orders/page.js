"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
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

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

const statusLabels = {
  ALL: "Toutes",
  PENDING: "A traiter",
  PAID: "Payees",
  PREPARED: "Pretes",
  DELIVERED: "Livrees",
  CANCELLED: "Annulees",
};

const statusClasses = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  PREPARED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-zinc-100 text-zinc-500",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      setError("");

      const [orderData, deliveryData] = await Promise.all([
        getSellerOrders(),
        getSellerDeliverySettings("salia"),
      ]);

      setOrders(orderData || []);
      setDrivers(deliveryData?.drivers || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err.message || "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }

  async function markStatus(order, status) {
    try {
      await updateOrderStatus(order.id, status);
      await fetchOrders();
      setSelectedOrder((current) => current ? { ...current, status } : current);
    } catch (err) {
      alert(`Impossible de changer le statut: ${err.message}`);
    }
  }

  async function markDriverAssigned(order, driver) {
    try {
      const result = await assignOrderDriver(order.id, driver.id);
      setOrders((current) => current.map((item) => (
        item.id === order.id
          ? { ...item, ...result, delivery_drivers: driver }
          : item
      )));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, ...result, delivery_drivers: driver } : current);
    } catch (err) {
      alert(`Impossible d'assigner le livreur: ${err.message}`);
    }
  }

  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Commandes</h1>
            <p className="mt-1 text-base text-[var(--text-dim)]">Gerez vos expeditions et suivis.</p>
          </div>
          <button onClick={fetchOrders} className="app-icon-button" aria-label="Actualiser">
            <RefreshCw size={19} strokeWidth={2.5} />
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
          {["ALL", "PENDING", "PAID", "PREPARED", "DELIVERED"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${
                filter === item ? "border border-[var(--primary)] bg-white text-[var(--primary)] shadow-sm" : "border border-[var(--outline)]/40 bg-white text-[var(--text-dim)] shadow-sm"
              }`}
            >
              {statusLabels[item]}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <p className="mt-2 text-xs">
            Si les champs livraison manquent, applique la migration `2026-05-03-delivery-and-order-management.sql`.
          </p>
        </div>
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
              <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
            ))}
          </div>
        )}
      </section>

      {selectedOrder && (
        <OrderSheet
          order={selectedOrder}
          drivers={drivers}
          onClose={() => setSelectedOrder(null)}
          onPrepared={() => markStatus(selectedOrder, "PREPARED")}
          onDelivered={() => markStatus(selectedOrder, "DELIVERED")}
          onDriverShared={markDriverAssigned}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onClick }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="app-card w-full p-4 text-left transition active:scale-[0.99]"
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-[var(--text-main)]">#{order.order_ref || order.id?.slice(0, 8)}</p>
            <span className={`rounded px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${statusClasses[order.status] || "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
              {statusLabels[order.status] || order.status}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--text-dim)]">{order.customer_phone || "Client inconnu"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-base font-semibold text-[var(--primary)]">{formatPrice(total)}</p>
          <p className="mt-1 text-xs text-[var(--outline)]">
            {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-[var(--surface-mid)] pt-3 text-sm text-[var(--text-dim)]">
        <MapPin size={16} className="shrink-0 text-[var(--outline)]" />
        <span className="truncate">{order.delivery_zone || order.delivery_address || "Adresse non renseignee"}</span>
      </div>
    </button>
  );
}

function OrderSheet({ order, drivers, onClose, onPrepared, onDelivered, onDriverShared }) {
  const items = order.order_items || [];
  const itemsText = items.map((item) => `- ${item.quantity} x ${item.products?.name || "Article"}`).join("\n");
  const deliveryAmount = Number(order.delivery_fee || 0);
  const deliveryText = deliveryAmount > 0 ? `${formatPrice(deliveryAmount)} a encaisser` : "Aucun frais";
  const clientPhone = cleanPhone(order.customer_phone);
  const availableDrivers = drivers.filter((driver) => driver.is_active !== false);
  const driverMessage = encodeURIComponent(`Nouvelle livraison Tikchop

Boutique: Salia Boutique
Commande: ${order.order_ref || order.id?.slice(0, 8)}

Client: ${order.customer_phone || "Non renseigne"}
Zone: ${order.delivery_zone || "Non renseignee"}
Adresse: ${order.delivery_address || "Non renseignee"}

Articles:
${itemsText || "- Articles dans la commande"}

Livraison: ${deliveryText}
Paiement produit: ${order.status === "PAID" || order.payment_method === "PAYSTACK" ? "PAYE" : "A verifier"}`);

  const clientMessage = encodeURIComponent(`Bonjour, votre commande ${order.order_ref || order.id?.slice(0, 8)} est en preparation. Nous vous tenons informe pour la livraison.`);

  function openDriverWhatsapp(driver = null) {
    const phone = cleanPhone(driver?.phone_number);
    const url = phone ? `https://wa.me/${phone}?text=${driverMessage}` : `https://wa.me/?text=${driverMessage}`;
    window.open(url, "_blank", "noopener,noreferrer");

    if (driver) {
      onDriverShared(order, driver);
    }
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[460px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <p className="quiet-label text-green-700">Commande</p>
            <h2 className="text-2xl font-extrabold text-zinc-950">#{order.order_ref || order.id?.slice(0, 8)}</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-5 overflow-y-auto p-5">
          <InfoBlock icon={<Phone size={18} />} label="Client" value={order.customer_phone || "Non renseigne"} />
          <InfoBlock icon={<MapPin size={18} />} label="Adresse" value={`${order.delivery_zone || "Zone non renseignee"} - ${order.delivery_address || "Adresse non renseignee"}`} />
          <InfoBlock icon={<Truck size={18} />} label="Livreur" value={order.delivery_drivers?.name || "Pas encore assigne"} />

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-400">Articles</p>
            <div className="space-y-2">
              {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                  <div>
                    <p className="font-extrabold text-zinc-950">{item.products?.name || "Article"}</p>
                    <p className="text-sm font-bold text-zinc-400">Quantite: {item.quantity}</p>
                  </div>
                  <p className="font-extrabold text-zinc-950">{formatPrice(Number(item.price_at_time || 0) * Number(item.quantity || 0))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-zinc-950 p-4 text-white">
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
              <span className="text-green-400">{formatPrice(Number(order.total_amount || 0) + Number(order.delivery_fee || 0))}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-4">
          <button onClick={onPrepared} className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-extrabold text-zinc-950">
            <Package size={17} />
            Prete
          </button>
          <button onClick={onDelivered} className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-green-500 text-sm font-extrabold text-zinc-950">
            <CheckCircle2 size={17} />
            Livree
          </button>
          <button onClick={() => openDriverWhatsapp()} className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-zinc-950 text-sm font-extrabold text-white">
            <Share2 size={17} />
            Livreur
          </button>
          <a href={clientPhone ? `https://wa.me/${clientPhone}?text=${clientMessage}` : undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[52px] items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${clientPhone ? "bg-white text-zinc-950 ring-1 ring-zinc-200" : "pointer-events-none bg-zinc-100 text-zinc-400"}`}>
            <Send size={17} />
            Client
          </a>
        </div>

        <div className="border-t border-zinc-100 px-4 pb-4">
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
        </div>
      </div>
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
