import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
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
      title: "Commande livree",
      text: "Merci pour votre confiance. Gardez ce recu si vous devez verifier l'achat plus tard.",
      accent: "green",
    };
  }

  if (deliveryStatus === "ASSIGNED") {
    return {
      title: "Livraison prise en charge",
      text: "Votre colis est confie au livreur. Le vendeur ou le livreur peut vous appeler si une precision est necessaire.",
      accent: "blue",
    };
  }

  if (status === "PREPARED" || deliveryStatus === "READY") {
    return {
      title: "Colis pret",
      text: "La boutique a prepare la commande. La prochaine etape est le retrait ou la livraison.",
      accent: "amber",
    };
  }

  if (paid) {
    return {
      title: "Commande prise en charge",
      text: "Le paiement est confirme. La boutique prepare maintenant vos articles.",
      accent: "green",
    };
  }

  return {
    title: "Commande recue",
    text: "La boutique a recu votre commande. Le paiement ou les details de livraison peuvent encore etre confirmes.",
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

export default async function ReceiptPage({ searchParams }) {
  const params = await searchParams;
  const { order, payment, error } = await getReceiptOrder({
    order: params.order,
    reference: params.reference,
  });

  if (!order) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-8">
        <section className="mx-auto max-w-[460px] rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-[var(--outline)]/50">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <ReceiptText size={28} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">Recu indisponible</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-dim)]">
            {error || "Impossible de retrouver cette commande pour le moment."}
          </p>
          <Link
            href="/salia"
            className="mt-6 flex min-h-[54px] items-center justify-center gap-2 rounded-lg bg-[var(--text-main)] px-4 text-sm font-extrabold text-white"
          >
            <ShoppingBag size={18} />
            Retour boutique
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
  const sellerName = order.sellers?.name || "Tikchop";
  const sellerSlug = order.sellers?.slug || "salia";
  const items = order.order_items || [];
  const deliveryLabel = order.delivery_type === "PICKUP" ? "Retrait boutique" : (order.delivery_zone || "A confirmer");
  const downloadUrl = `/api/receipt/pdf?${getReceiptQuery(order, params)}`;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 md:py-10">
      <section className="print-receipt mx-auto max-w-[480px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_70px_rgb(16_24_20_/_0.12)] ring-1 ring-[var(--outline)]/55">
        <div className="relative overflow-hidden bg-[var(--text-main)] px-5 pb-6 pt-5 text-white">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[#5b8cff]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Recu de commande</p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-9">Commande #{receiptRef}</h1>
              <p className="mt-2 text-sm font-semibold text-white/65">{sellerName}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--text-main)]">
              <ReceiptText size={24} />
            </div>
          </div>

          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${
            paid ? "bg-green-400 text-zinc-950" : "bg-amber-300 text-zinc-950"
          }`}>
            {paid ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
            {paid ? "Paiement confirme" : "Paiement a confirmer"}
          </div>

          <div className="mt-5 rounded-2xl bg-white/9 p-4 ring-1 ring-white/10">
            <p className="font-display text-xl font-bold leading-7">{progress.title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/68">{progress.text}</p>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <ReceiptActions title={`Recu Tikchop ${receiptRef}`} downloadUrl={downloadUrl} />

          <div className="rounded-2xl border border-[var(--surface-mid)] bg-[var(--surface-soft)] p-4">
            <div className="grid grid-cols-4 gap-2">
              {["Recue", "Payee", "Prete", "Livree"].map((label, index) => {
                const state = getStepState(index, currentStep);
                return (
                  <div key={label} className="min-w-0 text-center">
                    <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                      state === "done" ? "bg-[var(--primary)] text-white" : state === "active" ? "bg-[var(--text-main)] text-white" : "bg-white text-[var(--text-dim)] ring-1 ring-[var(--outline)]"
                    }`}>
                      {state === "done" ? <CheckCircle2 size={16} /> : index + 1}
                    </div>
                    <p className="mt-1 truncate text-[0.66rem] font-extrabold text-[var(--text-dim)]">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InfoBox icon={CalendarDays} label="Date" value={formatDate(order.created_at)} />
            <InfoBox icon={Phone} label="Client" value={order.customer_phone && order.customer_phone !== "UNKNOWN" ? order.customer_phone : "Non renseigne"} />
            <InfoBox icon={Truck} label="Livraison" value={deliveryLabel} />
            <InfoBox icon={CreditCard} label="Paiement" value={order.payment_method ? getPaymentOption(order.payment_method).label : "A confirmer"} />
          </div>

          {order.delivery_address && (
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-dim)]">
                <MapPin size={16} />
                <p className="quiet-label">Adresse</p>
              </div>
              <p className="mt-2 text-sm font-bold leading-5 text-[var(--text-main)]">{order.delivery_address}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[var(--text-main)]">Articles</h2>
              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--text-dim)]">{items.length} article{items.length > 1 ? "s" : ""}</span>
            </div>
            <div className="mt-3 divide-y divide-[var(--surface-mid)] rounded-2xl border border-[var(--surface-mid)]">
              {items.length > 0 ? items.map((item) => {
                const lineTotal = Number(item.price_at_time || 0) * Number(item.quantity || 0);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-bold leading-5 text-[var(--text-main)]">{item.products?.name || "Article"}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">
                        {item.quantity} x {formatPrice(item.price_at_time)}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-sm font-bold text-[var(--text-main)]">{formatPrice(lineTotal)}</p>
                  </div>
                );
              }) : (
                <div className="p-3 text-sm font-semibold text-[var(--text-dim)]">Articles non disponibles dans le recu.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-950 p-4 text-white">
            <div className="flex justify-between text-sm font-bold text-white/60">
              <span>Produits</span>
              <span>{formatPrice(totals.productsTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm font-bold text-white/60">
              <span>Livraison</span>
              <span>{formatPrice(totals.deliveryFee)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-display text-2xl font-bold">
              <span>Total</span>
              <span className="text-green-400">{formatPrice(totals.total)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--surface-mid)] bg-white p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
                <PackageCheck size={20} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-[var(--text-main)]">A presenter si besoin</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-dim)]">
                  Ce recu aide la boutique ou le livreur a retrouver rapidement votre commande.
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/${sellerSlug}`}
            className="no-print flex min-h-[54px] items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-white px-4 text-sm font-extrabold text-[var(--text-main)]"
          >
            <Home size={18} />
            Retour boutique
          </Link>
        </div>
      </section>
    </main>
  );
}

function InfoBox({ label, value, icon: Icon = Store }) {
  return (
    <div className="min-h-[86px] rounded-2xl bg-[var(--surface-soft)] p-3">
      <div className="flex items-center gap-2 text-[var(--text-dim)]">
        <Icon size={15} />
        <p className="quiet-label">{label}</p>
      </div>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-[var(--text-main)]">{value || "A confirmer"}</p>
    </div>
  );
}
