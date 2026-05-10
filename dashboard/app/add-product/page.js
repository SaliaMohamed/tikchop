"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Camera,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDollarSign,
  ImagePlus,
  Layers3,
  ListChecks,
  Loader2,
  MessageCircle,
  Mic,
  PackagePlus,
  Ruler,
  Sparkles,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { addProduct, addProductsBulk, analyzeProductImage, uploadProductImage } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
}

export default function AddProductPage() {
  const activeSeller = useActiveSeller();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [publishResult, setPublishResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [bulkListeningId, setBulkListeningId] = useState("");
  const [expandedBulkItemId, setExpandedBulkItemId] = useState("");
  const [mode, setMode] = useState("BULK");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreset, setBulkPreset] = useState({
    size: "",
    product_keywords: "",
  });
  const [bulkPhotoItems, setBulkPhotoItems] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "1",
    size: "",
    variants_text: "",
    product_keywords: "",
    category: "",
    colors: [],
    confidence: 0,
    suggested_sizes: [],
    description: "",
    image_url: "",
    seller_id: "",
  });

  useEffect(() => {
    if (activeSeller.id) {
      setFormData((current) => ({ ...current, seller_id: activeSeller.id }));
    }
  }, [activeSeller.id]);

  useEffect(() => {
    if (mode !== "BULK") return;
    if (bulkPhotoItems.length === 0) {
      setExpandedBulkItemId("");
      return;
    }

    if (!bulkPhotoItems.some((item) => item.id === expandedBulkItemId)) {
      const firstIncomplete = bulkPhotoItems.find((item) => !isBulkItemReady(item)) || bulkPhotoItems[0];
      setExpandedBulkItemId(firstIncomplete.id);
    }
  }, [bulkPhotoItems, expandedBulkItemId, mode]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setSubmitError("");

    try {
      const token = await getSellerAccessToken();
      let publishedCount = 1;
      if (mode === "BULK") {
        const photoProducts = bulkPhotoItems
          .filter((item) => item.image_url && item.name && item.price)
          .map((item) => ({
            name: item.name,
            price: item.price,
            stock_quantity: item.stock_quantity || 1,
            variants_text: item.variants_text || buildVariantText(item.size, item.stock_quantity),
            product_keywords: mergeKeywords(item.product_keywords, item.category, item.colors),
            image_url: item.image_url,
            description: buildDescription(item.description, item.size),
            seller_id: formData.seller_id,
          }));
        const textProducts = parseBulkProducts(bulkText).map((product) => ({
          ...product,
          seller_id: formData.seller_id,
        }));
        const products = photoProducts.length > 0 ? photoProducts : textProducts;
        await addProductsBulk(products, token);
        publishedCount = products.length;
      } else {
        await addProduct({
          ...formData,
          description: buildDescription(formData.description, formData.size),
          variants_text: formData.variants_text || buildVariantText(formData.size, formData.stock_quantity),
          product_keywords: mergeKeywords(formData.product_keywords, formData.category, formData.colors),
        }, token);
      }
      setPublishResult({
        count: publishedCount,
        sellerName: activeSeller.name,
        sellerSlug: activeSeller.slug,
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout du produit:", error);
      setSubmitError(friendlyError(error, "Article non publie. Verifiez surtout le prix, la taille et le stock."));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  }

  async function handleImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");
    setAnalysisError("");
    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));

    try {
      const payload = new FormData();
      payload.append("image", file);
      const result = await uploadProductImage(payload);
      setFormData((current) => ({ ...current, image_url: result.url }));
      setImagePreview(result.url);
      setImageAnalyzing(true);
      try {
        const analysis = await analyzeProductImage(result.url, formData.description);
        setFormData((current) => applyAnalysisToProduct(current, analysis));
      } catch (analysisFailure) {
        console.warn("Image analysis unavailable:", analysisFailure);
        setAnalysisError("Nom non propose. Completez les infos a la main.");
      } finally {
        setImageAnalyzing(false);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      setImageError(friendlyError(error, "Photo non envoyee. Choisissez une image plus legere ou une connexion plus stable."));
      setFormData((current) => ({ ...current, image_url: "" }));
      setImageAnalyzing(false);
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  async function handleBulkImageSelection(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type?.startsWith("image/"));
    if (files.length === 0) return;

    setImageError("");
    setBulkUploading(true);

    const pendingItems = files.map((file) => ({
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      image_url: "",
      name: "",
      price: "",
      size: "",
      category: "",
      colors: [],
      confidence: 0,
      suggested_sizes: [],
      description: "",
      stock_quantity: 1,
      uploading: true,
      analyzing: false,
      analysisError: "",
    }));

    setBulkPhotoItems((current) => [...current, ...pendingItems]);

    for (const [index, item] of pendingItems.entries()) {
      try {
        const payload = new FormData();
        const file = files[index];
        payload.append("image", file);
        const result = await uploadProductImage(payload);
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, image_url: result.url, preview: result.url, uploading: false, analyzing: true }
            : entry
        )));
        try {
          const analysis = await analyzeProductImage(result.url);
          setBulkPhotoItems((current) => current.map((entry) => (
            entry.id === item.id
              ? { ...applyAnalysisToProduct(entry, analysis), analyzing: false }
              : entry
          )));
        } catch (analysisFailure) {
          console.warn("Bulk image analysis unavailable:", analysisFailure);
          setBulkPhotoItems((current) => current.map((entry) => (
            entry.id === item.id
              ? { ...entry, analysisError: "Nom non propose. Completez a la main.", analyzing: false }
              : entry
          )));
        }
      } catch (error) {
        console.error("Bulk image upload error:", error);
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, uploadError: friendlyError(error, "Photo non envoyee."), uploading: false }
            : entry
        )));
      }
    }

    setBulkUploading(false);
    event.target.value = "";
  }

  function updateBulkPhotoItem(id, field, value) {
    setBulkPhotoItems((current) => current.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function removeBulkPhotoItem(id) {
    setBulkPhotoItems((current) => current.filter((item) => item.id !== id));
  }

  function applyBulkQuantity(quantity) {
    setBulkPhotoItems((current) => current.map((item) => ({
      ...item,
      stock_quantity: quantity,
      variants_text: buildVariantText(item.size, quantity) || item.variants_text,
    })));
  }

  function openNextIncompleteBulkItem() {
    const nextItem = bulkPhotoItems.find((item) => !isBulkItemReady(item)) || bulkPhotoItems[0];
    if (!nextItem) return;
    setExpandedBulkItemId(nextItem.id);
    document.getElementById("bulk-products")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function applyBulkPreset() {
    const cleanSize = String(bulkPreset.size || "").trim();
    const cleanKeywords = String(bulkPreset.product_keywords || "").trim();

    if (!cleanSize && !cleanKeywords) return;

    setBulkPhotoItems((current) => current.map((item) => ({
      ...item,
      size: cleanSize || item.size,
      variants_text: cleanSize ? buildVariantText(cleanSize, item.stock_quantity) || item.variants_text : item.variants_text,
      product_keywords: cleanKeywords || item.product_keywords || "",
    })));
  }

  function applyBulkPresetToIncomplete() {
    const cleanSize = String(bulkPreset.size || "").trim();
    const cleanKeywords = String(bulkPreset.product_keywords || "").trim();

    if (!cleanSize && !cleanKeywords) return;

    setBulkPhotoItems((current) => current.map((item) => {
      if (isBulkItemReady(item)) return item;

      return {
        ...item,
        size: cleanSize || item.size,
        variants_text: cleanSize ? buildVariantText(cleanSize, item.stock_quantity) || item.variants_text : item.variants_text,
        product_keywords: cleanKeywords || item.product_keywords || "",
      };
    }));
  }

  function markCurrentAndNext(currentId) {
    const currentIndex = bulkPhotoItems.findIndex((item) => item.id === currentId);
    if (currentIndex === -1) return;

    const nextIncomplete = bulkPhotoItems
      .slice(currentIndex + 1)
      .find((item) => !isBulkItemReady(item))
      || bulkPhotoItems.find((item) => !isBulkItemReady(item) && item.id !== currentId)
      || bulkPhotoItems[currentIndex + 1]
      || bulkPhotoItems[0];

    if (!nextIncomplete) return;

    setExpandedBulkItemId(nextIncomplete.id);
  }

  function applyVoiceText(text) {
    const parsed = parseVoiceProduct(text);
    setFormData((current) => ({
      ...current,
      name: parsed.name || current.name,
      price: parsed.price || current.price,
      stock_quantity: parsed.stock_quantity || current.stock_quantity || "1",
      size: parsed.size || current.size,
      variants_text: parsed.size ? buildVariantText(parsed.size, parsed.stock_quantity || current.stock_quantity || "1") : current.variants_text,
      description: text || current.description,
    }));
  }

  function startVoiceCapture() {
    setVoiceNotice("");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice("La dictee directe n'est pas disponible ici. Appuyez dans un champ puis utilisez le micro du clavier du telephone.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceNotice("Je n'ai pas bien entendu. Reessayez ou utilisez le micro du clavier.");
    };
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setVoiceNotice("");
      applyVoiceText(text);
    };
    recognition.start();
  }

  function applyBulkVoiceText(id, text) {
    const parsed = parseVoiceProduct(text);
    setBulkPhotoItems((current) => current.map((item) => (
      item.id === id
        ? {
          ...item,
          name: parsed.name || item.name,
          price: parsed.price || item.price,
          size: parsed.size || item.size,
          stock_quantity: parsed.stock_quantity || item.stock_quantity || 1,
          variants_text: parsed.size ? buildVariantText(parsed.size, parsed.stock_quantity || item.stock_quantity || 1) : item.variants_text,
          description: text || item.description,
        }
        : item
    )));
  }

  function startBulkVoiceCapture(id) {
    setVoiceNotice("");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice("La dictee directe n'est pas disponible ici. Appuyez dans le champ de l'article puis utilisez le micro du clavier.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setBulkListeningId(id);
    recognition.onend = () => setBulkListeningId("");
    recognition.onerror = () => {
      setBulkListeningId("");
      setVoiceNotice("Je n'ai pas bien entendu. Reessayez pour cet article ou ecrivez le prix a la main.");
    };
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setVoiceNotice("");
      applyBulkVoiceText(id, text);
    };
    recognition.start();
  }

  const sellers = activeSeller.id ? [activeSeller] : [];
  const bulkProducts = parseBulkProducts(bulkText);
  const readyBulkPhotos = bulkPhotoItems.filter((item) => item.image_url && item.name && item.price);
  const firstIncompleteBulkItem = bulkPhotoItems.find((item) => !isBulkItemReady(item)) || bulkPhotoItems[0] || null;
  const singleFieldCopy = getProductFieldCopy(formData);
  const publishCount = mode === "BULK" ? readyBulkPhotos.length || bulkProducts.length : canSingleProductSubmit(formData, imageUploading, imageAnalyzing) ? 1 : 0;
  const selectedCount = mode === "BULK" ? bulkPhotoItems.length || bulkProducts.length : formData.image_url ? 1 : 0;
  const progressLabel = mode === "BULK"
    ? `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length || 0} pret${readyBulkPhotos.length > 1 ? "s" : ""}`
    : formData.price ? "Prix pret" : formData.image_url ? "Photo prete" : "Photo attendue";
  const canSubmit = mode === "BULK"
    ? formData.seller_id && !bulkUploading && (readyBulkPhotos.length > 0 || bulkProducts.length > 0)
    : formData.seller_id && formData.image_url && formData.name && formData.price && !imageUploading && !imageAnalyzing;
  const dockHint = getPublishHint({
    mode,
    formData,
    bulkPhotoItems,
    bulkProducts,
    readyBulkPhotos,
    bulkUploading,
    imageUploading,
    imageAnalyzing,
  });
  const assistant = getPublishAssistant({
    mode,
    canSubmit,
    formData,
    bulkPhotoItems,
    bulkProducts,
    readyBulkPhotos,
    bulkUploading,
    imageUploading,
    imageAnalyzing,
    onPhoto: () => fileInputRef.current?.click(),
    onBulkPhoto: () => bulkFileInputRef.current?.click(),
    onDetails: () => {
      if (firstIncompleteBulkItem) {
        setExpandedBulkItemId(firstIncompleteBulkItem.id);
      }
      const target = document.getElementById("product-details") || document.getElementById("bulk-products");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    onPublish: () => formRef.current?.requestSubmit(),
    onVoice: startVoiceCapture,
  });

  function resetAfterPublish() {
    setPublishResult(null);
    setSubmitError("");
    setVoiceNotice("");
    setBulkText("");
    setBulkPhotoItems([]);
    setImagePreview("");
    setImageError("");
    setAnalysisError("");
    setFormData({
      name: "",
      price: "",
      stock_quantity: "1",
      size: "",
      variants_text: "",
      product_keywords: "",
      category: "",
      colors: [],
      confidence: 0,
      suggested_sizes: [],
      description: "",
      image_url: "",
      seller_id: activeSeller.id || "",
    });
  }

  if (publishResult) {
    return (
      <PublishSuccess
        result={publishResult}
        onAddMore={resetAfterPublish}
      />
    );
  }

  return (
    <div className="app-shell max-w-[1180px] pb-[calc(10rem+env(safe-area-inset-bottom,0px))] md:pb-10">
      <main className="space-y-5 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-6 md:space-y-0">
        <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)] md:min-h-[300px] md:rounded-[34px] md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <div className="absolute -right-10 bottom-0 hidden h-48 w-48 rounded-full bg-[var(--primary-bright)]/10 blur-3xl md:block" />
          <div className="relative z-10 md:flex md:min-h-[236px] md:flex-col md:justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="quiet-label text-white/55">Assistant article</p>
                <h1 className="mt-1 max-w-2xl font-display text-3xl font-bold leading-10 text-white md:text-5xl md:leading-[3.55rem]">Ajoutez vos articles sans vous perdre</h1>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--primary-bright)] md:h-16 md:w-16 md:rounded-[24px]">
                <Sparkles size={26} />
              </span>
            </div>
            <p className="mt-3 max-w-sm text-base font-semibold leading-6 text-white/72 md:max-w-2xl md:text-lg md:leading-7">
              Envoyez les photos. Tikchop prepare les fiches. Vous validez le prix, la taille et le stock avant publication.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <HeroMiniStat icon={<ImagePlus size={16} />} label={`${selectedCount} photo${selectedCount > 1 ? "s" : ""}`} />
              <HeroMiniStat icon={<Sparkles size={16} />} label="Auto" />
              <HeroMiniStat icon={<BadgeCheck size={16} />} label={progressLabel} />
            </div>
          </div>
        </section>

        <div className="md:hidden">
          <NextActionCard assistant={assistant} />
        </div>

        {submitError && (
          <NoticeBanner tone="danger" icon={<PackagePlus size={18} />} title="Publication bloquee" text={submitError} />
        )}

        {voiceNotice && (
          <NoticeBanner tone="info" icon={<Mic size={18} />} title="Option vocale" text={voiceNotice} />
        )}

        <form id="add-product-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6 md:space-y-7">
          {sellers.length > 1 && (
            <Field label="Boutique">
              <select name="seller_id" value={formData.seller_id} onChange={handleChange} required className="mobile-input">
                <option value="">Choisir la boutique</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
            </Field>
          )}

          {mode === "VOICE" && (
            <section className="app-card bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-main)]">Dicter les infos</p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">Ex: robe rouge 15000, taille M, quantite 1</p>
                </div>
                <button type="button" onClick={startVoiceCapture} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${listening ? "bg-red-500" : "bg-[var(--primary)]"}`} aria-label="Dicter le produit">
                  <Mic size={22} />
                </button>
              </div>
              <textarea
                value={formData.description}
                onChange={(event) => {
                  handleChange(event);
                  applyVoiceText(event.target.value);
                }}
                name="description"
                rows="2"
                placeholder="Dictez ou collez le texte du vocal ici..."
                className="mobile-input mt-4 resize-none"
              />
            </section>
          )}

          {mode === "BULK" && (
            <section className="space-y-4">
            <div className="rounded-[26px] border border-white/80 bg-white/95 p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.34)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-main)] text-[var(--primary-bright)]">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-[var(--text-main)]">Photos de vos articles</p>
                  <p className="text-sm leading-5 text-[var(--text-dim)]">Choisissez plusieurs photos. Ensuite, validez le prix, la taille et le stock fiche par fiche.</p>
                </div>
              </div>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBulkImageSelection}
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="mt-4 flex min-h-[92px] w-full items-center justify-between gap-3 rounded-[24px] bg-[var(--text-main)] px-4 text-left text-base font-bold text-white shadow-[var(--shadow-md)] active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                    {bulkUploading ? <Loader2 className="animate-spin" size={21} /> : <ImagePlus size={22} />}
                  </span>
                  <span>
                    <span className="block">{bulkUploading ? "Envoi des photos..." : "Choisir les photos"}</span>
                    <span className="block text-xs font-semibold text-white/58">Selection multiple depuis votre appareil</span>
                  </span>
                </span>
                <span className="rounded-full bg-[var(--primary-bright)] px-3 py-1 text-xs font-extrabold text-[var(--text-main)]">Recommande</span>
              </button>
              {bulkPhotoItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm">
                    <span className="font-semibold text-[var(--text-dim)]">Validation rapide</span>
                    <strong className="text-[var(--primary)]">{readyBulkPhotos.length}/{bulkPhotoItems.length}</strong>
                  </div>
                  <BatchReviewSummary items={bulkPhotoItems} />
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                    <button
                      type="button"
                      onClick={openNextIncompleteBulkItem}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[var(--text-main)] px-3 text-sm font-extrabold text-white"
                    >
                      <ListChecks size={16} />
                      Voir le prochain a completer
                    </button>
                    {[1, 2].map((quantity) => (
                      <button
                        key={quantity}
                        type="button"
                        onClick={() => applyBulkQuantity(quantity)}
                        className="flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] px-3 text-sm font-extrabold text-[var(--primary)]"
                      >
                        Qté {quantity}
                      </button>
                    ))}
                  </div>
                  <div id="bulk-products" className="space-y-3">
                  {bulkPhotoItems.map((item, index) => {
                    const itemFieldCopy = getProductFieldCopy(item);

                    return (
                    <article key={item.id} className="rounded-[24px] border border-[var(--outline)]/35 bg-white p-3 shadow-[0_14px_30px_rgb(16_24_20_/_0.07)]">
                      <button
                        type="button"
                        onClick={() => setExpandedBulkItemId((current) => current === item.id ? "" : item.id)}
                        className="w-full text-left"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-[20px] bg-[var(--surface-mid)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.preview} alt="" className="h-full w-full object-cover" />
                            {item.uploading && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                                <Loader2 className="animate-spin" size={22} />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-[var(--text-dim)]">Article {index + 1}</p>
                                <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold leading-6 text-[var(--text-main)]">
                                  {item.name || (item.analyzing ? "Nom en cours..." : "Nom a confirmer")}
                                </h3>
                                <p className={`mt-1 text-sm font-extrabold ${item.price ? "text-[var(--primary)]" : "text-[var(--accent)]"}`}>
                                  {item.price ? formatPrice(item.price) : "Prix a ajouter"}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold ${getBulkItemMeta(item).toneClass}`}>
                                  {getBulkItemMeta(item).label}
                                </span>
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-main)]">
                                  {expandedBulkItemId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ItemPill label={item.size ? `Taille ${item.size}` : "Taille a verifier"} active={Boolean(item.size)} />
                              <ItemPill label={`Qté ${item.stock_quantity || 1}`} active />
                              {item.category ? <ItemPill label={item.category} active tone="info" /> : null}
                              {item.product_keywords ? <ItemPill label="Infos auto" active tone="info" /> : null}
                              {item.analyzing && <ItemPill label="Tikchop prepare..." active tone="info" />}
                            </div>
                          </div>
                        </div>
                      </button>

                      {expandedBulkItemId === item.id && (
                        <div className="mt-4 space-y-3 border-t border-[var(--outline)]/20 pt-4">
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--text-dim)]">
                            <span>Ajoutez surtout le prix. Le reste peut rester simple.</span>
                            <button type="button" onClick={() => removeBulkPhotoItem(item.id)} className="shrink-0 font-extrabold text-red-600">
                              Retirer
                            </button>
                          </div>

                          <Field label="Nom affiche">
                            <input
                              value={item.name}
                              onChange={(event) => updateBulkPhotoItem(item.id, "name", event.target.value)}
                              placeholder={item.analyzing ? "Nom propose par Tikchop..." : "Ex: Robe pagne"}
                              className="mobile-input"
                            />
                          </Field>
                          <Field label="Prix de vente" icon={<CircleDollarSign size={17} />}>
                            <input
                              value={item.price}
                              onChange={(event) => updateBulkPhotoItem(item.id, "price", event.target.value)}
                              placeholder="15000"
                              inputMode="numeric"
                              className="min-h-[58px] w-full rounded-[20px] border border-[var(--primary)]/45 bg-[#fbfff9] px-4 font-display text-2xl font-extrabold text-[var(--primary)] outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_rgb(5_122_85_/_0.13)]"
                            />
                          </Field>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label={itemFieldCopy.sizeLabel} icon={<Ruler size={16} />}>
                              <input
                                value={item.size}
                                onChange={(event) => {
                                  updateBulkPhotoItem(item.id, "size", event.target.value);
                                  updateBulkPhotoItem(item.id, "variants_text", buildVariantText(event.target.value, item.stock_quantity));
                                }}
                                placeholder={itemFieldCopy.sizePlaceholder}
                                className="mobile-input"
                              />
                            </Field>
                            <Field label={itemFieldCopy.quantityLabel} icon={<Boxes size={16} />}>
                              <input
                                value={item.stock_quantity}
                                onChange={(event) => {
                                  updateBulkPhotoItem(item.id, "stock_quantity", event.target.value);
                                  updateBulkPhotoItem(item.id, "variants_text", buildVariantText(item.size, event.target.value));
                                }}
                                inputMode="numeric"
                                placeholder="1"
                                className="mobile-input"
                              />
                            </Field>
                          </div>
                          <button
                            type="button"
                            onClick={() => markCurrentAndNext(item.id)}
                            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-main)] text-sm font-extrabold text-white"
                          >
                            <CheckCircle2 size={16} />
                            Fiche OK, suivante
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}

                      {item.analysisError && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{item.analysisError}</p>
                      )}
                      {item.uploadError && (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{item.uploadError}</p>
                      )}
                    </article>
                  );})}
                  </div>
                </div>
              )}
            </div>
            </section>
          )}

          {mode !== "BULK" && (
            <section className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelection}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex min-h-[240px] w-full flex-col items-center justify-center overflow-hidden rounded-[22px] border p-0 text-center transition active:scale-[0.99] md:min-h-[280px] ${
                  formData.image_url ? "border-[var(--primary)] bg-white" : "border-[var(--line)] bg-white shadow-[var(--shadow-sm)]"
                }`}
              >
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Apercu produit" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <span className="absolute bottom-4 left-4 right-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-white/94 px-4 text-sm font-extrabold text-[var(--primary)] shadow-sm">
                    {imageUploading ? "Envoi de la photo..." : imageAnalyzing ? "Tikchop propose le nom..." : "Changer la photo"}
                    </span>
                  </>
                ) : (
                  <span className="flex w-full flex-col items-center px-6">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]">
                      <ImagePlus size={30} />
                    </span>
                    <span className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">Ouvrir la galerie</span>
                    <span className="mt-2 max-w-[17rem] text-sm leading-5 text-[var(--text-dim)]">Choisissez la photo la plus claire. Le nom sera propose automatiquement.</span>
                    <span className="mt-4 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-extrabold text-[var(--primary)]">Appuyez ici</span>
                  </span>
                )}
                {(imageUploading || imageAnalyzing) && (
                  <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-sm">
                    <Loader2 className="animate-spin" size={20} />
                  </span>
                )}
                {formData.image_url && !imageUploading && !imageAnalyzing && (
                  <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-sm">
                    <CheckCircle2 size={20} />
                  </span>
                )}
              </button>
              {imageError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {imageError}
                </p>
              )}
              {analysisError && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {analysisError}
                </p>
              )}
            </section>
          )}

          {mode !== "BULK" && (
            <div className="space-y-4">
              <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="quiet-label text-[var(--secondary)]">Aide Tikchop</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
                      {imageAnalyzing ? "Analyse en cours..." : formData.name ? "Nom propose a verifier" : "Ajoutez une photo pour que Tikchop propose le nom"}
                    </p>
                  </div>
                  {imageAnalyzing ? <Loader2 className="animate-spin text-[var(--primary)]" size={22} /> : <Sparkles className="text-[var(--primary)]" size={22} />}
                </div>
                <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] p-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Nom visible dans la boutique</p>
                  <input type="text" name="name" placeholder="Ex: Robe rouge" value={formData.name} onChange={handleChange} required className="mobile-input mt-2 bg-white" />
                </div>
                {(formData.category || formData.colors?.length > 0 || formData.confidence) && (
                  <div className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Lecture automatique</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-extrabold text-[var(--primary)]">
                        {formatConfidence(formData.confidence)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.category ? <ItemPill label={formData.category} active tone="info" /> : null}
                      {(formData.colors || []).map((color) => (
                        <ItemPill key={color} label={color} active />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData((current) => ({
                        ...current,
                        product_keywords: mergeKeywords(current.product_keywords, current.category, current.colors),
                      }))}
                      className="mt-3 flex min-h-[40px] items-center justify-center rounded-2xl bg-white px-3 text-xs font-extrabold text-[var(--text-main)]"
                    >
                      Garder ces infos pour la vente
                    </button>
                  </div>
                )}
                <div className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Rayon boutique</p>
                  <div className="mt-2 no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
                    {singleFieldCopy.categorySuggestions.map((category) => (
                      <QuickValueButton
                        key={category}
                        active={formData.category === category}
                        label={category}
                        onClick={() => setFormData((current) => ({ ...current, category }))}
                      />
                    ))}
                  </div>
                </div>
                {formData.description && (
                  <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--text-dim)]">
                    {formData.description}
                  </p>
                )}
              </section>

              <section id="product-details" className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="quiet-label text-[var(--primary)]">A valider</p>
                    <h2 className="mt-1 font-display text-xl font-bold text-[var(--text-main)]">Prix, taille, stock</h2>
                  </div>
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
                    Important
                  </span>
                </div>
                <button
                  type="button"
                  onClick={startVoiceCapture}
                  className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${listening ? "bg-red-500 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}
                >
                  <Mic size={18} />
                  {listening ? "J'ecoute..." : "Dicter au lieu d'ecrire"}
                </button>
                <div className="mt-4 space-y-3">
                  <Field label="Prix de vente" icon={<CircleDollarSign size={17} />}>
                    <input type="number" name="price" placeholder="15000" value={formData.price} onChange={handleChange} required min="0" className="mobile-input text-xl text-[var(--primary)]" />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    {singleFieldCopy.priceSuggestions.map((price) => (
                      <QuickValueButton key={price} active={formData.price === price} label={`${Number(price).toLocaleString("fr-FR")}`} onClick={() => setFormData((current) => ({ ...current, price }))} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={singleFieldCopy.sizeLabel} icon={<Ruler size={16} />}>
                      <input type="text" name="size" placeholder={singleFieldCopy.sizePlaceholder} value={formData.size} onChange={handleChange} className="mobile-input" />
                    </Field>
                    <Field label={singleFieldCopy.quantityLabel} icon={<Boxes size={16} />}>
                      <input type="number" name="stock_quantity" placeholder="1" value={formData.stock_quantity} onChange={handleChange} required min="0" className="mobile-input" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 5, 10].map((quantity) => (
                      <QuickValueButton
                        key={quantity}
                        active={String(formData.stock_quantity) === String(quantity)}
                        label={`${quantity}`}
                        onClick={() => setFormData((current) => ({
                          ...current,
                          stock_quantity: String(quantity),
                          variants_text: buildVariantText(current.size, quantity) || current.variants_text,
                        }))}
                      />
                    ))}
                  </div>
                  <Field label="Variantes">
                    <textarea name="variants_text" rows="2" placeholder="M rouge stock 2, L noir stock 1" value={formData.variants_text} onChange={handleChange} className="mobile-input resize-none" />
                  </Field>
                  <Field label="Infos pour retrouver l'article">
                    <input type="text" name="product_keywords" placeholder="chaussure, cuir, noir..." value={formData.product_keywords} onChange={handleChange} className="mobile-input" />
                  </Field>
                  {formData.suggested_sizes?.length > 0 && (
                    <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Tailles proposees</p>
                      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
                        {getSizeOptions(formData).map((size) => (
                          <QuickValueButton key={size} active={formData.size === size} label={size} onClick={() => setFormData((current) => ({ ...current, size }))} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {mode === "MANUAL" && (
                <Field label="Petit detail optionnel">
                  <textarea name="description" rows="3" placeholder="Ex: taille M disponible, tissu leger..." value={formData.description} onChange={handleChange} className="mobile-input resize-none" />
                </Field>
              )}
            </div>
          )}

          {mode !== "BULK" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-semibold text-[var(--text-main)]">Apercu</h2>
              <div className="app-card flex overflow-hidden">
                <div className="relative flex aspect-square w-1/3 shrink-0 items-center justify-center overflow-hidden bg-[var(--surface-mid)] text-[var(--outline)]">
                  {imagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                    </>
                  ) : (
                    <ImagePlus size={32} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                  <p className="truncate font-display text-xl font-semibold text-[var(--text-main)]">{formData.name || "Nouvel article"}</p>
                  <p className="mt-1 font-semibold text-[var(--primary)]">{formatPrice(formData.price)}</p>
                  {formData.category ? (
                    <span className="mt-2 self-start rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-extrabold text-[var(--primary)]">
                      {formData.category}
                    </span>
                  ) : null}
                  <span className="mt-2 self-start rounded bg-[var(--surface-mid)] px-2 py-1 text-xs font-semibold text-[var(--secondary)]">
                    {formData.size ? `Taille ${formData.size} - ` : ""}Stock: {formData.stock_quantity || 0}
                  </span>
                </div>
              </div>
            </section>
          )}

          <PublishDock
            loading={loading}
            canSubmit={canSubmit}
            mode={mode}
            count={publishCount}
            hint={dockHint}
          />
        </form>
        </div>

        <aside className="sticky top-[6.25rem] hidden space-y-4 md:block">
          <DesktopPublishPanel
            loading={loading}
            canSubmit={canSubmit}
            mode={mode}
            count={publishCount}
            hint={dockHint}
          />
        </aside>
      </main>
    </div>
  );
}

function parseVoiceProduct(text) {
  const originalText = String(text || "");
  const source = String(text || "").toLowerCase();
  const explicitPriceMatch = source.match(/(?:prix|a|à)\s*(\d[\d\s.]*)/i)
    || source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i);
  const quantityMatch = source.match(/(?:quantite|quantité|qte|stock|reste|il y a)\s*(\d+)/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const loosePriceMatch = explicitPriceMatch ? null : [...originalText.matchAll(/\d[\d\s.]*/g)]
    .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
    .find((match) => match.digits.length >= 4 || Number(match.digits) >= 1000);
  const price = explicitPriceMatch
    ? explicitPriceMatch[1].replace(/[^\d]/g, "")
    : loosePriceMatch?.digits || "";
  const priceTextToRemove = explicitPriceMatch?.[0] || loosePriceMatch?.raw || "";
  const name = originalText
    .replace(priceTextToRemove, "")
    .replace(/(?:prix|a|à)\s*(\d[\d\s.]*)/i, "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i, "")
    .replace(/(?:quantite|quantité|qte|stock|reste|il y a)\s*\d+/i, "")
    .replace(/(?:taille|size|pointure)\s*[a-z0-9]+/i, "")
    .replace(/[,.]/g, " ")
    .trim();

  return {
    name,
    price,
    size: sizeMatch?.[1]?.toUpperCase() || "",
    stock_quantity: quantityMatch?.[1] || "1",
  };
}

function canSingleProductSubmit(formData, imageUploading, imageAnalyzing) {
  return Boolean(formData.seller_id && formData.image_url && formData.name && formData.price && !imageUploading && !imageAnalyzing);
}

function applyAnalysisToProduct(product, analysis) {
  const suggestedSizes = Array.isArray(analysis?.suggested_sizes)
    ? analysis.suggested_sizes.filter(Boolean).map(String).slice(0, 8)
    : [];

  return {
    ...product,
    name: analysis?.name || product.name,
    description: analysis?.description || product.description,
    category: analysis?.category || product.category || "",
    colors: Array.isArray(analysis?.colors) ? analysis.colors.filter(Boolean).map(String).slice(0, 5) : (product.colors || []),
    confidence: Number.isFinite(Number(analysis?.confidence)) ? Number(analysis.confidence) : (product.confidence || 0),
    size: product.size || analysis?.size || suggestedSizes[0] || "",
    suggested_sizes: suggestedSizes,
  };
}

function buildDescription(description, size) {
  const parts = [];
  if (size) parts.push(`Taille: ${size}`);
  if (description) parts.push(description);
  return parts.join("\n");
}

function buildVariantText(size, stock) {
  const cleanSize = String(size || "").trim();
  if (!cleanSize) return "";
  return `${cleanSize} stock ${Number(stock || 0)}`;
}

function mergeKeywords(...values) {
  return Array.from(new Set(values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter(Boolean)))
    .join(", ");
}

function formatConfidence(confidence) {
  const numeric = Number(confidence || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "A confirmer";
  if (numeric >= 0.85) return "Tres probable";
  if (numeric >= 0.65) return "Probable";
  return "A verifier";
}

function inferProductKind(product) {
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

function getProductFieldCopy(product) {
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
    sizeLabel: "Taille",
    sizePlaceholder: "M, L, XL",
    quantityLabel: "Quantite",
    categorySuggestions: ["Vetements", "Chaussures", "Sacs", "Accessoires"],
    priceSuggestions: ["5000", "10000", "15000"],
  };
}

function isBulkItemReady(item) {
  return Boolean(item?.image_url && item?.name && item?.price);
}

function getBulkItemMeta(item) {
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

  if (!item?.name) {
    return {
      label: "Nom a verifier",
      toneClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    };
  }

  return {
    label: "Pret",
    toneClass: "bg-[var(--surface-soft)] text-[var(--primary)]",
  };
}

function getPublishHint({
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
    if (bulkPhotoItems.length === 0 && bulkProducts.length === 0) return "Etape 1: ouvrez votre galerie et choisissez les photos.";
    if (readyBulkPhotos.length === 0 && bulkProducts.length === 0) return "Etape 2: ouvrez une fiche puis ajoutez au moins le prix.";
    if (bulkPhotoItems.length > readyBulkPhotos.length && readyBulkPhotos.length > 0) {
      const remaining = bulkPhotoItems.length - readyBulkPhotos.length;
      return `${remaining} fiche${remaining > 1 ? "s" : ""} peuvent attendre. Vous pouvez deja publier les articles prets.`;
    }
    return "Tout est pret pour apparaitre dans la boutique.";
  }

  if (imageUploading) return "Photo en envoi. Gardez cette page ouverte.";
  if (imageAnalyzing) return "Tikchop propose le nom de l'article.";
  if (!formData.image_url) return "Ajoutez une photo depuis la galerie.";
  if (!formData.name) return "Confirmez le nom visible dans la boutique.";
  if (!formData.price) return "Ajoutez le prix de vente.";
  return "L'article est pret pour la boutique.";
}

function getSizeOptions(item) {
  const defaults = ["S", "M", "L", "XL", "38", "39", "40"];
  return Array.from(new Set([...(item.suggested_sizes || []), ...defaults].filter(Boolean).map(String))).slice(0, 10);
}

function BatchReviewSummary({ items }) {
  const missingPrice = items.filter((item) => item.image_url && !item.price).length;
  const missingName = items.filter((item) => item.image_url && !item.name).length;
  const analyzing = items.filter((item) => item.uploading || item.analyzing).length;
  const ready = items.filter((item) => item.image_url && item.name && item.price).length;

  return (
    <div className="grid grid-cols-3 gap-2">
      <BatchMetric label="Prets" value={ready} tone="green" />
      <BatchMetric label="Prix" value={missingPrice} tone={missingPrice > 0 ? "amber" : "green"} />
      <BatchMetric label="Auto" value={analyzing || missingName} tone={analyzing || missingName ? "blue" : "green"} />
    </div>
  );
}

function BatchMetric({ label, value, tone }) {
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

function ItemPill({ label, active = false, tone = "default" }) {
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

function parseBulkProducts(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s[-:]\s|,/).map((part) => part.trim()).filter(Boolean);
      const fallbackPrice = line.match(/(\d[\d\s.]*)\s*(f|fcfa|cfa)?$/i);
      const name = parts.length > 1 ? parts[0] : line.replace(fallbackPrice?.[0] || "", "").trim();
      const price = (parts[1] || fallbackPrice?.[1] || "").replace(/[^\d]/g, "");
      return {
        name,
        price,
        stock_quantity: 1,
      };
    })
    .filter((product) => product.name && product.price);
}

function getPublishAssistant({
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
        body: "Ouvrez la galerie et choisissez toutes les photos a vendre.",
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
        body: `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length} article pret. Le prix est le champ le plus important avant publication.`,
        label: "Completer les fiches",
        icon: <ListChecks size={20} />,
        onClick: onDetails,
      };
    }

    return {
      step: "3",
      title: "Le lot est pret",
      body: `${readyBulkPhotos.length || bulkProducts.length} article${(readyBulkPhotos.length || bulkProducts.length) > 1 ? "s" : ""} peuvent etre mis en ligne.`,
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
      body: mode === "VOICE"
        ? "Vous pouvez dicter les infos, mais il faut quand meme une photo pour vendre."
        : "Une photo claire aide Tikchop et rassure le client.",
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
      body: "Vous pouvez ecrire ou dicter. Le prix est obligatoire avant publication.",
      label: mode === "VOICE" ? "Dicter les infos" : "Completer les infos",
      icon: mode === "VOICE" ? <Mic size={20} /> : <ListChecks size={20} />,
      onClick: mode === "VOICE" ? onVoice : onDetails,
    };
  }

  return {
    step: "3",
    title: "Article pret a vendre",
    body: `${formData.name} peut apparaitre dans la boutique.`,
    label: "Mettre en ligne",
    icon: <Upload size={20} />,
    onClick: onPublish,
    strong: true,
  };
}

function NextActionCard({ assistant }) {
  return (
    <section className={`rounded-[20px] border p-4 shadow-[var(--shadow-sm)] ${assistant.strong ? "border-[var(--text-main)] bg-[var(--text-main)] text-white" : "border-[var(--line)] bg-white text-[var(--text-main)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${assistant.strong ? "bg-white text-[var(--text-main)]" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
          {assistant.step}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`quiet-label ${assistant.strong ? "text-white/55" : "text-[var(--primary)]"}`}>A faire maintenant</p>
          <h2 className="mt-1 font-display text-xl font-bold leading-7">{assistant.title}</h2>
          <p className={`mt-1 text-sm leading-5 ${assistant.strong ? "text-white/68" : "text-[var(--text-dim)]"}`}>{assistant.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={assistant.onClick}
        disabled={assistant.disabled}
        className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold active:scale-[0.99] disabled:opacity-70 ${
          assistant.strong ? "bg-[var(--primary-bright)] text-zinc-950" : "bg-[var(--text-main)] text-white"
        }`}
      >
        {assistant.icon}
        {assistant.label}
        {!assistant.disabled && <ArrowRight size={18} />}
      </button>
    </section>
  );
}

function StepChip({ done, step, label, icon, important = false }) {
  return (
    <div className={`rounded-2xl border px-2 py-3 ${done ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : important ? "border-[var(--primary)]/45 bg-white text-[var(--primary)]" : "border-[var(--outline)]/35 bg-white text-[var(--text-dim)]"}`}>
      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${done ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
        {done ? <CheckCircle2 size={16} strokeWidth={2.6} /> : icon || step}
      </span>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

function ProgressSteps({ mode, bulkPhotoItems, bulkProducts, readyBulkPhotos, formData }) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.34)] md:p-4">
      <div className="mb-3 hidden items-center justify-between md:flex">
        <div>
          <p className="quiet-label text-[var(--primary)]">Progression</p>
          <h2 className="font-display text-lg font-bold text-[var(--text-main)]">3 validations avant mise en ligne</h2>
        </div>
        <BadgeCheck className="text-[var(--primary)]" size={22} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-left">
        <StepChip done={mode === "BULK" ? bulkPhotoItems.length > 0 || bulkProducts.length > 0 : Boolean(formData.image_url)} step="1" label="Photos" icon={<ImagePlus size={15} />} />
        <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.name)} step="2" label="Fiches" icon={<Sparkles size={15} />} />
        <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.price)} step="3" label="Prix + stock" icon={<CircleDollarSign size={15} />} important />
      </div>
    </section>
  );
}

function AfterPublishStrip() {
  const items = [
    { icon: <BadgeCheck size={15} />, label: "Boutique mise a jour" },
    { icon: <MessageCircle size={15} />, label: "WhatsApp presente et encaisse" },
    { icon: <Truck size={15} />, label: "Commande envoyee au livreur" },
  ];

  return (
    <section className="rounded-[20px] border border-[var(--primary)]/15 bg-[var(--surface-soft)] p-3 shadow-[var(--shadow-sm)]">
      <p className="quiet-label text-[var(--primary)]">Apres publication</p>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-extrabold text-[var(--text-main)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--text-main)] text-[var(--primary-bright)]">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SellerShortcut({ icon, title, text }) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-white/92 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.26)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
        {icon}
      </span>
      <p className="mt-2 text-sm font-extrabold leading-4 text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-[0.68rem] font-bold leading-4 text-[var(--text-dim)]">{text}</p>
    </div>
  );
}

function ModeButton({ active, icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-[18px] border text-sm font-extrabold transition active:scale-[0.99] ${
        active ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]" : "border-[var(--outline)]/40 bg-white text-[var(--text-dim)] shadow-[var(--shadow-sm)]"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/12" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
        {icon}
      </span>
      <span>{label}</span>
      <span className={`text-[0.66rem] font-bold ${active ? "text-white/55" : "text-[var(--outline)]"}`}>{hint}</span>
    </button>
  );
}

function Field({ label, icon, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-main)]">
        {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--primary)]">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

function HeroMiniStat({ icon, label }) {
  return (
    <span className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl bg-white/10 px-2 text-xs font-extrabold text-white/82">
      {icon}
      {label}
    </span>
  );
}

function NoticeBanner({ tone = "info", icon, title, text }) {
  const classes = tone === "danger"
    ? "border-red-100 bg-red-50 text-red-800"
    : "border-[var(--info)]/15 bg-[var(--info-soft)] text-[var(--text-main)]";

  return (
    <div className={`flex items-start gap-3 rounded-[20px] border p-4 shadow-[var(--shadow-sm)] ${classes}`}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-current">
        {icon}
      </span>
      <div>
        <p className="text-sm font-extrabold">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-5 opacity-80">{text}</p>
      </div>
    </div>
  );
}

function QuickValueButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 min-w-10 shrink-0 rounded-xl px-3 text-sm font-extrabold ${
        active ? "bg-[var(--text-main)] text-white" : "bg-[var(--surface-soft)] text-[var(--text-dim)]"
      }`}
    >
      {label}
    </button>
  );
}

function PublishSuccess({ result, onAddMore }) {
  const shopHref = result.sellerSlug ? `/${result.sellerSlug}` : "/dashboard";

  return (
    <div className="app-shell min-h-screen pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <main className="flex min-h-[78vh] flex-col justify-center space-y-5">
        <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <span className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--primary-bright)] text-[var(--text-main)] shadow-sm">
            <CheckCircle2 size={32} />
          </span>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.14em] text-white/48">Article en ligne</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-[2.7rem] text-white">
            {result.count} article{result.count > 1 ? "s" : ""} publie{result.count > 1 ? "s" : ""}
          </h1>
          <p className="mt-3 text-base font-semibold leading-6 text-white/68">
            La boutique {result.sellerName || "Tikchop"} peut maintenant afficher ces produits aux clients.
          </p>
        </section>

        <section className="grid gap-3">
          <Link
            href={shopHref}
            className="flex min-h-[60px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary)] px-4 text-base font-extrabold text-white no-underline shadow-[0_14px_34px_rgba(0,108,73,0.22)]"
          >
            Voir la boutique
            <ArrowRight size={19} />
          </Link>
          <button
            type="button"
            onClick={onAddMore}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-white px-4 text-sm font-extrabold text-[var(--text-main)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35"
          >
            <ImagePlus size={18} />
            Ajouter encore
          </button>
          <Link
            href="/products"
            className="flex min-h-[52px] items-center justify-center rounded-[18px] bg-[var(--surface-soft)] px-4 text-sm font-extrabold text-[var(--primary)] no-underline"
          >
            Gerer les articles
          </Link>
        </section>
      </main>
    </div>
  );
}

function DesktopPublishPanel({ loading, canSubmit, mode, count, hint }) {
  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoutez les prix"
      : "Mettre en ligne";

  return (
    <section className="rounded-[24px] border border-[var(--text-main)] bg-[var(--text-main)] p-4 text-white shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="quiet-label text-white/50">Mise en vente</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-8">Publier sur la boutique</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${canSubmit ? "bg-[var(--primary-bright)] text-[var(--text-main)]" : "bg-white/10 text-white/70"}`}>
          {canSubmit ? "Pret" : "A completer"}
        </span>
      </div>
      {hint ? <p className="mt-3 text-sm font-semibold leading-5 text-white/64">{hint}</p> : null}
      <button
        form="add-product-form"
        type="submit"
        disabled={loading || !canSubmit}
        className={`mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-55 ${
          loading || !canSubmit ? "bg-white/14 text-white" : "bg-[var(--primary-bright)] text-[var(--text-main)] hover:translate-y-[-1px]"
        }`}
      >
        <Upload size={19} />
        {label}
        {!loading && canSubmit && <ArrowRight size={18} />}
      </button>
    </section>
  );
}

function PublishDock({ loading, canSubmit, mode, count, hint }) {
  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoutez les prix"
      : "Mettre en ligne";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-white/70 bg-white/92 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_44px_rgb(13_23_18_/_0.13)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto max-w-[460px]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <span>
            <span className="block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Mise en vente</span>
            {hint ? <span className="mt-1 block text-xs font-bold leading-4 text-[var(--text-dim)]">{hint}</span> : null}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${canSubmit ? "bg-[var(--surface-soft)] text-[var(--primary)]" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
            {canSubmit ? "Pret" : "A completer"}
          </span>
        </div>
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className={`flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[22px] text-base font-extrabold shadow-[0_14px_34px_rgba(0,108,73,0.22)] transition ${
            loading || !canSubmit ? "bg-[var(--outline)] text-white" : "bg-[var(--primary)] text-white active:scale-[0.98]"
          }`}
        >
          <Upload size={20} />
          {label}
          {!loading && canSubmit && <ArrowRight size={19} />}
        </button>
      </div>
    </div>
  );
}
