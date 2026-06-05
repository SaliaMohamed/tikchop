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
  CopyCheck,
  ImagePlus,
  Layers3,
  ListChecks,
  Loader2,
  MessageCircle,
  Mic,
  PackagePlus,
  Ruler,
  Share2,
  Sparkles,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { addProduct, addProductsBulk, analyzeProductImage, analyzeProductImagesBatch, removeProductBackground, uploadProductImage } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { compressImage } from "../../lib/image-compressor";
import { PRODUCT_PROFILES, getProductProfile, getStoredProductProfileId, storeProductProfileId } from "../../lib/product-profiles";

function formatPrice(value) {
  return `${Number(normalizeMoneyInput(value) || 0).toLocaleString("fr-FR")} FCFA`;
}

function normalizeMoneyInput(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeStockInput(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits || "1";
}

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
            <div className={`rounded-[26px] border border-white/80 bg-white/95 p-4 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.34)] ${
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
                    <span className="block text-xs font-semibold text-white/58">Selection multiple depuis votre appareil</span>
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
                        : `Lot deja propre (${backgroundCleanedBulkPhotos.length})`}
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
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-sm font-black text-white shadow-[0_14px_30px_rgb(7_18_13_/_0.16)]"
                    >
                      <ListChecks size={16} />
                      Suivant
                    </button>
                    {BACKGROUND_REMOVAL_ENABLED && (
                      <button
                        type="button"
                        onClick={cleanAllBulkBackgrounds}
                        disabled={backgroundBusyId === "bulk-all" || cleanableBulkPhotos.length === 0}
                        className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#f4fbf6] px-3 text-sm font-black text-[var(--primary)] shadow-sm ring-1 ring-[rgba(0,143,90,0.16)] disabled:opacity-55"
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
                    <article key={item.id} className={`${focusedOnMobile ? "" : "hidden md:block"} rounded-[24px] bg-white p-3 shadow-[0_10px_26px_rgb(7_18_13_/_0.045)] ring-1 ring-[#07120d]/8`}>
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
                            <div className="mt-3 hidden flex-wrap gap-2 md:flex">
                              <ItemPill label={item.size ? `Option ${item.size}` : "Option facultative"} active={Boolean(item.size)} />
                              <ItemPill label={`Stock ${item.stock_quantity || 1}`} active />
                              {item.category ? <ItemPill label={item.category} active tone="info" /> : null}
                              {item.product_keywords ? <ItemPill label="Infos auto" active tone="info" /> : null}
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
                          <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--surface-soft)] px-3 py-2">
                            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">
                              Fiche {index + 1}
                            </span>
                            <button type="button" onClick={() => removeBulkPhotoItem(item.id)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-red-600">
                              Retirer
                            </button>
                          </div>
                          <BulkQuickPricePanel
                            item={item}
                            itemFieldCopy={itemFieldCopy}
                            onUpdate={updateBulkPhotoItem}
                            onNext={markCurrentAndNext}
                          />
                          <div className="rounded-[22px] bg-white p-3 ring-1 ring-[#07120d]/7 md:hidden">
                            <label className="block">
                              <span className="mb-2 block text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#008f5a]">Nom article</span>
                              <input
                                value={item.name}
                                onChange={(event) => updateBulkPhotoItem(item.id, "name", event.target.value)}
                                placeholder={item.analyzing ? "Tikchop prepare..." : "Nom visible"}
                                className="min-h-[48px] w-full rounded-[18px] bg-[#fbf9f4] px-3 text-sm font-black text-[#07120d] outline-none ring-1 ring-[#07120d]/8 focus:ring-[#008f5a]/35"
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
                              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--primary)]/25 bg-[#f4fbf6] px-3 text-sm font-black text-[var(--text-main)]"
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
                            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07120d] text-sm font-extrabold text-white shadow-[0_14px_30px_rgb(7_18_13_/_0.16)]"
                          >
                            <CheckCircle2 size={16} />
                            Valider cette fiche
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

// Kept only as a rollback reference for older mojibake voice parsing.
function parseVoiceProductLegacy(text) {
  const originalText = String(text || "");
  const source = String(text || "").toLowerCase();
  const explicitPriceMatch = source.match(/(?:prix|a|à)\s*(\d[\d\s.]*)/i)
    || source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i);
  const quantityMatch = source.match(/(?:quantite|quantité|qte|stock|reste|il y a)\s*(\d+)/i)
    || source.match(/\b(\d+)\s*(?:piece|pièce|pieces|pièces|article|articles|dispo|disponible|disponibles)\b/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const loosePriceMatch = explicitPriceMatch ? null : [...originalText.matchAll(/\d[\d\s.]*/g)]
    .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
    .find((match) => match.digits.length >= 4 || Number(match.digits) >= 1000);
  const spokenPrice = explicitPriceMatch || loosePriceMatch ? "" : parseSpokenPrice(source);
  const price = explicitPriceMatch
    ? explicitPriceMatch[1].replace(/[^\d]/g, "")
    : loosePriceMatch?.digits || spokenPrice;
  const priceTextToRemove = explicitPriceMatch?.[0] || loosePriceMatch?.raw || "";
  const quantity = quantityMatch?.[1] || parseSpokenQuantity(source) || "1";
  const name = originalText
    .replace(priceTextToRemove, "")
    .replace(/(?:prix|a|à)?\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:[-\s]+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille/i, "")
    .replace(/(?:prix|a|à)\s*(\d[\d\s.]*)/i, "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i, "")
    .replace(/(?:quantite|quantité|qte|stock|reste|il y a)\s*\d+/i, "")
    .replace(/(?:quantite|quantitÃ©|qte|stock|reste|il y a)\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/i, "")
    .replace(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pièce|pieces|pièces|article|articles|dispo|disponible|disponibles)\b/i, "")
    .replace(/(?:taille|size|pointure)\s*[a-z0-9]+/i, "")
    .replace(/[,.]/g, " ")
    .trim();

  return {
    name,
    price,
    size: sizeMatch?.[1]?.toUpperCase() || "",
    stock_quantity: quantity,
  };
}

function normalizeSpokenText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseVoiceProduct(text) {
  const originalText = String(text || "");
  const source = normalizeSpokenText(text);
  const explicitPriceMatch = source.match(/(?:prix|a|au prix de|vendu a|coute)\s*(\d[\d\s.]*)/i)
    || source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|francs|cfa)/i);
  const quantityMatch = source.match(/(?:quantite|qte|stock|reste|il y a)\s*(\d+)/i)
    || source.match(/\b(\d+)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const spokenSize = parseSpokenSize(source);
  const loosePriceMatch = explicitPriceMatch ? null : [...source.matchAll(/\d[\d\s.]*/g)]
    .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
    .find((match) => match.digits.length >= 4 || Number(match.digits) >= 1000);
  const spokenPrice = explicitPriceMatch || loosePriceMatch ? "" : parseSpokenPrice(source);
  const price = explicitPriceMatch
    ? explicitPriceMatch[1].replace(/[^\d]/g, "")
    : loosePriceMatch?.digits || spokenPrice;
  const quantity = quantityMatch?.[1] || parseSpokenQuantity(source) || "";
  const name = originalText
    .replace(new RegExp(escapeRegExp(explicitPriceMatch?.[0] || loosePriceMatch?.raw || ""), "i"), "")
    .replace(/(?:prix|a|au prix de|vendu a|coute)?\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:[-\s]+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille/i, "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|francs|cfa)/i, "")
    .replace(/(?:quantite|qte|stock|reste|il y a)\s*\d+/i, "")
    .replace(/(?:quantite|qte|stock|reste|il y a)\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/i, "")
    .replace(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i, "")
    .replace(/(?:taille|size|pointure)\s+(xs|small|petit|s|m|medium|moyen|l|large|xl|xxl|\d{1,3}|trente|quarante|vingt)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?/i, "")
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name,
    price,
    size: spokenSize || sizeMatch?.[1]?.toUpperCase() || "",
    stock_quantity: quantity,
  };
}

function parseSpokenSize(source) {
  const normalized = normalizeSpokenText(source);
  const direct = normalized.match(/(?:taille|size)\s+(xs|small|petit|s|m|medium|moyen|l|large|xl|xxl|\d{1,3})\b/i);
  const pointureNumber = normalized.match(/pointure\s+(\d{2})\b/i);

  if (pointureNumber) return pointureNumber[1];
  if (direct) {
    const value = direct[1].toLowerCase();
    if (["small", "petit"].includes(value)) return "S";
    if (["medium", "moyen"].includes(value)) return "M";
    if (value === "large") return "L";
    return value.toUpperCase();
  }

  const tens = {
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
  };
  const units = {
    un: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
  };
  const wordSize = normalized.match(/pointure\s+(vingt|trente|quarante|cinquante)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\b/i);
  if (!wordSize) return "";

  const value = (tens[wordSize[1]] || 0) + (units[wordSize[2]] || 0);
  return value > 0 ? String(value) : "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSpokenPrice(source) {
  const normalized = String(source || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ");
  const units = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
  };
  const extras = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
  const match = normalized.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille\b/i);
  if (!match) return "";
  const amount = (units[match[1]] || 0) + (extras[match[2]] || 0);
  return amount > 0 ? String(amount * 1000) : "";
}

function parseSpokenQuantity(source) {
  const normalized = String(source || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = {
    un: "1",
    une: "1",
    deux: "2",
    trois: "3",
    quatre: "4",
    cinq: "5",
    six: "6",
    sept: "7",
    huit: "8",
    neuf: "9",
    dix: "10",
  };
  const match = normalized.match(/(?:quantite|qte|stock|reste|il y a)\s+(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i);
  if (match) return words[match[1]] || "";

  const looseNumeric = normalized.match(/\b(\d+)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  if (looseNumeric) return looseNumeric[1];

  const looseWord = normalized.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  return looseWord ? words[looseWord[1]] || "" : "";
}

function canSingleProductSubmit(formData, imageUploading, imageAnalyzing) {
  return Boolean(formData.seller_id && formData.image_url && formData.name && formData.price && !imageUploading && !imageAnalyzing);
}

async function runLimited(items, limit, worker) {
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

function chunkArray(items = [], size = 6) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function inferProductNameFromFile(filename) {
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

function buildBulkAnalysisHint(preset = {}, profile = getProductProfile("general")) {
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

function buildItemAnalysisHint(item = {}, preset = {}, profile = getProductProfile("general")) {
  return [
    buildBulkAnalysisHint(preset, profile),
    String(item.description || "").trim() ? `Note deja saisie sur cet article: ${String(item.description).trim()}` : "",
    String(item.name || "").trim() ? `Nom provisoire actuel: ${String(item.name).trim()}` : "",
  ].filter(Boolean).join("\n");
}

function reviewBulkAnalysis(item) {
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

function applyAnalysisToProduct(product, analysis) {
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

function getFallbackProductName(item, profile = getProductProfile("general"), index = 0) {
  const currentName = sanitizeAiProductName(item?.name);
  if (currentName) return currentName;

  const base = profile?.shortLabel && profile.shortLabel !== "Articles"
    ? profile.shortLabel
    : profile?.categorySuggestions?.[0] || "Article";
  return `${base} ${Math.max(Number(index) + 1, 1)}`;
}

function sanitizeAiProductName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (/(fleur|jardin|plante|decor|arriere-plan|background|photo whatsapp|image whatsapp)/i.test(lower)) {
    return "";
  }
  return clean.split(" ").slice(0, 5).join(" ");
}

function buildDescription(description, size, extraImages = []) {
  const parts = [];
  if (size) parts.push(`Taille: ${size}`);
  if (description) parts.push(description);
  const cleanExtraImages = Array.from(new Set((extraImages || []).map((image) => String(image || "").trim()).filter(Boolean)));
  if (cleanExtraImages.length > 0) {
    parts.push(`[[TIKCHOP_EXTRA_IMAGES:${cleanExtraImages.map(encodeURIComponent).join("|")}]]`);
  }
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

function getProductFieldCopy(product, profile = getProductProfile("general")) {
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

function isBulkItemReady(item) {
  return Boolean(item?.image_url && normalizeMoneyInput(item?.price));
}

function getBulkReviewStats(items = []) {
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

function getBackgroundProgressLabel(progress, fallback = "Nettoyage...") {
  if (!progress?.total) return fallback;
  return `Fond propre ${Math.min(progress.done, progress.total)}/${progress.total}`;
}

function getBackgroundProgressAdvice(progress) {
  if (!progress?.total) return "";
  if (progress.done < progress.total) {
    return `${progress.done}/${progress.total} photos nettoyees. Gardez la page ouverte.`;
  }
  if (progress.failed > 0) {
    return `${progress.total - progress.failed}/${progress.total} photos nettoyees. ${progress.failed} a garder en photo claire.`;
  }
  return `${progress.total}/${progress.total} photos nettoyees. Vous pouvez verifier les prix.`;
}

function getBulkItemName(item, index = 0) {
  const fallback = item?.category || item?.product_keywords || `Article ${index + 1}`;
  return String(item?.name || fallback).trim();
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

  return {
    label: "Pret",
    toneClass: "bg-[var(--surface-soft)] text-[var(--primary)]",
  };
}

function getComparableProductText(item) {
  return normalizeSpokenText([
    item?.name,
    item?.category,
    Array.isArray(item?.colors) ? item.colors.join(" ") : "",
  ].filter(Boolean).join(" "));
}

function getLikelyDuplicateHint(item, previousItem) {
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

function getAutoGroupKey(item) {
  return normalizeSpokenText([
    item?.name,
    item?.category,
    Array.isArray(item?.colors) ? item.colors.join(" ") : "",
  ].filter(Boolean).join(" "))
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["article", "femme", "homme", "modele", "couleur"].includes(word))
    .join(" ");
}

function getWordSimilarity(left, right) {
  const leftWords = new Set(String(left || "").split(/\s+/).filter(Boolean));
  const rightWords = new Set(String(right || "").split(/\s+/).filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.min(leftWords.size, rightWords.size);
}

function hasColorOverlap(left, right) {
  const leftColors = new Set((left?.colors || []).map((color) => normalizeSpokenText(color)).filter(Boolean));
  const rightColors = new Set((right?.colors || []).map((color) => normalizeSpokenText(color)).filter(Boolean));
  if (!leftColors.size || !rightColors.size) return false;
  return [...leftColors].some((color) => rightColors.has(color));
}

function shouldAutoGroupProduct(primary, candidate) {
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

function mergeBulkAngle(primary, angle) {
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

function autoGroupBulkPhotoItems(items = []) {
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
    if (bulkPhotoItems.length === 0 && bulkProducts.length === 0) return "1. Ajoutez les photos.";
    if (readyBulkPhotos.length === 0 && bulkProducts.length === 0) return "2. Mettez le prix sur au moins une fiche.";
    if (bulkPhotoItems.length > readyBulkPhotos.length && readyBulkPhotos.length > 0) {
      const remaining = bulkPhotoItems.length - readyBulkPhotos.length;
      return `${remaining} fiche${remaining > 1 ? "s" : ""} peuvent attendre. Vous pouvez deja publier les articles prets.`;
    }
    return "3. Publiez, puis partagez la boutique.";
  }

  if (imageUploading) return "Photo en envoi. Gardez cette page ouverte.";
  if (imageAnalyzing) return "Tikchop propose le nom de l'article.";
  if (!formData.image_url) return "Ajoutez une photo depuis la galerie.";
  if (!formData.name) return "Confirmez le nom visible dans la boutique.";
  if (!formData.price) return "Ajoutez le prix de vente.";
  return "L'article est pret. Publiez puis partagez.";
}

function getSizeOptions(item) {
  const defaults = ["S", "M", "L", "XL", "38", "39", "40"];
  return Array.from(new Set([...(item.suggested_sizes || []), ...defaults].filter(Boolean).map(String))).slice(0, 10);
}

function BatchReviewSummary({ items, backgroundProgress = null }) {
  const stats = getBulkReviewStats(items);
  const advice = stats.waiting > 0
    ? "Analyse en cours. Continuez a remplir les prix visibles."
    : stats.missingPrice > 0
      ? `${stats.missingPrice} prix a saisir avant de publier tout le lot.`
      : stats.weakNames > 0
        ? `${stats.weakNames} nom${stats.weakNames > 1 ? "s" : ""} a verifier, mais vous pouvez deja publier.`
        : "Le lot est propre. Les articles prets peuvent etre publies.";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <BatchMetric label="Photos" value={`${stats.uploaded}/${items.length}`} tone={stats.uploaded === items.length ? "green" : "blue"} />
        <BatchMetric label="Prix" value={`${stats.priced}/${items.length}`} tone={stats.priced === items.length ? "green" : "amber"} />
        <BatchMetric label="Fond" value={`${stats.backgrounds}/${items.length}`} tone={stats.backgrounds > 0 ? "green" : "blue"} />
      </div>
      <div className="rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-5 text-[var(--text-dim)]">
        {backgroundProgress ? getBackgroundProgressAdvice(backgroundProgress) : advice}
        {stats.failedUploads > 0 ? ` ${stats.failedUploads} photo${stats.failedUploads > 1 ? "s" : ""} n'ont pas ete envoyees.` : ""}
      </div>
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

function getMobileProductCopy(mode) {
  if (mode === "MANUAL") {
    return {
      title: "Un article",
    };
  }

  if (mode === "VOICE") {
    return {
      title: "Vocal",
    };
  }

  return {
    title: "Plusieurs photos",
  };
}

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
    <section className="rounded-[24px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(0,143,90,0.13)] md:hidden">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9fff1] text-[var(--primary)]">
          <ImagePlus size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[var(--text-main)]">Photos du lot</p>
          <p className="truncate text-xs font-bold text-[var(--text-dim)]">
            {hasPhotos ? "Corrigez les fiches une par une" : "Choisissez depuis la galerie"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fbf9f4] px-2.5 py-1 text-[0.62rem] font-black text-[#008f5a] ring-1 ring-[#07120d]/7">
          {productProfile?.shortLabel || "Articles"}
        </span>
        {hasPhotos && (
          <button
            type="button"
            onClick={onOpenGallery}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#07120d] text-[var(--primary-bright)]"
            aria-label="Ajouter des photos"
          >
            <ImagePlus size={19} />
          </button>
        )}
      </div>

      {hasPhotos && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRenameAll}
            disabled={!canRename || renamingAll}
            className="flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-xs font-black text-white disabled:opacity-55"
          >
            {renamingAll ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
            <span className="truncate">{renamingAll ? "Analyse..." : "Renommer"}</span>
          </button>
          <button
            type="button"
            onClick={onOpenGallery}
            className="flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#e9fff1] px-3 text-xs font-black text-[#008f5a] ring-1 ring-[#008f5a]/10"
          >
            <ImagePlus size={15} />
            <span className="truncate">Ajouter photos</span>
          </button>
        </div>
      )}

      {!hasPhotos && (
        <div className="mt-3 space-y-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PRODUCT_PROFILES.map((profile) => {
              const active = productProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onProfileChange(profile.id)}
                  className={`min-h-[38px] shrink-0 rounded-full px-3 text-xs font-black ${
                    active ? "bg-[#07120d] text-white" : "bg-[#fbf9f4] text-[#07120d] ring-1 ring-[#07120d]/8"
                  }`}
                >
                  {profile.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenGallery}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-sm font-black text-white"
          >
            <ImagePlus size={17} />
            Ouvrir la galerie
          </button>
        </div>
      )}

      {hasPhotos && (
      <details className="mt-3 rounded-[20px] bg-[var(--surface-soft)] p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm font-black text-[var(--text-main)]">Aide IA</span>
          <ChevronDown size={18} className="shrink-0 text-[var(--primary)]" />
        </summary>

        <div className="mt-3 border-t border-[rgba(0,143,90,0.08)] pt-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PRODUCT_PROFILES.map((profile) => {
              const active = productProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onProfileChange(profile.id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                    active ? "bg-[#07120d] text-white" : "bg-white text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]"
                  }`}
                >
                  {profile.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {presets.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange((current) => ({ ...current, product_keywords: mergeKeywords(current.product_keywords, label) }))}
                className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]"
              >
                {label}
              </button>
            ))}
          </div>

          <input
            value={preset.product_keywords}
            onChange={(event) => onChange((current) => ({ ...current, product_keywords: event.target.value }))}
            placeholder={`Ex: ${(presets || []).slice(0, 3).join(", ").toLowerCase() || "articles"}`}
            className="mt-2 min-h-[50px] w-full rounded-2xl border border-[rgba(0,143,90,0.12)] bg-white px-3 text-sm font-bold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
          />

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={preset.size}
              onChange={(event) => onChange((current) => ({ ...current, size: event.target.value }))}
              placeholder={productProfile?.sizePlaceholder || "Option commune"}
              className="min-h-[48px] rounded-2xl border border-[rgba(0,143,90,0.12)] bg-white px-3 text-sm font-bold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
            />
            {hasPhotos && (
              <button
                type="button"
                onClick={onApplyIncomplete}
                className="min-h-[48px] rounded-2xl bg-[#07120d] px-3 text-xs font-black text-white"
              >
                Appliquer
              </button>
            )}
          </div>

          <div className="mt-2 no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {optionPresets.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange((current) => ({ ...current, size: label }))}
                className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-[var(--primary)] shadow-sm ring-1 ring-[rgba(0,143,90,0.12)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </details>
      )}
    </section>
  );
}

function MobilePrepStep({ step, label, important = false }) {
  return (
    <div className={`rounded-2xl px-2 py-3 text-center ring-1 ${
      important
        ? "bg-[#07120d] text-white ring-[#07120d]"
        : "bg-[var(--surface-soft)] text-[var(--text-main)] ring-[rgba(0,143,90,0.10)]"
    }`}>
      <strong className={`mx-auto flex h-7 w-7 items-center justify-center rounded-xl text-sm font-black ${
        important ? "bg-[var(--primary-bright)] text-[#07120d]" : "bg-white text-[var(--primary)]"
      }`}>
        {step}
      </strong>
      <span className={`mt-1 block text-[0.68rem] font-black uppercase leading-3 ${
        important ? "text-white/74" : "text-[var(--text-dim)]"
      }`}>
        {label}
      </span>
    </div>
  );
}

function AngleDecisionCard({ index, extraCount, onAttachPrevious, onSeparateLast }) {
  if (index <= 0) {
    return (
      <div className="rounded-[18px] bg-[#e9fff1] p-3 text-sm font-bold leading-5 text-[#063d28] ring-1 ring-[#bff3cf]">
        Si plusieurs photos montrent le meme article, Tikchop les regroupe automatiquement quand il est assez sur.
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-[#f7fbf8] p-3 ring-1 ring-[rgba(0,143,90,0.12)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Cette photo est...</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center text-xs font-black text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]">
          <ImagePlus size={15} />
          Nouvel article
        </div>
        <button
          type="button"
          onClick={onAttachPrevious}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-center text-xs font-black text-white"
        >
          <CopyCheck size={15} />
          Meme article
        </button>
      </div>
      {extraCount > 0 && (
        <div className="mt-2 rounded-2xl bg-white p-2">
          <p className="text-xs font-bold leading-4 text-[var(--text-dim)]">
            {extraCount} autre{extraCount > 1 ? "s" : ""} photo{extraCount > 1 ? "s" : ""} deja fusionnee{extraCount > 1 ? "s" : ""}.
          </p>
          <button
            type="button"
            onClick={onSeparateLast}
            className="mt-2 flex min-h-[38px] w-full items-center justify-center rounded-xl bg-[var(--surface-soft)] px-3 text-xs font-black text-[var(--primary)]"
          >
            Separer la derniere photo
          </button>
        </div>
      )}
    </div>
  );
}

function MobileProductCockpit({ assistant, canSubmit, mode, onModeChange, readyCount, selectedCount, totalCount }) {
  const photosDone = selectedCount > 0;
  const total = totalCount || selectedCount || 0;
  const progress = photosDone ? Math.max(8, Math.round((readyCount / Math.max(total || selectedCount, 1)) * 100)) : 0;
  const mobileModes = [
    { value: "BULK", label: "Lot", icon: <ImagePlus size={17} strokeWidth={2.7} /> },
    { value: "MANUAL", label: "Simple", icon: <Camera size={17} strokeWidth={2.7} /> },
  ];

  return (
    <section className="md:hidden">
      <div className="rounded-[26px] bg-white p-3 shadow-[0_10px_28px_rgb(7_18_13_/_0.045)] ring-1 ring-[#07120d]/6">
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-[18px] bg-[#f7fbf8] p-1 ring-1 ring-[#07120d]/6">
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
                      ? "bg-[#008f5a] text-white shadow-[0_8px_18px_rgb(0_143_90_/_0.16)]"
                      : "bg-transparent text-[#5b615b]"
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
            className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-[17px] bg-[#008f5a] px-3 text-sm font-black text-white shadow-[0_10px_22px_rgb(0_143_90_/_0.18)] disabled:opacity-60"
          >
            {React.cloneElement(assistant.icon, { strokeWidth: 2.75 })}
            {canSubmit ? "Publier" : photosDone ? "Suivant" : "Photos"}
          </button>
        </div>

        {photosDone && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 text-xs font-black text-[#07120d]">
              <span>{readyCount}/{total || selectedCount} pret</span>
              <span className="text-[#008f5a]">{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-full bg-[#07120d]/7">
              <span className="block h-2 rounded-full bg-[#008f5a]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MobileProductStep({ icon, label, value, done, warn = false, dark = false }) {
  const className = warn
    ? "bg-[#fff0bd] text-[#171006] ring-[#ffcf3d]/50"
    : done
      ? dark
        ? "bg-white text-[#008f5a] ring-white"
        : "bg-white text-[#008f5a] ring-[#e8dcc8]"
      : dark
        ? "bg-white/10 text-white ring-white/10"
        : "bg-white text-[#07120d] ring-[#e8dcc8]";

  return (
    <div className={`flex-1 rounded-[18px] p-2 text-center ring-1 ${className}`}>
      <span className="tk-icon-badge mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-current">
        {icon}
      </span>
      <strong className="block font-display text-lg font-black leading-none">{value}</strong>
      <small className={`mt-1 block text-[0.62rem] font-black uppercase leading-3 ${dark && !warn && !done ? "text-white/48" : "text-[var(--text-dim)]"}`}>{label}</small>
    </div>
  );
}

function ImageQualitySwitch({
  backgroundAvailable = false,
  backgroundBusy = false,
  cleanAvailable,
  value,
  onChange,
  onCleanBackground,
}) {
  if (!cleanAvailable && !backgroundAvailable) return null;

  const options = [
    {
      value: "clean",
      label: "Photo claire",
      hint: "Lumiere et couleurs corrigees",
      icon: <Sparkles size={15} />,
    },
    {
      value: "original",
      label: "Originale",
      hint: "Photo prise au depart",
      icon: <ImagePlus size={15} />,
    },
  ].filter((option) => option.value !== "clean" || cleanAvailable);

  if (backgroundAvailable) {
    options.unshift({
      value: "background",
      label: "Fond propre",
      hint: "Fond neutre pret pour vendre",
      icon: <BadgeCheck size={15} />,
    });
  }

  return (
    <div className="rounded-[20px] bg-[#f5fbf7] p-3 ring-1 ring-[rgba(0,143,90,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Rendu boutique</p>
          <p className="mt-1 text-sm font-bold leading-5 text-[var(--text-dim)]">Choisissez la photo visible.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black text-[var(--primary)]">
          Photo
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${options.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-3 text-left text-xs font-black transition active:scale-[0.99] ${
                active
                  ? "bg-[#07120d] text-white"
                  : "bg-white text-[var(--text-main)] ring-1 ring-[rgba(0,143,90,0.10)]"
              }`}
            >
              {option.icon}
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                <span className={`mt-0.5 block text-[0.66rem] font-bold leading-3 ${active ? "text-white/60" : "text-[var(--text-dim)]"}`}>
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {onCleanBackground && (
        <button
          type="button"
          onClick={onCleanBackground}
          disabled={backgroundBusy}
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-[var(--primary)] ring-1 ring-[rgba(0,143,90,0.14)] disabled:opacity-60"
        >
          {backgroundBusy ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
          {backgroundAvailable ? "Refaire le fond propre" : "Creer un fond propre"}
        </button>
      )}
    </div>
  );
}

function BulkQuickPricePanel({ item, itemFieldCopy, onUpdate, onNext }) {
  const hasPrice = Boolean(normalizeMoneyInput(item.price));
  return (
    <section className="rounded-[26px] bg-[#fbf7ed] p-3 shadow-[0_16px_36px_rgb(58_47_30_/_0.10)] ring-1 ring-[#e8dcc8]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#008f5a]">Prix</p>
          <p className="mt-1 hidden text-xs font-bold leading-4 text-[var(--text-dim)] md:block">Le prix suffit pour publier cette fiche.</p>
        </div>
        {hasPrice ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[var(--primary)] shadow-sm">
            OK
          </span>
        ) : (
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent)]">
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
          className="min-h-[60px] w-full rounded-[22px] border border-[#d9ccb9] bg-white px-4 font-display text-2xl font-extrabold text-[#008f5a] outline-none focus:border-[#07120d] focus:shadow-[0_0_0_4px_rgb(5_122_85_/_0.13)]"
        />
        <button
          type="button"
          onClick={() => onNext(item.id)}
          className="flex min-h-[60px] items-center justify-center rounded-[22px] bg-[#07120d] text-[var(--primary-bright)] shadow-[0_14px_30px_rgb(7_18_13_/_0.16)] disabled:opacity-50"
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
      className={`h-9 min-w-10 shrink-0 rounded-xl px-3 text-sm font-extrabold shadow-sm ring-1 ${
        active ? "bg-[#07120d] text-white ring-[#07120d]" : "bg-white text-[#07120d] ring-[#e8dcc8]"
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
            href="/social-sharing"
            className="flex min-h-[62px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-extrabold text-[var(--text-main)] no-underline shadow-[0_14px_34px_rgba(57,245,142,0.22)]"
          >
            <Share2 size={19} />
            Partager maintenant
            <ArrowRight size={19} />
          </Link>
          <Link
            href={shopHref}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-white px-4 text-sm font-extrabold text-[var(--primary)] no-underline shadow-[var(--shadow-sm)] ring-1 ring-[var(--outline)]/35"
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

function PublishDock({ loading, canSubmit, mode, count }) {
  if (!loading && !canSubmit) return null;

  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoutez les prix"
      : "Mettre en ligne";

  return (
    <div id="publish-dock" className="fixed inset-x-0 bottom-0 z-[120] border-t border-white/70 bg-white/92 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_44px_rgb(13_23_18_/_0.13)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto max-w-[460px]">
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
