"use client";

import { Download, Share2 } from "lucide-react";

export default function ReceiptActions({ title }) {
  function downloadReceipt() {
    window.print();
  }

  async function shareReceipt() {
    if (!navigator.share) {
      downloadReceipt();
      return;
    }

    try {
      await navigator.share({
        title: title || "Recu Tikchop",
        text: "Voici mon recu de commande Tikchop.",
        url: window.location.href,
      });
    } catch {
      // The user may simply cancel the native share sheet.
    }
  }

  return (
    <div className="no-print grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={downloadReceipt}
        className="flex min-h-[54px] items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-extrabold text-white shadow-sm active:scale-[0.99]"
      >
        <Download size={18} />
        Telecharger
      </button>
      <button
        type="button"
        onClick={shareReceipt}
        className="flex min-h-[54px] items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] shadow-sm active:scale-[0.99]"
      >
        <Share2 size={18} />
        Partager
      </button>
    </div>
  );
}
