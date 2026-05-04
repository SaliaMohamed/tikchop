import React from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingBag } from "lucide-react";

export default async function PaymentCallbackPage({ searchParams }) {
  const params = await searchParams;
  const reference = params.reference;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f5f1] p-6 text-center">
      <div className="w-full max-w-md rounded-[40px] bg-white p-10 shadow-xl shadow-black/5 ring-1 ring-black/5">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>

        <h1 className="text-3xl font-extrabold text-zinc-950">Paiement reussi !</h1>
        <p className="mt-4 text-zinc-500 font-medium leading-relaxed">
          Merci pour votre achat. Votre commande est en cours de preparation.
          Un message de confirmation vous sera envoye sur WhatsApp.
        </p>

        <div className="mt-8 rounded-2xl bg-zinc-50 p-4 text-sm font-mono text-zinc-400">
          Ref: {reference || "N/A"}
        </div>

        <div className="mt-10 space-y-3">
          <Link
            href="/salia"
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
