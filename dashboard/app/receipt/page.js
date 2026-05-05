import Link from "next/link";
import { CheckCircle2, Clock3, Home, ReceiptText, ShoppingBag } from "lucide-react";
import { getReadableOrderRef, getReceiptOrder, getReceiptTotals } from "../../lib/receipt";
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
  const sellerName = order.sellers?.name || "Tikchop";
  const sellerSlug = order.sellers?.slug || "salia";
  const items = order.order_items || [];

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 md:py-10">
      <section className="print-receipt mx-auto max-w-[460px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[var(--outline)]/50">
        <div className="bg-[var(--text-main)] px-5 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Recu Tikchop</p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-9">Commande #{receiptRef}</h1>
              <p className="mt-2 text-sm font-semibold text-white/65">{sellerName}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[var(--text-main)]">
              <ReceiptText size={24} />
            </div>
          </div>

          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${
            paid ? "bg-green-400 text-zinc-950" : "bg-amber-300 text-zinc-950"
          }`}>
            {paid ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
            {paid ? "Paiement confirme" : "Paiement a confirmer"}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <ReceiptActions title={`Recu Tikchop ${receiptRef}`} />

          <div className="grid grid-cols-2 gap-2">
            <InfoBox label="Date" value={formatDate(order.created_at)} />
            <InfoBox label="Client" value={order.customer_phone && order.customer_phone !== "UNKNOWN" ? order.customer_phone : "Non renseigne"} />
            <InfoBox label="Livraison" value={order.delivery_type === "PICKUP" ? "Retrait boutique" : (order.delivery_zone || "A confirmer")} />
            <InfoBox label="Paiement" value={order.payment_method || "A confirmer"} />
          </div>

          {order.delivery_address && (
            <div className="rounded-lg bg-[var(--surface-soft)] p-4">
              <p className="quiet-label">Adresse</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[var(--text-main)]">{order.delivery_address}</p>
            </div>
          )}

          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-main)]">Articles</h2>
            <div className="mt-3 divide-y divide-[var(--surface-mid)] rounded-lg border border-[var(--surface-mid)]">
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

          <div className="rounded-lg bg-zinc-950 p-4 text-white">
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

          <p className="rounded-lg bg-[var(--surface-soft)] p-3 text-center text-xs font-semibold leading-5 text-[var(--text-dim)]">
            Gardez ce recu. Vous pouvez le presenter au vendeur ou au livreur si besoin.
          </p>

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

function InfoBox({ label, value }) {
  return (
    <div className="min-h-[78px] rounded-lg bg-[var(--surface-soft)] p-3">
      <p className="quiet-label">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-[var(--text-main)]">{value || "A confirmer"}</p>
    </div>
  );
}
