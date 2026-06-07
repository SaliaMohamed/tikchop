import React from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";

function normalizeWhatsAppNumber(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

export default function ProductCard({ product, sellerPhone }) {
  const stock = Number(product.stock_quantity || 0);
  const message = `Bonjour, je souhaite commander ${product.name}. Ref: ${product.id}. Prix: ${product.price} FCFA.`;
  const whatsappUrl = `https://wa.me/${normalizeWhatsAppNumber(sellerPhone)}?text=${encodeURIComponent(message)}`;

  return (
    <article className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative aspect-[1/1.08] w-full overflow-hidden bg-zinc-100">
        <Image
          src={product.image_url || "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800"}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
        />
        <div className="absolute left-2 top-2">
          {stock > 0 && stock < 5 && (
            <span className="rounded-full bg-amber-500 px-2 py-1 text-[0.62rem] font-extrabold uppercase text-white">
              Stock faible
            </span>
          )}
          {stock === 0 && (
            <span className="rounded-full bg-red-600 px-2 py-1 text-[0.62rem] font-extrabold uppercase text-white">
              Rupture
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="min-h-[2.45rem] text-[0.93rem] font-extrabold leading-5 text-zinc-950 line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold leading-none text-zinc-950">
              {Number(product.price).toLocaleString("fr-FR")}
            </p>
            <p className="mt-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-zinc-400">FCFA</p>
          </div>
          <p className="text-[0.7rem] font-bold text-zinc-400">{stock} dispo</p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold transition ${
            stock > 0
              ? "bg-[#111827] text-white active:scale-[0.98]"
              : "pointer-events-none bg-zinc-100 text-zinc-400"
          }`}
        >
          <MessageCircle size={17} strokeWidth={2.4} />
          {stock > 0 ? "Commander" : "Indisponible"}
        </a>
      </div>
    </article>
  );
}
