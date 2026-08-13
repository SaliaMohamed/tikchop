"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import BrandLogo from "../../components/BrandLogo";
import { updateSellerPassword } from "./actions";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkReady, setLinkReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      if (!supabase) {
        setError("Supabase Auth n'est pas configure.");
        setCheckingLink(false);
        return;
      }

      try {
        setError("");
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const linkError = url.searchParams.get("error_description") || hashParams.get("error_description");

        if (linkError) {
          throw new Error(decodeURIComponent(linkError).replace(/\+/g, " "));
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState({}, document.title, "/account/update-password");
        } else if (hashParams.get("access_token") && hashParams.get("refresh_token")) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: hashParams.get("access_token"),
            refresh_token: hashParams.get("refresh_token"),
          });
          if (sessionError) throw sessionError;
          window.history.replaceState({}, document.title, "/account/update-password");
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error("Lien de recuperation expire ou deja utilise. Demandez un nouveau lien.");
        }

        if (active) setLinkReady(true);
      } catch (sessionError) {
        if (active) {
          setError(sessionError.message || "Lien de recuperation invalide. Demandez un nouveau lien.");
          setLinkReady(false);
        }
      } finally {
        if (active) setCheckingLink(false);
      }
    }

    prepareRecoverySession();
    const { data: listener } = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session && active) {
        setLinkReady(true);
        setError("");
        setCheckingLink(false);
      }
    }) || { data: null };

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase Auth n'est pas configure.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit avoir au moins 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await updateSellerPassword(password);
      setSuccess(true);
    } catch (updateError) {
      setError(updateError.message || "Impossible de changer le mot de passe. Ouvre le lien recu par email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell min-h-screen bg-[#fbf6ee] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top bg-white">
        <div className="flex items-center justify-between">
          <Link href="/login" className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#2b2219]/50 no-underline hover:text-[#2b2219]">Retour</Link>
          <BrandLogo href="/login" size="sm" />
          <span className="h-5 w-10" />
        </div>
      </header>

      <main className="mt-6 px-4">
        <section className="mx-auto max-w-[440px] rounded-[34px] bg-white p-6 shadow-[0_16px_34px_rgba(13,23,18,0.08)] ring-1 ring-[#2b2219]/10">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#fbf6ee] text-[#c2572b] ring-1 ring-[#2b2219]/5">
              {success ? <CheckCircle2 size={26} /> : <KeyRound size={26} />}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black leading-8 text-[#2b2219]">
                {success ? "Mot de passe change" : "Nouveau mot de passe"}
              </h1>
              <p className="mt-1 text-sm font-bold leading-5 text-[#2b2219]/50">
                {success ? "Vous pouvez maintenant vous reconnecter a votre espace vendeur." : "Choisissez un nouveau mot de passe pour votre compte vendeur."}
              </p>
            </div>
          </div>

          {success ? (
            <Link href="/login" className="flex min-h-[58px] w-full items-center justify-center rounded-[20px] bg-[#c2572b] text-base font-black text-white no-underline shadow-sm active:scale-[0.98] transition-transform">
              Retour connexion
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {checkingLink && (
                <p className="flex items-center gap-2 rounded-[20px] bg-[#fbf6ee] p-3 text-sm font-bold leading-5 text-[#2b2219]/50 ring-1 ring-[#2b2219]/10">
                  <Loader2 className="animate-spin text-[#c2572b]" size={18} />
                  Verification du lien de recuperation...
                </p>
              )}
              {!checkingLink && !linkReady && (
                <Link href="/onboarding" className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] bg-[#fbf6ee] text-sm font-black text-[#c2572b] no-underline ring-1 ring-[#2b2219]/10 active:scale-[0.98] transition-transform">
                  Demander un nouveau lien
                </Link>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Nouveau mot de passe</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 6 caracteres"
                  disabled={checkingLink || !linkReady}
                  className="mobile-input bg-[#fbf6ee] text-base font-bold text-[#2b2219] placeholder:text-[#2b2219]/30"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-[#2b2219]/50">Confirmer</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Retape le mot de passe"
                  disabled={checkingLink || !linkReady}
                  className="mobile-input bg-[#fbf6ee] text-base font-bold text-[#2b2219] placeholder:text-[#2b2219]/30"
                />
              </label>

              {error && (
                <p className="rounded-[20px] bg-red-50 p-3 text-sm font-bold leading-5 text-red-700 ring-1 ring-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || checkingLink || !linkReady}
                className="mt-6 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2b2219] text-base font-black text-[#f0954c] shadow-[0_16px_34px_rgba(43, 34, 25,0.22)] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                {saving ? "Enregistrement..." : "Changer le mot de passe"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
