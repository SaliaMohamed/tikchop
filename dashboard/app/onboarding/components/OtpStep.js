"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { OnboardingLayout } from "./OnboardingLayout";

export function OtpStep({ phone, phoneDisplay, onBack, onResend, onVerify }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputsRef = useRef([]);

  const code = digits.join("");
  const ready = code.length === 6 && !verifying;

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  useEffect(() => {
    if (!verifying) inputsRef.current[0]?.focus();
  }, [verifying]);

  function focusIndex(index) {
    inputsRef.current[Math.min(Math.max(index, 0), 5)]?.focus();
  }

  function handleChange(index, value) {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned) focusIndex(index + 1);
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      focusIndex(index - 1);
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((char, index) => { next[index] = char; });
    setDigits(next);
    focusIndex(Math.min(pasted.length, 5));
  }

  async function handleSubmit() {
    if (!ready) return;
    setVerifying(true);
    setError("");
    try {
      await onVerify(code);
    } catch (err) {
      setError(err?.message || "Code incorrect. Réessayez.");
      setDigits(Array(6).fill(""));
      setVerifying(false);
      focusIndex(0);
    }
  }

  async function handleResend() {
    if (resending || timer > 0) return;
    setResending(true);
    setError("");
    try {
      await onResend();
      setTimer(60);
      setDigits(Array(6).fill(""));
    } catch (err) {
      setError(err?.message || "Impossible de renvoyer le code.");
    } finally {
      setResending(false);
      focusIndex(0);
    }
  }

  const minutes = Math.floor(timer / 60);
  const seconds = String(timer % 60).padStart(2, "0");

  return (
    <OnboardingLayout>
      <div className="flex min-h-dvh w-full flex-col px-4 py-8 lg:justify-center">
        <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#0F2B20]/8 active:scale-95"
            aria-label="Retour"
          >
            <X size={16} className="text-[#0F2B20]" />
          </button>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#059669] ring-1 ring-[#0F2B20]/8">
            <MessageCircle size={17} />
          </span>
        </div>

        <div className="mt-8">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#059669]">Connexion</p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#0F2B20]">Code de vérification</h1>
          <p className="mt-1.5 text-sm font-bold leading-5 text-[#0F2B20]/50">
            Entrez le code reçu sur WhatsApp ({phoneDisplay || phone}).
          </p>
        </div>
      </div>

      <form
        className="mx-auto mt-8 w-full max-w-sm"
        onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
      >
        <div className="flex items-center justify-center gap-2.5">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputsRef.current[index] = el; }}
              type="tel"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              maxLength={1}
              aria-label={`Chiffre ${index + 1}`}
              className={`h-14 w-11 rounded-[16px] text-center font-display text-xl font-black text-[#0F2B20] outline-none transition ring-1 ${
                digit ? "bg-white ring-[#059669] shadow-[0_4px_14px_rgba(5,150,105,0.18)]" : "bg-white ring-[#0F2B20]/10"
              } focus:ring-2 focus:ring-[#059669]`}
            />
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-[18px] bg-amber-50 p-3.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!ready}
          className="mt-7 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#059669] text-base font-black text-white shadow-[0_16px_38px_rgba(5,150,105,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {verifying ? <Loader2 className="animate-spin" size={19} /> : null}
          {verifying ? "Vérification..." : "Se connecter"}
        </button>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-black text-[#0F2B20]/45">
          {timer > 0 ? (
            <>
              <RefreshCw size={14} />
              Renvoyer le code dans {minutes}:{seconds}
            </>
          ) : (
            <button type="button" onClick={handleResend} className="flex items-center gap-2 text-[#059669] active:scale-95 transition">
              {resending ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              Renvoyer le code
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="mt-4 mx-auto flex items-center gap-1.5 px-4 py-2 text-xs font-black text-[#0F2B20]/40"
        >
          <ArrowLeft size={14} />
          Changer de numéro
        </button>
      </form>

      <p className="mt-auto pt-8 text-center text-[0.62rem] font-bold text-[#0F2B20]/25">
        Le code expire dans 5 minutes. Ne le partagez jamais.
      </p>
      </div>
    </OnboardingLayout>
  );
}
