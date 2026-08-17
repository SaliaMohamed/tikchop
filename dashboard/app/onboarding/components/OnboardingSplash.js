"use client";

import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { OnboardingLayout } from "./OnboardingLayout";

export function OnboardingSplash({ onCreate, onSignIn }) {
  return (
    <OnboardingLayout>
      <div className="flex min-h-dvh w-full flex-col px-4 py-8 lg:justify-center">
        <div className="hidden lg:block">
          <span className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#059669]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
            Accès vendeur
          </span>
        </div>

        <div className="mx-auto mt-auto w-full max-w-sm lg:mt-8">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[30px] bg-white shadow-[0_16px_40px_rgba(15,43,32,0.08)] ring-1 ring-[#0F2B20]/8 lg:hidden">
            <Sparkles size={44} className="text-[#0F2B20]" />
          </div>

          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#059669] lg:hidden">Accès vendeur</p>
          <h1 className="mt-2 font-display text-4xl font-black leading-[1.08] text-[#0F2B20]">
            Vendez sur WhatsApp.<br />
            <span className="text-[#059669]">Automatiquement.</span>
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-[#0F2B20]/50">
            Boutique, commandes et bot en 2 minutes.
          </p>

          <div className="mt-8 space-y-3">
            <button
              id="onboarding-start-btn"
              type="button"
              onClick={onCreate}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#059669] text-base font-black text-white shadow-[0_18px_44px_rgba(5,150,105,0.28)] active:scale-[0.98] transition"
            >
              Créer ma boutique <ArrowRight size={18} />
            </button>
            <button
              id="onboarding-signin-btn"
              type="button"
              onClick={onSignIn}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white text-sm font-black text-[#0F2B20]/70 ring-1 ring-[#0F2B20]/10 shadow-[0_8px_22px_rgba(15,43,32,0.05)] active:scale-[0.98] transition"
            >
              <LockKeyhole size={16} /> J&apos;ai déjà un compte
            </button>
          </div>

          <p className="mt-8 text-center text-[0.62rem] font-bold text-[#0F2B20]/30">
            Tikchop · Commerce local en Afrique
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}