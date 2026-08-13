"use client";

import { useState } from "react";
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
import { useActiveSeller } from "../components/sellerContext";
import { IllustrationNoOrders } from "../components/TikchopIllustrations";
import {
  buildDriverShareMessage,
  buildWhatsappHref,
  getBestOrderResponse,
  getOrderCaseNotes,
  getOrderResponseTemplates,
} from "../../lib/customer-response-playbook";
import { TkScreen } from "../components/TikchopUI";
import { useOrders } from "../../lib/useOrders";
import {
  formatPrice,
  cleanPhone,
  getSimpleOrderStatus,
  statusLabels,
  orderTabs,
} from "../../lib/order-utils";
import { DriverSharePanel } from "../orders/components/DriverSharePanel";
import { BotControlPanel } from "../orders/components/BotControlPanel";

export default function OrdersPage() {
  const {
    orders,
    drivers,
    loading,
    selectedOrder,
    filter,
    demoBusy,
    error,
    sessionExpired,
    filteredOrders,
    getFilterCount,
    setFilter,
    setSelectedOrder,
    fetchOrders,
    markPaid,
    markStatus,
    cancelOrder,
    markDriverAssigned,
    markSharedToDriver,
    handlePauseBot,
    handleResumeBot,
    handleManualReply,
    handleCreateDemoOrder,
  } = useOrders();


  return (
    <TkScreen className="md:max-w-[1180px] md:px-8">
      <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-2">
          {orderTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-label={label}
              title={label}
              className={`flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-black transition ${
                filter === key ? "bg-[#2b2219] text-white" : "bg-white text-[#6e6353] ring-1 ring-[#2b2219]/8"
              }`}
            >
              <Icon size={16} />
              <span className={filter === key ? "" : "sr-only"}>{label}</span>
              <span className={`text-[10px] font-black ${filter === key ? "text-[#f0954c]" : "text-[#c2572b]"}`}>
                {getFilterCount(key)}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={fetchOrders}
            aria-label="Actualiser"
            title="Actualiser"
            className="flex min-h-[44px] w-12 items-center justify-center rounded-full bg-white text-[#2b2219] ring-1 ring-[#2b2219]/8"
          >
            <RefreshCw size={17} strokeWidth={2.35} className={loading ? "animate-spin text-[#c2572b]" : ""} />
          </button>
        </div>
      </nav>

      {error && (
        <div className="mt-4 rounded-[22px] bg-[#fdf3d6] p-3 text-xs font-black text-[#7a5425] ring-1 ring-[#f4ce60]/45">
          <p>{error}</p>
          <div className="mt-3 flex gap-2">
            {sessionExpired && (
              <Link href="/login" className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[#2b2219] px-4 text-xs font-black text-white no-underline">
                Connexion
              </Link>
            )}
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-white px-4 text-xs font-black text-[#7a5425] ring-1 ring-[#f4ce60]/60"
            >
              Actualiser
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
    </TkScreen>
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
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#2b2219] rounded-[28px] my-6 relative overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(240, 149, 76,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(240, 149, 76,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex flex-col items-center w-full">
        <IllustrationNoOrders size={120} className="opacity-90" />
        <h3 className="mt-3 font-display text-xl font-bold text-white">Aucune vente</h3>
        <p className="mt-2 text-sm font-medium leading-relaxed text-white/55 max-w-[280px]">
          Partagez votre boutique pour recevoir vos premi?res commandes.
        </p>
        
        <button
          type="button"
          onClick={handleShare}
          className="mt-6 flex min-h-[50px] w-full max-w-[260px] items-center justify-center gap-2 rounded-2xl bg-[#f0954c] text-sm font-extrabold text-[#2b2219] transition active:scale-[0.98] shadow-[0_12px_28px_rgba(240, 149, 76,0.25)]"
        >
          <Share2 size={16} />
          {copied ? "Lien copi? !" : "Partager la boutique"}
        </button>

        <button
          type="button"
          onClick={onCreateDemo}
          disabled={creating}
          className="mt-4 text-xs font-bold text-white/40 hover:text-white/80 py-1 transition disabled:opacity-60"
        >
          {creating ? "Cr?ation en cours..." : "Cr?er une commande test"}
        </button>
      </div>
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

  // Step active checks for mini progress bar
  const stepConfirmActive = ["PENDING", "PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus);
  const stepPackActive = ["PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus);
  const stepDriverActive = ["PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus);
  const stepDoneActive = ["IN_DELIVERY", "DELIVERED"].includes(simpleStatus);

  return (
    <div
      onClick={onClick}
      className="animate-rise-in cursor-pointer w-full text-left rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgb(43_34_25_/_0.035)] ring-1 ring-[#2b2219]/7 active:scale-[0.99] transition hover:shadow-md"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-black text-[#2b2219] truncate">
              {order.order_ref || order.id?.slice(0, 8).toUpperCase()}
            </h3>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase whitespace-nowrap ${statusColors[simpleStatus] || "bg-zinc-50 text-zinc-600"}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#6e6353] truncate">
            {demoOrder ? "Client test" : primaryLine}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#6e6353]/50">
            <Package size={12} /> {itemCount} article{itemCount > 1 ? "s" : ""} ? {dateStr}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-base font-black text-[#2b2219] whitespace-nowrap">
            {demoOrder ? "TEST" : formatPrice(total)}
          </p>
          <span className={`mt-1.5 inline-flex min-h-[30px] items-center justify-center rounded-full px-3 text-[0.68rem] font-black ${getCardActionTone(simpleStatus)}`}>
            {actionLabel}
          </span>
        </div>
      </div>

      {/* Visual Stepper Bar on List Card */}
      <div className="mt-3 flex items-center justify-between border-t border-[#2b2219]/5 pt-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 rounded-full transition-all ${stepConfirmActive ? "w-5 bg-[#c2572b]" : "w-2 bg-[#2b2219]/10"}`} title="Re?ue" />
          <span className={`h-2 rounded-full transition-all ${stepPackActive ? "w-5 bg-[#c2572b]" : "w-2 bg-[#2b2219]/10"}`} title="Colis pr?t" />
          <span className={`h-2 rounded-full transition-all ${stepDriverActive ? "w-5 bg-[#c2572b]" : "w-2 bg-[#2b2219]/10"}`} title="Livreur" />
          <span className={`h-2 rounded-full transition-all ${stepDoneActive ? "w-5 bg-[#c2572b]" : "w-2 bg-[#2b2219]/10"}`} title="Livr?" />
          <span className="ml-1 text-[0.6rem] font-black text-[#c2572b] uppercase tracking-wider">
            {simpleStatus === "DELIVERED" ? "Livr?e" : simpleStatus === "IN_DELIVERY" ? "En route" : simpleStatus === "PREPARED" ? "Pr?te" : simpleStatus === "PAID" ? "En pr?pa" : "Re?ue"}
          </span>
        </div>
        {order.delivery_zone && (
          <span className="text-[0.64rem] font-extrabold text-[#6e6353]/60 flex items-center gap-1">
            <MapPin size={11} className="text-[#c2572b]" /> {order.delivery_zone}
          </span>
        )}
      </div>
    </div>
  );
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
    <div className="fixed inset-0 z-[260] flex items-end bg-[#2b2219]/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="animate-slide-up mx-auto max-h-[92vh] w-full max-w-[460px] overflow-hidden rounded-t-[32px] bg-white border border-[#e7dac2]/45 shadow-2xl md:rounded-[32px]">
        <div className="relative overflow-hidden bg-[#fbf6ee] border-b border-[#e7dac2]/40 p-5 text-[#2b2219]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-bright)]" />
          <button 
            onClick={onClose} 
            className="absolute right-5 top-5 z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2b2219] border border-[#e7dac2]/30 shadow-sm hover:bg-[#fbf6ee] transition active:scale-95" 
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0 pr-12">
              <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#6e6354]/80">Commande #{order.order_ref || order.id?.slice(0, 8)}</p>
              <h2 className="mt-2 font-display text-xl font-black leading-7 text-[#2b2219]">{nextAction.title}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6e6354]">{nextAction.subtitle}</p>
            </div>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white border border-[#e7dac2]/35 p-3 shadow-[0_2px_6px_rgba(58,47,30,0.02)]">
              <p className="text-[0.62rem] font-black uppercase tracking-wider text-[#6e6354]/80">Total</p>
              <p className="mt-1 font-display text-lg font-black text-[#c2572b]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#e7dac2]/35 p-3 shadow-[0_2px_6px_rgba(58,47,30,0.02)]">
              <p className="text-[0.62rem] font-black uppercase tracking-wider text-[#6e6354]/80">Articles</p>
              <p className="mt-1 font-display text-lg font-black text-[#2b2219]">{getOrderItemCount(order)}</p>
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
              <div className="mt-3 rounded-2xl bg-[#fcf2d3] p-3 text-sm font-bold leading-5 text-[#6d5126] ring-1 ring-[#f4c13a]/40">
                La fiche livreur apparait ici apres <strong>Marquer colis pret</strong>. Elle contient client, adresse, articles, total, frais a encaisser et lien recu.
              </div>
            )}
          </section>

          <div className="rounded-[24px] bg-[#fbf6ee] border border-[#e7dac2]/45 p-4.5 text-[#2b2219] shadow-[0_2px_10px_rgba(58,47,30,0.02)]">
            <div className="flex justify-between text-xs font-black uppercase tracking-wider text-[#6e6354]">
              <span>Produits</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>
            <div className="mt-2.5 flex justify-between text-xs font-black uppercase tracking-wider text-[#6e6354]">
              <span>Livraison</span>
              <span>{formatPrice(order.delivery_fee)}</span>
            </div>
            <div className="mt-3.5 flex justify-between border-t border-dashed border-[#e7dac2] pt-3.5 text-lg font-black font-display">
              <span>Total</span>
              <span className="text-[#c2572b]">{formatPrice(total)}</span>
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
            <button onClick={onPaid} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#c2572b] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(0,143,90,0.15)] active:scale-[0.99] transition">
              <CheckCircle2 size={20} />
              Client confirme
            </button>
          ) : isPaid ? (
            <button onClick={onPrepared} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#2b2219] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(16,24,20,0.15)] active:scale-[0.99] transition">
              <Package size={20} />
              Marquer colis pret
            </button>
          ) : isInDelivery ? (
            <button onClick={onDelivered} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#c2572b] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(0,143,90,0.15)] active:scale-[0.99] transition">
              <CheckCircle2 size={20} />
              Marquer livree
            </button>
          ) : isDone ? (
            <div className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-sm font-extrabold text-zinc-500">
              <CheckCircle2 size={18} />
              Commande livree
            </div>
          ) : (
            <button onClick={() => openDriverWhatsapp()} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#2b2219] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(16,24,20,0.15)] active:scale-[0.99] transition">
              <Share2 size={19} />
              Partager au livreur
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a href={clientHref || undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-xs font-black transition ${clientHref ? "bg-[#fbf6ee] text-[#2b2219] border border-[#e7dac2]/60 shadow-sm active:scale-98" : "pointer-events-none bg-zinc-100 text-zinc-400"}`}>
              <Send size={15} />
              Message client
            </a>
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#fbf6ee] text-xs font-black text-[#2b2219] border border-[#e7dac2]/60 shadow-sm transition active:scale-98">
              <ReceiptText size={15} />
              Recu
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onDelivered} disabled={!canMarkDelivered || isDone || isCancelled} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-xs font-black transition ${canMarkDelivered && !isDone && !isCancelled ? "bg-[#fbf6ee] text-[#c2572b] border border-[#e7dac2]/60 shadow-sm active:scale-98" : "bg-zinc-100 text-zinc-400"}`}>
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
    <div className="fixed inset-0 z-[260] flex items-end bg-[#2b2219]/35 px-3 pb-[calc(0.7rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="animate-slide-up mx-auto max-h-[88vh] w-full max-w-[440px] overflow-hidden rounded-[30px] bg-[#fbf6ee] shadow-[0_28px_70px_rgb(43_34_25_/_0.28)] ring-1 ring-white/70">
        <header className="flex items-start justify-between gap-4 border-b border-[#2b2219]/8 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">{statusLabels[status] || status}</p>
            <h2 className="mt-1 truncate font-display text-2xl font-black leading-7 text-[#2b2219]">
              {order.order_ref || order.id?.slice(0, 8)?.toUpperCase()}
            </h2>
            <p className="mt-1 text-xs font-bold text-[#6e6353]/60">{action.title}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf6ee] text-[#2b2219] ring-1 ring-[#2b2219]/8" aria-label="Fermer">
            <X size={17} />
          </button>
        </header>

        <div className="no-scrollbar max-h-[58vh] space-y-3 overflow-y-auto px-4 py-4">
          <div className="rounded-[24px] bg-[#2b2219] p-4 text-white">
            <div className="flex items-end justify-between gap-3">
              <span>
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#f0954c]">Total</span>
                <strong className="mt-1 block font-display text-3xl font-black leading-none">{formatPrice(total)}</strong>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/80">
                {getOrderItemCount(order)} article{getOrderItemCount(order) > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <section className="rounded-[22px] bg-white p-3 ring-1 ring-[#2b2219]/7">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#c2572b]">
              <Package size={14} />
              Sachet
            </div>
            <div className="mt-3 space-y-2">
              {(items || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fbf6ee] px-3 py-2.5">
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-black text-[#2b2219]">{item.products?.name || "Article"}</strong>
                    <small className="text-xs font-bold text-[#6e6353]/55">A mettre dans le sachet</small>
                  </span>
                  <strong className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#2b2219] ring-1 ring-[#2b2219]/6">x{item.quantity}</strong>
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
                  className="min-h-[46px] shrink-0 rounded-full bg-white px-4 text-xs font-black text-[#2b2219] ring-1 ring-[#2b2219]/8"
                >
                  {driver.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="space-y-2 border-t border-[#2b2219]/8 bg-white p-4">
          <button
            type="button"
            onClick={primary.onClick || undefined}
            disabled={primary.disabled}
            className={`flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] text-base font-black shadow-sm disabled:opacity-70 ${
              primary.tone === "green"
                ? "bg-[#c2572b] text-white"
                : primary.tone === "dark"
                  ? "bg-[#2b2219] text-white"
                  : "bg-[#f0ece2] text-[#6e6353]"
            }`}
          >
            {primary.icon}
            {primary.label}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <a href={clientHref || undefined} target="_blank" rel="noopener noreferrer" className={`flex min-h-[46px] items-center justify-center rounded-[18px] text-xs font-black no-underline ring-1 ${clientHref ? "bg-[#fbf6ee] text-[#2b2219] ring-[#2b2219]/8" : "pointer-events-none bg-[#f0ece2] text-[#6e6353]/45 ring-transparent"}`}>
              Client
            </a>
            <button type="button" onClick={() => onShareDriver()} disabled={!canShareDriver} className="min-h-[46px] rounded-[18px] bg-[#fbf6ee] text-xs font-black text-[#2b2219] ring-1 ring-[#2b2219]/8 disabled:opacity-40">
              Livreur
            </button>
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[46px] items-center justify-center rounded-[18px] bg-[#fbf6ee] text-xs font-black text-[#2b2219] no-underline ring-1 ring-[#2b2219]/8">
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
    <div className="flex items-center gap-3 rounded-[20px] bg-white px-3 py-3 ring-1 ring-[#2b2219]/7">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf6ee] text-[#c2572b]">
        {icon}
      </span>
      <span className="min-w-0">
        <small className="block text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#6e6353]/45">{label}</small>
        <strong className="block truncate text-sm font-black text-[#2b2219]">{value}</strong>
      </span>
    </div>
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
    <section className="rounded-[22px] bg-[#fdf2d5] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[#ef9f28]/30">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#a06a24]">Exemple</p>
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
      className: "bg-[var(--primary-bright)] text-[#221b14] ring-[var(--primary-bright)]",
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
    { key: "CONFIRM", label: "Nouveau", active: ["PENDING", "PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "PACK", label: "Colis pr?t", active: ["PAID", "PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "DRIVER", label: "Livreur", active: ["PREPARED", "IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
    { key: "DONE", label: "Livr?", active: ["IN_DELIVERY", "DELIVERED"].includes(simpleStatus) },
  ];

  return (
    <div className="rounded-[22px] bg-[#2b2219] p-3.5 text-white shadow-md">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex flex-col items-center text-center">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl font-black text-xs transition-all ${
                step.active
                  ? "bg-[#f0954c] text-[#2b2219] shadow-[0_0_12px_rgba(240, 149, 76,0.45)]"
                  : "bg-white/10 text-white/35"
              }`}
            >
              {step.active ? <CheckCircle2 size={16} strokeWidth={2.5} /> : index + 1}
            </span>
            <span
              className={`mt-1.5 text-[0.62rem] font-black uppercase tracking-tight ${
                step.active ? "text-[#f0954c]" : "text-white/35"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
