"use client";

import Link from "next/link";
import { ArrowLeft, Bot, RefreshCw, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveSeller } from "../components/sellerContext";
import WhatsAppConnector from "../components/WhatsAppConnector";
import StyleEditor from "../components/StyleEditor";

export default function CrmSettingsPage() {
  const seller = useActiveSeller();
  const router = useRouter();

  return (
    <div className="app-shell mx-auto max-w-[560px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 md:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#2b2219] ring-1 ring-[#2b2219]/8"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">Parametres globaux</p>
            <h1 className="font-display text-xl font-black leading-7 text-[#2b2219]">DJASSAMAN</h1>
          </div>
        </div>
        <Link
          href="/messages"
          className="flex h-10 items-center gap-1.5 rounded-full bg-[#2b2219] px-3.5 text-xs font-black text-white no-underline"
        >
          <Bot size={14} />
          DJASSAMAN
        </Link>
      </header>

      <p className="mt-3 text-sm font-semibold leading-5 text-[#2b2219]/55">
        Modifiez la connexion WhatsApp et le style de reponse du DJASSAMAN. Les changements s&apos;appliquent immediatement a vos discussions.
      </p>

      {/* ── WhatsApp connection ── */}
      <section className="mt-5 overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_16px_44px_rgba(43,34,25,0.08)] ring-1 ring-[#2b2219]/8">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#fbefe0] text-[#c2572b]">
            <RefreshCw size={15} />
          </span>
          <div>
            <p className="text-sm font-black text-[#2b2219]">Connexion WhatsApp</p>
            <p className="text-[0.62rem] font-bold text-[#2b2219]/45">Numero lie a la boutique</p>
          </div>
        </div>
        <WhatsAppConnector />
      </section>

      {/* ── Style ── */}
      <section className="mt-4 overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_16px_44px_rgba(43,34,25,0.08)] ring-1 ring-[#2b2219]/8">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#fbefe0] text-[#c2572b]">
            <Settings2 size={15} />
          </span>
          <div>
            <p className="text-sm font-black text-[#2b2219]">Style du DJASSAMAN</p>
            <p className="text-[0.62rem] font-bold text-[#2b2219]/45">Comment il repond, encaisse et livre</p>
          </div>
        </div>
        <StyleEditor />
      </section>

      <p className="mt-4 text-center text-xs font-bold text-[#2b2219]/40">
        {seller.name || "Votre boutique"}
      </p>
    </div>
  );
}
