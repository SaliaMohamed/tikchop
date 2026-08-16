"use client";

import Link from "next/link";
import { Phone, Share2, Truck } from "lucide-react";
export function DriverSharePanel({ availableDrivers, order, onShare }) {
  const assignedDriverId = order.delivery_driver_id;

  return (
    <div className="mt-3 rounded-[22px] bg-[#091D14] p-3 text-white shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[#091D14]">
          <Truck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/50">Fiche livreur WhatsApp</p>
          <h4 className="mt-1 font-display text-lg font-bold text-white">Envoyer la fiche</h4>
          <p className="mt-1 text-sm font-semibold leading-5 text-white/66">
            Le livreur recoit client, adresse, articles, total, frais a encaisser et lien recu.
          </p>
        </div>
      </div>

      {availableDrivers.length === 0 ? (
        <Link href="/delivery-settings" className="mt-3 flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-[#091D14] no-underline">
          <Phone size={17} />
          Ajouter un livreur WhatsApp
        </Link>
      ) : (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {availableDrivers.map((driver) => (
            <button
              key={driver.id}
              type="button"
              onClick={() => onShare(driver)}
              className={`min-h-[54px] shrink-0 rounded-2xl px-4 text-left text-sm font-extrabold ring-1 ${
                assignedDriverId === driver.id
                  ? "bg-[var(--primary-bright)] text-[#091D14] ring-[var(--primary-bright)]"
                  : "bg-white/10 text-white ring-white/14"
              }`}
            >
              <span className="block">{driver.name}</span>
              <span className={`block text-xs font-bold ${assignedDriverId === driver.id ? "text-[#15382C]" : "text-white/48"}`}>
                {assignedDriverId === driver.id ? "Déjà envoyé" : (driver.zone || "Toutes zones")}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onShare()}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-extrabold text-white ring-1 ring-white/14"
      >
        <Share2 size={17} />
        Ouvrir WhatsApp sans choisir
      </button>
    </div>
  );
}
