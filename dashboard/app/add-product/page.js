"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Loader2, Mic, PackagePlus, Sparkles, Trash2, Upload } from "lucide-react";
import { addProduct, addProductsBulk, analyzeProductImage, getSellersForProductForm, uploadProductImage } from "../actions";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
}

export default function AddProductPage() {
  const router = useRouter();
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
  const [mode, setMode] = useState("MANUAL");
  const [bulkText, setBulkText] = useState("");
  const [bulkPhotoItems, setBulkPhotoItems] = useState([]);
  const [sellers, setSellers] = useState([]);
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
    async function fetchSellers() {
      try {
        const data = await getSellersForProductForm();
        setSellers(data || []);
        if (data?.length === 1) {
          setFormData((current) => ({ ...current, seller_id: data[0].id }));
        }
      } catch (error) {
        console.error("Erreur chargement vendeurs:", error);
      }
    }

    fetchSellers();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
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
        await addProductsBulk(products);
        alert(`${products.length} produits ajoutes.`);
      } else {
        await addProduct({
          ...formData,
          description: buildDescription(formData.description, formData.size),
        });
        alert("Produit ajoute.");
      }
      router.push("/products");
    } catch (error) {
      console.error("Erreur lors de l'ajout du produit:", error);
      alert(`Erreur: ${error.message}`);
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
        setAnalysisError("IA pas encore configuree. Ajoute une cle Gemini pour remplir le nom automatiquement.");
      } finally {
        setImageAnalyzing(false);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      setImageError(error.message || "Image impossible a envoyer.");
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
              ? { ...entry, analysisError: "IA pas encore configuree. Complete a la main.", analyzing: false }
              : entry
          )));
        }
      } catch (error) {
        console.error("Bulk image upload error:", error);
        setBulkPhotoItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, uploadError: error.message || "Erreur image", uploading: false }
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

  const bulkProducts = parseBulkProducts(bulkText);
  const readyBulkPhotos = bulkPhotoItems.filter((item) => item.image_url && item.name && item.price);
  const canSubmit = mode === "BULK"
    ? formData.seller_id && !bulkUploading && (readyBulkPhotos.length > 0 || bulkProducts.length > 0)
    : formData.seller_id && formData.image_url && formData.name && formData.price && !imageUploading && !imageAnalyzing;

  return (
    <div className="app-shell pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
      <main className="space-y-5">
        <section>
          <p className="quiet-label text-[var(--primary)]">Publication rapide</p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Nouvel article</h1>
          <p className="mt-1 text-base leading-6 text-[var(--text-dim)]">
            Photo d&apos;abord. L&apos;IA remplit le nom, puis le vendeur met prix, taille et quantite.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-2" aria-label="Choisir une methode">
          <ModeButton active={mode === "MANUAL"} icon={<Sparkles size={18} />} label="1 photo" onClick={() => setMode("MANUAL")} />
          <ModeButton active={mode === "BULK"} icon={<PackagePlus size={18} />} label="Lot photos" onClick={() => setMode("BULK")} />
          <ModeButton active={mode === "VOICE"} icon={<Mic size={18} />} label="Vocal" onClick={() => setMode("VOICE")} />
        </section>

        <section className="app-card bg-white p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <StepChip done={mode === "BULK" ? bulkPhotoItems.length > 0 || bulkProducts.length > 0 : Boolean(formData.image_url)} step="1" label={mode === "BULK" ? "Photos" : "Photo"} />
            <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.name)} step="2" label="Nom" />
            <StepChip done={mode === "BULK" ? readyBulkPhotos.length > 0 || bulkProducts.length > 0 : Boolean(formData.price)} step="3" label="Prix" important />
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            <div className="app-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--primary)]">
                  <PackagePlus size={19} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Mettre plusieurs articles</p>
                  <p className="text-sm text-[var(--text-dim)]">Selectionne les photos. L&apos;IA propose le nom, puis tu completes les champs importants.</p>
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
                className="mt-4 flex min-h-[74px] w-full items-center justify-center gap-3 rounded-xl bg-[var(--primary)] px-4 text-base font-bold text-white shadow-sm active:scale-[0.99]"
              >
                {bulkUploading ? <Loader2 className="animate-spin" size={21} /> : <ImagePlus size={22} />}
                {bulkUploading ? "Envoi des photos..." : "Choisir plusieurs photos"}
              </button>
              {bulkPhotoItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm">
                    <span className="font-semibold text-[var(--text-dim)]">Articles prets</span>
                    <strong className="text-[var(--primary)]">{readyBulkPhotos.length}/{bulkPhotoItems.length}</strong>
                  </div>
                  {bulkPhotoItems.map((item, index) => (
                    <div key={item.id} className="rounded-xl border border-[var(--outline)]/35 bg-white p-3">
                      <div className="flex gap-3">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-mid)]">
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
                          <input
                            value={item.name}
                            onChange={(event) => updateBulkPhotoItem(item.id, "name", event.target.value)}
                            placeholder={item.analyzing ? "Nom propose par l'IA..." : "Nom"}
                            className="min-h-[44px] w-full rounded-lg border border-[var(--outline)]/45 bg-white px-3 text-sm font-semibold outline-none"
                          />
                          <input
                            value={item.price}
                            onChange={(event) => updateBulkPhotoItem(item.id, "price", event.target.value)}
                            placeholder="Prix obligatoire"
                            inputMode="numeric"
                            className="min-h-[48px] w-full rounded-lg border border-[var(--primary)]/45 bg-white px-3 text-base font-extrabold text-[var(--primary)] outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={item.size}
                              onChange={(event) => updateBulkPhotoItem(item.id, "size", event.target.value)}
                              placeholder="Taille"
                              className="min-h-[44px] w-full rounded-lg border border-[var(--outline)]/45 bg-white px-3 text-sm font-semibold outline-none"
                            />
                            <input
                              value={item.stock_quantity}
                              onChange={(event) => updateBulkPhotoItem(item.id, "stock_quantity", event.target.value)}
                              placeholder="Quantite"
                              inputMode="numeric"
                              className="min-h-[44px] w-full rounded-lg border border-[var(--outline)]/45 bg-white px-3 text-sm font-semibold outline-none"
                            />
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
                className={`relative flex min-h-[210px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-0 text-center transition active:scale-[0.99] md:min-h-[250px] ${
                  formData.image_url ? "border-[var(--primary)] bg-white" : "border-[var(--outline)]/55 bg-[var(--surface-mid)]"
                }`}
              >
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Apercu produit" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <span className="absolute bottom-4 left-4 right-4 flex min-h-[46px] items-center justify-center rounded-lg bg-white/92 px-4 text-sm font-bold text-[var(--primary)] shadow-sm">
                      {imageUploading ? "Envoi de la photo..." : imageAnalyzing ? "IA propose le nom..." : "Changer la photo"}
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center px-6">
                    <ImagePlus className="text-[var(--secondary)]" size={46} />
                    <span className="mt-3 font-display text-xl font-bold text-[var(--text-main)]">Choisir dans la galerie</span>
                    <span className="mt-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--primary)] shadow-sm">Appuie ici</span>
                    <span className="mt-1 max-w-[15rem] text-sm leading-5 text-[var(--text-dim)]">Une belle photo vend plus vite.</span>
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
              <section className="app-card space-y-4 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="quiet-label text-[var(--primary)]">Champs importants</p>
                    <h2 className="mt-1 font-display text-xl font-bold text-[var(--text-main)]">Prix, taille, quantite</h2>
                  </div>
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
                    Obligatoire
                  </span>
                </div>
                <Field label="Prix de vente">
                  <input type="number" name="price" placeholder="15000" value={formData.price} onChange={handleChange} required min="0" className="mobile-input text-xl text-[var(--primary)]" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Taille">
                    <input type="text" name="size" placeholder="M, L, 42..." value={formData.size} onChange={handleChange} className="mobile-input" />
                  </Field>
                  <Field label="Quantite">
                    <input type="number" name="stock_quantity" placeholder="1" value={formData.stock_quantity} onChange={handleChange} required min="0" className="mobile-input" />
                  </Field>
                </div>
              </section>

              <section className="app-card space-y-3 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="quiet-label text-[var(--secondary)]">Aide IA</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
                      {imageAnalyzing ? "Analyse en cours..." : formData.name ? "Nom propose par l'IA" : "Ajoute une photo pour activer l'IA"}
                    </p>
                  </div>
                  {imageAnalyzing ? <Loader2 className="animate-spin text-[var(--primary)]" size={22} /> : <Sparkles className="text-[var(--primary)]" size={22} />}
                </div>
                <Field label="Nom de l'article">
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

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,108,73,0.20)] transition ${
              loading || !canSubmit ? "bg-[var(--outline)]" : "bg-[var(--primary)] active:scale-[0.98]"
            }`}
          >
            <Upload size={19} />
            {loading ? "Enregistrement..." : mode === "BULK" ? `Publier ${readyBulkPhotos.length || bulkProducts.length || ""} articles` : "Mettre en ligne"}
          </button>
        </form>
      </main>
    </div>
  );
}

function parseVoiceProduct(text) {
  const source = String(text || "").toLowerCase();
  const priceMatch = source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)?/i);
  const quantityMatch = source.match(/(?:quantite|quantite|stock|reste|il y a)\s*(\d+)/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const price = priceMatch ? priceMatch[1].replace(/[^\d]/g, "") : "";
  const name = String(text || "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)?/i, "")
    .replace(/(?:quantite|quantite|stock|reste|il y a)\s*\d+/i, "")
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

function applyAnalysisToProduct(product, analysis) {
  const quantity = Number.parseInt(analysis?.quantity || product.stock_quantity || 1, 10);

  return {
    ...product,
    name: analysis?.name || product.name,
    description: analysis?.description || product.description,
    size: analysis?.size || product.size || analysis?.suggested_sizes?.[0] || "",
    stock_quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : product.stock_quantity || "1",
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

function StepChip({ done, step, label, important = false }) {
  return (
    <div className={`rounded-lg border px-2 py-3 ${done ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : important ? "border-[var(--primary)]/45 bg-white text-[var(--primary)]" : "border-[var(--outline)]/35 bg-white text-[var(--text-dim)]"}`}>
      <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"}`}>
        {done ? <CheckCircle2 size={16} strokeWidth={2.6} /> : step}
      </span>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

function ModeButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
        active ? "border-[var(--primary)] bg-white text-[var(--primary)] shadow-sm" : "border-[var(--outline)]/40 bg-[var(--surface-mid)] text-[var(--text-dim)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-[var(--text-main)]">{label}</span>
      {children}
    </label>
  );
}
