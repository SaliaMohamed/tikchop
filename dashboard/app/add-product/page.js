"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Mic, PackagePlus, Sparkles, Upload } from "lucide-react";
import { addProduct, addProductsBulk, getSellersForProductForm } from "../actions";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
}

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState("MANUAL");
  const [bulkText, setBulkText] = useState("");
  const [sellers, setSellers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "1",
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
        const products = parseBulkProducts(bulkText).map((product) => ({
          ...product,
          seller_id: formData.seller_id,
        }));
        await addProductsBulk(products);
        alert(`${products.length} produits ajoutes.`);
      } else {
        await addProduct(formData);
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

  function applyVoiceText(text) {
    const parsed = parseVoiceProduct(text);
    setFormData((current) => ({
      ...current,
      name: parsed.name || current.name,
      price: parsed.price || current.price,
      stock_quantity: parsed.stock_quantity || current.stock_quantity || "1",
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

  const bulkProducts = parseBulkProducts(bulkText);
  const canSubmit = mode === "BULK"
    ? bulkProducts.length > 0 && formData.seller_id
    : formData.seller_id && formData.name && formData.price;

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <main className="space-y-6">
        <section>
          <p className="quiet-label text-[var(--primary)]">Mise en ligne</p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Ajouter un article</h1>
          <p className="mt-1 text-base leading-6 text-[var(--text-dim)]">
            Le vendeur remplit l&apos;essentiel. Le vocal reste une option.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-2" aria-label="Choisir une methode">
          <ModeButton active={mode === "MANUAL"} icon={<Sparkles size={18} />} label="Simple" onClick={() => setMode("MANUAL")} />
          <ModeButton active={mode === "BULK"} icon={<PackagePlus size={18} />} label="Plusieurs" onClick={() => setMode("BULK")} />
          <ModeButton active={mode === "VOICE"} icon={<Mic size={18} />} label="Vocal" onClick={() => setMode("VOICE")} />
        </section>

        <section className="app-card bg-white p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <StepChip done={Boolean(formData.image_url) || mode === "BULK"} label="Photo" />
            <StepChip done={Boolean(formData.name) || bulkProducts.length > 0} label="Nom" />
            <StepChip done={Boolean(formData.price) || bulkProducts.length > 0} label="Prix" />
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
                  <p className="mt-1 text-sm text-[var(--text-dim)]">Ex: robe rouge 15000, quantite 1</p>
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
            <section className="app-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--primary)]">
                  <PackagePlus size={19} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Mettre plusieurs articles</p>
                  <p className="text-sm text-[var(--text-dim)]">Une ligne = un produit. Stock 1 par defaut.</p>
                </div>
              </div>
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
            </section>
          )}

          {mode !== "BULK" && (
            <section className="space-y-3">
              <div className="flex min-h-[154px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--outline)]/55 bg-[var(--surface-mid)] p-6 text-center md:min-h-[220px]">
                <ImagePlus className="text-[var(--secondary)]" size={44} />
                <p className="mt-3 font-semibold text-[var(--text-main)]">Photo du produit</p>
                <p className="mt-1 max-w-[15rem] text-sm leading-5 text-[var(--text-dim)]">Pour le MVP, colle le lien image juste en dessous.</p>
              </div>

              <Field label="Lien photo">
                <input type="url" name="image_url" placeholder="https://..." value={formData.image_url} onChange={handleChange} className="mobile-input" />
              </Field>
            </section>
          )}

          {mode !== "BULK" && (
            <div className="space-y-4">
              <Field label="Nom visible par le client">
                <input type="text" name="name" placeholder="Ex: Robe rouge" value={formData.name} onChange={handleChange} required className="mobile-input" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Prix">
                  <input type="number" name="price" placeholder="15000" value={formData.price} onChange={handleChange} required min="0" className="mobile-input" />
                </Field>
                <Field label="Stock">
                  <input type="number" name="stock_quantity" placeholder="1" value={formData.stock_quantity} onChange={handleChange} required min="0" className="mobile-input" />
                </Field>
              </div>

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
                <div className="flex aspect-square w-1/3 shrink-0 items-center justify-center bg-[var(--surface-mid)] text-[var(--outline)]">
                  <ImagePlus size={32} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                  <p className="truncate font-display text-xl font-semibold text-[var(--text-main)]">{formData.name || "Nouvel article"}</p>
                  <p className="mt-1 font-semibold text-[var(--primary)]">{formatPrice(formData.price)}</p>
                  <span className="mt-2 self-start rounded bg-[var(--surface-mid)] px-2 py-1 text-xs font-semibold text-[var(--secondary)]">
                    Stock: {formData.stock_quantity || 0}
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
            {loading ? "Enregistrement..." : mode === "BULK" ? `Publier ${bulkProducts.length || ""} articles` : "Mettre en ligne"}
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
  const price = priceMatch ? priceMatch[1].replace(/[^\d]/g, "") : "";
  const name = String(text || "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)?/i, "")
    .replace(/(?:quantite|quantite|stock|reste|il y a)\s*\d+/i, "")
    .replace(/[,.]/g, " ")
    .trim();

  return {
    name,
    price,
    stock_quantity: quantityMatch?.[1] || "1",
  };
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

function StepChip({ done, label }) {
  return (
    <div className={`rounded-lg border px-2 py-3 ${done ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--primary)]" : "border-[var(--outline)]/35 bg-white text-[var(--text-dim)]"}`}>
      <CheckCircle2 className="mx-auto" size={18} strokeWidth={2.5} />
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
