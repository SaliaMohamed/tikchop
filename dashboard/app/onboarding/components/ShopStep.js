"use client";

import { CheckCircle2, Loader2, MapPin, ShoppingBag, Store, Tag, X } from "lucide-react";
import { CI_CITIES, CI_CITY_COMMUNES, SHOP_CATEGORIES } from "../../../lib/onboarding-utils";
import { StepDots } from "./StepDots";

export function ShopStep({
  shopName,
  onShopNameChange,
  suggestedSlug,
  shopCategory,
  onShopCategory,
  shopCity,
  onShopCity,
  shopCommune,
  onShopCommune,
  canSubmit,
  saving,
  error,
  notice,
  onSubmit,
  onBack,
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F1F8F3] px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#0F2B20]/8 active:scale-95"
            aria-label="Retour"
          >
            <X size={16} className="text-[#0F2B20]" />
          </button>
          <StepDots current={1} total={2} />
        </div>

        <div className="mt-6">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#059669]">Étape 2 sur 2</p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#0F2B20]">Votre boutique</h1>
          <p className="mt-1.5 text-sm font-bold text-[#0F2B20]/50">
            Ces infos personnalisent votre boutique et votre bot WhatsApp.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mx-auto mt-6 w-full max-w-sm space-y-4">

        {/* Shop name */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#0F2B20]/8">
          <label htmlFor="onb-shop-name" className="flex min-h-[68px] cursor-text items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F7EE] text-[#059669]">
              <Store size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#059669]">Nom de la boutique</span>
              <input
                id="onb-shop-name"
                type="text"
                value={shopName}
                onChange={onShopNameChange}
                placeholder="Ex: Salia Fashion, Kemi Bijoux…"
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#0F2B20] outline-none placeholder:text-[#0F2B20]/30"
                autoComplete="organization"
              />
            </span>
            {shopName.trim().length >= 2 && <CheckCircle2 size={17} className="shrink-0 text-[#059669] ml-1" />}
          </label>
          {suggestedSlug && (
            <p className="px-4 pb-3 text-[0.65rem] font-bold text-[#0F2B20]/40">
              Lien : tikchop.com/<span className="text-[#059669]">{suggestedSlug}</span>
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-2">
            <Tag size={13} className="text-[#059669]" />
            <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#059669]">Que vendez-vous ?</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onShopCategory(cat.id)}
                className={`flex items-center gap-2.5 rounded-[18px] px-3 py-3 text-left text-sm font-black transition active:scale-[0.98] ring-1 ${
                  shopCategory === cat.id
                    ? "bg-[#0F2B20] text-[#34D399] ring-[#0F2B20]"
                    : "bg-white text-[#0F2B20] ring-[#0F2B20]/8 hover:ring-[#059669]/30"
                }`}
              >
                <span className="text-base leading-none">{cat.emoji}</span>
                <span className="leading-4">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#0F2B20]/8">
          <label htmlFor="onb-city" className="flex min-h-[58px] cursor-pointer items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F7EE] text-[#059669]">
              <MapPin size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#059669]">Ville principale</span>
              <select
                id="onb-city"
                value={shopCity}
                onChange={(e) => onShopCity(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-sm font-black text-[#0F2B20] outline-none"
              >
                <option value="">Choisir une ville…</option>
                {CI_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
          </label>
        </div>

        {/* Commune / precision zone */}
        {shopCity === "Abidjan" && (
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#0F2B20]/8">
            <label htmlFor="onb-commune" className="flex min-h-[58px] cursor-pointer items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F7EE] text-[#059669]">
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#059669]">Commune d&apos;Abidjan</span>
                <select
                  id="onb-commune"
                  value={shopCommune}
                  onChange={(e) => onShopCommune(e.target.value)}
                  className="mt-0.5 w-full bg-transparent text-sm font-black text-[#0F2B20] outline-none"
                >
                  <option value="">Choisir une commune…</option>
                  {CI_CITY_COMMUNES.Abidjan.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </span>
            </label>
          </div>
        )}

        {shopCity && shopCity !== "Abidjan" && (
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#0F2B20]/8">
            <label htmlFor="onb-commune" className="flex min-h-[58px] items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F7EE] text-[#059669]">
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#059669]">
                  {shopCity === "Autre" ? "Ville / localite" : "Commune / localite"}
                </span>
                <input
                  id="onb-commune"
                  type="text"
                  value={shopCommune}
                  onChange={(e) => onShopCommune(e.target.value)}
                  placeholder={shopCity === "Autre" ? "Precisez la ville…" : "Ex : Sorobango, Dioulakro…"}
                  className="mt-0.5 w-full bg-transparent text-sm font-black text-[#0F2B20] outline-none placeholder:text-[#0F2B20]/30"
                />
              </span>
            </label>
          </div>
        )}

        {/* Errors / Notices */}
        {error && (
          <div className="rounded-[18px] bg-amber-50 p-3.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-[18px] bg-emerald-50 p-3.5 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
            {notice}
          </div>
        )}

        {/* Submit */}
        <button
          id="onb-submit-btn"
          type="submit"
          disabled={saving || !canSubmit}
          className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#059669] text-base font-black text-white shadow-[0_16px_38px_rgba(5,150,105,0.25)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="animate-spin" size={19} /> : <ShoppingBag size={19} />}
          {saving ? "Création en cours…" : "Créer ma boutique"}
        </button>
      </form>

      <p className="mt-10 pb-4 text-center text-[0.62rem] font-bold text-[#0F2B20]/25">
        Tikchop · Espace vendeur
      </p>
    </div>
  );
}