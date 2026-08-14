"use client";
import { BadgeCheck, CheckCircle2, CircleDollarSign, ImagePlus, Sparkles } from "lucide-react";
// Progress indicators.

export function StepChip({ done, step, label, icon, important = false }) {
  return (
    <div className={`rounded-2xl border px-2 py-3 ${done ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : important ? "border-[var(--primary)]/45 bg-white text-[var(--primary)]" : "border-[var(--outline)]/35 bg-white text-[var(--text-dim)]"}`}>
      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${done ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
        {done ? <CheckCircle2 size={16} strokeWidth={1.6} /> : icon || step}
      </span>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

export function ProgressSteps({ mode, bulkPhotoItems, bulkProducts, readyBulkPhotos, formData }) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.34)] md:p-4">
      <div className="mb-3 hidden items-center justify-between md:flex">
        <div>
          <p className="quiet-label text-[var(--primary)]">Progression</p>
          <h2 className="font-display text-lg font-bold text-[var(--text-main)]">3 validations avant mise en ligne</h2>
        </div>
        <BadgeCheck className="text-[var(--primary)]" size={22} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-left">
        <StepChip done={mode === "BULK" ? bulkPhotoItems.length > 0 || bulkProducts.length > 0 : Boolean(formData.image_url)} step="1" label="Photos" icon={<ImagePlus size={15} />} />
        <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.name)} step="2" label="Fiches" icon={<Sparkles size={15} />} />
        <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.price)} step="3" label="Prix + stock" icon={<CircleDollarSign size={15} />} important />
      </div>
    </section>
  );
}