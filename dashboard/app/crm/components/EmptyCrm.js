"use client";

import { UsersRound } from "lucide-react";

export function EmptyCrm({ query }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] bg-[#fbf9f4] p-8 text-center ring-1 ring-[#07120d]/8 md:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#008f5a] shadow-sm">
        <UsersRound size={30} />
      </div>
      <h2 className="mt-4 font-display text-xl font-black text-[#07120d]">{query ? "Aucun resultat" : "Aucun client"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-[#07120d]/50">Les premiers clients apparaitront apres commande.</p>
    </div>
  );
}