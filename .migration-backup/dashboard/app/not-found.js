import Link from "next/link";

export const metadata = {
  title: "Page introuvable | Tikchop",
};

export default function NotFound() {
  return (
    <main className="container public-chrome">
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <p className="font-display text-6xl font-bold text-[var(--primary)]">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">
          Page introuvable
        </h1>
        <p className="mt-2 max-w-[20rem] text-sm font-semibold leading-5 text-[var(--text-dim)]">
          La page que vous cherchez n'existe pas ou a ete deplacee.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Retour a l'accueil
        </Link>
      </div>
    </main>
  );
}
