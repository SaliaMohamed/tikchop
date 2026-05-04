"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

const statusLabels = {
  ALL: "Toutes",
  WORK: "En cours",
  PENDING: "A preparer",
  PAID: "A preparer",
  PREPARED: "A livrer",
  DELIVERED: "Effectuees",
  CANCELLED: "Annulees",
};

const statusHints = {
  PENDING: "Verifier les articles",
  PAID: "Preparer maintenant",
  PREPARED: "Remettre au livreur",
  DELIVERED: "Livre au client",
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
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState("WORK");
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
    if (filter === "WORK") return orders.filter((order) => ["PENDING", "PAID", "PREPARED"].includes(order.status));
    if (filter === "ALL") return orders;
    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);
  const pendingCount = orders.filter((order) => order.status === "PENDING" || order.status === "PAID").length;
  const readyCount = orders.filter((order) => order.status === "PREPARED").length;
  const doneCount = orders.filter((order) => order.status === "DELIVERED").length;
  const nextOrder = orders.find((order) => ["PENDING", "PAID", "PREPARED"].includes(order.status));

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[var(--primary)]">Preparation</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Commandes du jour</h1>
            <p className="mt-1 text-base text-[var(--text-dim)]">Prepare, marque pret, puis marque livre.</p>
          </div>
          <button onClick={fetchOrders} className="app-icon-button" aria-label="Actualiser">
            <RefreshCw size={19} strokeWidth={2.5} />
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {["WORK", "PENDING", "PREPARED", "DELIVERED", "ALL"].map((item) => (
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

      {!loading && !error && orders.length > 0 && (
        <section className="mt-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <WorkTile title="Preparer" value={pendingCount} tone="primary" />
            <WorkTile title="Livrer" value={readyCount} />
            <WorkTile title="Fait" value={doneCount} />
          </div>
          {nextOrder && (
            <button
              type="button"
              onClick={() => setSelectedOrder(nextOrder)}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--text-main)] p-4 text-left text-white shadow-sm active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Prochaine action</p>
                <p className="mt-1 truncate font-display text-lg font-semibold">{getNextAction(nextOrder).title}</p>
                <p className="mt-1 text-sm text-white/65">Commande #{nextOrder.order_ref || nextOrder.id?.slice(0, 8)}</p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--text-main)]">
                <ChevronRight size={22} />
              </span>
            </button>
          )}
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
          onClose={() => setSelectedOrder(null)}
          onPrepared={() => markStatus(selectedOrder, "PREPARED")}
          onDelivered={() => markStatus(selectedOrder, "DELIVERED")}
          onDriverShared={markDriverAssigned}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onClick, onPrepared, onDelivered }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const primaryLine = order.customer_phone && order.customer_phone !== "UNKNOWN"
    ? order.customer_phone
    : "Client WhatsApp";
  const action = getNextAction(order);
  const quickAction = getQuickAction(order, onPrepared, onDelivered);
  const itemCount = (order.order_items || []).reduce((count, item) => count + Number(item.quantity || 0), 0);

  return (
    <div className="app-card w-full overflow-hidden p-0 text-left">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left transition active:scale-[0.99]"
      >
        <div className="p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${action.iconTone}`}>
                  {action.icon}
                </span>
                <div>
                  <p className="font-display text-base font-semibold text-[var(--text-main)]">#{order.order_ref || order.id?.slice(0, 8)}</p>
                  <p className="text-xs font-semibold text-[var(--text-dim)]">{primaryLine}</p>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-base font-semibold text-[var(--primary)]">{formatPrice(total)}</p>
              <p className="mt-1 text-xs text-[var(--outline)]">
                {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <div className="min-w-0 rounded-lg bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--text-dim)]">Articles</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-main)]">
                {itemCount || (order.order_items || []).length || 1} article{itemCount > 1 ? "s" : ""} a preparer
              </p>
            </div>
            <span className={`self-start rounded px-2.5 py-1 text-[0.68rem] font-bold uppercase ${statusClasses[order.status] || "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
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
            className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg text-sm font-extrabold shadow-sm active:scale-[0.99] ${quickAction.className}`}
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
      className: "bg-green-500 text-zinc-950",
      onClick: onDelivered,
    };
  }

  if (order.status === "PENDING" || order.status === "PAID") {
    return {
      label: "Marquer pret",
      icon: <Package size={18} />,
      className: "bg-[var(--text-main)] text-white",
      onClick: onPrepared,
    };
  }

  return null;
}

function OrderSheet({ order, drivers, onClose, onPrepared, onDelivered, onDriverShared }) {
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
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5">
          <div className="min-w-0">
            <p className="quiet-label text-green-700">Commande #{order.order_ref || order.id?.slice(0, 8)}</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-8 text-zinc-950">{nextAction.title}</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-500">{nextAction.subtitle}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="no-scrollbar max-h-[60vh] space-y-4 overflow-y-auto p-5">
          <section>
            <SectionTitle step="1" title="Articles a preparer" />
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3">
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

        <div className="space-y-3 border-t border-zinc-100 p-4">
          <p className="quiet-label">Action a faire maintenant</p>
          {!isPrepared && !isDone ? (
            <button onClick={onPrepared} className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-lg bg-green-500 text-base font-extrabold text-zinc-950 shadow-sm active:scale-[0.99]">
              <Package size={19} />
              J&apos;ai prepare la commande
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openDriverWhatsapp()} className="flex min-h-[58px] items-center justify-center gap-2 rounded-lg bg-zinc-950 text-sm font-extrabold text-white">
                <Share2 size={17} />
                Envoyer livreur
              </button>
              <button onClick={onDelivered} disabled={isDone} className={`flex min-h-[58px] items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${isDone ? "bg-zinc-100 text-zinc-400" : "bg-green-500 text-zinc-950"}`}>
                <CheckCircle2 size={17} />
                {isDone ? "Effectuee" : "Marquer livree"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {isPrepared ? (
              <button onClick={onPrepared} disabled className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-extrabold text-zinc-400">
                <Package size={17} />
                Deja pret
              </button>
            ) : (
              <button type="button" disabled className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-extrabold text-zinc-400">
                <Truck size={17} />
                Livreur apres pret
              </button>
            )}
            <a href={clientPhone ? `https://wa.me/${clientPhone}?text=${clientMessage}` : undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${clientPhone ? "bg-white text-zinc-950 ring-1 ring-zinc-200" : "pointer-events-none bg-zinc-100 text-zinc-400"}`}>
              <Send size={17} />
              Client
            </a>
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
              Le livreur vient apres le bouton “J&apos;ai prepare la commande”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkTile({ title, value, tone = "default" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "primary" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--outline)]/35 bg-white text-[var(--text-main)]"}`}>
      <p className={`text-sm font-bold ${tone === "primary" ? "text-white/80" : "text-[var(--text-dim)]"}`}>{title}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

function getNextAction(order) {
  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      title: "Envoyer au livreur",
      subtitle: "La commande est prete. Partage les details au livreur.",
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
    title: order.status === "PAID" ? "Preparer la commande" : "Verifier et preparer",
    subtitle: "Mets les articles ensemble, puis marque la commande comme prete.",
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
