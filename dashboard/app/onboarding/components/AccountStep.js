"use client";

import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, LogOut, Store, X } from "lucide-react";
import { COMMON_PASSWORDS } from "../../../lib/onboarding-utils";
import { StepDots } from "./StepDots";

export function AccountStep({
  mode,
  localPhone,
  onPhoneChange,
  phoneOk,
  password,
  onPasswordChange,
  showPassword,
  onTogglePassword,
  strength,
  canProceed,
  saving,
  error,
  notice,
  sellerAccount,
  onSubmit,
  onBack,
  onSwitchMode,
  onSignOut,
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f2e7] px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#2b2219]/8 active:scale-95"
            aria-label="Retour"
          >
            <X size={16} className="text-[#2b2219]" />
          </button>
          {mode === "SIGN_UP" && <StepDots current={0} total={2} />}
        </div>

        <div className="mt-6">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">
            {mode === "SIGN_IN" ? "Connexion" : "Étape 1 sur 2"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#2b2219]">
            {mode === "SIGN_IN" ? "Bon retour !" : "Votre compte"}
          </h1>
          <p className="mt-1.5 text-sm font-bold text-[#2b2219]/50">
            {mode === "SIGN_IN"
              ? "Entrez votre numéro et mot de passe."
              : "Ces identifiants vous permettront de vous connecter."}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mx-auto mt-6 w-full max-w-sm space-y-3">

        {/* Phone — +225 fixed */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#2b2219]/8">
          <label htmlFor="onb-phone" className="flex min-h-[68px] cursor-text items-center gap-0 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#fbefe0] text-[#c2572b] mr-3">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.37 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Numéro WhatsApp (Côte d&apos;Ivoire)</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                {/* Fixed prefix */}
                <span className="shrink-0 select-none rounded-lg bg-[#fbefe0] px-2 py-0.5 text-sm font-black text-[#c2572b]">+225</span>
                <input
                  id="onb-phone"
                  type="tel"
                  inputMode="numeric"
                  value={localPhone}
                  onChange={onPhoneChange}
                  placeholder="07 12 34 56 78"
                  className="w-full bg-transparent text-sm font-black text-[#2b2219] outline-none placeholder:text-[#2b2219]/30"
                  autoComplete="tel-local"
                />
              </div>
            </span>
            {phoneOk && <CheckCircle2 size={17} className="shrink-0 text-[#c2572b] ml-2" />}
          </label>
          {localPhone.length > 0 && !phoneOk && (
            <p className="px-4 pb-2.5 text-[0.7rem] font-bold text-amber-600">
              Numéro CI : 8 à 10 chiffres (ex: 0712345678)
            </p>
          )}
        </div>

        {/* Password */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#2b2219]/8">
          <label htmlFor="onb-password" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#fbefe0] text-[#c2572b]">
              <LockKeyhole size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">
                {mode === "SIGN_IN" ? "Mot de passe" : "Choisissez un mot de passe"}
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <input
                  id="onb-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={onPasswordChange}
                  placeholder={mode === "SIGN_IN" ? "Votre mot de passe" : "Au moins 6 caractères"}
                  className="w-full bg-transparent text-sm font-black text-[#2b2219] outline-none placeholder:text-[#2b2219]/30"
                  autoComplete={mode === "SIGN_IN" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="shrink-0 text-[#2b2219]/30 hover:text-[#2b2219]/60"
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </span>
          </label>

          {/* Strength bar — only on signup */}
          {mode === "SIGN_UP" && password.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= strength.score ? strength.color : "#e5e7eb" }}
                    />
                  ))}
                </div>
                <span className="text-[0.68rem] font-black" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
              {/* Rules */}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                  { ok: password.length >= 6, text: "6 caractères min." },
                  { ok: /\d/.test(password), text: "Un chiffre" },
                  { ok: /[A-Z]/.test(password), text: "Une majuscule" },
                  { ok: !COMMON_PASSWORDS.has(password.toLowerCase()), text: "Pas trop simple" },
                ].map(({ ok, text }) => (
                  <span key={text} className={`flex items-center gap-1.5 text-[0.68rem] font-bold ${ok ? "text-[#c2572b]" : "text-[#2b2219]/35"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? "bg-[#c2572b]" : "bg-[#2b2219]/20"}`} />
                    {text}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Errors / Notices */}
        {error && (
          <div className="rounded-[18px] bg-amber-50 p-3.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-[18px] bg-emerald-50 p-3.5 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
            {notice}
          </div>
        )}

        {/* Submit */}
        <button
          id="onb-submit-btn"
          type="submit"
          disabled={saving || !canProceed}
          className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#c2572b] text-base font-black text-white shadow-[0_16px_38px_rgba(194,87,43,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="animate-spin" size={19} /> : <ArrowRight size={19} />}
          {saving ? "En cours..." : mode === "SIGN_IN" ? "Se connecter" : "Continuer"}
        </button>

        {/* Switch mode */}
        <button
          type="button"
          id="onb-switch-mode-btn"
          onClick={onSwitchMode}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-white text-sm font-black text-[#2b2219]/60 ring-1 ring-[#2b2219]/8 active:scale-[0.98] transition"
        >
          {mode === "SIGN_UP" ? (
            <><LockKeyhole size={15} /> J&apos;ai déjà un compte</>
          ) : (
            <><Store size={15} /> Créer un nouveau compte</>
          )}
        </button>

        {sellerAccount && (
          <button
            type="button"
            id="onb-signout-btn"
            onClick={onSignOut}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[16px] text-xs font-bold text-[#2b2219]/40 active:scale-[0.98]"
          >
            <LogOut size={13} /> Changer de compte
          </button>
        )}
      </form>

      <p className="mt-10 pb-4 text-center text-[0.62rem] font-bold text-[#2b2219]/25">
        Tikchop · Espace vendeur
      </p>
    </div>
  );
}