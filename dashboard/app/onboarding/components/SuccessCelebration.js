"use client";

import { CheckCircle2 } from "lucide-react";

const COLORS = ["#34D399", "#059669", "#e9b949", "#4e7db5", "#8065bb", "#f97316"];

const CONFETTI_PIECES = Array.from({ length: 36 }).map((_, index) => ({
  left: (index * 37) % 100,
  delay: (index % 7) * 0.1,
  duration: 2.1 + (index % 5) * 0.35,
  color: COLORS[index % COLORS.length],
  size: 6 + (index % 4) * 2,
  rotate: (index % 360),
}));

export function SuccessCelebration({ label = "Boutique créée !", sub = "Configuration de votre espace vendeur…" }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-[#0F2B20]/70 px-5 backdrop-blur-sm">
      <style>{`
        @keyframes tk-confetti-fall {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(112vh) rotate(720deg); opacity: 0.55; }
        }
      `}</style>
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute top-0 block rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.55,
            background: piece.color,
            animation: `tk-confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
          }}
        />
      ))}
      <div className="animate-pop-in flex flex-col items-center rounded-[32px] bg-white px-9 py-7 text-center shadow-2xl ring-1 ring-[#0F2B20]/8">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#E8F7EE] text-[#059669]">
          <CheckCircle2 size={32} strokeWidth={1.6} />
        </span>
        <h3 className="mt-4 font-display text-2xl font-black text-[#0F2B20]">{label}</h3>
        <p className="mt-2 max-w-[260px] text-sm font-bold leading-5 text-[#0F2B20]/50">{sub}</p>
      </div>
    </div>
  );
}