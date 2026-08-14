"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import TikchopLottie from "../../components/TikchopLottie";

export function OnboardingSplash({ onCreate, onSignIn }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0F2B20] px-5 py-12 text-white">
      <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[30px] bg-[#34D399]/12 ring-1 ring-[#34D399]/25">
        <TikchopLottie name="sparkle" size={104} />
      </div>

      <h1 className="font-display text-4xl font-black leading-[1.08] text-white text-center">
        Vendez sur WhatsApp.<br />
        <span className="text-[#34D399]">Automatiquement.</span>
      </h1>

      <p className="mt-4 max-w-[260px] text-center text-sm font-bold leading-6 text-white/50">
        Boutique, commandes et bot en 2 minutes.
      </p>

      {/* Steps preview */}
      <div className="mt-8 w-full max-w-xs space-y-2">
        {[
          { n: "1", label: "Créez votre compte vendeur" },
          { n: "2", label: "Nommez et personnalisez votre boutique" },
          { n: "3", label: "Commencez à vendre sur WhatsApp" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34D399]/15 text-[0.68rem] font-black text-[#34D399]">{n}</span>
            <span className="text-sm font-bold text-white/70">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-10 w-full max-w-xs space-y-3">
        <button
          id="onboarding-start-btn"
          type="button"
          onClick={onCreate}
          className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#34D399] text-base font-black text-[#0F2B20] shadow-[0_18px_44px_rgba(52, 211, 153,0.32)] active:scale-[0.98] transition"
        >
          Créer ma boutique <ArrowRight size={18} />
        </button>
        <button
          id="onboarding-signin-btn"
          type="button"
          onClick={onSignIn}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white/8 text-sm font-black text-white/80 ring-1 ring-white/10 active:scale-[0.98] transition"
        >
          <LockKeyhole size={16} /> J&apos;ai déjà un compte
        </button>
      </div>

      <p className="mt-8 text-center text-[0.62rem] font-bold text-white/20">
        Tikchop · Commerce local en Afrique
      </p>
    </div>
  );
}