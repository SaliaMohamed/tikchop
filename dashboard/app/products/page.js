"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  Store,
  X,
} from "lucide-react";
import {
  duplicateProduct,
  getSellerProducts,
  updateProduct,
  updateProductQuick,
  uploadProductImage,
} from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { fetchSellerProductsFromMobileApi, withClientTimeout } from "../../lib/seller-products-client";
import { friendlyError } from "../../lib/user-facing-error";
import { compressImage } from "../../lib/image-compressor";

const EXTRA_IMAGES_PATTERN = /\n?\[\[TIKCHOP_EXTRA_IMAGES:([^\]]*)\]\]/i;

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function getCleanProductDescription(description) {
  return String(description || "").replace(EXTRA_IMAGES_PATTERN, "").trim();
}

function preserveExtraImagesMarker(nextDescription, previousDescription) {
  const marker = String(previousDescription || "").match(EXTRA_IMAGES_PATTERN)?.[0] || "";
  return [String(nextDescription || "").trim(), marker.trim()].filter(Boolean).join("\n");
}

function getStock(product) {
  return Number.parseInt(product?.stock_quantity || 0, 10) || 0;
}

function isProductHidden(product) {
  return product?.is_active === false || getStock(product) <= 0;
}

function isProductLive(product) {
  return !isProductHidden(product) && getStock(product) > 0;
}

function isProductUnpublished(product) {
  return product?.is_active === false;
}

function isProductOutOfStock(product) {
  return product?.is_active !== false && getStock(product) <= 0;
}

function getProductStatus(product) {
  const stock = getStock(product);
  if (product?.is_active === false) {
    return {
      label: "Masque",
      toneClass: "bg-zinc-100 text-zinc-600",
      icon: <EyeOff size={14} />,
    };
  }
  if (stock <= 0) {
    return {
      label: "Rupture",
      toneClass: "bg-red-50 text-red-700",
      icon: <AlertTriangle size={14} />,
    };
  }
  if (stock <= 2) {
    return {
      label: `Stock faible (${stock})`,
      toneClass: "bg-amber-50 text-amber-800",
      icon: <AlertTriangle size={14} />,
    };
  }
  return {
    label: `En vente (${stock})`,
    toneClass: "bg-white text-[var(--primary)]",
    icon: <CheckCircle2 size={14} />,
  };
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
  const [busyProductId, setBusyProductId] = useState("");
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
    is_active: true,
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
        let data;
        try {
          data = await withClientTimeout(
            fetchSellerProductsFromMobileApi(token),
            "Catalogue trop long a charger.",
          );
        } catch (apiError) {
          console.warn("Seller products mobile API unavailable, using server action fallback:", apiError);
          data = await withClientTimeout(
            getSellerProducts(seller.slug, token),
            "Catalogue trop long a charger.",
          );
        }
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

  const stockStats = useMemo(() => {
    const live = products.filter(isProductLive).length;
    const lowStock = products.filter((product) => {
      const stock = getStock(product);
      return isProductLive(product) && stock <= 2;
    }).length;
    const unpublished = products.filter(isProductUnpublished).length;
    const outOfStock = products.filter(isProductOutOfStock).length;
    const hidden = unpublished + outOfStock;

    return {
      total: products.length,
      live,
      lowStock,
      hidden,
      unpublished,
      outOfStock,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = [
        product.name,
        getCleanProductDescription(product.description),
        product.product_keywords,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !value || haystack.includes(value);
      const matchesStock = stockFilter === "ALL"
        || (stockFilter === "LIVE" && isProductLive(product))
        || (stockFilter === "LOW" && isProductLive(product) && getStock(product) <= 2)
        || (stockFilter === "HIDDEN" && isProductUnpublished(product))
        || (stockFilter === "OUT" && isProductOutOfStock(product));

      return matchesQuery && matchesStock;
    });
  }, [products, query, stockFilter]);

  const sessionExpired = /Session vendeur expiree|Aucune boutique active/i.test(error);

  function patchProduct(updatedProduct) {
    if (!updatedProduct?.id) return;
    setProducts((current) => current.map((item) => (
      item.id === updatedProduct.id
        ? {
          ...item,
          ...updatedProduct,
          is_active: Object.prototype.hasOwnProperty.call(updatedProduct, "is_active")
            ? updatedProduct.is_active
            : updatedProduct.stock_quantity > 0,
        }
        : item
    )));
  }

  async function runQuickUpdate(product, updates, successMessage) {
    if (!product?.id || !seller.slug) return;

    try {
      setBusyProductId(product.id);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const updated = await updateProductQuick(product.id, updates, seller.slug, token);
      patchProduct(updated);
      setNotice(successMessage);
    } catch (err) {
      setError(friendlyError(err, "Modification non enregistree. Reessayez."));
    } finally {
      setBusyProductId("");
    }
  }

  async function setProductStock(product, nextStock) {
    const cleanStock = Math.max(0, Number.parseInt(nextStock || 0, 10) || 0);
    await runQuickUpdate(
      product,
      {
        stock_quantity: cleanStock,
        is_active: cleanStock > 0,
      },
      cleanStock > 0 ? "Stock mis a jour." : "Article mis en rupture.",
    );
  }

  async function duplicateProductCard(product) {
    if (!product?.id || !seller.slug) return;

    try {
      setBusyProductId(product.id);
      setError("");
      setNotice("");
      const token = await getSellerAccessToken();
      const created = await duplicateProduct(product.id, seller.slug, token);
      setProducts((current) => [created, ...current]);
      setNotice("Copie creee. Vous pouvez corriger son nom ou son stock.");
    } catch (err) {
      setError(friendlyError(err, "Article non duplique. Reessayez."));
    } finally {
      setBusyProductId("");
    }
  }

  function openEditor(product) {
    setEditingProduct(product);
    setImageError("");
    setFormData({
      name: product.name || "",
      price: String(product.price ?? ""),
      stock_quantity: String(product.stock_quantity ?? ""),
      image_url: product.image_url || "",
      description: getCleanProductDescription(product.description),
      variants_text: formatVariantsText(product.product_variants),
      product_keywords: product.product_keywords || "",
      is_active: product.is_active !== false && getStock(product) > 0,
    });
  }

  function closeEditor() {
    setEditingProduct(null);
    setImageError("");
    setFormData({
      name: "",
      price: "",
      stock_quantity: "",
      image_url: "",
      description: "",
      variants_text: "",
      product_keywords: "",
      is_active: true,
    });
  }

  async function handleEditImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImageError("");
      setImageUploading(true);
      const preview = URL.createObjectURL(file);
      setFormData((current) => ({ ...current, image_url: preview }));

      const compressedFile = await compressImage(file);
      const payload = new FormData();
      payload.append("image", compressedFile);
      const result = await uploadProductImage(payload);
      setFormData((current) => ({ ...current, image_url: result.cleanUrl || result.url }));
    } catch (err) {
      setImageError(friendlyError(err, "Photo non envoyee. Choisissez une image plus legere."));
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  async function saveProduct() {
    if (!editingProduct) return;

    const parsedStock = Math.max(0, Number.parseInt(formData.stock_quantity || 0, 10) || 0);
    const nextIsActive = formData.is_active !== false && parsedStock > 0;
    const nextStock = nextIsActive ? Math.max(1, parsedStock || 1) : 0;

    try {
      setSaving(true);
      setError("");
      const token = await getSellerAccessToken();
      const product = await updateProduct(editingProduct.id, {
        ...formData,
        stock_quantity: nextStock,
        is_active: nextIsActive,
        description: preserveExtraImagesMarker(formData.description, editingProduct.description),
      }, seller.slug, token);
      patchProduct(product);
      closeEditor();
      setNotice("Article enregistre.");
    } catch (err) {
      setError(friendlyError(err, "Article non enregistre. Verifiez le prix et le stock."));
    } finally {
      setSaving(false);
    }
  }

  async function copyProductLink(product) {
    const url = `${window.location.origin}/${seller.slug}?product=${product.id}`;

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
      if (err?.name !== "AbortError" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice("Lien produit copie.");
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="mobile-top">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[30px] bg-[var(--text-main)] p-4 text-white shadow-[var(--shadow-lg)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary-bright)]">Catalogue vendeur</p>
                <h1 className="mt-2 font-display text-[2.05rem] font-black leading-[2.15rem] text-white md:text-4xl md:leading-tight">
                  Mes articles en ligne
                </h1>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-5 text-white/68">
                  Voyez ce qui se vend, ce qui manque, et partagez vite la boutique.
                </p>
              </div>
              <Link href="/add-product" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[var(--text-main)] no-underline shadow-sm" aria-label="Ajouter">
                <Plus size={24} strokeWidth={2.6} />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Publies" value={stockStats.live} active />
              <StatTile label="Non publies" value={stockStats.unpublished} warn={stockStats.unpublished > 0} />
              <StatTile label="Rupture" value={stockStats.outOfStock} warn={stockStats.outOfStock > 0} />
            </div>

            <NextCatalogueAction
              stats={stockStats}
              hasProducts={products.length > 0}
              onFilter={setStockFilter}
            />
          </section>

          <div className="flex min-h-[54px] items-center gap-2 rounded-[22px] border border-[var(--outline)]/55 bg-white px-4 shadow-[var(--shadow-sm)]">
            <Search className="shrink-0 text-[var(--outline)]" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher robe, sac, taille..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)]" aria-label="Effacer">
                <X size={15} />
              </button>
            )}
          </div>

          {!loading && products.length > 0 && (
            <CatalogueFilters stats={stockStats} filter={stockFilter} onFilter={setStockFilter} />
          )}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-[22px] bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
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
        <div className="mt-4 rounded-[22px] bg-emerald-50 p-4 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </div>
      )}

      <main className="mt-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
          </div>
        ) : error ? null : filteredProducts.length === 0 ? (
          <EmptyProductsState hasProducts={products.length > 0} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                sellerSlug={seller.slug}
                busy={busyProductId === product.id}
                onStock={setProductStock}
                onEdit={openEditor}
                onShare={copyProductLink}
                onDuplicate={duplicateProductCard}
              />
            ))}
          </div>
        )}
      </main>

      {editingProduct && (
        <ProductEditor
          formData={formData}
          setFormData={setFormData}
          saving={saving}
          imageUploading={imageUploading}
          imageError={imageError}
          editFileInputRef={editFileInputRef}
          onPickImage={() => editFileInputRef.current?.click()}
          onImageSelection={handleEditImageSelection}
          onClose={closeEditor}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, active = false, warn = false }) {
  return (
    <div className={`rounded-[20px] p-3 text-center ring-1 ${active ? "bg-white text-[var(--primary)] ring-white" : warn ? "bg-amber-50 text-amber-900 ring-amber-100" : "bg-white/10 text-white ring-white/10"}`}>
      <strong className="block font-display text-2xl font-black leading-none">{value}</strong>
      <span className={`mt-1 block text-[0.62rem] font-black uppercase leading-3 ${active || warn ? "text-[var(--text-dim)]" : "text-white/50"}`}>{label}</span>
    </div>
  );
}

function NextCatalogueAction({ stats, hasProducts, onFilter }) {
  if (!hasProducts) {
    return (
      <Link href="/add-product" className="mt-4 flex min-h-[58px] items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[var(--text-main)] no-underline">
        <Camera size={20} />
        Ajouter mes premiers articles
      </Link>
    );
  }

  if (stats.unpublished > 0) {
    return (
      <button type="button" onClick={() => onFilter("HIDDEN")} className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[var(--text-main)]">
        <Eye size={20} />
        Publier les articles masques
      </button>
    );
  }

  if (stats.outOfStock > 0) {
    return (
      <button type="button" onClick={() => onFilter("OUT")} className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[var(--text-main)]">
        <AlertTriangle size={20} />
        Corriger les ruptures
      </button>
    );
  }

  if (stats.lowStock > 0) {
    return (
      <button type="button" onClick={() => onFilter("LOW")} className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[var(--text-main)]">
        <AlertTriangle size={20} />
        Corriger les stocks faibles
      </button>
    );
  }

  return (
    <Link href="/social-sharing" className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--primary-bright)] px-4 text-base font-black text-[var(--text-main)] no-underline">
      <Share2 size={20} />
      Partager boutique et articles
    </Link>
  );
}

function CatalogueFilters({ stats, filter, onFilter }) {
  const filters = [
    { value: "ALL", label: "Tous", count: stats.total },
    { value: "LIVE", label: "Publies", count: stats.live },
    { value: "HIDDEN", label: "Non publies", count: stats.unpublished },
    { value: "OUT", label: "Rupture", count: stats.outOfStock },
    { value: "LOW", label: "Stock faible", count: stats.lowStock },
  ];

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {filters.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onFilter(item.value)}
          className={`min-h-[42px] shrink-0 rounded-full px-4 text-sm font-extrabold shadow-sm ${
            filter === item.value
              ? "bg-[var(--text-main)] text-white"
              : "border border-[var(--line)] bg-white text-[var(--text-main)]"
          }`}
        >
          {item.label}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.68rem] ${filter === item.value ? "bg-white/14 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptyProductsState({ hasProducts }) {
  return (
    <div className="djassa-command p-8 text-center md:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/12 text-[var(--primary-bright)]">
        <Package size={32} />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold text-white">
        {hasProducts ? "Aucun article dans ce filtre" : "Aucun article en ligne"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-5 text-white/72">
        {hasProducts
          ? "Changez le filtre ou cherchez un autre nom d'article."
          : "Ajoutez une photo, un prix et un stock. Tikchop pourra ensuite vendre ces articles sur WhatsApp."}
      </p>
      <Link href="/add-product" className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[var(--primary-bright)] px-6 text-sm font-extrabold text-[#042719] no-underline">
        Ajouter mes photos
      </Link>
    </div>
  );
}

function ProductCard({ product, sellerSlug, busy, onStock, onEdit, onShare, onDuplicate }) {
  const stock = getStock(product);
  const status = getProductStatus(product);
  const variants = Array.isArray(product.product_variants) ? product.product_variants.filter(Boolean).slice(0, 3) : [];
  const publicHref = sellerSlug ? `/${sellerSlug}?product=${product.id}` : "/onboarding";

  return (
    <article className="overflow-hidden rounded-[28px] border border-[#e8dcc8]/45 bg-white shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.22)]">
      <div className="relative aspect-square bg-[var(--surface-mid)]">
        <ProductImage src={product.image_url} />
        <span className={`absolute right-3 top-3 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[0.72rem] font-black shadow-sm ${status.toneClass}`}>
          {status.icon}
          {status.label}
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
            <Loader2 className="animate-spin" size={28} />
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 font-display text-xl font-black leading-6 text-[#07120d]">{product.name}</p>
            <p className="mt-1 font-display text-2xl font-black text-[var(--primary)]">{formatPrice(product.price)}</p>
          </div>
          <Link href={publicHref} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)] no-underline" aria-label="Voir dans la boutique">
            <Store size={18} />
          </Link>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-[#685f4f]">
          {getCleanProductDescription(product.description) || "Article visible dans la boutique Tikchop."}
        </p>

        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {variants.map((variant, index) => (
              <span key={`${variant.label || variant.size || index}`} className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-bold text-[var(--primary)]">
                {variant.label || variant.size || variant.color} {Number(variant.stock || 0) > 0 ? `(${variant.stock})` : ""}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-[26px] bg-[#fbf9f4] border border-[#e8dcc8]/40 p-3.5 space-y-3 shadow-[0_2px_10px_rgba(58,47,30,0.02)]">
          <div className="flex items-center justify-between gap-2">
            <button 
              type="button" 
              onClick={() => onStock(product, stock - 1)} 
              disabled={busy || stock <= 0} 
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#07120d] border border-[#e8dcc8]/50 shadow-sm hover:bg-[#fbf9f4] disabled:opacity-35 transition active:scale-95" 
              aria-label="Retirer un stock"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            
            <div className="text-center flex-1">
              <p className="font-display text-2xl font-black leading-none text-[#07120d]">{stock}</p>
              <p className="mt-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-[#685f4f]/80">Quantité en Stock</p>
            </div>
            
            <button 
              type="button" 
              onClick={() => onStock(product, stock + 1)} 
              disabled={busy} 
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#07120d] text-white shadow-sm hover:bg-[#122b20] disabled:opacity-55 transition active:scale-95" 
              aria-label="Ajouter un stock"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => onStock(product, stock > 0 ? 0 : 1)}
            disabled={busy}
            className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl text-xs font-black transition active:scale-[0.98] ${
              stock > 0 
                ? "bg-white text-rose-600 border border-rose-100 shadow-sm hover:bg-rose-50" 
                : "bg-[#008f5a] text-white hover:bg-[#007a4d]"
            } disabled:opacity-55`}
          >
            {stock > 0 ? <EyeOff size={14} strokeWidth={2.5} /> : <Eye size={14} strokeWidth={2.5} />}
            {stock > 0 ? "Mettre en rupture" : "Remettre en vente"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-1">
          <button 
            type="button" 
            onClick={() => onShare(product)} 
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#07120d] px-3 text-xs font-black text-white active:scale-[0.97] transition shadow-sm"
          >
            <Share2 size={15} strokeWidth={2.5} />
            Partager
          </button>
          <button 
            type="button" 
            onClick={() => onDuplicate(product)} 
            disabled={busy} 
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#e8dcc8]/45 px-3 text-xs font-black text-[#07120d] active:scale-[0.97] transition shadow-[0_2px_6px_rgba(58,47,30,0.02)]"
          >
            <Copy size={15} strokeWidth={2.5} />
            Dupliquer
          </button>
          <button 
            type="button" 
            onClick={() => onEdit(product)} 
            className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#e8dcc8]/60 px-3 text-xs font-black text-[#07120d] active:scale-[0.97] transition"
          >
            <Pencil size={15} strokeWidth={2.5} />
            Modifier l'article
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductEditor({
  formData,
  setFormData,
  saving,
  imageUploading,
  imageError,
  editFileInputRef,
  onPickImage,
  onImageSelection,
  onClose,
  onSave,
}) {
  function setVisible(nextVisible) {
    setFormData((current) => ({
      ...current,
      is_active: nextVisible,
      stock_quantity: nextVisible && Number(current.stock_quantity || 0) <= 0 ? "1" : current.stock_quantity,
    }));
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-[#07120d]/40 backdrop-blur-sm px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[470px] overflow-y-auto rounded-[32px] bg-white p-5 border border-[#e8dcc8]/45 shadow-2xl space-y-4 no-scrollbar">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#008f5a]">Correction article</p>
            <h2 className="font-display text-2xl font-black text-[#07120d] mt-1">Modifier la fiche</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbf9f4] border border-[#e8dcc8]/25 text-[#07120d]" 
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Toggle En Vente / Masque */}
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-[#fbf9f4] border border-[#e8dcc8]/35 p-1">
          <button
            type="button"
            onClick={() => setVisible(true)}
            className={`min-h-[46px] rounded-[16px] text-xs font-black transition-all ${
              formData.is_active 
                ? "bg-[#07120d] text-white shadow-sm" 
                : "text-[#685f4f]"
            }`}
          >
            En vente
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className={`min-h-[46px] rounded-[16px] text-xs font-black transition-all ${
              !formData.is_active 
                ? "bg-[#07120d] text-white shadow-sm" 
                : "text-[#685f4f]"
            }`}
          >
            Masqué
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5">
          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Nom du produit</span>
            <input 
              className="w-full min-h-[50px] px-4 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none transition" 
              placeholder="Ex: Robe en soie plissée" 
              value={formData.name} 
              onChange={(event) => setFormData({ ...formData, name: event.target.value })} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Prix (FCFA)</span>
              <input 
                className="w-full min-h-[50px] px-4 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none transition" 
                type="number" 
                placeholder="Prix" 
                value={formData.price} 
                onChange={(event) => setFormData({ ...formData, price: event.target.value })} 
              />
            </div>
            
            <div className="space-y-1">
              <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Quantité Stock</span>
              <input 
                className="w-full min-h-[50px] px-4 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none transition" 
                type="number" 
                placeholder="Stock" 
                value={formData.stock_quantity} 
                onChange={(event) => setFormData({ ...formData, stock_quantity: event.target.value, is_active: Number(event.target.value || 0) > 0 })} 
              />
            </div>
          </div>

          <input
            ref={editFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageSelection}
          />

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Photo du produit</span>
            <button
              type="button"
              onClick={onPickImage}
              className="relative flex min-h-[140px] w-full items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-[#e8dcc8] bg-[#fbf9f4]/30 text-center hover:bg-[#fbf9f4]/50 transition"
            >
              {formData.image_url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-black/25" />
                </>
              )}
              <span className="relative z-10 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#07120d] shadow-sm ring-1 ring-[#e8dcc8]/40 hover:bg-[#fbf9f4] transition">
                {formData.image_url ? "Changer la photo" : "Choisir une photo"}
              </span>
              {imageUploading && (
                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#008f5a] shadow-sm">
                  <Loader2 className="animate-spin" size={16} />
                </span>
              )}
            </button>
          </div>

          {imageError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 border border-rose-100">{imageError}</p>
          )}

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Description WhatsApp</span>
            <textarea 
              className="w-full min-h-[84px] p-3.5 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none resize-none transition" 
              placeholder="Ex: Robe fluide 100% soie sauvage, idéale pour les cérémonies..." 
              value={formData.description} 
              onChange={(event) => setFormData({ ...formData, description: event.target.value })} 
            />
          </div>

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Tailles / Couleurs</span>
            <textarea 
              className="w-full min-h-[70px] p-3.5 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none resize-none transition" 
              placeholder="Ex: M rouge stock 2, L bleu stock 4" 
              value={formData.variants_text} 
              onChange={(event) => setFormData({ ...formData, variants_text: event.target.value })} 
            />
          </div>

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#685f4f]/80 pl-1">Mots-clés de recherche</span>
            <input 
              className="w-full min-h-[50px] px-4 rounded-xl border border-[#e8dcc8]/55 bg-[#fbf9f4]/45 text-sm font-semibold text-[#07120d] focus:bg-white focus:ring-1 focus:ring-[#008f5a] focus:border-[#008f5a] outline-none transition" 
              placeholder="Ex: robe, ceremonie, soie, rouge" 
              value={formData.product_keywords} 
              onChange={(event) => setFormData({ ...formData, product_keywords: event.target.value })} 
            />
          </div>
        </div>

        {/* Save Button */}
        <button 
          type="button" 
          onClick={onSave} 
          disabled={saving || imageUploading} 
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07120d] text-sm font-black text-white hover:bg-[#122b20] active:scale-[0.98] transition disabled:bg-zinc-300 shadow-md shadow-[#07120d]/10"
        >
          <Save size={16} strokeWidth={2.5} />
          {imageUploading ? "Photo en cours..." : saving ? "Enregistrement..." : "Enregistrer les changements"}
        </button>
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
