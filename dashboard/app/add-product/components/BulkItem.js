"use client";

import { ArrowRight, Boxes, Layers3, Loader2, Mic, Ruler, Sparkles } from "lucide-react";
import { normalizeMoneyInput } from "../../../lib/product-utils";
import { buildVariantText, getSizeOptions } from "../../../lib/product-analysis-utils";
import { ImageQualitySwitch } from "./ImageQuality";
import { Field, QuickValueButton } from "./SharedUI";

function BulkQuickPricePanel({ item, itemFieldCopy, onUpdate, onNext }) {
  const hasPrice = Boolean(normalizeMoneyInput(item.price));
  return (
    <section className="rounded-[26px] bg-[#2b2219] p-3 text-white shadow-[0_18px_40px_rgb(43_34_25_/_0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-white/48">Prix</p>
          <p className="mt-1 hidden text-xs font-bold leading-4 text-[var(--text-dim)] md:block">Le prix suffit pour publier cette fiche.</p>
        </div>
        {hasPrice ? (
          <span className="rounded-full bg-[#f0954c] px-3 py-1.5 text-xs font-black text-[#2b2219] shadow-sm">
            OK
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/60">
            ?
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.4rem] gap-2">
        <input
          value={item.price}
          onChange={(event) => onUpdate(item.id, "price", event.target.value)}
          placeholder="15000"
          inputMode="numeric"
          className="min-h-[60px] w-full rounded-[22px] border border-white/10 bg-white px-4 font-display text-2xl font-extrabold text-[#c2572b] outline-none focus:border-[#f0954c] focus:shadow-[0_0_0_4px_rgb(240,149,76_/_0.16)]"
        />
        <button
          type="button"
          onClick={() => onNext(item.id)}
          className="flex min-h-[60px] items-center justify-center rounded-[22px] bg-[#f0954c] text-[#2b2219] shadow-[0_14px_30px_rgb(240,149,76_/_0.18)] disabled:opacity-50"
          disabled={!hasPrice}
          aria-label="Valider cette fiche et passer a la suivante"
        >
          <ArrowRight size={20} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {itemFieldCopy.priceSuggestions.map((price) => (
          <QuickValueButton
            key={price}
            active={String(item.price || "") === String(price)}
            label={Number(price).toLocaleString("fr-FR")}
            onClick={() => onUpdate(item.id, "price", price)}
          />
        ))}
      </div>
    </section>
  );
}

function BulkItemMoreOptions({
  item,
  index,
  itemFieldCopy,
  bulkListeningId,
  onVoice,
  onReanalyze,
  onAttachPrevious,
  onSeparateLast,
  onImageVersionChange,
  onCleanBackground,
  backgroundBusy = false,
  onUpdate,
}) {
  return (
    <div className="mt-3 space-y-3">
      <ImageQualitySwitch
        cleanAvailable={Boolean(item.clean_image_url && item.original_image_url && item.clean_image_url !== item.original_image_url)}
        backgroundAvailable={Boolean(item.background_image_url)}
        backgroundBusy={backgroundBusy}
        value={item.image_version || "clean"}
        onChange={(version) => onImageVersionChange?.(item.id, version)}
        onCleanBackground={onCleanBackground ? () => onCleanBackground(item.id) : null}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onVoice(item.id)}
          className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-3 text-xs font-extrabold ${
            bulkListeningId === item.id ? "bg-red-500 text-white" : "bg-white text-[var(--primary)]"
          }`}
        >
          <Mic size={15} />
          {bulkListeningId === item.id ? "J'ecoute..." : "Dicter"}
        </button>
        <button
          type="button"
          onClick={() => onReanalyze(item.id)}
          disabled={!item.image_url || item.analyzing}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-extrabold text-[var(--info)] disabled:opacity-50"
        >
          {item.analyzing ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
          Relancer IA
        </button>
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={() => onAttachPrevious(item.id)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--outline)]/45 bg-white px-3 text-sm font-extrabold text-[var(--text-main)]"
        >
          <Layers3 size={16} />
          Meme article que la photo precedente
        </button>
      )}

      {(item.extra_previews || []).length > 0 && (
        <div className="rounded-2xl bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Autres angles gardes</p>
            <button
              type="button"
              onClick={() => onSeparateLast(item.id)}
              className="shrink-0 rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-[0.68rem] font-black text-[var(--primary)]"
            >
              Separer
            </button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {(item.extra_previews || []).slice(0, 6).map((preview, previewIndex) => (
              <span key={`${preview}-${previewIndex}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm">
                <img src={preview} alt="" className="h-full w-full object-cover" />
              </span>
            ))}
          </div>
        </div>
      )}

      <Field label="Nom affiche">
        <input
          value={item.name}
          onChange={(event) => onUpdate(item.id, "name", event.target.value)}
          placeholder={item.analyzing ? "Nom propose par Tikchop..." : "Ex: Robe pagne"}
          className="mobile-input bg-white"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={itemFieldCopy.sizeLabel} icon={<Ruler size={16} />}>
          <input
            value={item.size}
            onChange={(event) => {
              onUpdate(item.id, "size", event.target.value);
              onUpdate(item.id, "variants_text", buildVariantText(event.target.value, item.stock_quantity));
            }}
            placeholder={itemFieldCopy.sizePlaceholder}
            className="mobile-input bg-white"
          />
        </Field>
        <Field label={itemFieldCopy.quantityLabel} icon={<Boxes size={16} />}>
          <input
            value={item.stock_quantity}
            onChange={(event) => {
              onUpdate(item.id, "stock_quantity", event.target.value);
              onUpdate(item.id, "variants_text", buildVariantText(item.size, event.target.value));
            }}
            inputMode="numeric"
            placeholder="1"
            className="mobile-input bg-white"
          />
        </Field>
      </div>

      {item.suggested_sizes?.length > 0 && (
        <div className="rounded-2xl bg-white p-3">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Options proposees</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {getSizeOptions(item).map((size) => (
              <QuickValueButton
                key={size}
                active={String(item.size || "") === String(size)}
                label={size}
                onClick={() => {
                  onUpdate(item.id, "size", size);
                  onUpdate(item.id, "variants_text", buildVariantText(size, item.stock_quantity));
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { BulkQuickPricePanel, BulkItemMoreOptions };
