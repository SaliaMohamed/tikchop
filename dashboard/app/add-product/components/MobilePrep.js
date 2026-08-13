"use client";

import React from "react";
import { ArrowRight, Camera, ImagePlus, ListChecks, Sparkles } from "lucide-react";
import { PRODUCT_PROFILES } from "../../../lib/product-profiles";
import { StudioMiniButton } from "./AnalysisDeck";
import TikchopLottie from "../../components/TikchopLottie";

function MobileBulkPrepCard({
  preset,
  productProfile,
  productProfileId,
  hasPhotos,
  canRename = false,
  renamingAll = false,
  onChange,
  onProfileChange,
  onApplyIncomplete,
  onOpenGallery,
  onRenameAll,
}) {
  const presets = productProfile?.presets || [];
  const optionPresets = productProfile?.optionPresets || [];

  return (
    <section className="relative md:hidden">
      <div className="rounded-[28px] bg-white p-3 shadow-[0_14px_34px_rgb(43_34_25_/_0.06)] ring-1 ring-[#2b2219]/7">
        {!hasPhotos ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenGallery}
              className="flex min-h-[78px] w-full items-center justify-between gap-3 rounded-[24px] bg-[#2b2219] px-4 text-left text-white shadow-[0_16px_34px_rgb(43_34_25_/_0.18)] active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#f0954c] text-[#2b2219]">
                  <ImagePlus size={23} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-black">Choisir photos</span>
                  <span className="mt-0.5 block text-xs font-bold text-white/52">Galerie du telephone</span>
                </span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-[#f0954c]" />
            </button>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {PRODUCT_PROFILES.map((profile) => {
                const active = productProfileId === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => onProfileChange(profile.id)}
                    className={`min-h-[38px] shrink-0 rounded-full px-3 text-xs font-black ${
                      active ? "bg-[#c2572b] text-white" : "bg-[#fbf6ee] text-[#2b2219] ring-1 ring-[#2b2219]/8"
                    }`}
                  >
                    {profile.shortLabel || profile.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StudioMiniButton icon={<ImagePlus size={17} />} label="Photos" onClick={onOpenGallery} />
              <StudioMiniButton
                icon={renamingAll
                  ? <TikchopLottie name="sparkle" size={18} speed={1.5} ariaLabel="Tikchop renomme le lot" />
                  : <Sparkles size={17} />}
                label="IA"
                onClick={onRenameAll}
                disabled={!canRename || renamingAll}
                dark
              />
              <details className="group">
                <summary className="flex min-h-[58px] cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-[20px] bg-[#fbf6ee] text-xs font-black text-[#2b2219] ring-1 ring-[#2b2219]/7">
                  <ListChecks size={17} className="text-[#c2572b]" />
                  Type
                </summary>
                <div className="absolute left-4 right-4 z-20 mt-2 rounded-[24px] bg-white p-3 shadow-[0_20px_44px_rgb(43_34_25_/_0.16)] ring-1 ring-[#2b2219]/8">
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {PRODUCT_PROFILES.map((profile) => {
                      const active = productProfileId === profile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => onProfileChange(profile.id)}
                          className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                            active ? "bg-[#2b2219] text-white" : "bg-[#fbf6ee] text-[#2b2219] ring-1 ring-[#2b2219]/8"
                          }`}
                        >
                          {profile.shortLabel || profile.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={preset.product_keywords}
                    onChange={(event) => onChange((current) => ({ ...current, product_keywords: event.target.value }))}
                    placeholder={`Ex: ${(presets || []).slice(0, 2).join(", ").toLowerCase() || "articles"}`}
                    className="mt-2 min-h-[46px] w-full rounded-2xl bg-[#fbf6ee] px-3 text-sm font-bold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 focus:ring-[#c2572b]/35"
                  />
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={preset.size}
                      onChange={(event) => onChange((current) => ({ ...current, size: event.target.value }))}
                      placeholder={productProfile?.sizePlaceholder || "Option"}
                      className="min-h-[46px] rounded-2xl bg-[#fbf6ee] px-3 text-sm font-bold text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 focus:ring-[#c2572b]/35"
                    />
                    <button
                      type="button"
                      onClick={onApplyIncomplete}
                      className="min-h-[46px] rounded-2xl bg-[#2b2219] px-3 text-xs font-black text-white"
                    >
                      OK
                    </button>
                  </div>
                  {optionPresets.length > 0 && (
                    <div className="mt-2 no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {optionPresets.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => onChange((current) => ({ ...current, size: label }))}
                          className="shrink-0 rounded-full bg-[#faedde] px-3 py-2 text-xs font-black text-[#c2572b]"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MobileProductCockpit({ assistant, canSubmit, mode, onModeChange, readyCount, selectedCount, totalCount }) {
  const photosDone = selectedCount > 0;
  const total = totalCount || selectedCount || 0;
  const progress = photosDone ? Math.max(8, Math.round((readyCount / Math.max(total || selectedCount, 1)) * 100)) : 0;
  const mobileModes = [
    { value: "BULK", label: "Plusieurs", icon: <ImagePlus size={18} strokeWidth={2.8} /> },
    { value: "MANUAL", label: "Simple", icon: <Camera size={18} strokeWidth={2.8} /> },
  ];

  return (
    <section className="md:hidden">
      <div className="rounded-[30px] bg-[#2b2219] p-3 text-white shadow-[0_22px_48px_rgb(43_34_25_/_0.18)]">
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-[20px] bg-white/8 p-1 ring-1 ring-white/10">
            {mobileModes.map((option) => {
              const active = mode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onModeChange(option.value)}
                  aria-label={`Mode ${option.label}`}
                  title={`Mode ${option.label}`}
                  className={`flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-[15px] px-2 text-sm font-black transition active:scale-[0.98] ${
                    active
                      ? "bg-[#f0954c] text-[#2b2219] shadow-[0_12px_28px_rgb(240,149,76_/_0.18)]"
                      : "bg-transparent text-white/58"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={assistant.onClick}
            disabled={assistant.disabled}
            className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-[18px] bg-white px-3 text-sm font-black text-[#2b2219] shadow-[0_12px_24px_rgb(0_0_0_/_0.16)] disabled:opacity-60"
          >
            {React.cloneElement(assistant.icon, { strokeWidth: 2.75 })}
            {canSubmit ? "Publier" : photosDone ? "Suivant" : "Photos"}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <span className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-white/52">
            <Camera size={14} />
            Articles
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-[#f0954c]">
            {photosDone ? `${readyCount}/${total || selectedCount}` : "0"}
          </span>
        </div>
        <div className="mt-2 overflow-hidden rounded-full bg-white/10">
          <span className="block h-2 rounded-full bg-[#f0954c]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

export { MobileBulkPrepCard, MobileProductCockpit };
