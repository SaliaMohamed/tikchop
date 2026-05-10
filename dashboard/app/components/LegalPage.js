import Link from "next/link";

const LEGAL_UPDATED_AT = "9 mai 2026";

export default function LegalPage({ eyebrow, title, intro, sections }) {
  return (
    <article className="mx-auto max-w-3xl py-8 md:py-14">
      <Link href="/" className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-extrabold text-[var(--primary)] no-underline shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.45)]">
        Retour a Tikchop
      </Link>
      <header className="mt-8 rounded-[30px] bg-[var(--text-main)] p-6 text-white shadow-[var(--shadow-lg)] md:p-8">
        <p className="quiet-label text-white/55">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight md:text-5xl">{title}</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-white/68 md:text-base">{intro}</p>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-bright)]">
          Derniere mise a jour: {LEGAL_UPDATED_AT}
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.42)]">
            <h2 className="font-display text-xl font-extrabold text-[var(--text-main)]">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-[var(--text-dim)]">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] bg-[var(--surface-soft)] p-5 text-sm font-semibold leading-6 text-[var(--text-dim)]">
        <p>
          Contact support:{" "}
          <a href="mailto:support@tikchop.app" className="font-extrabold text-[var(--primary)]">
            support@tikchop.app
          </a>
        </p>
      </div>
    </article>
  );
}
