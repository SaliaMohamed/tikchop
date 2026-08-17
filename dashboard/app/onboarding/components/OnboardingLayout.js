"use client";

import { Sparkles } from "lucide-react";

export function OnboardingLayout({ children }) {
  return (
    <div className="flex min-h-dvh w-full bg-[#F1F8F3]">
      {/* Panel marque — desktop uniquement */}
      <aside className="relative hidden w-[440px] shrink-0 flex-col justify-between overflow-hidden bg-[#0F2B20] px-10 py-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-[#34D399]/15" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#34D399]/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#34D399] text-[#0F2B20]">
              <Sparkles size={20} />
            </span>
            <span className="font-display text-xl font-black tracking-tight">Tikchop</span>
          </div>

          <div className="mt-16">
            <p className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#34D399]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
              Votre commerce, en mouvement
            </p>
            <h2 className="mt-4 font-display text-[2.15rem] font-black leading-[1.1] tracking-tight">
              Les belles histoires commencent par une{" "}
              <span className="text-[#34D399]">première commande.</span>
            </h2>
            <p className="mt-4 max-w-[300px] text-sm font-semibold leading-6 text-white/55">
              Boutique, commandes et bot WhatsApp en quelques minutes.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-3.5">
          {[
            "Créez votre compte vendeur",
            "Nommez et personnalisez votre boutique",
            "Commencez à vendre sur WhatsApp",
          ].map((label, index) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-[0.7rem] font-black text-[#34D399] ring-1 ring-white/10">
                {index + 1}
              </span>
              <span className="text-sm font-bold text-white/70">{label}</span>
            </div>
          ))}
        </div>

        <p className="relative z-10 font-display text-sm font-bold text-white/40">
          « Simple, local, efficace. »
          <span className="mt-1 block text-xs font-semibold text-white/30">L&apos;équipe Tikchop, Abidjan</span>
        </p>
      </aside>

      {/* Panneau contenu */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[#F1F8F3]">{children}</div>
    </div>
  );
}