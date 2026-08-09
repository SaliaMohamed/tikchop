"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Tikchop error:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main className="container public-chrome">
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <p className="font-display text-6xl font-bold text-[var(--primary)]">Oups</p>
            <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">
              Quelque chose s'est mal passe
            </h1>
            <p className="mt-2 max-w-[20rem] text-sm font-semibold leading-5 text-[var(--text-dim)]">
              Une erreur inattendue est survenue. Reessayez ou retournez a l'accueil.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={reset} className="btn-primary">
                Reessayer
              </button>
              <Link href="/" className="btn-secondary">
                Accueil
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
