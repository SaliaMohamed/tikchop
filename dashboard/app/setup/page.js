"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, Loader2, Store } from "lucide-react";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerChatbotSettings, getSellerWhatsAppConnection } from "../seller-actions";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import WhatsAppConnector from "../components/WhatsAppConnector";
import StyleEditor from "../components/StyleEditor";
import TikchopLottie from "../components/TikchopLottie";

const STEPS = [
  { key: "whatsapp", title: "Connecter WhatsApp", sub: "Liez le numéro de votre boutique" },
  { key: "style", title: "Style de DJASSAMAN", sub: "Comment il répond à vos clients" },
  { key: "done", title: "C'est pret", sub: "Vos discussions vous attendent" },
];

export default function SetupPage() {
  const seller = useActiveSeller();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [whatsappDone, setWhatsappDone] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!seller.slug) return;
    let alive = true;

    async function checkCurrentSetup() {
      try {
        const token = await getSellerAccessToken();
        const [connection, settings] = await Promise.all([
          getSellerWhatsAppConnection(seller, token),
          getSellerChatbotSettings(seller, token),
        ]);
        if (!alive) return;
        const connected = Boolean(connection?.isConnected);
        const styleSaved = Object.values(settings || {}).some((value) => Boolean(value));
        setWhatsappDone(connected);
        if (connected && styleSaved) setStep(2);
      } catch {
        if (alive) setWhatsappDone(false);
      } finally {
        if (alive) setChecking(false);
      }
    }

    checkCurrentSetup();
    return () => { alive = false; };
  }, [seller]);

  const current = STEPS[step];

  function goToDiscussions() {
    router.push("/messages");
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  if (checking) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#059669]" size={28} />
        <p className="mt-3 text-sm font-black text-[#0F2B20]/45">Vérification de la configuration...</p>
      </div>
    );
  }

  return (
    <div className="app-shell mx-auto max-w-[520px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 md:pt-8">
      {/* ── Header ── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#0F2B20] text-[#34D399]">
            <Store size={20} />
          </span>
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#059669]">DJASSAMAN</p>
            <h1 className="font-display text-lg font-black leading-6 text-[#0F2B20]">
              {seller.name || "Votre boutique"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={goToDiscussions}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-[#059669] ring-1 ring-[#0F2B20]/8"
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
                    ? "bg-[#059669] text-white"
                    : index === step
                      ? "bg-[#0F2B20] text-white"
                      : "bg-white text-[#0F2B20]/40 ring-1 ring-[#0F2B20]/10"
                }`}
              >
                {index < step ? <Check size={13} /> : index + 1}
              </span>
              <span className={`hidden text-[0.68rem] font-black sm:block ${index === step ? "text-[#0F2B20]" : "text-[#0F2B20]/40"}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-[#0F2B20]/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#34D399] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Step content ── */}
      <main className="mt-6">
        <div className="mb-5">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#059669]">Étape {step + 1} / 3</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-8 text-[#0F2B20]">{current.title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#0F2B20]/50">{current.sub}</p>
        </div>

        <div className="rounded-[26px] bg-white p-4 shadow-[0_16px_44px_rgba(15,43,32,0.08)] ring-1 ring-[#0F2B20]/8">
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
            className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-[#0F2B20]/60 ring-1 ring-[#0F2B20]/8 disabled:opacity-40"
          >
            <ArrowLeft size={15} />
            Retour
          </button>
          <span className="text-xs font-bold text-[#0F2B20]/40">Il reste {2 - step} étape{2 - step > 1 ? "s" : ""}</span>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4">
          <p className="text-center text-xs font-bold leading-5 text-[#0F2B20]/45">
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
      <h3 className="mt-4 font-display text-2xl font-black text-[#0F2B20]">DJASSAMAN est pret</h3>
      <p className="mt-2 max-w-[300px] text-sm font-semibold leading-6 text-[#0F2B20]/55">
        WhatsApp est connecté et le style enregistré. Vos clients peuvent déjà écrire : DJASSAMAN répond automatiquement.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#0F2B20] px-5 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,43,32,0.2)]"
      >
        <Bot size={18} />
        Ouvrir mes discussions
        <ArrowRight size={16} />
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-black text-[#0F2B20]/50"
      >
        <ArrowLeft size={14} />
        Retour au style
      </button>
    </div>
  );
}
