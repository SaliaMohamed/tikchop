"use client";

import { CheckCircle2, CopyCheck, ImagePlus } from "lucide-react";

export function StudioMiniButton({ icon, label, onClick, disabled = false, dark = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] text-xs font-black transition active:scale-[0.98] disabled:opacity-45 ${
        dark
          ? "bg-[#07120d] text-white"
          : "bg-[#fbf9f4] text-[#07120d] ring-1 ring-[#07120d]/7"
      }`}
    >
      <span className={dark ? "text-[#39f58e]" : "text-[#008f5a]"}>{icon}</span>
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  );
}

export function AngleDecisionCard({ index, extraCount, onAttachPrevious, onSeparateLast }) {
  if (index <= 0) {
    return (
      <div className="rounded-[18px] bg-[#e9fff1] p-3 text-sm font-bold leading-5 text-[#063d28] ring-1 ring-[#bff3cf]">
        Si plusieurs photos montrent le meme article, Tikchop les regroupe automatiquement quand il est assez sur.
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-[#f7fbf8] p-3 ring-1 ring-[rgba(0,143,90,0.12)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Cette photo est...</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center text-xs font-black text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]">
          <ImagePlus size={15} />
          Nouvel article
        </div>
        <button
          type="button"
          onClick={onAttachPrevious}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-center text-xs font-black text-white"
        >
          <CopyCheck size={15} />
          Meme article
        </button>
      </div>
      {extraCount > 0 && (
        <div className="mt-2 rounded-2xl bg-white p-2">
          <p className="text-xs font-bold leading-4 text-[var(--text-dim)]">
            {extraCount} autre{extraCount > 1 ? "s" : ""} photo{extraCount > 1 ? "s" : ""} deja fusionnee{extraCount > 1 ? "s" : ""}.
          </p>
          <button
            type="button"
            onClick={onSeparateLast}
            className="mt-2 flex min-h-[38px] w-full items-center justify-center rounded-xl bg-[var(--surface-soft)] px-3 text-xs font-black text-[var(--primary)]"
          >
            Separer la derniere photo
          </button>
        </div>
      )}
    </div>
  );
}