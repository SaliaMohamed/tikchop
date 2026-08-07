"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
    } catch (updateError) {
      setError(updateError.message || "Impossible de changer le mot de passe. Ouvre le lien recu par email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell min-h-screen pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <header className="mobile-top">
        <div className="flex items-center justify-between">
          <Link href="/onboarding" className="text-sm font-extrabold text-[var(--text-dim)] no-underline">Retour</Link>
          <p className="font-display text-lg font-bold text-[var(--primary)]">Tikchop</p>
          <span className="h-5 w-10" />
        </div>
      </header>

      <main className="mt-6">
        <section className="app-card p-5">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
              {success ? <CheckCircle2 size={28} /> : <KeyRound size={28} />}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold leading-9 text-[var(--text-main)]">
                {success ? "Mot de passe change" : "Nouveau mot de passe"}
              </h1>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                {success ? "Tu peux maintenant te reconnecter a ton espace vendeur." : "Choisis un nouveau mot de passe pour ton compte vendeur."}
              </p>
            </div>
          </div>

          {success ? (
            <Link href="/onboarding" className="flex min-h-[58px] w-full items-center justify-center rounded-xl bg-[var(--primary)] text-base font-extrabold text-white no-underline">
              Retour connexion
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Nouveau mot de passe</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 6 caracteres"
                  className="mobile-input text-lg"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Confirmer</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Retape le mot de passe"
                  className="mobile-input text-lg"
                />
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm font-bold leading-5 text-red-700 ring-1 ring-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-base font-extrabold text-white disabled:bg-[var(--outline)]"
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
