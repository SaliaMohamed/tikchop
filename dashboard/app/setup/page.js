"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, Store } from "lucide-react";
import { useActiveSeller } from "../components/sellerContext";
import WhatsAppConnector from "../components/WhatsAppConnector";
import StyleEditor from "../components/StyleEditor";
import TikchopLottie from "../components/TikchopLottie";

const STEPS = [
  { key: "whatsapp", title: "Connecter WhatsApp", sub: "Liez le numero de votre boutique" },
  { key: "style", title: "Style de DJASSAMAN", sub: "Comment il repond a vos clients" },
  { key: "done", title: "C'est pret", sub: "Vos discussions vous attendent" },
];

export default function SetupPage() {
  const seller = useActiveSeller();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [whatsappDone, setWhatsappDone] = useState(false);

  const current = STEPS[step];

  function goToDiscussions() {
    router.push("/messages");
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="app-shell mx-auto max-w-[520px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 md:pt-8">
      {/* ── Header ── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#2b2219] text-[#f0954c]">
            <Store size={20} />
          </span>
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">DJASSAMAN</p>
            <h1 className="font-display text-lg font-black leading-6 text-[#2b2219]">
              {seller.name || "Votre boutique"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={goToDiscussions}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-[#c2572b] ring-1 ring-[#2b2219]/8"
        >
          <Bot size={14} />
          DJASSAMAN
        </button>
      </header>

      {/* ── Stepper ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, index) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.68rem] font-black transition-colors ${
                  index < step
                    ? "bg-[#c2572b] text-white"
                    : index === step
                      ? "bg-[#2b2219] text-white"
                      : "bg-white text-[#2b2219]/40 ring-1 ring-[#2b2219]/10"
                }`}
              >
                {index < step ? <Check size={13} /> : index + 1}
              </span>
              <span className={`hidden text-[0.68rem] font-black sm:block ${index === step ? "text-[#2b2219]" : "text-[#2b2219]/40"}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-[#2b2219]/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c2572b] to-[#f0954c] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Step content ── */}
      <main className="mt-6">
        <div className="mb-5">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">Etape {step + 1} / 3</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 text-[#2b2219]">{current.title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#2b2219]/50">{current.sub}</p>
        </div>

        <div className="rounded-[26px] bg-white p-4 shadow-[0_16px_44px_rgba(43,34,25,0.08)] ring-1 ring-[#2b2219]/8">
          {step === 0 && (
            <WhatsAppConnector
              onConnected={() => { setWhatsappDone(true); setStep(1); }}
            />
          )}
          {step === 1 && (
            <StyleEditor
              onSaved={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <DoneStep
              whatsappDone={whatsappDone}
              onContinue={goToDiscussions}
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </main>

      {/* ── Nav buttons ── */}
      {step < 2 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-[#2b2219]/60 ring-1 ring-[#2b2219]/8 disabled:opacity-40"
          >
            <ArrowLeft size={15} />
            Retour
          </button>
          <span className="text-xs font-bold text-[#2b2219]/40">Il reste {2 - step} etape{2 - step > 1 ? "s" : ""}</span>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4">
          <p className="text-center text-xs font-bold leading-5 text-[#2b2219]/45">
            Vous pourrez modifier ces reglages a tout moment dans les parametres de l&apos;app (menu Plus).
          </p>
        </div>
      )}
    </div>
  );
}

function DoneStep({ whatsappDone, onContinue, onBack }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <TikchopLottie name="success" size={150} />
      <h3 className="mt-4 font-display text-2xl font-black text-[#2b2219]">DJASSAMAN est pret</h3>
      <p className="mt-2 max-w-[300px] text-sm font-semibold leading-6 text-[#2b2219]/55">
        WhatsApp est connecte et le style enregistre. Vos clients peuvent deja ecrire : DJASSAMAN repond automatiquement.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2b2219] px-5 text-sm font-black text-white shadow-[0_16px_36px_rgba(43,34,25,0.2)]"
      >
        <Bot size={18} />
        Ouvrir mes discussions
        <ArrowRight size={16} />
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-black text-[#2b2219]/50"
      >
        <ArrowLeft size={14} />
        Retour au style
      </button>
    </div>
  );
}
