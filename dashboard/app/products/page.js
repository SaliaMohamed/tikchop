"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
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
import { friendlyError } from "../../lib/user-facing-error";

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

export default function ProductsPage() {
  const seller = useActiveSeller();
  const editFileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    image_url: "",
    description: "",
    variants_text: "",
    product_keywords: "",
  });

  useEffect(() => {
    async function loadProducts() {
      if (!seller.slug) {
        setProducts([]);
        setLoading(false);
        setError("Aucune boutique active. Reconnectez-vous pour voir vos articles.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const token = await getSellerAccessToken();
        const data = await getSellerProducts(seller.slug, token);
        setProducts(data || []);
      } catch (err) {
        const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
        setError(sessionExpired
          ? "Session vendeur expiree. Reconnectez-vous pour voir vos articles."
          : friendlyError(err, "Articles non charges. Verifiez la connexion puis reessayez."));
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
      variants_text: formatVariantsText(product.product_variants),
      product_keywords: product.product_keywords || "",
    });
  }

  function closeEditor() {
    setEditingProduct(null);
    setImageError("");
    setFormData({ name: "", price: "", stock_quantity: "", image_url: "", description: "", variants_text: "", product_keywords: "" });
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
      setImageError(friendlyError(err, "Photo non envoyee. Choisissez une image plus legere."));
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
      setError(friendlyError(err, "Article non enregistre. Verifiez le prix et le stock."));
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
      setNotice("Lien produit copie.");
    } catch (err) {
      if (err.name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        setNotice("Lien produit copie.");
      }
    }
  }

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    return products.filter((product) => {
      const stock = Number(product.stock_quantity || 0);
      const matchesQuery = !value
        || product.name?.toLowerCase().includes(value)
        || product.description?.toLowerCase().includes(value);
      const matchesStock = stockFilter === "ALL"
        || (stockFilter === "LOW" && stock > 0 && stock <= 2)
        || (stockFilter === "OUT" && stock === 0)
        || (stockFilter === "IN_STOCK" && stock > 0);

      return matchesQuery && matchesStock;
    });
  }, [products, query, stockFilter]);

  const stockStats = useMemo(() => {
    const inStock = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;
    const lowStock = products.filter((product) => {
      const stock = Number(product.stock_quantity || 0);
      return stock > 0 && stock <= 2;
    }).length;
    const outStock = products.filter((product) => Number(product.stock_quantity || 0) === 0).length;

    return { total: products.length, inStock, lowStock, outStock };
  }, [products]);
  const sessionExpired = /Session vendeur expiree|Aucune boutique active/i.test(error);

  return (
    <div className="app-shell">
      <header className="mobile-top">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="quiet-label text-[var(--primary)]">Articles</p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Mes articles</h1>
              <p className="mt-1 text-sm text-[var(--text-dim)]">Corrigez les prix, les photos et le stock quand il faut.</p>
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

          {!loading && products.length > 0 && (
            <CatalogueHealth stats={stockStats} filter={stockFilter} onFilter={setStockFilter} />
          )}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <div className="mt-3 flex flex-wrap gap-2">
            {sessionExpired && (
              <Link href="/login" className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[var(--text-main)] px-4 text-sm font-extrabold text-white no-underline">
                Se reconnecter
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold text-amber-900 ring-1 ring-amber-200"
            >
              Reessayer
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </div>
      )}

      <main className="mt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
          </div>
        ) : error ? null : filteredProducts.length === 0 ? (
          <div className="djassa-command p-8 text-center md:py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/12 text-[var(--primary-bright)]">
              <Package size={32} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-white">Aucun article en ligne</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-white/72">
              Ajoutez vos photos, vos prix et vos stocks. Tikchop pourra ensuite vendre ces articles sur WhatsApp.
            </p>
            <Link href="/add-product" className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[var(--primary-bright)] px-6 text-sm font-extrabold text-[#042719] no-underline">
              Ajouter mes photos
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
              <h2 className="text-2xl font-extrabold text-zinc-950">Corriger l&apos;article</h2>
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
              <textarea className="mobile-input min-h-[96px] resize-none bg-zinc-50" placeholder="Detail utile: couleur, matiere, etat..." value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} />
              <textarea className="mobile-input min-h-[76px] resize-none bg-zinc-50" placeholder="Tailles/couleurs: M rouge stock 2, L noir stock 1" value={formData.variants_text} onChange={(event) => setFormData({ ...formData, variants_text: event.target.value })} />
              <input className="mobile-input bg-zinc-50" placeholder="Infos pour retrouver l'article: chaussure, talon, noir..." value={formData.product_keywords} onChange={(event) => setFormData({ ...formData, product_keywords: event.target.value })} />
            </div>

            <button onClick={saveProduct} disabled={saving || imageUploading} className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              <Save size={18} />
              {imageUploading ? "Photo en cours..." : saving ? "Enregistrement..." : "Enregistrer les changements"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogueHealth({ stats, filter, onFilter }) {
  const filters = [
    { value: "ALL", label: "Tout", count: stats.total },
    { value: "IN_STOCK", label: "En stock", count: stats.inStock },
    { value: "LOW", label: "Stock bas", count: stats.lowStock },
    { value: "OUT", label: "Rupture", count: stats.outStock },
  ];

  return (
    <section className="rounded-[22px] bg-[var(--text-main)] p-3 text-white shadow-[var(--shadow-md)]">
      <div className="grid grid-cols-3 gap-2">
        <HealthMini icon={<CheckCircle2 size={16} />} label="En stock" value={stats.inStock} />
        <HealthMini icon={<AlertTriangle size={16} />} label="Bas" value={stats.lowStock} />
        <HealthMini icon={<Package size={16} />} label="Total" value={stats.total} />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-0.5">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilter(item.value)}
            className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-extrabold ${
              filter === item.value ? "bg-[var(--primary-bright)] text-[var(--text-main)]" : "bg-white/10 text-white/72"
            }`}
          >
            {item.label} {item.count}
          </button>
        ))}
      </div>
    </section>
  );
}

function HealthMini({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-2 text-center ring-1 ring-white/10">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[var(--primary-bright)]">
        {icon}
      </span>
      <p className="mt-1 font-display text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[0.62rem] font-extrabold uppercase text-white/48">{label}</p>
    </div>
  );
}

function ProductCard({ product, onEdit, onShare }) {
  const stock = Number(product.stock_quantity || 0);
  const variants = Array.isArray(product.product_variants) ? product.product_variants.filter(Boolean).slice(0, 3) : [];

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
            {variants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {variants.map((variant, index) => (
                  <span key={`${variant.label || variant.size || index}`} className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-bold text-[var(--primary)]">
                    {variant.label || variant.size || variant.color} {Number(variant.stock || 0) > 0 ? `(${variant.stock})` : ""}
                  </span>
                ))}
              </div>
            )}
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

function formatVariantsText(variants) {
  if (!Array.isArray(variants)) return "";
  return variants
    .map((variant) => {
      const label = variant.label || [variant.size, variant.color].filter(Boolean).join(" ");
      return [label, Number(variant.stock || 0) > 0 ? `stock ${variant.stock}` : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
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
