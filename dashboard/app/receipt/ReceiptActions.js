"use client";

import React, { useState } from "react";
import { Copy, Check, Download, MessageCircle, Printer } from "lucide-react";

export default function ReceiptActions({
  title,
  downloadUrl,
  orderRef,
  sellerName,
  totalFormatted,
}) {
  const [copied, setCopied] = useState(false);

  function printReceipt() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  async function copyReceiptLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function shareWhatsApp() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const msg = [
      `🧾 *Reçu de commande #${orderRef || ""}*`,
      sellerName ? `Boutique : ${sellerName}` : "",
      totalFormatted ? `Montant : ${totalFormatted}` : "",
      "",
      `Consulter le reçu officiel et suivre la livraison :`,
      url,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="no-print space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`recu-${orderRef || "commande"}.pdf`}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-3 text-xs font-black text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition active:scale-[0.98] hover:opacity-95 no-underline"
          >
            <Download size={16} />
            <span>Télécharger PDF</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={printReceipt}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-3 text-xs font-black text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition active:scale-[0.98] hover:opacity-95"
          >
            <Download size={16} />
            <span>Télécharger PDF</span>
          </button>
        )}

        <button
          type="button"
          onClick={shareWhatsApp}
          className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#25D366]/15 px-3 text-xs font-black text-[#128C7E] ring-1 ring-[#25D366]/25 transition active:scale-[0.98] hover:bg-[#25D366]/25"
        >
          <MessageCircle size={16} />
          <span>Partager WhatsApp</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copyReceiptLink}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#F6FBF7] px-3 text-xs font-bold text-[#0F2B20] ring-1 ring-[#0F2B20]/10 transition active:scale-[0.98] hover:bg-[#EAF8F0]"
        >
          {copied ? <Check size={15} className="text-[#059669]" /> : <Copy size={15} />}
          <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
        </button>

        <button
          type="button"
          onClick={printReceipt}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-bold text-[#0F2B20]/70 ring-1 ring-[#0F2B20]/10 transition active:scale-[0.98] hover:text-[#0F2B20]"
        >
          <Printer size={15} />
          <span>Imprimer</span>
        </button>
      </div>
    </div>
  );
}
