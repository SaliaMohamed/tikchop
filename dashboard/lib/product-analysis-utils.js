/**
 * Product analysis & bulk-parsing helpers (pure functions).
 */
import { ImagePlus, ListChecks, Loader2, Mic, Upload } from "lucide-react";
import { normalizeMoneyInput } from "./product-utils";
import { getProductProfile } from "./product-profiles";
import { normalizeSpokenText } from "./voice-parsing";

// Kept only as a rollback reference for older mojibake voice parsing.
export function canSingleProductSubmit(formData, imageUploading, imageAnalyzing) {
  return Boolean(formData.seller_id && formData.image_url && formData.name && formData.price && Number(normalizeMoneyInput(formData.price)) > 0 && !imageUploading && !imageAnalyzing);
}

export async function runLimited(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });

  await Promise.all(workers);
}

export function chunkArray(items = [], size = 6) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function inferProductNameFromFile(filename) {
  const clean = String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/img|image|photo|screenshot|whatsapp|dsc|pxl/gi, " ")
    .replace(/\bat\b|\bjpeg\b|\bjpg\b|\bpng\b/gi, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 3 || /^(at|\(?\d+\)?|wa)$/i.test(clean)) return "";

  return clean
    .split(" ")
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function buildBulkAnalysisHint(preset = {}, profile = getProductProfile("general")) {
  return [
    profile?.keywords ? `Type de boutique: ${profile.keywords}` : "",
    String(preset.product_keywords || "").trim() ? `Contexte du lot: ${String(preset.product_keywords).trim()}` : "",
    String(preset.size || "").trim() ? `Tailles ou formats habituels du lot: ${String(preset.size).trim()}` : "",
    "Objectif: creer rapidement des fiches vendables, avec noms courts.",
    "Ne nomme jamais le decor: fleurs, jardin, table, sol, mur, lit, main, sac plastique, cintre ou mannequin ne sont pas le produit sauf si le vendeur l'indique.",
    "Si le produit est petit sur un fond charge, privilegie l'objet vendu probable.",
    "Ne suppose pas que ce sont des vetements: adapte-toi au type de boutique et au contexte du lot.",
  ].filter(Boolean).join("\n");
}

export function buildItemAnalysisHint(item = {}, preset = {}, profile = getProductProfile("general")) {
  return [
    buildBulkAnalysisHint(preset, profile),
    String(item.description || "").trim() ? `Note déjà saisie sur cet article: ${String(item.description).trim()}` : "",
    String(item.name || "").trim() ? `Nom provisoire actuel: ${String(item.name).trim()}` : "",
  ].filter(Boolean).join("\n");
}

export function reviewBulkAnalysis(item) {
  const confidence = Number(item?.confidence || 0);

  if (!item?.name && item?.category) {
    return {
      ...item,
      name: item.category,
      reviewNotice: "",
    };
  } else if (confidence > 0 && confidence < 0.55) {
    return {
      ...item,
      reviewNotice: "",
    };
  }

  return {
    ...item,
    reviewNotice: "",
  };
}

export function applyAnalysisToProduct(product, analysis) {
  const suggestedSizes = Array.isArray(analysis?.suggested_sizes)
    ? analysis.suggested_sizes.filter(Boolean).map(String).slice(0, 8)
    : [];
  const safeName = sanitizeAiProductName(analysis?.name);

  return {
    ...product,
    name: safeName || product.name,
    description: analysis?.description || product.description,
    category: analysis?.category || product.category || "",
    colors: Array.isArray(analysis?.colors) ? analysis.colors.filter(Boolean).map(String).slice(0, 5) : (product.colors || []),
    confidence: Number.isFinite(Number(analysis?.confidence)) ? Number(analysis.confidence) : (product.confidence || 0),
    size: product.size || analysis?.size || "",
    suggested_sizes: suggestedSizes,
  };
}

export function getFallbackProductName(item, profile = getProductProfile("general"), index = 0) {
  const currentName = sanitizeAiProductName(item?.name);
  if (currentName) return currentName;

  const base = profile?.shortLabel && profile.shortLabel !== "Articles"
    ? profile.shortLabel
    : profile?.categorySuggestions?.[0] || "Article";
  return `${base} ${Math.max(Number(index) + 1, 1)}`;
}

export function sanitizeAiProductName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (/(fleur|jardin|plante|decor|arriere-plan|background|photo whatsapp|image whatsapp)/i.test(lower)) {
    return "";
  }
  return clean.split(" ").slice(0, 5).join(" ");
}

export function buildDescription(description, size, extraImages = []) {
  const parts = [];
  if (size) parts.push(`Taille: ${size}`);
  if (description) parts.push(description);
  const cleanExtraImages = Array.from(new Set((extraImages || []).map((image) => String(image || "").trim()).filter(Boolean)));
  if (cleanExtraImages.length > 0) {
    parts.push(`[[TIKCHOP_EXTRA_IMAGES:${cleanExtraImages.map(encodeURIComponent).join("|")}]]`);
  }
  return parts.join("\n");
}

export function buildVariantText(size, stock) {
  const cleanSize = String(size || "").trim();
  if (!cleanSize) return "";
  return `${cleanSize} stock ${Number(stock || 0)}`;
}

export function mergeKeywords(...values) {
  return Array.from(new Set(values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter(Boolean)))
    .join(", ");
}

export function formatConfidence(confidence) {
  const numeric = Number(confidence || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "A confirmer";
  if (numeric >= 0.85) return "Tres probable";
  if (numeric >= 0.65) return "Probable";
  return "À vérifier";
}

export function inferProductKind(product) {
  const source = [
    product?.category,
    product?.name,
    product?.product_keywords,
    product?.description,
  ].join(" ").toLowerCase();

  if (/(robe|chemise|tee|t-shirt|pagne|jupe|pantalon|pull|veste|habit|friperie|vetement)/i.test(source)) {
    return "fashion";
  }
  if (/(chaussure|basket|sandale|talon|mocassin|sneaker|pointure)/i.test(source)) {
    return "shoes";
  }
  if (/(sac|handbag|pochette|cartable|valise)/i.test(source)) {
    return "bags";
  }
  if (/(creme|huile|maquillage|parfum|beaute|savon|shampoing)/i.test(source)) {
    return "beauty";
  }
  if (/(montre|bijou|collier|bracelet|bague|accessoire)/i.test(source)) {
    return "accessories";
  }

  return "general";
}

export function getProductFieldCopy(product, profile = getProductProfile("general")) {
  const kind = inferProductKind(product);

  if (kind === "shoes") {
    return {
      sizeLabel: "Pointure",
      sizePlaceholder: "38, 39, 42",
      quantityLabel: "Paires",
      categorySuggestions: ["Chaussures", "Baskets", "Sandales", "Talons"],
      priceSuggestions: ["12000", "18000", "25000"],
    };
  }

  if (kind === "bags") {
    return {
      sizeLabel: "Format",
      sizePlaceholder: "Petit, moyen, grand",
      quantityLabel: "Quantite",
      categorySuggestions: ["Sacs", "Pochettes", "Cartables", "Valises"],
      priceSuggestions: ["8000", "12000", "18000"],
    };
  }

  if (kind === "beauty") {
    return {
      sizeLabel: "Format",
      sizePlaceholder: "50 ml, 100 ml, pack",
      quantityLabel: "Quantite",
      categorySuggestions: ["Beaute", "Parfums", "Cremes", "Maquillage"],
      priceSuggestions: ["3000", "5000", "8000"],
    };
  }

  if (kind === "accessories") {
    return {
      sizeLabel: "Modele",
      sizePlaceholder: "Standard, lot, unique",
      quantityLabel: "Quantite",
      categorySuggestions: ["Accessoires", "Bijoux", "Montres", "Lunettes"],
      priceSuggestions: ["5000", "10000", "15000"],
    };
  }

  return {
    sizeLabel: profile.sizeLabel,
    sizePlaceholder: profile.sizePlaceholder,
    quantityLabel: profile.quantityLabel,
    categorySuggestions: profile.categorySuggestions,
    priceSuggestions: profile.priceSuggestions,
  };
}

export function isBulkItemReady(item) {
  return Boolean(item?.image_url && Number(normalizeMoneyInput(item?.price)) > 0);
}

export function getBulkReviewStats(items = []) {
  const uploaded = items.filter((item) => item.image_url).length;
  const priced = items.filter((item) => normalizeMoneyInput(item.price)).length;
  const backgrounds = items.filter((item) => item.background_image_url).length;
  const waiting = items.filter((item) => item.uploading || item.analyzing).length;
  const missingPrice = items.filter((item) => item.image_url && !normalizeMoneyInput(item.price)).length;
  const weakNames = items.filter((item) => item.image_url && (!item.name || (Number(item.confidence || 0) > 0 && Number(item.confidence || 0) < 0.55))).length;
  const failedUploads = items.filter((item) => item.uploadError).length;
  const incomplete = items.filter((item) => item.image_url && (!item.name || !normalizeMoneyInput(item.price))).length;
  return {
    uploaded,
    priced,
    backgrounds,
    waiting,
    missingPrice,
    weakNames,
    failedUploads,
    incomplete,
    remaining: waiting + incomplete + failedUploads,
  };
}

export function getBackgroundProgressLabel(progress, fallback = "Nettoyage...") {
  if (!progress?.total) return fallback;
  return `Fond propre ${Math.min(progress.done, progress.total)}/${progress.total}`;
}

export function getBackgroundProgressAdvice(progress) {
  if (!progress?.total) return "";
  if (progress.done < progress.total) {
    return `${progress.done}/${progress.total} photos nettoyées. Gardez la page ouverte.`;
  }
  if (progress.failed > 0) {
    return `${progress.total - progress.failed}/${progress.total} photos nettoyées. ${progress.failed} à garder en photo claire.`;
  }
  return `${progress.total}/${progress.total} photos nettoyées. Vous pouvez vérifier les prix.`;
}

export function getBulkItemName(item, index = 0) {
  const fallback = item?.category || item?.product_keywords || `Article ${index + 1}`;
  return String(item?.name || fallback).trim();
}

export function getBulkItemMeta(item) {
  if (item?.uploading) {
    return {
      label: "Photo en envoi",
      toneClass: "bg-[var(--info-soft)] text-[var(--info)]",
    };
  }

  if (item?.analyzing) {
    return {
      label: "Tikchop prepare",
      toneClass: "bg-[var(--info-soft)] text-[var(--info)]",
    };
  }

  if (!item?.price) {
    return {
      label: "Prix a ajouter",
      toneClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    };
  }

  return {
    label: "Pret",
    toneClass: "bg-[var(--surface-soft)] text-[var(--primary)]",
  };
}

export function getComparableProductText(item) {
  return normalizeSpokenText([
    item?.name,
    item?.category,
    Array.isArray(item?.colors) ? item.colors.join(" ") : "",
  ].filter(Boolean).join(" "));
}

export function getLikelyDuplicateHint(item, previousItem) {
  if (!item || !previousItem) return "";
  if (!item.image_url || !previousItem.image_url) return "";

  const current = getComparableProductText(item);
  const previous = getComparableProductText(previousItem);
  if (!current || !previous) return "";

  const currentWords = new Set(current.split(/\s+/).filter((word) => word.length > 3));
  const previousWords = new Set(previous.split(/\s+/).filter((word) => word.length > 3));
  const shared = [...currentWords].filter((word) => previousWords.has(word));

  if (shared.length >= 2 || current === previous) {
    return "On dirait un autre angle. Fusionner avec la photo precedente";
  }

  return "";
}

export function getAutoGroupKey(item) {
  return normalizeSpokenText([
    item?.name,
    item?.category,
    Array.isArray(item?.colors) ? item.colors.join(" ") : "",
  ].filter(Boolean).join(" "))
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["article", "femme", "homme", "modele", "couleur"].includes(word))
    .join(" ");
}

export function getWordSimilarity(left, right) {
  const leftWords = new Set(String(left || "").split(/\s+/).filter(Boolean));
  const rightWords = new Set(String(right || "").split(/\s+/).filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.min(leftWords.size, rightWords.size);
}

export function hasColorOverlap(left, right) {
  const leftColors = new Set((left?.colors || []).map((color) => normalizeSpokenText(color)).filter(Boolean));
  const rightColors = new Set((right?.colors || []).map((color) => normalizeSpokenText(color)).filter(Boolean));
  if (!leftColors.size || !rightColors.size) return false;
  return [...leftColors].some((color) => rightColors.has(color));
}

export function shouldAutoGroupProduct(primary, candidate) {
  if (!primary?.image_url || !candidate?.image_url) return false;
  if (primary.uploading || primary.analyzing || candidate.uploading || candidate.analyzing) return false;
  if (primary.uploadError || candidate.uploadError) return false;
  if (primary.price || candidate.price) return false;

  const primaryKind = inferProductKind(primary);
  const candidateKind = inferProductKind(candidate);
  if (primaryKind !== "general" && candidateKind !== "general" && primaryKind !== candidateKind) return false;

  const primaryKey = getAutoGroupKey(primary);
  const candidateKey = getAutoGroupKey(candidate);
  if (!primaryKey || !candidateKey) return false;

  const similarity = getWordSimilarity(primaryKey, candidateKey);
  const exactName = normalizeSpokenText(primary.name) && normalizeSpokenText(primary.name) === normalizeSpokenText(candidate.name);
  const sameCategory = normalizeSpokenText(primary.category) && normalizeSpokenText(primary.category) === normalizeSpokenText(candidate.category);

  if (exactName && (hasColorOverlap(primary, candidate) || sameCategory)) return true;
  if (similarity >= 0.82 && (hasColorOverlap(primary, candidate) || sameCategory)) return true;

  return false;
}

export function mergeBulkAngle(primary, angle) {
  const extraImage = angle.image_url || "";
  const extraPreview = angle.preview || angle.image_url || "";
  const extraImages = extraImage ? [...(primary.extra_images || []), extraImage] : (primary.extra_images || []);
  const extraPreviews = extraPreview ? [...(primary.extra_previews || []), extraPreview] : (primary.extra_previews || []);

  return {
    ...primary,
    description: primary.description || angle.description,
    suggested_sizes: Array.from(new Set([...(primary.suggested_sizes || []), ...(angle.suggested_sizes || [])])).slice(0, 8),
    colors: Array.from(new Set([...(primary.colors || []), ...(angle.colors || [])])).slice(0, 5),
    confidence: Math.max(Number(primary.confidence || 0), Number(angle.confidence || 0)),
    extra_images: extraImages,
    extra_previews: extraPreviews,
    reviewNotice: `Tikchop a regroupe ${extraImages.length + 1} photos qui semblent montrer le meme article. Separez si ce n'est pas correct.`,
  };
}

// ═══════════════════════════════════════════════════════════
// Extended analysis: auto-grouping, publish assistant & mobile copy
// ═══════════════════════════════════════════════════════════

export function autoGroupBulkPhotoItems(items = []) {
  const grouped = [];

  for (const item of items) {
    const matchIndex = grouped.findIndex((primary) => shouldAutoGroupProduct(primary, item));
    if (matchIndex === -1) {
      grouped.push(item);
      continue;
    }

    grouped[matchIndex] = mergeBulkAngle(grouped[matchIndex], item);
  }

  return grouped;
}

export function getPublishHint({
  mode,
  formData,
  bulkPhotoItems,
  bulkProducts,
  readyBulkPhotos,
  bulkUploading,
  imageUploading,
  imageAnalyzing,
}) {
  if (mode === "BULK") {
    if (bulkUploading) return "Les photos arrivent. Gardez cette page ouverte.";
    if (bulkPhotoItems.length === 0 && bulkProducts.length === 0) return "1. Ajoutez les photos.";
    if (readyBulkPhotos.length === 0 && bulkProducts.length === 0) return "2. Mettez le prix sur au moins une fiche.";
    if (bulkPhotoItems.length > readyBulkPhotos.length && readyBulkPhotos.length > 0) {
      const remaining = bulkPhotoItems.length - readyBulkPhotos.length;
      return `${remaining} fiche${remaining > 1 ? "s" : ""} peuvent attendre. Vous pouvez déjà publier les articles prêts.`;
    }
    return "3. Publiez, puis partagez la boutique.";
  }

  if (imageUploading) return "Photo en envoi. Gardez cette page ouverte.";
  if (imageAnalyzing) return "Tikchop propose le nom de l'article.";
  if (!formData.image_url) return "Ajoutez une photo depuis la galerie.";
  if (!formData.name) return "Confirmez le nom visible dans la boutique.";
  if (!formData.price) return "Ajoutez le prix de vente.";
  return "L'article est prêt. Publiez puis partagez.";
}

export function getSizeOptions(item) {
  const defaults = ["S", "M", "L", "XL", "38", "39", "40"];
  return Array.from(new Set([...(item.suggested_sizes || []), ...defaults].filter(Boolean).map(String))).slice(0, 10);
}

export function BatchReviewSummary({ items, backgroundProgress = null }) {
  const stats = getBulkReviewStats(items);
  const advice = stats.waiting > 0
    ? "Analyse en cours. Continuez a remplir les prix visibles."
    : stats.missingPrice > 0
      ? `${stats.missingPrice} prix a saisir avant de publier tout le lot.`
      : stats.weakNames > 0
        ? `${stats.weakNames} nom${stats.weakNames > 1 ? "s" : ""} à vérifier, mais vous pouvez déjà publier.`
        : "Le lot est propre. Les articles prêts peuvent être publiés.";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <BatchMetric label="Photos" value={`${stats.uploaded}/${items.length}`} tone={stats.uploaded === items.length ? "green" : "blue"} />
        <BatchMetric label="Prix" value={`${stats.priced}/${items.length}`} tone={stats.priced === items.length ? "green" : "amber"} />
        <BatchMetric label="Fond" value={`${stats.backgrounds}/${items.length}`} tone={stats.backgrounds > 0 ? "green" : "blue"} />
      </div>
      <div className="rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-5 text-[var(--text-dim)]">
        {backgroundProgress ? getBackgroundProgressAdvice(backgroundProgress) : advice}
        {stats.failedUploads > 0 ? ` ${stats.failedUploads} photo${stats.failedUploads > 1 ? "s" : ""} n'ont pas été envoyées.` : ""}
      </div>
    </div>
  );
}

export function BatchMetric({ label, value, tone }) {
  const toneClass = {
    green: "bg-[var(--surface-soft)] text-[var(--primary)]",
    amber: "bg-[var(--accent-soft)] text-[var(--accent)]",
    blue: "bg-[var(--info-soft)] text-[var(--info)]",
  }[tone];

  return (
    <div className={`rounded-2xl p-3 text-center ${toneClass}`}>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[0.65rem] font-extrabold uppercase">{label}</p>
    </div>
  );
}

export function ItemPill({ label, active = false, tone = "default" }) {
  const toneClass = tone === "info"
    ? "bg-[var(--info-soft)] text-[var(--info)]"
    : active
      ? "bg-[var(--surface-soft)] text-[var(--primary)]"
      : "bg-[var(--surface-mid)] text-[var(--text-dim)]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold ${toneClass}`}>
      {label}
    </span>
  );
}

export function parseBulkProducts(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const trailingStockMatch = line.match(/(?:stock|qte|dispo|disponibles?)\s*[:=]?\s*(\d+)/i);
      const leadingStockMatch = line.match(/\b(\d+)\s*(?:pieces?|articles?)\b/i);
      const dashQuantityMatch = line.match(/\s-+\s*(\d{1,2})\s*$/);
      const stockMatch = trailingStockMatch || leadingStockMatch || dashQuantityMatch;
      const stockRaw = stockMatch?.[1] || "";
      const body = stockMatch ? line.replace(stockMatch[0], "") : line;

      const currencyPrice = body.match(/(\d[\d\s.]*)\s*(f|fcfa|cfa|francs?)\b/i);
      const pricedWithoutCurrency = currencyPrice
        ? null
        : [...body.matchAll(/\d[\d\s.]*/g)]
          .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
          .find((match) => match.digits.length >= 3);

      const priceMatch = currencyPrice?.[1] || pricedWithoutCurrency?.raw || "";
      const priceRaw = priceMatch.replace(/[^\d]/g, "");
      const reservedParts = [currencyPrice?.[0], pricedWithoutCurrency?.raw, stockMatch?.[0]].filter(Boolean);
      let name = body;
      for (const part of reservedParts.sort((a, b) => (b?.length || 0) - (a?.length || 0))) {
        name = name.replace(part, " ");
      }

      return {
        name: name.replace(/[,;]\s*$/g, " ").replace(/\s*[-:;,]+\s*$/g, "").replace(/^[-:;,\s]+/g, "")
          .replace(/\s*[-:;,]\s*(?=\s*$)/g, "")
          .replace(/\s+/g, " ")
          .trim(),
        price: priceRaw || "0",
        stock_quantity: stockRaw || "1",
      };
    })
    .filter((product) => product.name && Number(product.price) > 0);
}

export function getPublishAssistant({
  mode,
  canSubmit,
  formData,
  bulkPhotoItems,
  bulkProducts,
  readyBulkPhotos,
  bulkUploading,
  imageUploading,
  imageAnalyzing,
  onPhoto,
  onBulkPhoto,
  onDetails,
  onPublish,
  onVoice,
}) {
  if (mode === "BULK") {
    if (bulkUploading) {
      return {
        step: "Photos",
        title: "Les photos arrivent",
        body: "Gardez cette page ouverte. Tikchop cree une fiche par image.",
        label: "Envoi en cours",
        icon: <Loader2 className="animate-spin" size={20} />,
        disabled: true,
      };
    }

    if (bulkPhotoItems.length === 0 && bulkProducts.length === 0) {
      return {
        step: "1",
        title: "Ajoutez les photos du lot",
        body: "Ouvrez la galerie. Une photo devient une fiche produit.",
        label: "Ouvrir la galerie",
        icon: <ImagePlus size={20} />,
        onClick: onBulkPhoto,
        strong: true,
      };
    }

    if (!canSubmit) {
      return {
        step: "2",
        title: "Validez les prix",
        body: `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length} article pret. Ajoutez surtout le prix.`,
        label: "Completer les fiches",
        icon: <ListChecks size={20} />,
        onClick: onDetails,
      };
    }

    return {
      step: "3",
      title: "Le lot est pret",
      body: `${readyBulkPhotos.length || bulkProducts.length} article${(readyBulkPhotos.length || bulkProducts.length) > 1 ? "s" : ""} peuvent etre publies puis partages.`,
      label: "Publier maintenant",
      icon: <Upload size={20} />,
      onClick: onPublish,
      strong: true,
    };
  }

  if (!formData.image_url) {
    return {
      step: "1",
      title: "Commencez par la photo",
      body: "Une photo claire suffit pour commencer.",
      label: "Ouvrir la galerie",
      icon: <ImagePlus size={20} />,
      onClick: onPhoto,
    };
  }

  if (imageUploading || imageAnalyzing) {
    return {
      step: "Auto",
      title: imageUploading ? "Photo en envoi" : "Tikchop prepare la fiche",
      body: "Patientez quelques secondes. Le nom peut se remplir automatiquement.",
      label: "Analyse en cours",
      icon: <Loader2 className="animate-spin" size={20} />,
      disabled: true,
    };
  }

  if (!formData.name || !formData.price) {
    return {
      step: "2",
      title: "Validez le nom et le prix",
      body: "Le prix est obligatoire. Les details peuvent attendre.",
      label: mode === "VOICE" ? "Dicter les infos" : "Completer les infos",
      icon: mode === "VOICE" ? <Mic size={20} /> : <ListChecks size={20} />,
      onClick: mode === "VOICE" ? onVoice : onDetails,
    };
  }

  return {
    step: "3",
    title: "Article pret a vendre",
      body: `${formData.name} peut etre publie puis partage.`,
    label: "Mettre en ligne",
    icon: <Upload size={20} />,
    onClick: onPublish,
    strong: true,
  };
}

