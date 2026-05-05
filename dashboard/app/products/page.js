"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  X,
} from "lucide-react";
import { getSellerProducts, updateProduct, uploadProductImage } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export default function ProductsPage() {
  const seller = useActiveSeller();
  const editFileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    image_url: "",
    description: "",
  });

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError("");
        const token = await getSellerAccessToken();
        const data = await getSellerProducts(seller.slug, token);
        setProducts(data || []);
      } catch (err) {
        setError(err.message || "Impossible de charger le catalogue.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [seller.slug]);

  function openEditor(product) {
    setEditingProduct(product);
    setImageError("");
    setFormData({
      name: product.name || "",
      price: String(product.price ?? ""),
      stock_quantity: String(product.stock_quantity ?? ""),
      image_url: product.image_url || "",
      description: product.description || "",
    });
  }

  function closeEditor() {
    setEditingProduct(null);
    setImageError("");
    setFormData({ name: "", price: "", stock_quantity: "", image_url: "", description: "" });
  }

  async function handleEditImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImageError("");
      setImageUploading(true);
      const preview = URL.createObjectURL(file);
      setFormData((current) => ({ ...current, image_url: preview }));

      const payload = new FormData();
      payload.append("image", file);
      const result = await uploadProductImage(payload);
      setFormData((current) => ({ ...current, image_url: result.url }));
    } catch (err) {
      setImageError(err.message || "Image impossible a envoyer.");
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  async function saveProduct() {
    if (!editingProduct) return;

    try {
      setSaving(true);
      setError("");
      const token = await getSellerAccessToken();
      const product = await updateProduct(editingProduct.id, formData, seller.slug, token);
      setProducts((current) => current.map((item) => (item.id === product.id ? product : item)));
      closeEditor();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer le produit.");
    } finally {
      setSaving(false);
    }
  }

  async function copyProductLink(product) {
    const origin = window.location.origin;
    const url = `${origin}/${seller.slug}?product=${product.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `${product.name} - ${formatPrice(product.price)}`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      alert("Lien produit copie.");
    } catch (err) {
      if (err.name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        alert("Lien produit copie.");
      }
    }
  }

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;

    return products.filter((product) => (
      product.name?.toLowerCase().includes(value)
      || product.description?.toLowerCase().includes(value)
    ));
  }, [products, query]);

  return (
    <div className="app-shell">
      <header className="mobile-top">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="quiet-label text-[var(--primary)]">Boutique</p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Catalogue</h1>
              <p className="mt-1 text-sm text-[var(--text-dim)]">Prix, stock, lien de partage. Tout est ici.</p>
            </div>
            <Link href="/add-product" className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-[var(--text-main)] px-4 text-sm font-extrabold text-white no-underline shadow-[var(--shadow-sm)]" aria-label="Ajouter">
              <Plus size={20} strokeWidth={2.6} />
              <span className="hidden min-[360px]:inline">Ajouter</span>
            </Link>
          </div>

          <div className="flex min-h-[54px] items-center gap-2 rounded-2xl border border-[var(--outline)]/70 bg-white px-4 shadow-[var(--shadow-sm)]">
            <Search className="shrink-0 text-[var(--outline)]" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher robe, sac, taille..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
            />
          </div>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      <main className="mt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="app-card p-8 text-center md:py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Package size={32} />
            </div>
            <h2 className="mt-4 text-xl font-black text-zinc-950">Aucun produit</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-zinc-500">
              Ajoute les articles que les clients verront dans la boutique.
            </p>
            <Link href="/add-product" className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[var(--primary-bright)] px-6 text-sm font-semibold text-[#042719] no-underline">
              Ajouter un produit
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onEdit={() => openEditor(product)} onShare={() => copyProductLink(product)} />
            ))}
          </div>
        )}
      </main>

      {editingProduct && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-zinc-950">Modifier produit</h2>
              <button onClick={closeEditor} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input className="mobile-input bg-zinc-50" placeholder="Nom du produit" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="mobile-input bg-zinc-50" type="number" placeholder="Prix" value={formData.price} onChange={(event) => setFormData({ ...formData, price: event.target.value })} />
                <input className="mobile-input bg-zinc-50" type="number" placeholder="Stock" value={formData.stock_quantity} onChange={(event) => setFormData({ ...formData, stock_quantity: event.target.value })} />
              </div>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditImageSelection}
              />
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="relative flex min-h-[156px] items-center justify-center overflow-hidden rounded-xl border border-[var(--outline)]/45 bg-zinc-50 text-center"
              >
                {formData.image_url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-black/25" />
                  </>
                )}
                <span className="relative z-10 rounded-lg bg-white/95 px-4 py-3 text-sm font-extrabold text-[var(--primary)] shadow-sm">
                  {formData.image_url ? "Changer la photo" : "Choisir une photo"}
                </span>
                {imageUploading && (
                  <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-sm">
                    <Loader2 className="animate-spin" size={20} />
                  </span>
                )}
              </button>
              {imageError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{imageError}</p>
              )}
              <textarea className="mobile-input min-h-[96px] resize-none bg-zinc-50" placeholder="Description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} />
            </div>

            <button onClick={saveProduct} disabled={saving || imageUploading} className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              <Save size={18} />
              {imageUploading ? "Photo en cours..." : saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onEdit, onShare }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
      <div className="relative aspect-square bg-[var(--surface-mid)]">
        <ProductImage src={product.image_url} />
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[0.72rem] font-extrabold shadow-sm ${stock > 0 ? "bg-white text-[var(--primary)]" : "bg-red-50 text-red-700"}`}>
          {stock > 0 ? `En stock (${stock})` : "Rupture (0)"}
        </span>
        <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/92 text-[var(--text-main)] shadow-sm">
          <Camera size={17} />
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between space-y-4 p-4">
        <div>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold leading-7 text-[var(--text-main)]">{product.name}</p>
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-[var(--text-dim)]">
              {product.description || "Article visible dans la boutique Tikchop."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-2xl font-bold text-[var(--primary)]">{formatPrice(product.price)}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--outline)]/50 bg-white text-[var(--secondary)] shadow-sm" aria-label={`Modifier ${product.name}`}>
              <Pencil size={17} />
            </button>
            <button onClick={onShare} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--text-main)] text-white shadow-sm" aria-label={`Partager ${product.name}`}>
              <Share2 size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductImage({ src }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[var(--outline)]">
        <ImagePlus size={30} />
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </>
  );
}
