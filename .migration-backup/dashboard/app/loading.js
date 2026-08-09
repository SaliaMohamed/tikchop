import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="container">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
        <p className="mt-4 font-display text-lg font-bold text-[var(--text-main)]">
          Chargement...
        </p>
      </div>
    </main>
  );
}
