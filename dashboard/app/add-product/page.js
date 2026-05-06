"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Camera,
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
  const router = useRouter();
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
  const [listening, setListening] = useState(false);
  const [bulkListeningId, setBulkListeningId] = useState("");
  const [mode, setMode] = useState("BULK");
  const [bulkText, setBulkText] = useState("");
  const [bulkPhotoItems, setBulkPhotoItems] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "1",
    size: "",
    description: "",
    image_url: "",
    seller_id: "",
  });

  useEffect(() => {
    if (activeSeller.id) {
      setFormData((current) => ({ ...current, seller_id: activeSeller.id }));
    }
  }, [activeSeller.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const token = await getSellerAccessToken();
      if (mode === "BULK") {
        const photoProducts = bulkPhotoItems
          .filter((item) => item.image_url && item.name && item.price)
          .map((item) => ({
            name: item.name,
            price: item.price,
            stock_quantity: item.stock_quantity || 1,
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
        alert(`${products.length} produits ajoutes.`);
      } else {
        await addProduct({
          ...formData,
          description: buildDescription(formData.description, formData.size),
        }, token);
        alert("Produit ajoute.");
      }
      router.push("/products");
    } catch (error) {
      console.error("Erreur lors de l'ajout du produit:", error);
      alert(friendlyError(error, "Article non publie. Verifie surtout le prix, la taille et le stock."));
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
        setAnalysisError("Nom non propose. Complete les infos a la main.");
      } finally {
        setImageAnalyzing(false);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      setImageError(friendlyError(error, "Photo non envoyee. Choisis une image plus legere ou une connexion plus stable."));
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
              ? { ...entry, analysisError: "Nom non propose. Complete a la main.", analyzing: false }
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

  function applyVoiceText(text) {
    const parsed = parseVoiceProduct(text);
    setFormData((current) => ({
      ...current,
      name: parsed.name || current.name,
      price: parsed.price || current.price,
      stock_quantity: parsed.stock_quantity || current.stock_quantity || "1",
      size: parsed.size || current.size,
      description: text || current.description,
    }));
  }

  function startVoiceCapture() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La dictee vocale n'est pas disponible ici. Le vendeur peut utiliser le micro du clavier.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
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
          description: text || item.description,
        }
        : item
    )));
  }

  function startBulkVoiceCapture(id) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La dictee vocale n'est pas disponible ici. Le vendeur peut utiliser le micro du clavier.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setBulkListeningId(id);
    recognition.onend = () => setBulkListeningId("");
    recognition.onerror = () => setBulkListeningId("");
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      applyBulkVoiceText(id, text);
    };
    recognition.start();
  }

  const sellers = activeSeller.id ? [activeSeller] : [];
  const bulkProducts = parseBulkProducts(bulkText);
  const readyBulkPhotos = bulkPhotoItems.filter((item) => item.image_url && item.name && item.price);
  const publishCount = mode === "BULK" ? readyBulkPhotos.length || bulkProducts.length : canSingleProductSubmit(formData, imageUploading, imageAnalyzing) ? 1 : 0;
  const selectedCount = mode === "BULK" ? bulkPhotoItems.length || bulkProducts.length : formData.image_url ? 1 : 0;
  const progressLabel = mode === "BULK"
    ? `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length || 0} pret${readyBulkPhotos.length > 1 ? "s" : ""}`
    : formData.price ? "Prix pret" : formData.image_url ? "Photo prete" : "Photo attendue";
  const canSubmit = mode === "BULK"
    ? formData.seller_id && !bulkUploading && (readyBulkPhotos.length > 0 || bulkProducts.length > 0)
    : formData.seller_id && formData.image_url && formData.name && formData.price && !imageUploading && !imageAnalyzing;
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
      const target = document.getElementById("product-details") || document.getElementById("bulk-products");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    onPublish: () => formRef.current?.requestSubmit(),
    onVoice: startVoiceCapture,
  });

  return (
    <div className="app-shell pb-[calc(10rem+env(safe-area-inset-bottom,0px))]">
      <main className="space-y-5">
        <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-5 text-white shadow-[var(--shadow-lg)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="quiet-label text-white/55">Assistant article</p>
                <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-white">Publier sans taper</h1>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--primary-bright)]">
                <Sparkles size={23} />
              </span>
            </div>
            <p className="mt-3 max-w-sm text-base font-semibold leading-6 text-white/72">
              Selectionne les photos. Tikchop propose le nom. Le vendeur valide surtout le prix, la taille et la quantite.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <HeroMiniStat icon={<ImagePlus size={16} />} label={`${selectedCount} photo${selectedCount > 1 ? "s" : ""}`} />
              <HeroMiniStat icon={<Sparkles size={16} />} label="IA" />
              <HeroMiniStat icon={<BadgeCheck size={16} />} label={progressLabel} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2" aria-label="Choisir une methode">
          <ModeButton active={mode === "BULK"} icon={<Layers3 size={19} />} label="Photos" hint="Recommande" onClick={() => setMode("BULK")} />
          <ModeButton active={mode === "MANUAL"} icon={<Camera size={19} />} label="1 article" hint="Simple" onClick={() => setMode("MANUAL")} />
          <ModeButton active={mode === "VOICE"} icon={<Mic size={19} />} label="Vocal" hint="Option" onClick={() => setMode("VOICE")} />
        </section>

        <section className="rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.34)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <StepChip done={mode === "BULK" ? bulkPhotoItems.length > 0 || bulkProducts.length > 0 : Boolean(formData.image_url)} step="1" label={mode === "BULK" ? "Photos" : "Photo"} />
            <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.name)} step="2" label="Nom" />
            <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.price)} step="3" label="Prix" important />
          </div>
        </section>

        <NextActionCard assistant={assistant} />

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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
                  <p className="font-semibold text-[var(--text-main)]">Parler au lieu d&apos;ecrire</p>
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
                  <p className="font-display text-lg font-bold text-[var(--text-main)]">Galerie du telephone</p>
                  <p className="text-sm leading-5 text-[var(--text-dim)]">Choisis plusieurs photos, puis complete seulement ce qui manque.</p>
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
                    <span className="block text-xs font-semibold text-white/58">Selection multiple depuis la galerie</span>
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
                  <div id="bulk-products" className="space-y-3">
                  {bulkPhotoItems.map((item, index) => (
                    <div key={item.id} className="rounded-[24px] border border-[var(--outline)]/35 bg-white p-3 shadow-[0_14px_30px_rgb(16_24_20_/_0.07)]">
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
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-[var(--text-main)]">Article {index + 1}</p>
                              {item.analyzing && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                                  <Loader2 className="animate-spin" size={12} />
                                  IA analyse...
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => startBulkVoiceCapture(item.id)} className={`flex h-8 w-8 items-center justify-center rounded-full ${bulkListeningId === item.id ? "bg-red-500 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`} aria-label="Dicter cet article">
                                <Mic size={15} />
                              </button>
                              <button type="button" onClick={() => removeBulkPhotoItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)]" aria-label="Retirer">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--text-dim)]">
                            Prix obligatoire. Le micro peut remplir taille et quantite.
                          </p>
                          <input
                            value={item.name}
                            onChange={(event) => updateBulkPhotoItem(item.id, "name", event.target.value)}
                            placeholder={item.analyzing ? "Nom propose par l'IA..." : "Nom"}
                            className="min-h-[46px] w-full rounded-2xl border border-[var(--outline)]/45 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                          />
                          <input
                            value={item.price}
                            onChange={(event) => updateBulkPhotoItem(item.id, "price", event.target.value)}
                            placeholder="Prix"
                            inputMode="numeric"
                            className="min-h-[58px] w-full rounded-[20px] border border-[var(--primary)]/45 bg-[#fbfff9] px-4 font-display text-2xl font-extrabold text-[var(--primary)] outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_rgb(5_122_85_/_0.13)]"
                          />
                          <div className="space-y-2">
                            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                              {["S", "M", "L", "XL", "38", "39", "40"].map((size) => (
                                <QuickValueButton key={size} active={item.size === size} label={size} onClick={() => updateBulkPhotoItem(item.id, "size", size)} />
                              ))}
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={item.size}
                                onChange={(event) => updateBulkPhotoItem(item.id, "size", event.target.value)}
                                placeholder="Taille autre"
                                className="min-h-[46px] w-full rounded-2xl border border-[var(--outline)]/45 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                              />
                              <div className="flex min-h-[46px] items-center rounded-2xl border border-[var(--outline)]/45 bg-white p-1">
                                {[1, 2, 3].map((quantity) => (
                                  <button
                                    key={quantity}
                                    type="button"
                                    onClick={() => updateBulkPhotoItem(item.id, "stock_quantity", quantity)}
                                    className={`h-9 min-w-9 rounded-xl text-sm font-extrabold ${Number(item.stock_quantity) === quantity ? "bg-[var(--text-main)] text-white" : "text-[var(--text-dim)]"}`}
                                  >
                                    {quantity}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {item.description && (
                        <p className="mt-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--text-dim)]">{item.description}</p>
                      )}
                      {item.analysisError && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{item.analysisError}</p>
                      )}
                      {item.uploadError && (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{item.uploadError}</p>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>

            <details className="app-card p-4">
              <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">Ou coller une liste sans photos</summary>
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                rows="7"
                placeholder={"Robe rouge - 15000\nSac noir - 8500\nBijoux bleus - 5000"}
                className="mobile-input mt-4 resize-none"
              />
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm">
                <span className="text-[var(--text-dim)]">Prets a publier</span>
                <strong className="text-[var(--primary)]">{bulkProducts.length} article{bulkProducts.length > 1 ? "s" : ""}</strong>
              </div>
              {bulkProducts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {bulkProducts.slice(0, 4).map((product, index) => (
                    <div key={`${product.name}-${index}`} className="flex items-center justify-between rounded-lg border border-[var(--outline)]/35 bg-white px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-[var(--text-main)]">{product.name}</span>
                      <span className="shrink-0 font-semibold text-[var(--primary)]">{formatPrice(product.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </details>
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
                      {imageUploading ? "Envoi de la photo..." : imageAnalyzing ? "IA propose le nom..." : "Changer la photo"}
                    </span>
                  </>
                ) : (
                  <span className="flex w-full flex-col items-center px-6">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]">
                      <ImagePlus size={30} />
                    </span>
                    <span className="mt-4 font-display text-2xl font-bold text-[var(--text-main)]">Ouvrir la galerie</span>
                    <span className="mt-2 max-w-[17rem] text-sm leading-5 text-[var(--text-dim)]">Choisis la photo la plus claire. Le nom sera propose automatiquement.</span>
                    <span className="mt-4 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-extrabold text-[var(--primary)]">Appuie ici</span>
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Taille" icon={<Ruler size={16} />}>
                      <input type="text" name="size" placeholder="M, L, 42" value={formData.size} onChange={handleChange} className="mobile-input" />
                    </Field>
                    <Field label="Stock" icon={<Boxes size={16} />}>
                      <input type="number" name="stock_quantity" placeholder="1" value={formData.stock_quantity} onChange={handleChange} required min="0" className="mobile-input" />
                    </Field>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="quiet-label text-[var(--secondary)]">Aide IA</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
                      {imageAnalyzing ? "Analyse en cours..." : formData.name ? "Nom propose par l'IA" : "Ajoute une photo pour activer l'IA"}
                    </p>
                  </div>
                  {imageAnalyzing ? <Loader2 className="animate-spin text-[var(--primary)]" size={22} /> : <Sparkles className="text-[var(--primary)]" size={22} />}
                </div>
                <Field label="Nom de l'article" icon={<Sparkles size={16} />}>
                  <input type="text" name="name" placeholder="Ex: Robe rouge" value={formData.name} onChange={handleChange} required className="mobile-input" />
                </Field>
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
          />
        </form>
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
  return {
    ...product,
    name: analysis?.name || product.name,
    description: analysis?.description || product.description,
  };
}

function buildDescription(description, size) {
  const parts = [];
  if (size) parts.push(`Taille: ${size}`);
  if (description) parts.push(description);
  return parts.join("\n");
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
        body: "Garde cette page ouverte. Tikchop va creer une fiche par image.",
        label: "Envoi en cours",
        icon: <Loader2 className="animate-spin" size={20} />,
        disabled: true,
      };
    }

    if (bulkPhotoItems.length === 0 && bulkProducts.length === 0) {
      return {
        step: "1",
        title: "Selectionne les articles",
        body: "Ouvre la galerie et choisis toutes les photos du lot.",
        label: "Ouvrir la galerie",
        icon: <ImagePlus size={20} />,
        onClick: onBulkPhoto,
      };
    }

    if (!canSubmit) {
      return {
        step: "2",
        title: "Complete les prix",
        body: `${readyBulkPhotos.length}/${bulkPhotoItems.length || bulkProducts.length} article pret. Le prix est le champ le plus important.`,
        label: "Completer",
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
      title: "Commence par la photo",
      body: mode === "VOICE"
        ? "Tu peux dicter les infos, mais il faut quand meme une photo pour vendre."
        : "Une photo claire aide l'IA et rassure le client.",
      label: "Ouvrir la galerie",
      icon: <ImagePlus size={20} />,
      onClick: onPhoto,
    };
  }

  if (imageUploading || imageAnalyzing) {
    return {
      step: "IA",
      title: imageUploading ? "Photo en envoi" : "Tikchop analyse l'image",
      body: "Patiente quelques secondes. Le nom peut se remplir automatiquement.",
      label: "Analyse en cours",
      icon: <Loader2 className="animate-spin" size={20} />,
      disabled: true,
    };
  }

  if (!formData.name || !formData.price) {
    return {
      step: "2",
      title: "Valide le nom et le prix",
      body: "Le vendeur peut ecrire ou dicter. Le prix est obligatoire avant publication.",
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
          <p className={`quiet-label ${assistant.strong ? "text-white/55" : "text-[var(--primary)]"}`}>Action suivante</p>
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

function StepChip({ done, step, label, important = false }) {
  return (
    <div className={`rounded-2xl border px-2 py-3 ${done ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : important ? "border-[var(--primary)]/45 bg-white text-[var(--primary)]" : "border-[var(--outline)]/35 bg-white text-[var(--text-dim)]"}`}>
      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${done ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
        {done ? <CheckCircle2 size={16} strokeWidth={2.6} /> : step}
      </span>
      <p className="mt-1 text-xs font-bold">{label}</p>
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

function PublishDock({ loading, canSubmit, mode, count }) {
  const label = loading
    ? "Publication..."
    : mode === "BULK"
      ? count > 0 ? `Publier ${count} article${count > 1 ? "s" : ""}` : "Ajoute les prix"
      : "Mettre en ligne";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-white/70 bg-white/92 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-18px_44px_rgb(13_23_18_/_0.13)] backdrop-blur-2xl md:left-1/2 md:max-w-[480px] md:-translate-x-1/2 md:rounded-t-[28px] md:border-x">
      <div className="mx-auto max-w-[460px]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-dim)]">Mise en vente</span>
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
