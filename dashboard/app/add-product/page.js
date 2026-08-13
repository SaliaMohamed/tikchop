"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDollarSign,
  ImagePlus,
  Layers3,
  ListChecks,
  Loader2,
  Mic,
  PackagePlus,
  Ruler,
  Sparkles,
  Trash2,
} from "lucide-react";
import { addProduct, addProductsBulk, analyzeProductImage, analyzeProductImagesBatch, removeProductBackground, uploadProductImage } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { compressImage } from "../../lib/image-compressor";
import { getProductProfile, getStoredProductProfileId, storeProductProfileId } from "../../lib/product-profiles";
import { formatPrice, normalizeMoneyInput, normalizeStockInput } from "../../lib/product-utils";
import { parseVoiceProduct } from "../../lib/voice-parsing";
import {
  canSingleProductSubmit,
  chunkArray,
  inferProductNameFromFile,
  buildBulkAnalysisHint,
  buildItemAnalysisHint,
  reviewBulkAnalysis,
  applyAnalysisToProduct,
  getFallbackProductName,
  sanitizeAiProductName,
  buildDescription,
  buildVariantText,
  mergeKeywords,
  formatConfidence,
  getProductFieldCopy,
  isBulkItemReady,
  getBackgroundProgressLabel,
  getBackgroundProgressAdvice,
  getBulkItemName,
  getBulkItemMeta,
  getLikelyDuplicateHint,
  autoGroupBulkPhotoItems,
  getPublishAssistant,
  getPublishHint,
  getSizeOptions,
  parseBulkProducts,
  ItemPill,
} from "../../lib/product-analysis-utils";
import { MobileBulkPrepCard, MobileProductCockpit } from "./components/MobilePrep";
import { ImageQualitySwitch } from "./components/ImageQuality";
import { BulkQuickPricePanel, BulkItemMoreOptions } from "./components/BulkItem";
import { BatchReviewSummary, DesktopPublishPanel, PublishDock } from "./components/PublishPanels";
import { Field, HeroMiniStat, NoticeBanner, QuickValueButton, PublishSuccess } from "./components/SharedUI";
import { AngleDecisionCard } from "./components/AnalysisDeck";
import TikchopLottie from "../components/TikchopLottie";


const BACKGROUND_REMOVAL_ENABLED = process.env.NEXT_PUBLIC_BACKGROUND_REMOVAL_ENABLED === "true";

export default function AddProductPage() {
  const activeSeller = useActiveSeller();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkAnalyzingAll, setBulkAnalyzingAll] = useState(false);
  const [backgroundBusyId, setBackgroundBusyId] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [publishResult, setPublishResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [bulkListeningId, setBulkListeningId] = useState("");
  const [expandedBulkItemId, setExpandedBulkItemId] = useState("");
  const [bulkBackgroundProgress, setBulkBackgroundProgress] = useState(null);
  const [mode, setMode] = useState("BULK");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreset, setBulkPreset] = useState({
    size: "",
    product_keywords: "",
  });
  const [productProfileId, setProductProfileId] = useState("general");
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
    original_image_url: "",
    clean_image_url: "",
    image_version: "clean",
    seller_id: "",
    background_image_url: "",
  });

  useEffect(() => {
    if (activeSeller.id) {
      setFormData((current) => ({ ...current, seller_id: activeSeller.id }));
    }
  }, [activeSeller.id]);

  useEffect(() => {
    setProductProfileId(getStoredProductProfileId(activeSeller.slug || "default"));
  }, [activeSeller.slug]);

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
          .filter(isBulkItemReady)
          .map((item, index) => ({
            name: getBulkItemName(item, index),
            price: normalizeMoneyInput(item.price),
            stock_quantity: normalizeStockInput(item.stock_quantity),
            variants_text: item.variants_text || buildVariantText(item.size, item.stock_quantity),
            product_keywords: mergeKeywords(item.product_keywords, item.category, item.colors),
            image_url: item.image_url,
            description: buildDescription(item.description, item.size, item.extra_images),
            seller_id: formData.seller_id,
          }));
        const textProducts = parseBulkProducts(bulkText).map((product) => ({
          ...product,
          seller_id: formData.seller_id,
        }));
        const products = photoProducts.length > 0 ? photoProducts : textProducts;
        if (products.length === 0) {
          throw new Error("Aucune fiche prete. Ajoutez au moins un prix avant de publier.");
        }
        await addProductsBulk(products, token);
        publishedCount = products.length;
      } else {
        await addProduct({
          ...formData,
          price: normalizeMoneyInput(formData.price),
          stock_quantity: normalizeStockInput(formData.stock_quantity),
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
      setSubmitError(friendlyError(error, "Article non publie. Verifiez surtout le prix et le stock."));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "price"
      ? normalizeMoneyInput(value)
      : name === "stock_quantity"
        ? normalizeStockInput(value)
        : value;
    setFormData({ ...formData, [name]: nextValue });
  }

  async function handleImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");
    setAnalysisError("");
    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));

    try {
      const compressedFile = await compressImage(file);
      const payload = new FormData();
      payload.append("image", compressedFile);
      const result = await uploadProductImage(payload);
      const cleanUrl = result.cleanUrl || result.url;
      setFormData((current) => ({
        ...current,
        image_url: cleanUrl,
        original_image_url: result.url,
        clean_image_url: cleanUrl,
        background_image_url: "",
        image_version: cleanUrl && cleanUrl !== result.url ? "clean" : "original",
      }));
      setImagePreview(cleanUrl);
      setImageAnalyzing(true);
      try {
        const analysis = await analyzeProductImage(cleanUrl, formData.description);
        setFormData((current) => {
          const next = applyAnalysisToProduct(current, analysis);
          return {
            ...next,
            name: sanitizeAiProductName(next.name) || getFallbackProductName(next, productProfile, 0),
          };
        });
      } catch (analysisFailure) {
        console.warn("Image analysis unavailable:", analysisFailure);
        setFormData((current) => ({
          ...current,
          name: current.name || getFallbackProductName(current, productProfile, 0),
          category: current.category || productProfile.categorySuggestions?.[0] || "",
          product_keywords: mergeKeywords(current.product_keywords, productProfile.shortLabel),
        }));
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
      original_image_url: "",
      clean_image_url: "",
      background_image_url: "",
      image_version: "clean",
      name: inferProductNameFromFile(file.name),
      price: "",
      size: "",
      category: "",
      colors: [],
      confidence: 0,
      suggested_sizes: [],
      description: "",
      extra_images: [],
      extra_previews: [],
      stock_quantity: 1,
      uploading: true,
      analyzing: false,
      analysisError: "",
      reviewNotice: "",
    }));

    setBulkPhotoItems((current) => [...current, ...pendingItems]);

    const uploadedItems = [];

    await runLimited(pendingItems, 3, async (item, index) => {
      try {
        const file = files[index];
        const compressedFile = await compressImage(file);
        const payload = new FormData();
        payload.append("image", compressedFile);
        const result = await uploadProductImage(payload);
        const cleanUrl = result.cleanUrl || result.url;
        uploadedItems[index] = { id: item.id, image_url: cleanUrl };
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? {
              ...entry,
              image_url: cleanUrl,
              preview: cleanUrl,
              original_image_url: result.url,
              clean_image_url: cleanUrl,
              background_image_url: "",
              image_version: cleanUrl && cleanUrl !== result.url ? "clean" : "original",
              uploading: false,
              analyzing: true,
            }
            : entry
        )));
      } catch (error) {
        console.error("Bulk image upload error:", error);
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, uploadError: friendlyError(error, "Photo non envoyee."), uploading: false }
            : entry
        )));
      }
    });

    await analyzeUploadedBulkItems(uploadedItems.filter(Boolean));

    setBulkUploading(false);
    event.target.value = "";
  }

  async function analyzeUploadedBulkItems(uploadedItems) {
    if (uploadedItems.length === 0) return;

    await analyzeBulkItemsInBatches(uploadedItems, {
      notice: "Tikchop analyse le lot...",
    });
  }

  async function analyzeBulkItemsInBatches(itemsToAnalyze, options = {}) {
    const validItems = (itemsToAnalyze || []).filter((item) => item?.id && item?.image_url);
    if (validItems.length === 0) return;

    const batches = chunkArray(validItems, 6);

    for (const batch of batches) {
      setBulkPhotoItems((current) => current.map((entry) => (
        batch.some((item) => item.id === entry.id)
          ? { ...entry, analyzing: true, analysisError: "", reviewNotice: options.notice || "Tikchop prepare la fiche..." }
          : entry
      )));

      try {
        const analyses = await analyzeProductImagesBatch(
          batch.map((item) => item.image_url),
          buildBulkAnalysisHint(bulkPreset, productProfile),
        );

        setBulkPhotoItems((current) => {
          const analyzed = current.map((entry) => {
            const batchIndex = batch.findIndex((item) => item.id === entry.id);
            if (batchIndex === -1) return entry;

            const analysis = analyses?.[batchIndex] || {};
            const reviewed = reviewBulkAnalysis(applyAnalysisToProduct(entry, analysis));
            const entryIndex = current.findIndex((item) => item.id === entry.id);
            const name = sanitizeAiProductName(reviewed.name) || getFallbackProductName(reviewed, productProfile, entryIndex);

            return {
              ...reviewed,
              name,
              category: reviewed.category || productProfile.categorySuggestions?.[0] || "",
              product_keywords: mergeKeywords(reviewed.product_keywords, reviewed.category, productProfile.shortLabel),
              analyzing: false,
              analysisError: "",
              reviewNotice: sanitizeAiProductName(analysis?.name) ? "" : "Nom provisoire. Corrigez si besoin.",
            };
          });

          return autoGroupBulkPhotoItems(analyzed);
        });
      } catch (analysisFailure) {
        console.warn("Bulk batch image analysis unavailable:", analysisFailure);
        setBulkPhotoItems((current) => current.map((entry) => {
          const batchIndex = batch.findIndex((item) => item.id === entry.id);
          if (batchIndex === -1) return entry;
          const entryIndex = current.findIndex((item) => item.id === entry.id);

          return {
            ...entry,
            name: entry.name || getFallbackProductName(entry, productProfile, entryIndex),
            category: entry.category || productProfile.categorySuggestions?.[0] || "",
            product_keywords: mergeKeywords(entry.product_keywords, productProfile.shortLabel),
            analyzing: false,
            analysisError: "",
            reviewNotice: "Nom provisoire. Mettez le prix pour publier.",
          };
        }));
      }
    }
  }

  async function reanalyzeAllBulkPhotos() {
    const itemsToAnalyze = bulkPhotoItems.filter((item) => item.image_url && !item.uploading);
    if (itemsToAnalyze.length === 0 || bulkAnalyzingAll) return;

    setBulkAnalyzingAll(true);
    setBulkPhotoItems((current) => current.map((item) => (
      itemsToAnalyze.some((entry) => entry.id === item.id)
        ? { ...item, analyzing: true, analysisError: "", reviewNotice: "Tikchop renomme le lot..." }
        : item
    )));

    try {
      await analyzeBulkItemsInBatches(itemsToAnalyze, {
        notice: "Tikchop renomme le lot...",
      });
    } finally {
      setBulkAnalyzingAll(false);
    }
  }

  async function reanalyzeBulkPhotoItem(id, imageUrlOverride = "", options = {}) {
    const item = bulkPhotoItems.find((entry) => entry.id === id);
    const imageUrl = imageUrlOverride || item?.image_url;
    if (!imageUrl) return;

    setBulkPhotoItems((current) => current.map((entry) => (
      entry.id === id
        ? { ...entry, analyzing: true, analysisError: "", reviewNotice: options.silent ? entry.reviewNotice : "Tikchop relance l'analyse de cette photo." }
        : entry
    )));

    try {
      const analysis = await analyzeProductImage(imageUrl, buildItemAnalysisHint(item, bulkPreset, productProfile));
      setBulkPhotoItems((current) => current.map((entry, entryIndex) => {
        if (entry.id !== id) return entry;

        const reviewed = reviewBulkAnalysis(applyAnalysisToProduct(entry, analysis));
        return {
          ...reviewed,
          name: sanitizeAiProductName(reviewed.name) || getFallbackProductName(reviewed, productProfile, entryIndex),
          analyzing: false,
          analysisError: "",
        };
      }));
      setBulkPhotoItems((current) => autoGroupBulkPhotoItems(current));
    } catch (analysisFailure) {
      console.warn("Bulk image analysis unavailable:", analysisFailure);
      setBulkPhotoItems((current) => current.map((entry) => (
        entry.id === id
          ? {
            ...entry,
            name: entry.name || getFallbackProductName(entry, productProfile, current.findIndex((item) => item.id === id)),
            category: entry.category || productProfile.categorySuggestions?.[0] || "",
            product_keywords: mergeKeywords(entry.product_keywords, productProfile.shortLabel),
            analysisError: "",
            analyzing: false,
            reviewNotice: "Nom provisoire. Corrigez si besoin.",
          }
          : entry
      )));
    }
  }

  function updateBulkPhotoItem(id, field, value) {
    const nextValue = field === "price"
      ? normalizeMoneyInput(value)
      : field === "stock_quantity"
        ? normalizeStockInput(value)
        : value;
    setBulkPhotoItems((current) => current.map((item) => (
      item.id === id ? { ...item, [field]: nextValue, reviewNotice: "" } : item
    )));
  }

  function setSingleImageVersion(version) {
    const nextUrl = version === "original"
      ? formData.original_image_url || formData.image_url
      : version === "background"
        ? formData.background_image_url || formData.clean_image_url || formData.image_url
        : formData.clean_image_url || formData.image_url;
    setImagePreview(nextUrl);
    setFormData((current) => ({
      ...current,
      image_url: nextUrl,
      image_version: version,
    }));
  }

  function setBulkImageVersion(id, version) {
    setBulkPhotoItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextUrl = version === "original"
        ? item.original_image_url || item.image_url
        : version === "background"
          ? item.background_image_url || item.clean_image_url || item.image_url
          : item.clean_image_url || item.image_url;
      return {
        ...item,
        image_url: nextUrl,
        preview: nextUrl,
        image_version: version,
        reviewNotice: version === "original"
          ? "Photo originale gardee pour cet article."
          : version === "background"
            ? "Fond propre active pour la boutique."
          : "Photo claire activee pour la boutique.",
      };
    }));
  }

  async function cleanSingleBackground() {
    if (!formData.image_url || backgroundBusyId) return;

    setBackgroundBusyId("single");
    setImageError("");

    try {
      const result = await removeProductBackground(formData.image_url, { background: "warm" });
      const backgroundUrl = result.url || result.cleanUrl;
      setImagePreview(backgroundUrl);
      setFormData((current) => ({
        ...current,
        image_url: backgroundUrl,
        background_image_url: backgroundUrl,
        image_version: "background",
      }));
    } catch (error) {
      setImageError(friendlyError(error, "Fond propre pas disponible. Gardez la photo claire pour publier."));
    } finally {
      setBackgroundBusyId("");
    }
  }

  async function cleanBulkBackground(id) {
    const item = bulkPhotoItems.find((entry) => entry.id === id);
    if (!item?.image_url || backgroundBusyId) return;

    setBackgroundBusyId(id);

    try {
      const result = await removeProductBackground(item.image_url, { background: "warm" });
      const backgroundUrl = result.url || result.cleanUrl;
      setBulkPhotoItems((current) => current.map((entry) => (
        entry.id === id
          ? {
            ...entry,
            image_url: backgroundUrl,
            preview: backgroundUrl,
            background_image_url: backgroundUrl,
            image_version: "background",
            reviewNotice: "Fond propre active. Verifiez juste que l'article reste fidele.",
          }
          : entry
      )));
    } catch (error) {
      setBulkPhotoItems((current) => current.map((entry) => (
        entry.id === id
          ? { ...entry, reviewNotice: friendlyError(error, "Fond propre pas disponible. Gardez la photo claire.") }
          : entry
      )));
    } finally {
      setBackgroundBusyId("");
    }
  }

  async function cleanAllBulkBackgrounds() {
    const itemsToClean = bulkPhotoItems.filter((item) => item.image_url && !item.uploading && !item.background_image_url);
    if (itemsToClean.length === 0 || backgroundBusyId) return;

    setBackgroundBusyId("bulk-all");
    setBulkBackgroundProgress({ total: itemsToClean.length, done: 0, failed: 0 });
    setBulkPhotoItems((current) => current.map((entry) => (
      itemsToClean.some((item) => item.id === entry.id)
        ? { ...entry, reviewNotice: "Fond propre en preparation..." }
        : entry
    )));

    await runLimited(itemsToClean, 2, async (item) => {
      try {
        const result = await removeProductBackground(item.image_url, { background: "warm" });
        const backgroundUrl = result.url || result.cleanUrl;
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? {
              ...entry,
              image_url: backgroundUrl,
              preview: backgroundUrl,
              background_image_url: backgroundUrl,
              image_version: "background",
              reviewNotice: "Fond propre active. Verifiez juste la photo.",
            }
            : entry
        )));
        setBulkBackgroundProgress((current) => current ? { ...current, done: current.done + 1 } : current);
      } catch (error) {
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, reviewNotice: friendlyError(error, "Fond propre indisponible sur cette photo. Gardez la photo claire.") }
            : entry
        )));
        setBulkBackgroundProgress((current) => current ? { ...current, done: current.done + 1, failed: current.failed + 1 } : current);
      }
    });

    setBackgroundBusyId("");
    setTimeout(() => setBulkBackgroundProgress(null), 3500);
  }

  function removeBulkPhotoItem(id) {
    setBulkPhotoItems((current) => current.filter((item) => item.id !== id));
  }

  function attachBulkPhotoToPrevious(id) {
    const currentIndex = bulkPhotoItems.findIndex((item) => item.id === id);
    if (currentIndex <= 0) {
      setBulkPhotoItems((current) => current.map((item) => (
        item.id === id
          ? { ...item, reviewNotice: "Cette photo est deja la premiere. Gardez-la comme article principal." }
          : item
      )));
      return;
    }

    const previousId = bulkPhotoItems[currentIndex - 1].id;

    setBulkPhotoItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index <= 0) return current;

      const currentItem = current[index];
      const previousItem = current[index - 1];
      const extraImage = currentItem.image_url || "";
      const extraPreview = currentItem.preview || currentItem.image_url || "";
      const extraCount = (previousItem.extra_images || []).length + (extraImage ? 1 : 0);
      const mergedPrevious = {
        ...previousItem,
        extra_images: extraImage ? [...(previousItem.extra_images || []), extraImage] : (previousItem.extra_images || []),
        extra_previews: extraPreview ? [...(previousItem.extra_previews || []), extraPreview] : (previousItem.extra_previews || []),
        reviewNotice: `${extraCount} photo${extraCount > 1 ? "s" : ""} supplementaire${extraCount > 1 ? "s" : ""} ajoutee${extraCount > 1 ? "s" : ""}. Tikchop gardera un seul article.`,
      };

      return current
        .map((item, itemIndex) => (itemIndex === index - 1 ? mergedPrevious : item))
        .filter((_, itemIndex) => itemIndex !== index);
    });

    setExpandedBulkItemId(previousId);
  }

  function separateLastBulkAngle(id) {
    setBulkPhotoItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) return current;

      const item = current[index];
      const extraImages = [...(item.extra_images || [])];
      const extraPreviews = [...(item.extra_previews || [])];
      if (extraImages.length === 0 && extraPreviews.length === 0) return current;

      const imageUrl = extraImages.pop() || "";
      const preview = extraPreviews.pop() || imageUrl;
      const restored = {
        id: crypto.randomUUID(),
        preview,
        image_url: imageUrl,
        original_image_url: imageUrl,
        clean_image_url: imageUrl,
        image_version: "original",
        background_image_url: "",
        name: item.name ? `${item.name} - autre photo` : "Article a verifier",
        price: "",
        size: item.size || "",
        category: item.category || "",
        colors: item.colors || [],
        confidence: item.confidence || 0,
        suggested_sizes: item.suggested_sizes || [],
        description: item.description || "",
        extra_images: [],
        extra_previews: [],
        stock_quantity: item.stock_quantity || 1,
        uploading: false,
        analyzing: false,
        analysisError: "",
        reviewNotice: "Photo separee. Ajoutez le prix si c'est un nouvel article.",
      };
      const updated = {
        ...item,
        extra_images: extraImages,
        extra_previews: extraPreviews,
        reviewNotice: extraImages.length > 0
          ? `${extraImages.length} angle${extraImages.length > 1 ? "s" : ""} garde${extraImages.length > 1 ? "s" : ""}.`
          : "Photo separee. Cette fiche garde l'image principale.",
      };

      return [
        ...current.slice(0, index),
        updated,
        restored,
        ...current.slice(index + 1),
      ];
    });
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
      product_keywords: mergeKeywords(item.product_keywords, cleanKeywords),
      reviewNotice: item.reviewNotice || (cleanKeywords ? "Consigne du lot ajoutee a cette fiche." : ""),
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
        product_keywords: mergeKeywords(item.product_keywords, cleanKeywords),
        reviewNotice: item.reviewNotice || (cleanKeywords ? "Consigne du lot ajoutee a cette fiche." : ""),
      };
    }));
  }

  function markCurrentAndNext(currentId) {
    const currentIndex = bulkPhotoItems.findIndex((item) => item.id === currentId);
    if (currentIndex === -1) return;
    const currentItem = bulkPhotoItems[currentIndex];

    if (!normalizeMoneyInput(currentItem.price)) {
      setBulkPhotoItems((current) => current.map((item) => (
        item.id === currentId
          ? { ...item, reviewNotice: "Ajoutez seulement le prix pour passer a la fiche suivante." }
          : item
      )));
      return;
    }

    const nextIncomplete = bulkPhotoItems
      .slice(currentIndex + 1)
      .find((item) => !isBulkItemReady(item))
      || bulkPhotoItems.find((item) => !isBulkItemReady(item) && item.id !== currentId)
      || null;

    if (!nextIncomplete) {
      setExpandedBulkItemId("");
      document.getElementById("publish-dock")?.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    setExpandedBulkItemId(nextIncomplete.id);
  }

  function applyVoiceText(text) {
    const parsed = parseVoiceProduct(text);
    setFormData((current) => ({
      ...current,
      name: parsed.name || current.name,
      price: parsed.price ? normalizeMoneyInput(parsed.price) : current.price,
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
          price: parsed.price ? normalizeMoneyInput(parsed.price) : item.price,
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
  const productProfile = getProductProfile(productProfileId);
  const bulkProducts = parseBulkProducts(bulkText);
  const readyBulkPhotos = bulkPhotoItems.filter(isBulkItemReady);
  const cleanableBulkPhotos = bulkPhotoItems.filter((item) => item.image_url && !item.uploading && !item.background_image_url);
  const backgroundCleanedBulkPhotos = bulkPhotoItems.filter((item) => item.background_image_url);
  const firstIncompleteBulkItem = bulkPhotoItems.find((item) => !isBulkItemReady(item)) || bulkPhotoItems[0] || null;
  const singleFieldCopy = getProductFieldCopy(formData, productProfile);
  const publishCount = mode === "BULK" ? readyBulkPhotos.length || bulkProducts.length : canSingleProductSubmit(formData, imageUploading, imageAnalyzing) ? 1 : 0;
  const selectedCount = mode === "BULK" ? bulkPhotoItems.length || bulkProducts.length : formData.image_url ? 1 : 0;
  const progressLabel = mode === "BULK"
    ? `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length || 0} pret${readyBulkPhotos.length > 1 ? "s" : ""}`
    : formData.price ? "Prix pret" : formData.image_url ? "Photo prete" : "Photo attendue";
  const canSubmit = mode === "BULK"
    ? formData.seller_id && !bulkUploading && (readyBulkPhotos.length > 0 || bulkProducts.length > 0)
    : formData.seller_id && formData.image_url && formData.name && normalizeMoneyInput(formData.price) && !imageUploading && !imageAnalyzing;
  const mobileFocusBulkItemId = expandedBulkItemId || firstIncompleteBulkItem?.id || bulkPhotoItems[0]?.id || "";
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

  function changeProductProfile(profileId) {
    setProductProfileId(profileId);
    storeProductProfileId(profileId, activeSeller.slug || "default");
    const nextProfile = getProductProfile(profileId);
    setBulkPreset((current) => ({
      ...current,
      product_keywords: current.product_keywords || nextProfile.keywords,
    }));
  }

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
        <section className="relative hidden overflow-hidden rounded-[30px] bg-[var(--text-main)] p-4 text-white shadow-[var(--shadow-lg)] md:block md:min-h-[300px] md:rounded-[34px] md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <div className="absolute -right-10 bottom-0 hidden h-48 w-48 rounded-full bg-[var(--primary-bright)]/10 blur-3xl md:block" />
          <div className="relative z-10 md:flex md:min-h-[236px] md:flex-col md:justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="quiet-label text-white/55">Assistant article</p>
                <h1 className="mt-1 max-w-2xl font-display text-[2rem] font-bold leading-[2.35rem] text-white md:text-5xl md:leading-[3.55rem]">Mettez vos articles en ligne plus vite</h1>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--primary-bright)] md:h-16 md:w-16 md:rounded-[24px]">
                <Sparkles size={26} />
              </span>
            </div>
            <p className="mt-3 max-w-sm text-base font-semibold leading-6 text-white/72 md:max-w-2xl md:text-lg md:leading-7">
              Choisissez les photos. Tikchop propose les fiches, puis vous confirmez le prix et le stock.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <HeroMiniStat icon={<ImagePlus size={16} />} label={`${selectedCount} photo${selectedCount > 1 ? "s" : ""}`} />
              <HeroMiniStat icon={<Sparkles size={16} />} label="Auto" />
              <HeroMiniStat icon={<BadgeCheck size={16} />} label={progressLabel} />
            </div>
          </div>
        </section>

        <MobileProductCockpit
          assistant={assistant}
          canSubmit={canSubmit}
          mode={mode}
          onModeChange={setMode}
          readyCount={readyBulkPhotos.length || bulkProducts.length}
          selectedCount={selectedCount}
          totalCount={bulkPhotoItems.length || bulkProducts.length || selectedCount}
        />

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

          <section className="hidden rounded-[24px] border border-[var(--outline)]/35 bg-white p-2 shadow-[var(--shadow-sm)] md:block">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "BULK", label: "Photos", hint: "Plusieurs" },
                { value: "MANUAL", label: "Standard", hint: "A la main" },
                { value: "VOICE", label: "Vocal", hint: "Dicter" },
              ].map((option) => {
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={`min-h-[58px] rounded-[18px] px-2 text-center transition active:scale-[0.98] ${
                      active
                        ? "bg-[var(--text-main)] text-white shadow-sm"
                        : "bg-[var(--surface-soft)] text-[var(--text-main)]"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{option.label}</span>
                    <span className={`mt-0.5 block text-[0.66rem] font-bold ${active ? "text-white/58" : "text-[var(--text-dim)]"}`}>{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {mode === "VOICE" && (
            <section className="app-card bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-main)]">Dicter les infos</p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">Ex: savon 3000, stock 5 ou robe rouge 15000</p>
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
              <input
                ref={bulkFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBulkImageSelection}
              />
              <MobileBulkPrepCard
                preset={bulkPreset}
                productProfile={productProfile}
                productProfileId={productProfileId}
                hasPhotos={bulkPhotoItems.length > 0 || bulkProducts.length > 0}
                canRename={bulkPhotoItems.some((item) => item.image_url && !item.uploading)}
                renamingAll={bulkAnalyzingAll}
                onChange={setBulkPreset}
                onProfileChange={changeProductProfile}
                onApplyIncomplete={applyBulkPresetToIncomplete}
                onOpenGallery={() => bulkFileInputRef.current?.click()}
                onRenameAll={reanalyzeAllBulkPhotos}
              />
            <div className={`md:rounded-[26px] md:border md:border-white/80 md:bg-white/95 md:p-4 md:shadow-[var(--shadow-sm)] md:ring-1 md:ring-[rgba(191,206,197,0.34)] ${
              bulkPhotoItems.length === 0 && bulkProducts.length === 0 ? "hidden md:block" : ""
            }`}>
              <div className="hidden items-center gap-3 md:flex">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-main)] text-[var(--primary-bright)]">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-[var(--text-main)]">Photos de vos articles</p>
                  <p className="text-sm leading-5 text-[var(--text-dim)]">Choisissez les photos. Mettez surtout le prix. Tikchop prepare le reste.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="mt-4 hidden min-h-[92px] w-full items-center justify-between gap-3 rounded-[24px] bg-[var(--text-main)] px-4 text-left text-base font-bold text-white shadow-[var(--shadow-md)] active:scale-[0.99] md:flex"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                    {bulkUploading ? <Loader2 className="animate-spin" size={21} /> : <ImagePlus size={22} />}
                  </span>
                  <span>
                    <span className="block">{bulkUploading ? "Envoi des photos..." : "Choisir les photos"}</span>
                    <span className="block text-xs font-semibold text-white/58">Depuis votre t?l?phone</span>
                  </span>
                </span>
                <span className="rounded-full bg-[var(--primary-bright)] px-3 py-1 text-xs font-extrabold text-[var(--text-main)]">Recommande</span>
              </button>
              <div className="mt-4 hidden rounded-[22px] border border-[var(--outline)]/25 bg-[var(--surface-soft)] p-3 md:block">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 shrink-0 text-[var(--primary)]" size={17} />
                  <div>
                    <p className="text-sm font-extrabold text-[var(--text-main)]">Affuter l&apos;agent avant l&apos;analyse</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">
                      Donnez le contexte du lot: chaussures, cosmetiques, sacs, alimentation, accessoires. Tikchop s&apos;en sert pour mieux nommer les articles.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_11rem]">
                  <input
                    value={bulkPreset.product_keywords}
                    onChange={(event) => setBulkPreset((current) => ({ ...current, product_keywords: event.target.value }))}
                    placeholder="Ex: chaussures, sacs, cosmetiques, accessoires"
                    className="min-h-[48px] rounded-2xl border border-white bg-white px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    value={bulkPreset.size}
                    onChange={(event) => setBulkPreset((current) => ({ ...current, size: event.target.value }))}
                    placeholder="Options: couleurs, formats, tailles..."
                    className="min-h-[48px] rounded-2xl border border-white bg-white px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                {bulkPhotoItems.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={applyBulkPresetToIncomplete}
                      className="min-h-[42px] rounded-2xl bg-white px-3 text-xs font-extrabold text-[var(--primary)]"
                    >
                      Appliquer aux fiches a finir
                    </button>
                    <button
                      type="button"
                      onClick={applyBulkPreset}
                      className="min-h-[42px] rounded-2xl bg-[var(--text-main)] px-3 text-xs font-extrabold text-white"
                    >
                      Appliquer a tout le lot
                    </button>
                  </div>
                )}
                {BACKGROUND_REMOVAL_ENABLED && bulkPhotoItems.length > 0 && (
                  <button
                    type="button"
                    onClick={cleanAllBulkBackgrounds}
                    disabled={backgroundBusyId === "bulk-all" || cleanableBulkPhotos.length === 0}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-extrabold text-[var(--primary)] ring-1 ring-[rgba(0,143,90,0.14)] disabled:opacity-55"
                  >
                    {backgroundBusyId === "bulk-all" ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                    {backgroundBusyId === "bulk-all"
                      ? getBackgroundProgressLabel(bulkBackgroundProgress, "Nettoyage du lot...")
                      : cleanableBulkPhotos.length > 0
                        ? `Nettoyer le lot (${cleanableBulkPhotos.length})`
                        : `Photos pr?tes (${backgroundCleanedBulkPhotos.length})`}
                  </button>
                )}
              </div>
              {bulkPhotoItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="hidden items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm md:flex">
                    <span className="font-semibold text-[var(--text-dim)]">Validation rapide</span>
                    <strong className="text-[var(--primary)]">{readyBulkPhotos.length}/{bulkPhotoItems.length}</strong>
                  </div>
                  <div className="hidden md:block">
                    <BatchReviewSummary items={bulkPhotoItems} backgroundProgress={bulkBackgroundProgress} />
                  </div>
                  <div className="hidden grid-cols-[1fr_auto_auto] gap-2 md:grid">
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
                        Stock {quantity}
                      </button>
                    ))}
                  </div>
                  <div className="hidden">
                    <button
                      type="button"
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-[var(--primary)] shadow-sm ring-1 ring-[var(--outline)]/30"
                    >
                      <ImagePlus size={16} />
                      Photos
                    </button>
                    <button
                      type="button"
                      onClick={openNextIncompleteBulkItem}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#2b2219] px-3 text-sm font-black text-white shadow-[0_14px_30px_rgb(43_34_25_/_0.16)]"
                    >
                      <ListChecks size={16} />
                      Suivant
                    </button>
                    {BACKGROUND_REMOVAL_ENABLED && (
                      <button
                        type="button"
                        onClick={cleanAllBulkBackgrounds}
                        disabled={backgroundBusyId === "bulk-all" || cleanableBulkPhotos.length === 0}
                        className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#f7f1e5] px-3 text-sm font-black text-[var(--primary)] shadow-sm ring-1 ring-[rgba(0,143,90,0.16)] disabled:opacity-55"
                      >
                        {backgroundBusyId === "bulk-all" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {backgroundBusyId === "bulk-all"
                          ? getBackgroundProgressLabel(bulkBackgroundProgress, "Nettoyage en cours...")
                          : cleanableBulkPhotos.length > 0
                            ? `Fond propre (${cleanableBulkPhotos.length})`
                            : "Fond propre"}
                      </button>
                    )}
                    {bulkBackgroundProgress && (
                      <div className="col-span-2 hidden rounded-2xl bg-white px-3 py-2 text-center text-xs font-extrabold text-[var(--text-dim)] ring-1 ring-[var(--outline)]/25 md:block">
                        {getBackgroundProgressAdvice(bulkBackgroundProgress)}
                      </div>
                    )}
                  </div>
                  <div id="bulk-products" className="space-y-3">
                  {bulkPhotoItems.map((item, index) => {
                    const itemFieldCopy = getProductFieldCopy(item, productProfile);
                    const focusedOnMobile = !mobileFocusBulkItemId || item.id === mobileFocusBulkItemId;
                    const previousItem = bulkPhotoItems[index - 1] || null;
                    const duplicateHint = getLikelyDuplicateHint(item, previousItem);
                    return (
                    <article key={item.id} className={`${focusedOnMobile ? "" : "hidden md:block"} overflow-hidden rounded-[28px] bg-white shadow-[0_18px_42px_rgb(43_34_25_/_0.07)] ring-1 ring-[#2b2219]/8 md:rounded-[24px] md:p-3 md:shadow-[0_10px_26px_rgb(43_34_25_/_0.045)]`}>
                      <button
                        type="button"
                        onClick={() => setExpandedBulkItemId((current) => current === item.id ? "" : item.id)}
                        className="w-full p-3 text-left md:p-0"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-[24px] bg-[var(--surface-mid)] md:h-28 md:w-24 md:rounded-[20px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.preview} alt="" className="h-full w-full object-cover" />
                            {item.uploading && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                                <Loader2 className="animate-spin" size={22} />
                              </span>
                            )}
                            {(item.extra_images || []).length > 0 && (
                              <span className="absolute bottom-2 left-2 rounded-full bg-white/92 px-2 py-1 text-[0.62rem] font-extrabold text-[var(--text-main)] shadow-sm">
                                +{item.extra_images.length}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[var(--primary)]">
                                  {index + 1}/{bulkPhotoItems.length}
                                </p>
                                <h3 className="mt-1 line-clamp-2 font-display text-lg font-black leading-6 text-[var(--text-main)]">
                                  {item.name || `Article ${index + 1}`}
                                </h3>
                                <p className={`mt-1 text-sm font-extrabold ${item.price ? "text-[var(--primary)]" : "text-[var(--accent)]"}`}>
                                  {item.price ? formatPrice(item.price) : "Prix"}
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
                            <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                              <ItemPill label={`Stock ${item.stock_quantity || 1}`} active />
                              {item.size ? <ItemPill label={item.size} active /> : null}
                            </div>
                            <div className="mt-3 hidden flex-wrap gap-2 md:flex">
                              <ItemPill label={item.size ? `Option ${item.size}` : "Option facultative"} active={Boolean(item.size)} />
                              <ItemPill label={`Stock ${item.stock_quantity || 1}`} active />
                              {item.category ? <ItemPill label={item.category} active tone="info" /> : null}
                              {item.product_keywords ? <ItemPill label="IA" active tone="info" /> : null}
                              {item.image_version === "clean" ? <ItemPill label="Photo claire" active tone="info" /> : null}
                              {item.image_version === "background" ? <ItemPill label="Fond propre" active tone="info" /> : null}
                              {(item.extra_images || []).length > 0 ? <ItemPill label={`+${item.extra_images.length} angle${item.extra_images.length > 1 ? "s" : ""}`} active tone="info" /> : null}
                              {item.analyzing && <ItemPill label="Tikchop prepare..." active tone="info" />}
                            </div>
                          </div>
                        </div>
                      </button>

                      {expandedBulkItemId === item.id && (
                        <div className="mt-4 space-y-3 border-t border-[var(--outline)]/20 pt-4">
                          <div className="flex items-center justify-between gap-3 px-1">
                            <span className="flex h-9 items-center rounded-full bg-[#faedde] px-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">
                              #{index + 1}
                            </span>
                            <button type="button" onClick={() => removeBulkPhotoItem(item.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600" aria-label="Retirer cette photo">
                              <Trash2 size={17} />
                            </button>
                          </div>
                          <BulkQuickPricePanel
                            item={item}
                            itemFieldCopy={itemFieldCopy}
                            onUpdate={updateBulkPhotoItem}
                            onNext={markCurrentAndNext}
                          />
                          <div className="rounded-[22px] bg-white p-3 ring-1 ring-[#2b2219]/7 md:hidden">
                            <label className="block">
                              <span className="mb-2 block text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#c2572b]">Nom</span>
                              <input
                                value={item.name}
                                onChange={(event) => updateBulkPhotoItem(item.id, "name", event.target.value)}
                                placeholder={item.analyzing ? "Tikchop prepare..." : "Nom visible"}
                                className="min-h-[48px] w-full rounded-[18px] bg-[#fbf6ee] px-3 text-sm font-black text-[#2b2219] outline-none ring-1 ring-[#2b2219]/8 focus:ring-[#c2572b]/35"
                              />
                            </label>
                          </div>
                          <div className="hidden space-y-3 md:block">
                            <AngleDecisionCard
                              index={index}
                              extraCount={(item.extra_images || []).length}
                              onAttachPrevious={() => attachBulkPhotoToPrevious(item.id)}
                              onSeparateLast={() => separateLastBulkAngle(item.id)}
                            />
                            <ImageQualitySwitch
                              cleanAvailable={Boolean(item.clean_image_url && item.original_image_url && item.clean_image_url !== item.original_image_url)}
                              backgroundAvailable={Boolean(item.background_image_url)}
                              backgroundBusy={backgroundBusyId === item.id || backgroundBusyId === "bulk-all"}
                              value={item.image_version || "original"}
                              onChange={(version) => setBulkImageVersion(item.id, version)}
                              onCleanBackground={BACKGROUND_REMOVAL_ENABLED ? () => cleanBulkBackground(item.id) : null}
                            />
                          </div>
                          {duplicateHint && (
                            <button
                              type="button"
                              onClick={() => attachBulkPhotoToPrevious(item.id)}
                              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--primary)]/25 bg-[#f7f1e5] px-3 text-sm font-black text-[var(--text-main)]"
                            >
                              <Layers3 size={16} />
                              {duplicateHint}
                            </button>
                          )}
                          <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem] gap-3 md:grid">
                            <Field label={itemFieldCopy.sizeLabel} icon={<Ruler size={16} />}>
                              <input
                                value={item.size}
                                onChange={(event) => {
                                  updateBulkPhotoItem(item.id, "size", event.target.value);
                                  updateBulkPhotoItem(item.id, "variants_text", buildVariantText(event.target.value, item.stock_quantity));
                                }}
                                placeholder={itemFieldCopy.sizePlaceholder}
                                className="mobile-input bg-white"
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
                                className="mobile-input bg-white"
                              />
                            </Field>
                          </div>
                          <div className="no-scrollbar hidden gap-2 overflow-x-auto pb-0.5 md:flex">
                            {getSizeOptions(item).slice(0, 7).map((size) => (
                              <QuickValueButton
                                key={size}
                                active={String(item.size || "") === String(size)}
                                label={size}
                                onClick={() => {
                                  updateBulkPhotoItem(item.id, "size", size);
                                  updateBulkPhotoItem(item.id, "variants_text", buildVariantText(size, item.stock_quantity));
                                }}
                              />
                            ))}
                          </div>
                          <div className="hidden grid-cols-4 gap-2 md:grid">
                            {[1, 2, 3, 5].map((quantity) => (
                              <QuickValueButton
                                key={quantity}
                                active={String(item.stock_quantity || "") === String(quantity)}
                                label={`Stock ${quantity}`}
                                onClick={() => {
                                  updateBulkPhotoItem(item.id, "stock_quantity", quantity);
                                  updateBulkPhotoItem(item.id, "variants_text", buildVariantText(item.size, quantity));
                                }}
                              />
                            ))}
                          </div>
                          <details className="hidden rounded-2xl bg-[var(--surface-soft)] p-3 md:block">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-[var(--text-main)]">
                              <span className="flex items-center gap-2">
                                <Mic size={16} className="text-[var(--primary)]" />
                                Dicter prix, option ou stock
                              </span>
                              <ChevronDown size={16} className="text-[var(--primary)]" />
                            </summary>
                            <div className="mt-3">
                              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-2">
                                <p className="text-xs font-bold leading-4 text-[var(--text-dim)]">
                                  Optionnel. Exemple: quinze mille, stock 3, couleur noire.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => startBulkVoiceCapture(item.id)}
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                    bulkListeningId === item.id ? "bg-red-500 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"
                                  }`}
                                  aria-label="Dicter les informations de l'article"
                                >
                                  {bulkListeningId === item.id ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}
                                </button>
                              </div>
                              <textarea
                                value={item.description || ""}
                                onChange={(event) => applyBulkVoiceText(item.id, event.target.value)}
                                rows="2"
                                placeholder="Dictez ou collez le message vocal ici..."
                                className="mt-3 min-h-[58px] w-full resize-none rounded-[18px] border border-white bg-white px-3 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                              />
                            </div>
                          </details>
                          <button
                            type="button"
                            onClick={() => markCurrentAndNext(item.id)}
                            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2b2219] text-sm font-extrabold text-white shadow-[0_14px_30px_rgb(43_34_25_/_0.16)]"
                          >
                            <CheckCircle2 size={16} />
                            Suivant
                            <ArrowRight size={16} />
                          </button>
                          <details className="rounded-2xl bg-[var(--surface-soft)] p-3 md:hidden">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-[var(--text-main)]">
                              <span className="flex items-center gap-2">
                                <ListChecks size={16} className="text-[var(--primary)]" />
                                Plus
                              </span>
                              <ChevronDown size={16} className="text-[var(--primary)]" />
                            </summary>
                            <BulkItemMoreOptions
                              item={item}
                              index={index}
                              itemFieldCopy={itemFieldCopy}
                              bulkListeningId={bulkListeningId}
                              onVoice={startBulkVoiceCapture}
                              onReanalyze={reanalyzeBulkPhotoItem}
                              onAttachPrevious={attachBulkPhotoToPrevious}
                              onSeparateLast={separateLastBulkAngle}
                              onImageVersionChange={setBulkImageVersion}
                              onCleanBackground={BACKGROUND_REMOVAL_ENABLED ? cleanBulkBackground : null}
                              backgroundBusy={backgroundBusyId === item.id || backgroundBusyId === "bulk-all"}
                              onUpdate={updateBulkPhotoItem}
                            />
                          </details>
                          <div className="hidden space-y-3 md:block">
                            <BulkItemMoreOptions
                              item={item}
                              index={index}
                              itemFieldCopy={itemFieldCopy}
                              bulkListeningId={bulkListeningId}
                              onVoice={startBulkVoiceCapture}
                              onReanalyze={reanalyzeBulkPhotoItem}
                              onAttachPrevious={attachBulkPhotoToPrevious}
                              onSeparateLast={separateLastBulkAngle}
                              onImageVersionChange={setBulkImageVersion}
                              onCleanBackground={BACKGROUND_REMOVAL_ENABLED ? cleanBulkBackground : null}
                              backgroundBusy={backgroundBusyId === item.id || backgroundBusyId === "bulk-all"}
                              onUpdate={updateBulkPhotoItem}
                            />
                          </div>
                        </div>
                      )}

                      {item.analysisError && (
                        <p className="mt-2 hidden rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 md:block">{item.analysisError}</p>
                      )}
                      {item.reviewNotice && (
                        <p className="mt-2 hidden rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 md:block">{item.reviewNotice}</p>
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
                    {imageAnalyzing
                      ? <TikchopLottie name="sparkle" size={24} speed={1.4} ariaLabel="Tikchop analyse la photo" />
                      : <Loader2 className="animate-spin" size={20} />}
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
              <ImageQualitySwitch
                cleanAvailable={Boolean(formData.clean_image_url && formData.original_image_url && formData.clean_image_url !== formData.original_image_url)}
                backgroundAvailable={Boolean(formData.background_image_url)}
                backgroundBusy={backgroundBusyId === "single"}
                value={formData.image_version || "original"}
                onChange={setSingleImageVersion}
                onCleanBackground={BACKGROUND_REMOVAL_ENABLED ? cleanSingleBackground : null}
              />
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
                  {imageAnalyzing
                    ? <TikchopLottie name="sparkle" size={26} speed={1.4} className="shrink-0" ariaLabel="Tikchop analyse la photo" />
                    : <Sparkles className="text-[var(--primary)]" size={22} />}
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
                    <h2 className="mt-1 font-display text-xl font-bold text-[var(--text-main)]">Prix, option, stock</h2>
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
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Options proposees</p>
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
                  <textarea name="description" rows="3" placeholder="Ex: couleur noire disponible, pack de 3..." value={formData.description} onChange={handleChange} className="mobile-input resize-none" />
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
                    {formData.size ? `Option ${formData.size} - ` : ""}Stock: {formData.stock_quantity || 0}
                  </span>
                </div>
              </div>
            </section>
          )}

          {(mode !== "BULK" || selectedCount > 0 || bulkProducts.length > 0) && (
            <PublishDock
              loading={loading}
              canSubmit={canSubmit}
              mode={mode}
              count={publishCount}
            />
          )}
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
