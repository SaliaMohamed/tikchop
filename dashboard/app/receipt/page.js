import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Home,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { getReadableOrderRef, getReceiptOrder, getReceiptTotals } from "../../lib/receipt";
import { getPaymentOption } from "../../lib/local-commerce";
import ReceiptActions from "./ReceiptActions";

export const dynamic = "force-dynamic";

function formatPrice(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

const EXTRA_IMAGES_PATTERN = /\n?\[\[TIKCHOP_EXTRA_IMAGES:([^\]]*)\]\]/i;

function getCleanProductDescription(description) {
  return String(description || "").replace(EXTRA_IMAGES_PATTERN, "").trim();
}

function formatDate(value) {
  if (!value) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isPaid(order, payment) {
  return ["PAID", "PREPARED", "DELIVERED"].includes(order?.status) || payment?.status === "success";
}

function getReceiptQuery(order, params) {
  if (params.reference) {
    return `reference=${encodeURIComponent(params.reference)}`;
  }

  if (params.order) {
    return `order=${encodeURIComponent(params.order)}`;
  }

  return `order=${encodeURIComponent(order.id)}`;
}

function getOrderProgress(order, paid) {
  const deliveryStatus = order?.delivery_status;
  const status = order?.status;

  if (status === "DELIVERED" || deliveryStatus === "DELIVERED") {
    return {
      title: order?.delivery_type === "PICKUP" ? "Commande retirée" : "Commande livrée",
      text: "Merci pour votre achat. Conservez ce reçu numérique comme justificatif.",
      accent: "green",
    };
  }

  if (deliveryStatus === "ASSIGNED") {
    return {
      title: "Colis confié au livreur",
      text: "Le livreur est en route. Il vous contactera à son arrivée.",
      accent: "blue",
    };
  }

  if (status === "PREPARED" || deliveryStatus === "READY") {
    return {
      title: order?.delivery_type === "PICKUP" ? "Prêt pour retrait" : "Colis emballé & prêt",
      text: order?.delivery_type === "PICKUP"
        ? "Votre commande vous attend en boutique. Présentez ce reçu au vendeur."
        : "La commande est préparée. Le départ en livraison est imminent.",
      accent: "amber",
    };
  }

  if (paid) {
    return {
      title: "Paiement validé",
      text: "Votre règlement est confirmé. La boutique prépare actuellement vos articles.",
      accent: "green",
    };
  }

  return {
    title: "Commande enregistrée",
    text: "La boutique a bien reçu votre commande. Le paiement ou la livraison seront confirmés sous peu.",
    accent: "amber",
  };
}

function getStepState(index, currentStep) {
  if (index < currentStep) return "done";
  if (index === currentStep) return "active";
  return "pending";
}

function getCurrentStep(order, paid) {
  if (order?.status === "DELIVERED" || order?.delivery_status === "DELIVERED") return 3;
  if (order?.delivery_status === "ASSIGNED") return 2;
  if (order?.status === "PREPARED" || order?.delivery_status === "READY") return 2;
  if (paid) return 1;
  return 0;
}

function getStatusLabel(order, paid) {
  if (order?.status === "DELIVERED" || order?.delivery_status === "DELIVERED") {
    return order?.delivery_type === "PICKUP" ? "Retirée" : "Livrée";
  }
  if (order?.delivery_status === "ASSIGNED") return "En cours de livraison";
  if (order?.status === "PREPARED" || order?.delivery_status === "READY") {
    return order?.delivery_type === "PICKUP" ? "Prêt au magasin" : "Colis prêt";
  }
  if (paid) return "Paiement validé";
  if (order?.status === "CANCELLED") return "Annulée";
  return "En attente";
}

function getDeliveryModeLabel(order) {
  if (order?.delivery_type === "PICKUP") return "Retrait en boutique";
  return "Livraison locale";
}

function getItemQuantityTotal(items) {
  return (items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

export default async function ReceiptPage({ searchParams }) {
  const params = await searchParams;
  const { order, payment, error } = await getReceiptOrder({
    order: params.order,
    reference: params.reference,
  });

  if (!order) {
    return (
      <main className="min-h-screen bg-[#F0F5F2] px-4 py-12">
        <section className="mx-auto max-w-[440px] rounded-[28px] bg-white p-7 text-center shadow-[0_16px_40px_rgba(15,43,32,0.06)] ring-1 ring-[#0F2B20]/8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
            <ReceiptText size={32} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-black text-[#0F2B20]">Reçu indisponible</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#0F2B20]/60">
            {error || "Impossible de retrouver cette commande. Vérifiez le lien ou contactez la boutique."}
          </p>
          <Link
            href="/"
            className="mt-6 flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] px-5 text-sm font-black text-white no-underline shadow-sm transition active:scale-[0.98]"
          >
            <ShoppingBag size={18} />
            <span>Retour à l&apos;accueil</span>
          </Link>
        </section>
      </main>
    );
  }

  const receiptRef = getReadableOrderRef(order);
  const totals = getReceiptTotals(order);
  const paid = isPaid(order, payment);
  const progress = getOrderProgress(order, paid);
  const currentStep = getCurrentStep(order, paid);
  const sellerName = order.sellers?.name || "Boutique Tikchop";
  const sellerSlug = order.sellers?.slug || "";
  const sellerPhone = order.sellers?.phone_number || "";
  const sellerAddress = order.sellers?.physical_address || "";
  const items = order.order_items || [];
  const deliveryLabel = order.delivery_type === "PICKUP"
    ? "Retrait en boutique"
    : (order.delivery_zone || "Zone à confirmer");
  const downloadUrl = `/api/receipt/pdf?${getReceiptQuery(order, params)}`;
  const paymentOption = order.payment_method ? getPaymentOption(order.payment_method) : null;
  const paymentLabel = paymentOption?.label || "Paiement à la livraison";
  const statusLabel = getStatusLabel(order, paid);
  const quantityTotal = getItemQuantityTotal(items);

  const brandColor = order.sellers?.brand_color || "#059669";
  const brandStyles = {
    "--primary": brandColor,
    "--accent": brandColor,
  };

  // URL de vérification directe pour QR Code
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    `https://tikchop.app/receipt?order=${order.id}`
  )}&size=180x180&color=0F2B20&bgcolor=FFFFFF&margin=6&format=png`;

  // WhatsApp boutique direct message
  const whatsappSellerUrl = sellerPhone
    ? `https://wa.me/${sellerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Bonjour ${sellerName}, je vous contacte concernant ma commande #${receiptRef}.`
      )}`
    : null;

  return (
    <main className="min-h-screen bg-[#EEF4F0] px-3 py-6 md:py-12" style={brandStyles}>
      {/* Container Ticket de Caisse Digital */}
      <div className="mx-auto max-w-[480px]">
        {/* Barre d'action supérieure */}
        <div className="mb-4">
          <ReceiptActions
            title={`Reçu de commande #${receiptRef}`}
            downloadUrl={downloadUrl}
            orderRef={receiptRef}
            sellerName={sellerName}
            totalFormatted={formatPrice(totals.total)}
          />
        </div>

        {/* Ticket physique avec encoches et design soigné */}
        <section className="print-receipt relative overflow-hidden rounded-[32px] bg-white shadow-[0_24px_60px_rgba(15,43,32,0.12)] ring-1 ring-[#0F2B20]/10">
          {/* Header Banner Vendeur */}
          <div className="relative overflow-hidden bg-[#0F2B20] p-6 text-white">
            {/* Ligne lumineuse marque */}
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: brandColor }}
            />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-[#34D399]">
                    Reçu officiel
                  </span>
                  <span className="text-[0.65rem] font-bold text-white/50">Tikchop</span>
                </div>
                <h1 className="mt-2 font-display text-2xl font-black leading-tight text-white md:text-3xl">
                  Commande #{receiptRef}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/80">
                  <Store size={13} className="text-[#34D399]" />
                  <span>{sellerName}</span>
                </p>
                {sellerAddress && (
                  <p className="mt-0.5 text-[0.72rem] font-medium text-white/60">
                    <MapPin size={11} className="inline mr-1 -mt-0.5 text-[#34D399]" />
                    {sellerAddress}
                  </p>
                )}
              </div>

              {/* Logo ou icône reçu */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                {order.sellers?.logo_url ? (
                  <Image
                    src={order.sellers.logo_url}
                    alt={sellerName}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <ReceiptText size={28} className="text-[#34D399]" />
                )}
              </div>
            </div>

            {/* Badge de Statut Paiement */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shadow-sm ${
                  paid
                    ? "bg-[#10B981] text-white"
                    : "bg-[#F59E0B] text-zinc-950"
                }`}
              >
                {paid ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                <span>{statusLabel}</span>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                {paymentLabel}
              </span>
            </div>

            {/* Carte Progression Commande */}
            <div className="mt-4 rounded-2xl bg-white/8 p-4 ring-1 ring-white/12">
              <p className="font-display text-base font-black text-white">{progress.title}</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/70">
                {progress.text}
              </p>
            </div>
          </div>

          {/* Ligne d'encoche ticket (Notch effect) */}
          <div className="relative flex items-center justify-between bg-white px-2 py-3">
            <div className="h-5 w-5 -ml-4 rounded-full bg-[#EEF4F0] ring-1 ring-[#0F2B20]/10" />
            <div className="flex-1 border-t-2 border-dashed border-[#0F2B20]/10 mx-2" />
            <div className="h-5 w-5 -mr-4 rounded-full bg-[#EEF4F0] ring-1 ring-[#0F2B20]/10" />
          </div>

          {/* Corps du reçu */}
          <div className="space-y-5 px-5 pb-6 pt-1">
            {/* Timeline des étapes */}
            <div className="rounded-2xl bg-[#F6FBF7] p-4 ring-1 ring-[#0F2B20]/8">
              <p className="text-[0.68rem] font-black uppercase tracking-wider text-[#059669]">
                Suivi de commande
              </p>
              <div className="relative mt-4 flex justify-between items-center max-w-[360px] mx-auto">
                <div className="absolute left-4 right-4 top-4 h-0.5 bg-[#0F2B20]/10 -translate-y-1/2 z-0">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(currentStep / 3) * 100}%`,
                      backgroundColor: brandColor,
                    }}
                  />
                </div>

                {["Reçue", "Payée", "Prête", order.delivery_type === "PICKUP" ? "Retirée" : "Livrée"].map((label, index) => {
                  const state = getStepState(index, currentStep);
                  const isDone = state === "done";
                  const isActive = state === "active";

                  return (
                    <div key={label} className="relative z-10 flex flex-col items-center flex-1">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                          isDone
                            ? "text-white shadow-sm"
                            : isActive
                              ? "bg-[#0F2B20] text-white shadow-[0_0_0_4px_rgba(15,43,32,0.1)] scale-110"
                              : "bg-white text-[#0F2B20]/40 ring-1 ring-[#0F2B20]/10"
                        }`}
                        style={isDone ? { backgroundColor: brandColor } : {}}
                      >
                        {isDone ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <span className="text-[11px] font-black">{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-black tracking-tight ${
                          isActive ? "text-[#0F2B20]" : "text-[#0F2B20]/40"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grille informations clés */}
            <div className="grid grid-cols-2 gap-2.5">
              <InfoBox
                icon={CalendarDays}
                label="Date de commande"
                value={formatDate(order.created_at)}
              />
              <InfoBox
                icon={Phone}
                label="Téléphone client"
                value={
                  order.customer_phone && order.customer_phone !== "UNKNOWN"
                    ? order.customer_phone
                    : "Non renseigné"
                }
              />
              <InfoBox
                icon={Truck}
                label={getDeliveryModeLabel(order)}
                value={deliveryLabel}
              />
              <InfoBox
                icon={CreditCard}
                label="Mode de règlement"
                value={paymentLabel}
              />
            </div>

            {/* Détails livraison / retrait */}
            <div className="rounded-2xl bg-[#F6FBF7] p-4 ring-1 ring-[#0F2B20]/8">
              <div className="flex items-center gap-2 text-[#059669]">
                <MapPin size={16} />
                <span className="text-xs font-black uppercase tracking-wider">
                  {order.delivery_type === "PICKUP" ? "Point de retrait" : "Lieu de livraison"}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold leading-relaxed text-[#0F2B20]">
                {order.delivery_type === "PICKUP"
                  ? sellerAddress
                    ? `Retrait à la boutique : ${sellerAddress}`
                    : "Retrait direct en boutique. Confirmez l'heure avec le commerçant."
                  : `${order.delivery_zone || "Zone à confirmer"}${
                      order.delivery_address ? ` · ${order.delivery_address}` : ""
                    }`}
              </p>
              {order.customer_note && (
                <p className="mt-2 rounded-xl bg-white p-2.5 text-xs font-semibold text-[#0F2B20]/70 ring-1 ring-[#0F2B20]/5">
                  <span className="font-bold text-[#0F2B20]">Note client :</span> {order.customer_note}
                </p>
              )}
            </div>

            {/* Liste des articles commandés */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h2 className="font-display text-base font-black text-[#0F2B20]">
                  Articles commandés
                </h2>
                <span className="rounded-full bg-[#F6FBF7] px-2.5 py-0.5 text-xs font-bold text-[#059669] ring-1 ring-[#0F2B20]/5">
                  {quantityTotal || items.length} article{(quantityTotal || items.length) > 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-[#0F2B20]/6 rounded-2xl bg-[#F6FBF7] ring-1 ring-[#0F2B20]/8">
                {items.length > 0 ? (
                  items.map((item) => {
                    const lineTotal = Number(item.price_at_time || 0) * Number(item.quantity || 0);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-[#0F2B20]/8">
                          {item.products?.image_url ? (
                            <Image
                              src={item.products.image_url}
                              alt={item.products.name || "Article"}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <Package size={20} className="text-[#059669]/60" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#0F2B20]">
                            {item.products?.name || "Article"}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-[#0F2B20]/50">
                            {item.quantity} × {formatPrice(item.price_at_time)}
                          </p>
                        </div>

                        <p className="shrink-0 font-display text-sm font-black text-[#0F2B20]">
                          {formatPrice(lineTotal)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-xs font-semibold text-[#0F2B20]/50">
                    Détail des articles non disponible.
                  </div>
                )}
              </div>
            </div>

            {/* Récapitulatif financier */}
            <div className="rounded-3xl bg-[#0F2B20] p-5 text-white shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-base font-black text-white">Récapitulatif</p>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.68rem] font-bold text-white/80">
                  {paymentLabel}
                </span>
              </div>

              <div className="space-y-2 text-xs font-medium text-white/70">
                <div className="flex justify-between">
                  <span>Sous-total articles</span>
                  <span className="font-bold text-white">{formatPrice(totals.productsTotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Frais de livraison</span>
                  <span className="font-bold text-white">
                    {order.delivery_type === "PICKUP" || totals.deliveryFee === 0
                      ? "Gratuit"
                      : formatPrice(totals.deliveryFee)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between border-t border-white/15 pt-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white/60">
                    Total TTC
                  </span>
                  <p className="text-[0.65rem] font-medium text-white/40">F CFA</p>
                </div>
                <span className="font-display text-2xl font-black text-[#34D399]">
                  {formatPrice(totals.total)}
                </span>
              </div>
            </div>

            {/* QR Code de vérification instantanée */}
            <div className="rounded-2xl border border-[#0F2B20]/10 bg-white p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#0F2B20]">
                <QrCode size={16} className="text-[#059669]" />
                <span>Vérification & Retrait rapide</span>
              </div>
              <p className="mt-1 text-[0.72rem] font-medium text-[#0F2B20]/50">
                Présentez ce QR Code au livreur ou en boutique pour vérification immédiate.
              </p>
              <div className="mt-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR Code Reçu #${receiptRef}`}
                  width={140}
                  height={140}
                  className="rounded-xl ring-1 ring-[#0F2B20]/10"
                />
              </div>
            </div>

            {/* Raccourci contact WhatsApp vendeur */}
            {whatsappSellerUrl && (
              <a
                href={whatsappSellerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#EAF8F0] px-4 text-xs font-black text-[#047857] ring-1 ring-[#059669]/20 transition active:scale-[0.98] hover:bg-[#D5F2E0] no-underline"
              >
                <MessageCircle size={16} />
                <span>Contacter {sellerName} sur WhatsApp</span>
              </a>
            )}

            {/* Badge de sécurité & garantie Tikchop */}
            <div className="flex items-center justify-center gap-2 text-center text-[0.7rem] font-semibold text-[#0F2B20]/50">
              <ShieldCheck size={15} className="text-[#059669]" />
              <span>Garantie & reçu officiel propulsé par Tikchop</span>
            </div>

            {/* Bouton retour boutique */}
            {sellerSlug && (
              <Link
                href={`/${sellerSlug}`}
                className="no-print flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#F6FBF7] px-4 text-xs font-black text-[#0F2B20] ring-1 ring-[#0F2B20]/10 transition active:scale-[0.98] hover:bg-[#EAF8F0] no-underline"
              >
                <Home size={16} />
                <span>Retour à la boutique</span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoBox({ label, value, icon: Icon = Store }) {
  return (
    <div className="rounded-2xl bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/8">
      <div className="flex items-center gap-1.5 text-[#059669]">
        <Icon size={14} />
        <span className="text-[0.65rem] font-black uppercase tracking-wider text-[#0F2B20]/60">
          {label}
        </span>
      </div>
      <p className="mt-1 truncate text-xs font-black text-[#0F2B20]">
        {value || "A confirmer"}
      </p>
    </div>
  );
}
