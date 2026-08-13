import React from "react";
import Link from "next/link";
import { CheckCircle2, ReceiptText, ShoppingBag } from "lucide-react";
import { getReadableOrderRef, getReceiptOrder } from "../../../lib/receipt";

export default async function PaymentCallbackPage({ searchParams }) {
  const params = await searchParams;
  const reference = params.reference;
  const receipt = reference ? await getReceiptOrder({ reference }) : { order: null, payment: null };
  const orderRef = receipt.order ? getReadableOrderRef(receipt.order) : null;
  const sellerSlug = receipt.order?.sellers?.slug || "salia";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4efe5] p-6 text-center">
      <div className="w-full max-w-md rounded-[40px] bg-white p-10 shadow-xl shadow-black/5 ring-1 ring-black/5">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>

        <h1 className="text-3xl font-extrabold text-zinc-950">Commande prise en charge</h1>
        <p className="mt-4 text-zinc-500 font-medium leading-relaxed">
          Paiement confirme. La boutique prepare maintenant votre commande et vous recevrez le suivi sur WhatsApp.
        </p>

        <div className="mt-8 rounded-2xl bg-zinc-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-zinc-400">Numero de commande</p>
          <p className="mt-1 font-display text-2xl font-bold text-zinc-950">#{orderRef || "En verification"}</p>
        </div>

        <div className="mt-10 space-y-3">
          {reference && (
            <Link
              href={`/receipt?reference=${encodeURIComponent(reference)}`}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-green-500 text-zinc-950 font-extrabold transition hover:scale-[1.02] active:scale-95"
            >
              <ReceiptText size={20} />
              Voir le recu PDF
            </Link>
          )}
          <Link
            href={`/${sellerSlug}`}
            className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-white font-extrabold transition hover:scale-[1.02] active:scale-95"
          >
            <ShoppingBag size={20} />
            Retourner a la boutique
          </Link>
        </div>
      </div>
    </div>
  );
}
