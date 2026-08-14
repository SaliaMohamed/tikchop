"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X } from "lucide-react";
import { useActiveSeller } from "./sellerContext";
import { getSellerWhatsAppConnection } from "../seller-actions";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

const CACHE_KEY = "tikchop:whatsappConnected";
const DISMISS_KEY = "tikchop:setupResumeDismissed";

function readCache() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(CACHE_KEY);
}

export default function SetupResumeBanner() {
  const seller = useActiveSeller();
  const [connected, setConnected] = useState(() => (readCache() === "1" ? true : null));
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || !seller.slug) return;
    checkedRef.current = true;
    let alive = true;
    getSellerAccessToken()
      .then((token) => getSellerWhatsAppConnection(seller, token))
      .then((data) => {
        const isConnected = Boolean(data?.isConnected);
        if (!alive) return;
        setConnected(isConnected);
        window.sessionStorage.setItem(CACHE_KEY, isConnected ? "1" : "0");
      })
      .catch(() => {
        if (alive) setConnected(false);
      });
    return () => { alive = false; };
  }, [seller]);

  if (connected === null || connected || dismissed) return null;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[18px] bg-[#E8F7EE] px-4 py-3 text-[#0F2B20] ring-1 ring-[#34D399]/35">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#059669] text-white">
        <Bot size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Configuration a terminer</p>
        <p className="text-xs font-bold text-[#577066]">Connectez WhatsApp et creez le style de DJASSAMAN.</p>
      </div>
      <Link
        href="/setup"
        className="flex shrink-0 items-center gap-1 rounded-full bg-[#0F2B20] px-3.5 py-2 text-xs font-black text-white no-underline"
      >
        Reprendre
      </Link>
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => {
          setDismissed(true);
          window.sessionStorage.setItem(DISMISS_KEY, "1");
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0F2B20]/40"
      >
        <X size={16} />
      </button>
    </div>
  );
}