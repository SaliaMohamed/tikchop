"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  ReceiptText,
  Send,
  Share2,
  Truck,
  X,
} from "lucide-react";
import {
  assignOrderDriver,
  createDemoOrder,
  getSellerDeliverySettings,
  getSellerOrders,
  markOrderSharedToDriver,
  pauseBotForCustomer,
  resumeBotForCustomer,
  sendSellerManualReply,
  updateOrderStatus,
} from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  buildDriverShareMessage,
  buildWhatsappHref,
  getBestOrderResponse,
  getOrderCaseNotes,
  getOrderResponseTemplates,
} from "../../lib/customer-response-playbook";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

function getSimpleOrderStatus(order) {
  if (order?.status === "DELIVERED") return "DELIVERED";
  if (order?.status === "CANCELLED") return "CANCELLED";
  if (order?.delivery_status === "ASSIGNED") return "IN_DELIVERY";
  return order?.status || "PENDING";
}

const statusLabels = {
  ALL: "Toutes",
  WORK: "Ouvertes",
  PENDING: "Nouvelles",
  PAID: "Colis",
  DELIVERY: "Livreur",
  PREPARED: "Livreur",
  IN_DELIVERY: "En route",
  DELIVERED: "Finies",
  CANCELLED: "Annulees",
};

const orderTabs = [
  { key: "PENDING", label: "Nouvelles" },
  { key: "PAID", label: "Colis" },
  { key: "DELIVERY", label: "Livreur" },
  { key: "DELIVERED", label: "Finies" },
];

const statusHints = {
  PENDING: "Confirmer le client",
  PAID: "Mettre dans le sachet",
  PREPARED: "Envoyer au livreur",
  IN_DELIVERY: "Marquer livree",
  DELIVERED: "Vente fermee",
  CANCELLED: "Commande annulee",
};

const statusClasses = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  PREPARED: "bg-blue-100 text-blue-700",
  IN_DELIVERY: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-zinc-100 text-zinc-500",
  CANCELLED: "bg-red-100 text-red-700",
};

const LOAD_TIMEOUT_MS = 12000;

function withTimeout(promise, message, timeoutMs = LOAD_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function OrdersPage() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingNote, setLoadingNote] = useState("Chargement des commandes...");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState("PENDING");
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async function fetchOrders() {
    if (!seller.slug) {
      setOrders([]);
      setDrivers([]);
      setLoading(false);
      setError("Aucune boutique active. Reconnectez-vous pour ouvrir vos commandes.");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote("Chargement des commandes...");
      setError("");
      const slowTimer = setTimeout(() => {
        setLoadingNote("La connexion est lente. On essaie encore quelques secondes...");
      }, 4500);

      try {
        const token = await withTimeout(
          getSellerAccessToken(),
          "Session trop lente a verifier. Actualisez ou reconnectez-vous.",
          8000,
        );

        const orderData = await withTimeout(
          getSellerOrders(seller.slug, token),
          "Commandes trop longues a charger. Actualisez la page.",
        );

        let deliveryData = { drivers: [] };
        try {
          deliveryData = await withTimeout(
            getSellerDeliverySettings(seller.slug, token),
            "Reglages livraison trop longs a charger.",
            8000,
          );
        } catch (deliveryError) {
          console.warn("Delivery settings skipped:", deliveryError);
        }

        setOrders(orderData || []);
        setDrivers(deliveryData?.drivers || []);
      } finally {
        clearTimeout(slowTimer);
      }
    } catch (err) {
      console.warn("Orders unavailable:", err);
      const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
      setError(sessionExpired
        ? "Session vendeur expiree. Reconnectez-vous pour voir vos commandes."
        : friendlyError(err, "Commandes non chargees. Verifiez la connexion puis actualisez."));
    } finally {
      setLoadingNote("Chargement des commandes...");
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
      setError(friendlyError(err, "Statut non mis a jour. Gardez la commande ouverte puis relancez l'action."));
    }
  }

  async function markPaid(order) {
    await markStatus(order, "PAID");
  }

  async function cancelOrder(order) {
    await markStatus(order, "CANCELLED");
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
      setError(friendlyError(err, "Partage livreur non fait. Verifiez le numero du livreur."));
    }
  }

  async function markSharedToDriver(order) {
    try {
      const token = await getSellerAccessToken();
      const result = await markOrderSharedToDriver(order.id, token);
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, ...result } : item
      )));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, ...result } : current);
    } catch (err) {
      setError(friendlyError(err, "Commande partagee, mais le statut livraison n'a pas ete mis a jour."));
    }
  }

  function updateOrderHandoff(orderId, handoff) {
    setOrders((current) => current.map((item) => (
      item.id === orderId ? { ...item, handoff } : item
    )));
    setSelectedOrder((current) => current?.id === orderId ? { ...current, handoff } : current);
  }

  async function handlePauseBot(order) {
    try {
      const token = await getSellerAccessToken();
      const result = await pauseBotForCustomer(seller.slug, order.customer_phone, token);
      updateOrderHandoff(order.id, result?.handoff || null);
      return result;
    } catch (err) {
      const message = friendlyError(err, "Pause bot non appliquee. Verifiez le numero client.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleResumeBot(order) {
    try {
      const token = await getSellerAccessToken();
      await resumeBotForCustomer(seller.slug, order.customer_phone, token);
      updateOrderHandoff(order.id, null);
      return { ok: true };
    } catch (err) {
      const message = friendlyError(err, "Bot non reactive. Reessayez dans quelques secondes.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleManualReply(order, text) {
    try {
      const token = await getSellerAccessToken();
      const result = await sendSellerManualReply(seller.slug, order.customer_phone, text, token);
      updateOrderHandoff(order.id, result?.handoff || order.handoff || null);
      return result;
    } catch (err) {
      const message = friendlyError(err, "Message client non envoye. Verifiez WhatsApp puis reessayez.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleCreateDemoOrder() {
    try {
      setDemoBusy(true);
      setError("");
      const token = await getSellerAccessToken();
      const demoOrder = await createDemoOrder(seller.slug, token);
      await fetchOrders();
      setFilter("PENDING");
      if (demoOrder?.id) {
        setSelectedOrder(demoOrder);
      }
    } catch (err) {
      console.warn("Demo order create unavailable:", err);
      setError(friendlyError(err, "Commande test non creee. Verifiez qu'une boutique est bien active."));
    } finally {
      setDemoBusy(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (filter === "WORK") return orders.filter((order) => ["PENDING", "PAID", "PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)));
    if (filter === "DELIVERY") return orders.filter((order) => ["PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)));
    if (filter === "ALL") return orders;
    return orders.filter((order) => getSimpleOrderStatus(order) === filter);
  }, [filter, orders]);
  const activeCount = orders.filter((order) => ["PENDING", "PAID"].includes(getSimpleOrderStatus(order))).length;
  const verifyCount = orders.filter((order) => getSimpleOrderStatus(order) === "PENDING").length;
  const prepareCount = orders.filter((order) => getSimpleOrderStatus(order) === "PAID").length;
  const readyCount = orders.filter((order) => getSimpleOrderStatus(order) === "PREPARED").length;
  const deliveryCount = orders.filter((order) => getSimpleOrderStatus(order) === "IN_DELIVERY").length;
  const toFinishCount = readyCount + deliveryCount;
  const doneCount = orders.filter((order) => getSimpleOrderStatus(order) === "DELIVERED").length;
  const nextOrder = getNextOrder(orders);
  const sessionExpired = /Session vendeur expiree/i.test(error);
  const headerCount = activeCount + toFinishCount;
  const headerLabel = headerCount > 0
    ? `${headerCount} vente${headerCount > 1 ? "s" : ""}`
    : "Ventes";

  function getFilterCount(item) {
    if (item === "WORK") return activeCount + toFinishCount;
    if (item === "PENDING") return verifyCount;
    if (item === "PREPARED") return readyCount;
    if (item === "DELIVERY") return readyCount + deliveryCount;
    if (item === "IN_DELIVERY") return deliveryCount;
    if (item === "DELIVERED") return doneCount;
    if (item === "ALL") return orders.length;
    return orders.filter((order) => getSimpleOrderStatus(order) === item).length;
  }

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] px-4 md:px-8">
      <header className="flex items-center justify-between pb-5 pt-6">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">Aujourd'hui</p>
          <h1 className="mt-1 font-display text-3xl font-black leading-none text-[#07120d]">{headerLabel}</h1>
        </div>
        <button 
          onClick={fetchOrders} 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#07120d]/5 text-[#07120d] active:scale-95 transition"
          aria-label="Actualiser"
        >
          <RefreshCw size={16} strokeWidth={1.5} className={loading ? "animate-spin text-[#008f5a]" : ""} />
        </button>
      </header>

      <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-2">
          {orderTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`min-h-[42px] rounded-full px-4 text-sm font-black transition ${
                filter === key ? "bg-[#07120d] text-white" : "bg-white text-[#4e6055] ring-1 ring-[#07120d]/8"
              }`}
            >
              {label}
              <span className={`ml-1 text-[10px] font-black ${filter === key ? "text-[#39f58e]" : "text-[#008f5a]"}`}>
                {getFilterCount(key)}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {error && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-xs font-semibold text-amber-900 ring-1 ring-amber-100/50">
          <p>{error}</p>
          <div className="mt-3 flex gap-2">
            {sessionExpired && (
              <Link href="/login" className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#07120d] px-4 text-xs font-black text-white no-underline">
                Se reconnecter
              </Link>
            )}
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-white px-4 text-xs font-black text-amber-900 ring-1 ring-amber-200"
            >
              Reessayer
            </button>
          </div>
        </div>
      )}

      <main className="mt-5">
        {loading ? (
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[78px] w-full rounded-[22px]" style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
        ) : error ? null : filteredOrders.length === 0 ? (
          <EmptyOrdersGuide creating={demoBusy} onCreateDemo={handleCreateDemoOrder} />
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
                index={i}
              />
            ))}
          </div>
        )}
      </main>

      {selectedOrder && (
        <OrderSheet
          order={selectedOrder}
          drivers={drivers}
          sellerName={seller.name}
          onClose={() => setSelectedOrder(null)}
          onPaid={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
            markPaid(selectedOrder);
          }}
          onPrepared={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
            markStatus(selectedOrder, "PREPARED");
          }}
          onDelivered={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 30, 60]);
            markStatus(selectedOrder, "DELIVERED");
          }}
          onCancel={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
            cancelOrder(selectedOrder);
          }}
          onDriverShared={markDriverAssigned}
          onManualDriverShare={markSharedToDriver}
          onPauseBot={handlePauseBot}
          onResumeBot={handleResumeBot}
          onManualReply={handleManualReply}
        />
      )}
    </div>
  );
}

function MiniOrderMetric({ icon, label, value, active, onClick }) {
  return null;
}

function EmptyOrdersGuide({ creating, onCreateDemo }) {
  const seller = useActiveSeller();
  const [copied, setCopied] = useState(false);
  const shopUrl = seller?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/${seller.slug}` : "";

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: seller.name || "Ma boutique Tikchop",
          text: "Decouvrez mes articles sur ma boutique Tikchop !",
          url: shopUrl,
        });
      } catch (err) {
        console.warn("Share failed:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shopUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.warn("Clipboard failed:", err);
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#fbf9f4] rounded-[24px] border border-[#07120d]/5 shadow-[0_2px_16px_rgba(13,23,18,0.03)] my-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#008f5a]/10 text-[#008f5a] mb-4">
        <ReceiptText size={28} />
      </div>
      <h3 className="font-display text-xl font-bold text-[#07120d]">Aucune vente</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#07120d]/60 max-w-[280px]">
        Partagez votre boutique pour recevoir les premieres ventes.
      </p>
      
      <button
        type="button"
        onClick={handleShare}
        className="mt-6 flex min-h-[50px] w-full max-w-[260px] items-center justify-center gap-2 rounded-xl bg-[#008f5a] text-sm font-extrabold text-white transition active:scale-[0.98] shadow-[0_12px_24px_rgba(0,143,90,0.15)]"
      >
        <Share2 size={16} />
        {copied ? "Lien copie !" : "Partager ma boutique"}
      </button>

      <button
        type="button"
        onClick={onCreateDemo}
        disabled={creating}
        className="mt-4 text-xs font-bold text-[#07120d]/40 hover:text-[#07120d]/80 py-1 transition disabled:opacity-60"
      >
        {creating ? "Creation en cours..." : "Creer une vente test"}
      </button>
    </div>
  );
}

function DemoStep({ label, value }) {
  return null;
}

function NextOrderHero({ order, onOpen }) {
  return null;
}

function OrderCard({ order, onClick, index = 0 }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const demoOrder = isDemoOrder(order);
  const simpleStatus = getSimpleOrderStatus(order);
  const primaryLine = order.customer_phone && order.customer_phone !== "UNKNOWN"
    ? order.customer_phone
    : "Client WhatsApp";
  
  const statusColors = {
    PENDING: "bg-amber-50 text-amber-800 border-amber-100",
    PAID: "bg-emerald-50 text-emerald-800 border-emerald-100",
    PREPARED: "bg-blue-50 text-blue-800 border-blue-100",
    IN_DELIVERY: "bg-indigo-50 text-indigo-800 border-indigo-100",
    DELIVERED: "bg-zinc-50 text-zinc-600 border-zinc-100",
    CANCELLED: "bg-rose-50 text-rose-800 border-rose-100",
  };

  const statusLabel = statusLabels[simpleStatus] || simpleStatus;
  const actionLabel = getCardActionLabel(simpleStatus);
  const itemCount = getOrderItemCount(order);
  const dateStr = new Date(order.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const delay = `${Math.min(index, 5) * 0.06}s`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-rise-in w-full text-left rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgb(7_18_13_/_0.035)] ring-1 ring-[#07120d]/7 active:scale-[0.99] transition"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-black text-[#07120d] truncate">
              {order.order_ref || order.id?.slice(0, 8).toUpperCase()}
            </h3>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase whitespace-nowrap ${statusColors[simpleStatus] || "bg-zinc-50 text-zinc-600"}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#4e6055] truncate">
            {demoOrder ? "Client test" : primaryLine}
          </p>
          <p className="mt-0.5 text-xs font-bold text-[#4e6055]/50">
            {itemCount} article{itemCount > 1 ? "s" : ""} - {dateStr}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-base font-black text-[#07120d] whitespace-nowrap">
            {demoOrder ? "TEST" : formatPrice(total)}
          </p>
          <span className={`mt-1.5 inline-flex min-h-[30px] items-center justify-center rounded-full px-3 text-[0.68rem] font-black ${getCardActionTone(simpleStatus)}`}>
            {actionLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

function getCardActionLabel(status) {
  if (status === "PENDING") return "Confirmer";
  if (status === "PAID") return "Colis";
  if (status === "PREPARED") return "Livreur";
  if (status === "IN_DELIVERY") return "Livree";
  if (status === "DELIVERED") return "Finie";
  if (status === "CANCELLED") return "Annulee";
  return "Voir";
}

function getCardActionTone(status) {
  if (status === "DELIVERED") return "bg-[#07120d]/7 text-[#07120d]/45";
  if (status === "CANCELLED") return "bg-rose-50 text-rose-800";
  return "bg-[#07120d] text-white";
}

function getQuickAction(order, onPaid, onPrepared, onDelivered, onOpenDelivery) {
  if (order.delivery_status === "ASSIGNED" && order.status !== "DELIVERED") {
    return {
      label: "Marquer livree",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[#008f5a] text-white hover:bg-[#007a4d]",
      onClick: onDelivered,
    };
  }

  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      label: "Partager au livreur",
      icon: <Truck size={18} />,
      className: "bg-[#07120d] text-white hover:bg-[#122b20]",
      onClick: onOpenDelivery,
    };
  }

  if (order.status === "PENDING") {
    return {
      label: "Client confirme",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[#008f5a] text-white hover:bg-[#007a4d]",
      onClick: onPaid,
    };
  }

  if (order.status === "PAID") {
    return {
      label: "Colis pret",
      icon: <Package size={18} />,
      className: "bg-[#07120d] text-white hover:bg-[#122b20]",
      onClick: onPrepared,
    };
  }

  return null;
}

function getOrderItemCount(order) {
  const count = (order.order_items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
  return count || (order.order_items || []).length || 1;
}

function isDemoOrder(order) {
  return String(order?.order_ref || "").startsWith("DEMO") || String(order?.customer_phone || "") === "DEMO_CLIENT";
}

function getNextOrder(orders) {
  const priority = { PENDING: 1, PAID: 2, PREPARED: 3, IN_DELIVERY: 4 };
  return [...orders]
    .filter((order) => ["PENDING", "PAID", "PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)))
    .sort((a, b) => {
      const statusDiff = (priority[getSimpleOrderStatus(a)] || 9) - (priority[getSimpleOrderStatus(b)] || 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    })[0] || null;
}

function OrderSheet({
  order,
  drivers,
  sellerName,
  onClose,
  onPaid,
  onPrepared,
  onDelivered,
  onCancel,
  onDriverShared,
  onManualDriverShare,
  onPauseBot,
  onResumeBot,
  onManualReply,
}) {
  const items = order.order_items || [];
  const demoOrder = isDemoOrder(order);
  const displayClientPhone = demoOrder
    ? "Client demo Tikchop"
    : order.customer_phone && order.customer_phone !== "UNKNOWN" ? order.customer_phone : "Client WhatsApp";
  const availableDrivers = drivers.filter((driver) => driver.is_active !== false);
  const isInDelivery = order.delivery_status === "ASSIGNED" && order.status !== "DELIVERED";
  const isPrepared = order.status === "PREPARED" || order.delivery_status === "READY";
  const isReadyForDriver = isPrepared && !isInDelivery;
  const canMarkDelivered = isPrepared || isInDelivery;
  const isPaid = order.status === "PAID";
  const isPending = order.status === "PENDING";
  const isDone = order.status === "DELIVERED";
  const isCancelled = order.status === "CANCELLED";
  const nextAction = getNextAction(order);
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const responseContext = { sellerName, origin };
  const responseTemplates = getOrderResponseTemplates(order, responseContext);
  const bestResponse = getBestOrderResponse(order, responseContext);
  const caseNotes = getOrderCaseNotes(order, { hasDrivers: availableDrivers.length > 0 });
  const receiptUrl = typeof window !== "undefined" ? `/receipt?order=${order.id}` : `/receipt?order=${order.id}`;
  const driverMessage = encodeURIComponent(buildDriverShareMessage(order, { sellerName, origin }));
  const clientHref = demoOrder ? "" : buildWhatsappHref(order.customer_phone, bestResponse?.text);

  function openDriverWhatsapp(driver = null) {
    const phone = cleanPhone(driver?.phone_number);
    const url = phone ? `https://wa.me/${phone}?text=${driverMessage}` : `https://wa.me/?text=${driverMessage}`;
    window.open(url, "_blank", "noopener,noreferrer");

    if (driver) {
      onDriverShared(order, driver);
    } else {
      onManualDriverShare(order);
    }
  }

  return (
    <SimpleOrderSheet
      order={order}
      items={items}
      total={total}
      displayClientPhone={displayClientPhone}
      availableDrivers={availableDrivers}
      clientHref={clientHref}
      receiptUrl={receiptUrl}
      isPending={isPending}
      isPaid={isPaid}
      isPrepared={isPrepared}
      isInDelivery={isInDelivery}
      isDone={isDone}
      isCancelled={isCancelled}
      onClose={onClose}
      onPaid={onPaid}
      onPrepared={onPrepared}
      onDelivered={onDelivered}
      onCancel={onCancel}
      onShareDriver={openDriverWhatsapp}
    />
  );

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-[#07120d]/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="animate-slide-up mx-auto max-h-[92vh] w-full max-w-[460px] overflow-hidden rounded-t-[32px] bg-white border border-[#e8dcc8]/45 shadow-2xl md:rounded-[32px]">
        <div className="relative overflow-hidden bg-[#fbf9f4] border-b border-[#e8dcc8]/40 p-5 text-[#07120d]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-bright)]" />
          <button 
            onClick={onClose} 
            className="absolute right-5 top-5 z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#07120d] border border-[#e8dcc8]/30 shadow-sm hover:bg-[#fbf9f4] transition active:scale-95" 
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0 pr-12">
              <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#685f4f]/80">Commande #{order.order_ref || order.id?.slice(0, 8)}</p>
              <h2 className="mt-2 font-display text-xl font-black leading-7 text-[#07120d]">{nextAction.title}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#685f4f]">{nextAction.subtitle}</p>
            </div>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white border border-[#e8dcc8]/35 p-3 shadow-[0_2px_6px_rgba(58,47,30,0.02)]">
              <p className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80">Total</p>
              <p className="mt-1 font-display text-lg font-black text-[#008f5a]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#e8dcc8]/35 p-3 shadow-[0_2px_6px_rgba(58,47,30,0.02)]">
              <p className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80">Articles</p>
              <p className="mt-1 font-display text-lg font-black text-[#07120d]">{getOrderItemCount(order)}</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-4 overflow-y-auto p-5">
          <OrderNextActionCard order={order} />

          <OrderProgress status={order.status} deliveryStatus={order.delivery_status} />

          {demoOrder && <DemoOrderChecklist />}

          <section>
            <SectionTitle step="1" title="Articles dans le sachet" />
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
            <SectionTitle step="2" title="Client, adresse, livreur" />
            <div className="mt-3 grid gap-2">
              <InfoBlock icon={<Phone size={18} />} label="Client" value={displayClientPhone} />
              <InfoBlock icon={<MapPin size={18} />} label="Adresse" value={`${order.delivery_zone || "Zone non renseignee"} - ${order.delivery_address || "Adresse non renseignee"}`} />
              <InfoBlock icon={<Truck size={18} />} label="Livreur" value={order.delivery_drivers?.name || "Pas encore assigne"} />
            </div>
            {(isPrepared || isDone || isInDelivery) ? (
              <DriverSharePanel
                availableDrivers={availableDrivers}
                order={order}
                onShare={openDriverWhatsapp}
              />
            ) : (
              <div className="mt-3 rounded-2xl bg-[#fff8db] p-3 text-sm font-bold leading-5 text-[#5a4212] ring-1 ring-[#ffcf3d]/40">
                La fiche livreur apparait ici apres <strong>Marquer colis pret</strong>. Elle contient client, adresse, articles, total, frais a encaisser et lien recu.
              </div>
            )}
          </section>

          <div className="rounded-[24px] bg-[#fbf9f4] border border-[#e8dcc8]/45 p-4.5 text-[#07120d] shadow-[0_2px_10px_rgba(58,47,30,0.02)]">
            <div className="flex justify-between text-xs font-black uppercase tracking-wider text-[#685f4f]">
              <span>Produits</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>
            <div className="mt-2.5 flex justify-between text-xs font-black uppercase tracking-wider text-[#685f4f]">
              <span>Livraison</span>
              <span>{formatPrice(order.delivery_fee)}</span>
            </div>
            <div className="mt-3.5 flex justify-between border-t border-dashed border-[#e8dcc8] pt-3.5 text-lg font-black font-display">
              <span>Total</span>
              <span className="text-[#008f5a]">{formatPrice(total)}</span>
            </div>
          </div>

          <OrderCaseNotes notes={caseNotes} />

          <details className="rounded-[22px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)]">
            <summary className="flex min-h-[50px] cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] bg-[var(--surface-soft)] px-3 text-sm font-black text-[var(--text-main)]">
              Messages et bot
              <ChevronRight size={18} className="text-[var(--primary)]" />
            </summary>
            <div className="mt-3 space-y-3">
              <ResponseTemplateRail templates={responseTemplates} phoneNumber={order.customer_phone} />

              <BotControlPanel
                key={order.id}
                order={order}
                bestResponse={bestResponse}
                disabled={demoOrder || cleanPhone(order.customer_phone).length < 6}
                onPauseBot={onPauseBot}
                onResumeBot={onResumeBot}
                onManualReply={onManualReply}
              />
            </div>
          </details>
        </div>

        <div className="space-y-3 border-t border-zinc-100 p-4">
          <p className="quiet-label">Prochaine action</p>
          {isCancelled ? (
            <div className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-red-50 text-sm font-extrabold text-red-700">
              <X size={18} />
              Commande annulee
            </div>
          ) : isPending ? (
            <button onClick={onPaid} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(0,143,90,0.15)] active:scale-[0.99] transition">
              <CheckCircle2 size={20} />
              Client confirme
            </button>
          ) : isPaid ? (
            <button onClick={onPrepared} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#07120d] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(16,24,20,0.15)] active:scale-[0.99] transition">
              <Package size={20} />
              Marquer colis pret
            </button>
          ) : isInDelivery ? (
            <button onClick={onDelivered} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#008f5a] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(0,143,90,0.15)] active:scale-[0.99] transition">
              <CheckCircle2 size={20} />
              Marquer livree
            </button>
          ) : isDone ? (
            <div className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-sm font-extrabold text-zinc-500">
              <CheckCircle2 size={18} />
              Commande livree
            </div>
          ) : (
            <button onClick={() => openDriverWhatsapp()} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#07120d] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(16,24,20,0.15)] active:scale-[0.99] transition">
              <Share2 size={19} />
              Partager au livreur
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a href={clientHref || undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-xs font-black transition ${clientHref ? "bg-[#fbf9f4] text-[#07120d] border border-[#e8dcc8]/60 shadow-sm active:scale-98" : "pointer-events-none bg-zinc-100 text-zinc-400"}`}>
              <Send size={15} />
              Message client
            </a>
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4] text-xs font-black text-[#07120d] border border-[#e8dcc8]/60 shadow-sm transition active:scale-98">
              <ReceiptText size={15} />
              Recu
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onDelivered} disabled={!canMarkDelivered || isDone || isCancelled} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-xs font-black transition ${canMarkDelivered && !isDone && !isCancelled ? "bg-[#fbf9f4] text-[#008f5a] border border-[#e8dcc8]/60 shadow-sm active:scale-98" : "bg-zinc-100 text-zinc-400"}`}>
              <CheckCircle2 size={15} />
              {isReadyForDriver ? "Livree sans livreur" : "Marquer livree"}
            </button>
            <button onClick={onCancel} disabled={isDone || isCancelled} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-xs font-black transition ${!isDone && !isCancelled ? "bg-rose-50 text-rose-700 border border-rose-100 shadow-sm active:scale-98" : "bg-zinc-100 text-zinc-400"}`}>
              <X size={15} />
              Annuler
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function DriverSharePanel({ availableDrivers, order, onShare }) {
  const assignedDriverId = order.delivery_driver_id;

  return (
    <div className="mt-3 rounded-[22px] bg-[#06281a] p-3 text-white shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[#06100a]">
          <Truck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/50">Fiche livreur WhatsApp</p>
          <h4 className="mt-1 font-display text-lg font-bold text-white">Envoyer la fiche</h4>
          <p className="mt-1 text-sm font-semibold leading-5 text-white/66">
            Le livreur recoit client, adresse, articles, total, frais a encaisser et lien recu.
          </p>
        </div>
      </div>

      {availableDrivers.length === 0 ? (
        <Link href="/delivery-settings" className="mt-3 flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-[#06281a] no-underline">
          <Phone size={17} />
          Ajouter un livreur WhatsApp
        </Link>
      ) : (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {availableDrivers.map((driver) => (
            <button
              key={driver.id}
              type="button"
              onClick={() => onShare(driver)}
              className={`min-h-[54px] shrink-0 rounded-2xl px-4 text-left text-sm font-extrabold ring-1 ${
                assignedDriverId === driver.id
                  ? "bg-[var(--primary-bright)] text-[#06100a] ring-[var(--primary-bright)]"
                  : "bg-white/10 text-white ring-white/14"
              }`}
            >
              <span className="block">{driver.name}</span>
              <span className={`block text-xs font-bold ${assignedDriverId === driver.id ? "text-[#28533f]" : "text-white/48"}`}>
                {assignedDriverId === driver.id ? "Deja envoye" : (driver.zone || "Toutes zones")}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onShare()}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-extrabold text-white ring-1 ring-white/14"
      >
        <Share2 size={17} />
        Ouvrir WhatsApp sans choisir
      </button>
    </div>
  );
}

function SimpleOrderSheet({
  order,
  items,
  total,
  displayClientPhone,
  availableDrivers,
  clientHref,
  receiptUrl,
  isPending,
  isPaid,
  isPrepared,
  isInDelivery,
  isDone,
  isCancelled,
  onClose,
  onPaid,
  onPrepared,
  onDelivered,
  onCancel,
  onShareDriver,
}) {
  const action = getNextAction(order);
  const status = getSimpleOrderStatus(order);
  const canShareDriver = isPrepared || isInDelivery || isDone;
  const primary = isCancelled
    ? { label: "Commande annulee", icon: <X size={19} />, disabled: true, onClick: null, tone: "muted" }
    : isPending
      ? { label: "Confirmer", icon: <CheckCircle2 size={19} />, onClick: onPaid, tone: "green" }
      : isPaid
        ? { label: "Colis pret", icon: <Package size={19} />, onClick: onPrepared, tone: "dark" }
        : isPrepared || isInDelivery
          ? { label: "Livree", icon: <CheckCircle2 size={19} />, onClick: onDelivered, tone: "green" }
          : isDone
            ? { label: "Livree", icon: <CheckCircle2 size={19} />, disabled: true, onClick: null, tone: "muted" }
            : { label: "Partager livreur", icon: <Truck size={19} />, onClick: () => onShareDriver(), tone: "dark" };

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-[#07120d]/35 px-3 pb-[calc(0.7rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="animate-slide-up mx-auto max-h-[88vh] w-full max-w-[440px] overflow-hidden rounded-[30px] bg-[#fbf9f4] shadow-[0_28px_70px_rgb(7_18_13_/_0.28)] ring-1 ring-white/70">
        <header className="flex items-start justify-between gap-4 border-b border-[#07120d]/8 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">{statusLabels[status] || status}</p>
            <h2 className="mt-1 truncate font-display text-2xl font-black leading-7 text-[#07120d]">
              {order.order_ref || order.id?.slice(0, 8)?.toUpperCase()}
            </h2>
            <p className="mt-1 text-xs font-bold text-[#4e6055]/60">{action.title}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf9f4] text-[#07120d] ring-1 ring-[#07120d]/8" aria-label="Fermer">
            <X size={17} />
          </button>
        </header>

        <div className="no-scrollbar max-h-[58vh] space-y-3 overflow-y-auto px-4 py-4">
          <div className="rounded-[24px] bg-[#07120d] p-4 text-white">
            <div className="flex items-end justify-between gap-3">
              <span>
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#39f58e]">Total</span>
                <strong className="mt-1 block font-display text-3xl font-black leading-none">{formatPrice(total)}</strong>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/80">
                {getOrderItemCount(order)} article{getOrderItemCount(order) > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <section className="rounded-[22px] bg-white p-3 ring-1 ring-[#07120d]/7">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#008f5a]">
              <Package size={14} />
              Sachet
            </div>
            <div className="mt-3 space-y-2">
              {(items || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fbf9f4] px-3 py-2.5">
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-black text-[#07120d]">{item.products?.name || "Article"}</strong>
                    <small className="text-xs font-bold text-[#4e6055]/55">A mettre dans le sachet</small>
                  </span>
                  <strong className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#07120d] ring-1 ring-[#07120d]/6">x{item.quantity}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <MiniInfo icon={<Phone size={16} />} label="Client" value={displayClientPhone} />
            <MiniInfo icon={<MapPin size={16} />} label="Adresse" value={order.delivery_address || order.delivery_zone || "A confirmer"} />
            <MiniInfo icon={<Truck size={16} />} label="Livreur" value={order.delivery_drivers?.name || (canShareDriver ? "A choisir" : "Apres colis pret")} />
          </section>

          {canShareDriver && availableDrivers.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {availableDrivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => onShareDriver(driver)}
                  className="min-h-[46px] shrink-0 rounded-full bg-white px-4 text-xs font-black text-[#07120d] ring-1 ring-[#07120d]/8"
                >
                  {driver.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="space-y-2 border-t border-[#07120d]/8 bg-white p-4">
          <button
            type="button"
            onClick={primary.onClick || undefined}
            disabled={primary.disabled}
            className={`flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] text-base font-black shadow-sm disabled:opacity-70 ${
              primary.tone === "green"
                ? "bg-[#008f5a] text-white"
                : primary.tone === "dark"
                  ? "bg-[#07120d] text-white"
                  : "bg-[#f1f1ee] text-[#4e6055]"
            }`}
          >
            {primary.icon}
            {primary.label}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <a href={clientHref || undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[46px] items-center justify-center rounded-[18px] text-xs font-black no-underline ring-1 ${clientHref ? "bg-[#fbf9f4] text-[#07120d] ring-[#07120d]/8" : "pointer-events-none bg-[#f1f1ee] text-[#4e6055]/45 ring-transparent"}`}>
              Client
            </a>
            <button type="button" onClick={() => onShareDriver()} disabled={!canShareDriver} className="min-h-[46px] rounded-[18px] bg-[#fbf9f4] text-xs font-black text-[#07120d] ring-1 ring-[#07120d]/8 disabled:opacity-40">
              Livreur
            </button>
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[46px] items-center justify-center rounded-[18px] bg-[#fbf9f4] text-xs font-black text-[#07120d] no-underline ring-1 ring-[#07120d]/8">
              Recu
            </a>
          </div>
          {!isDone && !isCancelled && (
            <button type="button" onClick={onCancel} className="mx-auto block px-4 py-2 text-xs font-black text-rose-600">
              Annuler la commande
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function MiniInfo({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white px-3 py-3 ring-1 ring-[#07120d]/7">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf9f4] text-[#008f5a]">
        {icon}
      </span>
      <span className="min-w-0">
        <small className="block text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#4e6055]/45">{label}</small>
        <strong className="block truncate text-sm font-black text-[#07120d]">{value}</strong>
      </span>
    </div>
  );
}

function isHandoffActive(handoff) {
  return Boolean(handoff?.paused_until && new Date(handoff.paused_until).getTime() > Date.now());
}

function formatPauseUntil(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function BotControlPanel({ order, bestResponse, disabled, onPauseBot, onResumeBot, onManualReply }) {
  const [message, setMessage] = useState(bestResponse?.text || "");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const active = isHandoffActive(order.handoff);
  const pauseUntil = formatPauseUntil(order.handoff?.paused_until);

  async function runAction(kind, action) {
    try {
      setBusy(kind);
      setNotice("");
      await action();
    } catch (err) {
      setNotice(err?.message || "Action impossible. Reessayez.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={`rounded-[24px] p-4 shadow-[var(--shadow-sm)] ring-1 ${
      active
        ? "bg-[#06281a] text-white ring-[#39f58e]/20"
        : "bg-white text-[var(--text-main)] ring-[var(--outline)]/20"
    }`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          active ? "bg-[var(--primary-bright)] text-[#06100a]" : "bg-[var(--surface-soft)] text-[var(--primary)]"
        }`}>
          <Bot size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-extrabold uppercase tracking-[0.14em] ${active ? "text-white/52" : "text-[var(--primary)]"}`}>
            Bot WhatsApp
          </p>
          <h3 className={`mt-1 font-display text-lg font-bold ${active ? "text-white" : "text-[var(--text-main)]"}`}>
            {active ? "Vous repondez vous-meme" : "Le bot peut repondre"}
          </h3>
          <p className={`mt-1 text-sm font-semibold leading-5 ${active ? "text-white/68" : "text-[var(--text-dim)]"}`}>
            {disabled
              ? "Ajoutez un vrai numero client pour gerer la conversation depuis Tikchop."
              : active
                ? `Le bot ne repond plus a ce client${pauseUntil ? ` jusqu'a ${pauseUntil}` : ""}.`
                : "Pausez le bot si vous voulez reprendre cette discussion a la main."}
          </p>
        </div>
      </div>

      {!disabled && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {active ? (
              <button
                type="button"
                onClick={() => runAction("resume", async () => {
                  await onResumeBot(order);
                  setNotice("Bot reactive pour ce client.");
                })}
                disabled={Boolean(busy)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-[#06281a] ring-1 ring-white/20 disabled:opacity-60"
              >
                {busy === "resume" ? <Loader2 className="animate-spin" size={17} /> : <PlayCircle size={17} />}
                Relancer le bot
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runAction("pause", async () => {
                  await onPauseBot(order);
                  setNotice("Vous avez la main pendant 24h. Le bot ne repond plus a ce client.");
                })}
                disabled={Boolean(busy)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--text-main)] text-sm font-extrabold text-white disabled:opacity-60"
              >
                {busy === "pause" ? <Loader2 className="animate-spin" size={17} /> : <PauseCircle size={17} />}
                Reprendre 24h
              </button>
            )}
            <a
              href={buildWhatsappHref(order.customer_phone, message) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--surface-soft)] text-sm font-extrabold text-[var(--primary)] no-underline ring-1 ring-[var(--primary)]/10"
            >
              <MessageCircle size={17} />
              WhatsApp
            </a>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Ecrivez votre reponse au client..."
            className={`mt-3 min-h-[112px] w-full resize-none rounded-[20px] border-0 p-3 text-sm font-semibold leading-5 outline-none ring-1 focus:ring-2 ${
              active
                ? "bg-white/10 text-white placeholder:text-white/35 ring-white/12 focus:ring-[var(--primary-bright)]"
                : "bg-[var(--surface-soft)] text-[var(--text-main)] placeholder:text-[var(--outline)] ring-[var(--outline)]/20 focus:ring-[var(--primary)]/30"
            }`}
          />

          <button
            type="button"
            onClick={() => runAction("reply", async () => {
              await onManualReply(order, message);
              setNotice("Message envoye. Le bot reste en pause 24h.");
            })}
            disabled={Boolean(busy) || !message.trim()}
            className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary-bright)] text-sm font-extrabold text-[#06100a] shadow-[0_12px_28px_rgba(57,245,142,0.20)] disabled:opacity-55"
          >
            {busy === "reply" ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            Envoyer moi-meme
          </button>
        </>
      )}

      {notice && (
        <p className={`mt-3 rounded-2xl px-3 py-2 text-sm font-bold ${
          active ? "bg-white/10 text-white/78" : "bg-[var(--surface-soft)] text-[var(--text-dim)]"
        }`}>
          {notice}
        </p>
      )}
    </section>
  );
}

function DemoOrderChecklist() {
  const checks = [
    "Appuyez sur Marquer colis pret pour simuler l'emballage.",
    "Ouvre la fiche livreur pour voir le message de livraison.",
    "Ouvre Recu pour verifier le recap client.",
    "Marquez livree pour fermer le cycle.",
  ];

  return (
    <section className="rounded-[22px] bg-[#fff8dc] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[#ffb000]/30">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8a5a00]">Exemple</p>
      <p className="mt-1 text-sm font-extrabold text-[var(--text-main)]">Aucun vrai client WhatsApp n&apos;est contacte.</p>
      <div className="mt-3 grid gap-2">
        {checks.map((check, index) => (
          <div key={check} className="flex items-start gap-2 text-sm font-semibold leading-5 text-[var(--text-main)]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-main)] text-[0.7rem] font-black text-[var(--primary-bright)]">
              {index + 1}
            </span>
            <span>{check}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrderCaseNotes({ notes }) {
  return (
    <section>
      <p className="quiet-label">Cas a verifier</p>
      <div className="mt-3 grid gap-2">
        {notes.map((note) => (
          <div key={note.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[var(--outline)]/20">
            <p className="font-display text-sm font-semibold text-[var(--text-main)]">{note.title}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-dim)]">{note.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResponseTemplateRail({ templates, phoneNumber }) {
  if (!templates.length) return null;

  return (
    <section>
      <p className="quiet-label">Reponses pretes</p>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {templates.map((template) => {
          const href = buildWhatsappHref(phoneNumber, template.text);
          return (
            <a
              key={template.id}
              href={href || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`min-w-[11.5rem] rounded-[20px] p-3 text-left no-underline shadow-sm ring-1 ring-[var(--outline)]/20 ${href ? getTemplateToneClass(template.tone) : "pointer-events-none bg-zinc-100 text-zinc-400"}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-current">
                  <MessageCircle size={16} />
                </span>
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-70">{template.shortTitle}</span>
              </div>
              <p className="mt-3 font-display text-sm font-semibold leading-5">{template.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-bold leading-4 opacity-70">{template.scenario}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function getTemplateToneClass(tone) {
  if (tone === "primary") return "bg-[var(--text-main)] text-white";
  if (tone === "success") return "bg-green-50 text-green-800";
  if (tone === "warning") return "bg-amber-50 text-amber-800";
  if (tone === "info") return "bg-blue-50 text-blue-800";
  if (tone === "danger") return "bg-red-50 text-red-700";
  return "bg-[var(--surface-soft)] text-[var(--text-main)]";
}

function OrderActionPath({ verifyCount, prepareCount, readyCount, deliveryCount, doneCount }) {
  const steps = [
    {
      key: "confirm",
      title: "Confirmer",
      count: verifyCount,
      detail: "Client, adresse, paiement",
      icon: <CheckCircle2 size={18} />,
      className: "bg-[var(--text-main)] text-white ring-[var(--text-main)]",
    },
    {
      key: "prepare",
      title: "Preparer",
      count: prepareCount,
      detail: "Articles en sachet",
      icon: <Package size={18} />,
      className: "bg-[var(--primary-bright)] text-[#06100a] ring-[var(--primary-bright)]",
    },
    {
      key: "driver",
      title: "Envoyer",
      count: readyCount,
      detail: "Fiche au livreur",
      icon: <Truck size={18} />,
      className: "bg-white text-[var(--text-main)] ring-[var(--outline)]/28",
    },
    {
      key: "delivery",
      title: "Fermer",
      count: deliveryCount,
      detail: doneCount > 0 ? `${doneCount} livree${doneCount > 1 ? "s" : ""}` : "Apres reception",
      icon: <CheckCircle2 size={18} />,
      className: "bg-white text-[var(--text-main)] ring-[var(--outline)]/28",
    },
  ];

  return (
    <div className="rounded-[24px] bg-white/92 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/24">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="quiet-label text-[var(--primary)]">File d&apos;action</p>
          <p className="mt-1 text-sm font-extrabold text-[var(--text-main)]">Le meme chemin pour chaque vente, sans chercher.</p>
        </div>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
          {verifyCount + prepareCount + readyCount + deliveryCount} ouvertes
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.key} className={`rounded-[18px] p-3 shadow-sm ring-1 ${step.className}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${index < 2 ? "bg-white/14" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
                {step.icon}
              </span>
              <span className="font-display text-2xl font-bold leading-none">{step.count}</span>
            </div>
            <p className={`mt-2 text-sm font-extrabold ${index === 0 ? "text-white" : "text-current"}`}>{index + 1}. {step.title}</p>
            <p className={`mt-0.5 text-[0.7rem] font-bold leading-4 ${index === 0 ? "text-white/58" : "text-[var(--text-dim)]"}`}>{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderNextActionCard({ order }) {
  const simpleStatus = getSimpleOrderStatus(order);
  const content = {
    PENDING: {
      label: "Etape 1",
      title: "Confirmer le client",
      body: "Verifiez client, commune, adresse et paiement choisi avant de preparer.",
      icon: <CheckCircle2 size={18} />,
      className: "bg-amber-50 text-amber-900 ring-amber-100",
    },
    PAID: {
      label: "Etape 2",
      title: "Preparer le colis",
      body: "Mettez les articles dans le sachet, puis marquez colis pret.",
      icon: <Package size={18} />,
      className: "bg-green-50 text-green-900 ring-green-100",
    },
    PREPARED: {
      label: "Etape 3",
      title: "Envoyer au livreur",
      body: "Choisissez un livreur ou partagez la fiche WhatsApp avec client, adresse et frais.",
      icon: <Truck size={18} />,
      className: "bg-blue-50 text-blue-900 ring-blue-100",
    },
    IN_DELIVERY: {
      label: "Etape 4",
      title: "Attendre la reception",
      body: "Le livreur a la fiche. Quand le client confirme, marquez livree.",
      icon: <Truck size={18} />,
      className: "bg-indigo-50 text-indigo-900 ring-indigo-100",
    },
    DELIVERED: {
      label: "Finie",
      title: "Commande livree",
      body: "Le cycle est ferme. Le recu reste disponible.",
      icon: <CheckCircle2 size={18} />,
      className: "bg-zinc-50 text-zinc-700 ring-zinc-100",
    },
    CANCELLED: {
      label: "Annulee",
      title: "Commande annulee",
      body: "Aucune action livraison n'est necessaire.",
      icon: <X size={18} />,
      className: "bg-red-50 text-red-700 ring-red-100",
    },
  }[simpleStatus] || {
    label: "Action",
    title: "Verifier la vente",
    body: "Ouvrez les details avant de passer a l'etape suivante.",
    icon: <Clock3 size={18} />,
    className: "bg-[var(--surface-soft)] text-[var(--text-main)] ring-[var(--outline)]/20",
  };

  return (
    <div className={`rounded-[22px] p-3 shadow-sm ring-1 ${content.className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-current shadow-sm">
          {content.icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-60">{content.label}</p>
          <h3 className="mt-1 font-display text-lg font-bold leading-6">{content.title}</h3>
          <p className="mt-1 text-sm font-bold leading-5 opacity-75">{content.body}</p>
        </div>
      </div>
    </div>
  );
}

function OrderProgress({ status, deliveryStatus }) {
  const simpleStatus = getSimpleOrderStatus({ status, delivery_status: deliveryStatus });
  const steps = [
    { key: "CONFIRM", label: "Client", active: ["PENDING", "PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "PACK", label: "Paquet", active: ["PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "DRIVER", label: "Livreur", active: ["PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "DONE", label: "Finie", active: ["IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => (
        <div key={step.key} className={`min-w-0 rounded-2xl border p-2 text-center ${step.active ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : "border-zinc-100 bg-zinc-50 text-zinc-400"}`}>
          <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold ${step.active ? "bg-[var(--primary)] text-white" : "bg-white text-zinc-400"}`}>
            {step.active ? <CheckCircle2 size={16} /> : index + 1}
          </span>
          <p className="mt-1 truncate text-[0.68rem] font-extrabold">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function getNextAction(order) {
  if (order.delivery_status === "ASSIGNED" && order.status !== "DELIVERED") {
    return {
      title: "En livraison",
      subtitle: "Le livreur a la fiche. Fermez apres reception client.",
      icon: <Truck size={17} />,
      iconTone: "bg-indigo-100 text-indigo-700",
      barClass: "bg-indigo-50 text-indigo-800",
    };
  }

  if (order.status === "PREPARED" || order.delivery_status === "READY") {
    return {
      title: "A envoyer au livreur",
      subtitle: "Partagez la fiche WhatsApp avec client, adresse et frais.",
      icon: <Truck size={17} />,
      iconTone: "bg-blue-100 text-blue-700",
      barClass: "bg-blue-50 text-blue-800",
    };
  }

  if (order.status === "DELIVERED") {
    return {
      title: "Commande finie",
      subtitle: "Cette commande est fermee.",
      icon: <CheckCircle2 size={17} />,
      iconTone: "bg-zinc-100 text-zinc-500",
      barClass: "bg-zinc-50 text-zinc-500",
    };
  }

  return {
    title: order.status === "PAID" ? "Preparer le colis" : "Client a confirmer",
    subtitle: order.status === "PAID"
      ? "Commande confirmee. Mettez les articles dans le sachet."
      : "Verifiez client, adresse et mode de paiement avant d'emballer.",
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

