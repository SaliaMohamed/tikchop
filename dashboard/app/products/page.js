"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Search,
  Share2,
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
import { withClientTimeout } from "../../lib/seller-products-client";
import { friendlyError } from "../../lib/user-facing-error";
import { compressImage } from "../../lib/image-compressor";
import { IllustrationEmptyShop } from "../components/TikchopIllustrations";
import {
  formatPrice,
  getCleanProductDescription,
  preserveExtraImagesMarker,
  getStock,
  isProductLive,
  isProductUnpublished,
  isProductOutOfStock,
  getProductStatus,
} from "../../lib/product-status-utils";

export default function ProductsPage() {
  const seller = useActiveSeller();
  const editFileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
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
        const data = await withClientTimeout(
          getSellerProducts(seller.slug, token),
          "Catalogue trop long a charger.",
        );
        setProducts(data || []);
        setHasMore((data || []).length >= 50);
      } catch (err) {
        const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
        setError(sessionExpired
          ? "Session vendeur expirée. Reconnectez-vous pour voir vos articles."
          : friendlyError(err, "Articles non charges. Verifiez la connexion puis reessayez."));
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [seller.slug]);

  async function loadMoreProducts() {
    if (!seller.slug || loadingMore || products.length === 0) return;
    const last = products[products.length - 1];
    if (!last?.created_at) {
      setHasMore(false);
      return;
    }

    try {
      setLoadingMore(true);
      setError("");
      const token = await getSellerAccessToken();
      const data = await withClientTimeout(
        getSellerProducts(seller.slug, token, { limit: 50, before: last.created_at }),
        "Catalogue trop long a charger.",
      );
      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }
      setProducts((current) => {
        const existing = new Set(current.map((product) => product.id));
        return [...current, ...data.filter((product) => !existing.has(product.id))];
      });
      setHasMore(data.length >= 50);
    } catch (err) {
      const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
      setError(sessionExpired
        ? "Session vendeur expirée. Reconnectez-vous pour voir vos articles."
        : friendlyError(err, "Articles supplementaires non charges. Reessayez."));
    } finally {
      setLoadingMore(false);
    }
  }

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
      setError(friendlyError(err, "Modification non enregistrée. Réessayez."));
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
      setNotice("Copie créée. Vous pouvez corriger son nom ou son stock.");
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
      setNotice("Article enregistré.");
    } catch (err) {
      setError(friendlyError(err, "Article non enregistré. Vérifiez le prix et le stock."));
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
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] px-4 md:px-8">
      {/* 1. Header Pur et Aéré */}
      <header className="py-8 flex items-center justify-between border-b border-[#0F2B20]/5">
        <div>
          <h1 className="font-display text-3xl font-black text-[#0F2B20] leading-none">Catalogue</h1>
          <p className="mt-2 text-xs font-semibold text-[#54685E]/60">
            {stockStats.live} article{stockStats.live > 1 ? "s" : ""} en ligne
          </p>
        </div>
        <Link 
          href="/add-product" 
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0F2B20] text-white hover:bg-[#0A1F16] active:scale-95 transition shadow-md shadow-[#0F2B20]/10" 
          aria-label="Ajouter un produit"
        >
          <Plus size={20} strokeWidth={1.5} />
        </Link>
      </header>

      {/* 2. Filtres Minimalistes (Aynid Aesthetic Tabs) */}
      <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4 pb-2">
        <div className="flex gap-6 border-b border-[#0F2B20]/5 pb-1 min-w-max">
          {[
            { value: "ALL", label: "Tous", count: stockStats.total },
            { value: "LIVE", label: "En vente", count: stockStats.live },
            { value: "HIDDEN", label: "Non publiés", count: stockStats.unpublished },
            { value: "OUT", label: "Rupture", count: stockStats.outOfStock },
            { value: "LOW", label: "Faible", count: stockStats.lowStock },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStockFilter(item.value)}
              className={`pb-2 text-sm font-black transition relative ${
                stockFilter === item.value ? "text-[#0F2B20]" : "text-[#54685E]/50 hover:text-[#0F2B20]/70"
              }`}
            >
              {item.label}
              <span className="ml-1 text-[10px] opacity-60 font-semibold">
                ({item.count})
              </span>
              {stockFilter === item.value && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#059669] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* 3. Barre de Recherche Pure */}
      <div className="mt-6 flex min-h-[50px] items-center gap-3 rounded-[20px] bg-[#0F2B20]/5 px-4">
        <Search className="shrink-0 text-[#54685E]/60" size={16} strokeWidth={1.5} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher robe, sac, taille, couleur..."
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0F2B20] outline-none placeholder:text-[#54685E]/50"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F2B20]/10 text-[#0F2B20]" aria-label="Effacer">
            <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-xs font-semibold text-amber-900 ring-1 ring-amber-100/50">
          <p>{error}</p>
          <div className="mt-3 flex gap-2">
            {sessionExpired && (
              <Link href="/login" className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#0F2B20] px-4 text-xs font-black text-white no-underline">
                Se reconnecter
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-white px-4 text-xs font-black text-amber-900 ring-1 ring-amber-200"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-xs font-extrabold text-emerald-950 ring-1 ring-emerald-100/50 animate-fade-in">
          {notice}
        </div>
      )}

      {/* 4. Liste des Produits épurée en Ligne verticale */}
      <main className="mt-8">
        {loading ? (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[20px] bg-white border border-[#0F2B20]/5 p-3" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="skeleton h-14 w-14 rounded-[14px] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton skeleton-text w-3/4" />
                  <div className="skeleton skeleton-text w-1/3" style={{ height: '0.7em' }} />
                  <div className="skeleton skeleton-round w-16" style={{ height: '1.2em' }} />
                </div>
                <div className="skeleton skeleton-round h-9 w-14 shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? null : filteredProducts.length === 0 ? (
          <EmptyProductsState hasProducts={products.length > 0} />
        ) : (
          <div className="space-y-2.5">
            {filteredProducts.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                sellerSlug={seller.slug}
                busy={busyProductId === product.id}
                onEdit={openEditor}
                index={i}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMoreProducts}
                className="mt-2 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[var(--secondary)]/8 font-extrabold text-[#0F2B20] ring-1 ring-[#0F2B20]/10 transition active:scale-[0.98] disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={17} strokeWidth={2.2} className="animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Charger plus"
                )}
              </button>
            )}
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
          onSave={async () => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
            await saveProduct();
          }}
          onShare={() => copyProductLink(editingProduct)}
          onDuplicate={async () => {
            await duplicateProductCard(editingProduct);
            closeEditor();
          }}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, active = false, warn = false }) {
  return null;
}

function NextCatalogueAction({ stats, hasProducts, onFilter }) {
  return null;
}

function CatalogueFilters({ stats, filter, onFilter }) {
  return null;
}

function EmptyProductsState({ hasProducts }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#0F2B20] rounded-[28px] my-6 relative overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(52, 211, 153,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(52, 211, 153,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex flex-col items-center">
        <IllustrationEmptyShop size={120} className="opacity-90" />
        <h3 className="mt-3 font-display text-xl font-bold text-white">
          {hasProducts ? "Aucun article trouvé" : "Aucun article en ligne"}
        </h3>
        <p className="mt-2 text-sm font-medium leading-relaxed text-white/55 max-w-[260px]">
          {hasProducts
            ? "Modifiez vos filtres ou écrivez un autre mot-clé dans la recherche."
            : "Ajoutez une photo, un prix et un stock pour commencer ? vendre en ligne."}
        </p>
        <Link href="/add-product" className="mt-6 flex min-h-[50px] w-full max-w-[240px] items-center justify-center gap-2 rounded-2xl bg-[#34D399] text-sm font-extrabold text-[#0F2B20] transition active:scale-[0.98] shadow-[0_12px_28px_rgba(52, 211, 153,0.25)] no-underline">
          <Plus size={16} />
          Ajouter un produit
        </Link>
      </div>
    </div>
  );
}

function ProductCard({ product, sellerSlug, busy, onEdit, index = 0 }) {
  const stock = getStock(product);
  const status = getProductStatus(product);
  const delay = `${Math.min(index, 6) * 0.05}s`;

  return (
    <article
      className="animate-rise-in flex items-center justify-between gap-3 rounded-[20px] bg-white border border-[#0F2B20]/5 p-3 hover:shadow-[0_4px_20px_rgba(15, 43, 32,0.03)] transition relative"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Soft Thumbnail */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[var(--surface-soft)]">
          <ProductImage src={product.image_url} />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Loader2 className="animate-spin text-white" size={14} />
            </span>
          )}
        </div>

        {/* Product Info */}
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-black text-[#0F2B20] leading-snug">
            {product.name}
          </h3>
          <p className="mt-0.5 font-display text-xs font-bold text-[#059669]">
            {formatPrice(product.price)}
          </p>
          <span className={`inline-flex items-center gap-1 mt-1 rounded-full px-2 py-0.5 text-[0.58rem] font-extrabold uppercase whitespace-nowrap ${status.toneClass}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Single edit action button */}
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="flex h-9 shrink-0 px-3.5 items-center justify-center rounded-full bg-[#0F2B20]/5 text-xs font-black text-[#0F2B20] hover:bg-[#0F2B20]/10 active:scale-95 transition"
      >
        Édit
      </button>
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
  onShare,
  onDuplicate,
}) {
  function setVisible(nextVisible) {
    setFormData((current) => ({
      ...current,
      is_active: nextVisible,
      stock_quantity: nextVisible && Number(current.stock_quantity || 0) <= 0 ? "1" : current.stock_quantity,
    }));
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-[#0F2B20]/40 backdrop-blur-sm px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
      <div className="animate-slide-up mx-auto max-h-[92vh] w-full max-w-[470px] overflow-y-auto rounded-[32px] bg-white p-5 border border-[#DCEFE3]/45 shadow-2xl space-y-4 no-scrollbar">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#059669]">Correction article</p>
            <h2 className="font-display text-2xl font-black text-[#0F2B20] mt-1">Modifier la fiche</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6FBF7] border border-[#DCEFE3]/25 text-[#0F2B20]" 
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Toggle En Vente / Masque */}
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-[#F6FBF7] border border-[#DCEFE3]/35 p-1">
          <button
            type="button"
            onClick={() => setVisible(true)}
            className={`min-h-[46px] rounded-[16px] text-xs font-black transition-all ${
              formData.is_active 
                ? "bg-[#0F2B20] text-white shadow-sm" 
                : "text-[#54685E]"
            }`}
          >
            En vente
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className={`min-h-[46px] rounded-[16px] text-xs font-black transition-all ${
              !formData.is_active 
                ? "bg-[#0F2B20] text-white shadow-sm" 
                : "text-[#54685E]"
            }`}
          >
            Masqué
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5">
          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Nom du produit</span>
            <input 
              className="w-full min-h-[50px] px-4 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none transition" 
              placeholder="Ex: Robe en soie plissée" 
              value={formData.name} 
              onChange={(event) => setFormData({ ...formData, name: event.target.value })} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Prix (FCFA)</span>
              <input 
                className="w-full min-h-[50px] px-4 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none transition" 
                type="number" 
                placeholder="Prix" 
                value={formData.price} 
                onChange={(event) => setFormData({ ...formData, price: event.target.value })} 
              />
            </div>
            
            <div className="space-y-1">
              <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Quantité Stock</span>
              <input 
                className="w-full min-h-[50px] px-4 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none transition" 
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
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Photo du produit</span>
            <button
              type="button"
              onClick={onPickImage}
              className="relative flex min-h-[140px] w-full items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-[#DCEFE3] bg-[#F6FBF7]/30 text-center hover:bg-[#F6FBF7]/50 transition"
            >
              {formData.image_url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-black/25" />
                </>
              )}
              <span className="relative z-10 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#0F2B20] shadow-sm ring-1 ring-[#DCEFE3]/40 hover:bg-[#F6FBF7] transition">
                {formData.image_url ? "Changer la photo" : "Choisir une photo"}
              </span>
              {imageUploading && (
                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#059669] shadow-sm">
                  <Loader2 className="animate-spin" size={16} />
                </span>
              )}
            </button>
          </div>

          {imageError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 border border-rose-100">{imageError}</p>
          )}

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Description WhatsApp</span>
            <textarea 
              className="w-full min-h-[84px] p-3.5 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none resize-none transition" 
              placeholder="Ex: Robe fluide 100% soie sauvage, idéale pour les cérémonies..." 
              value={formData.description} 
              onChange={(event) => setFormData({ ...formData, description: event.target.value })} 
            />
          </div>

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Tailles / Couleurs</span>
            <textarea 
              className="w-full min-h-[70px] p-3.5 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none resize-none transition" 
              placeholder="Ex: M rouge stock 2, L bleu stock 4" 
              value={formData.variants_text} 
              onChange={(event) => setFormData({ ...formData, variants_text: event.target.value })} 
            />
          </div>

          <div className="space-y-1">
            <span className="text-[0.62rem] font-black uppercase tracking-wider text-[#54685E]/80 pl-1">Mots-clés de recherche</span>
            <input 
              className="w-full min-h-[50px] px-4 rounded-xl border border-[#DCEFE3]/55 bg-[#F6FBF7]/45 text-sm font-semibold text-[#0F2B20] focus:bg-white focus:ring-1 focus:ring-[#059669] focus:border-[#059669] outline-none transition" 
              placeholder="Ex: robe, ceremonie, soie, rouge" 
              value={formData.product_keywords} 
              onChange={(event) => setFormData({ ...formData, product_keywords: event.target.value })} 
            />
          </div>
        </div>

        {/* Share & Duplicate Panel */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DCEFE3]/30">
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F6FBF7] border border-[#DCEFE3]/45 px-3 text-xs font-black text-[#0F2B20] active:scale-[0.97] transition"
          >
            <Share2 size={14} />
            Partager le lien
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={saving}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F6FBF7] border border-[#DCEFE3]/45 px-3 text-xs font-black text-[#0F2B20] active:scale-[0.97] transition"
          >
            <Copy size={14} />
            Dupliquer
          </button>
        </div>

        {/* Save Button */}
        <button 
          type="button" 
          onClick={onSave} 
          disabled={saving || imageUploading} 
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] text-sm font-black text-white hover:bg-[#0A1F16] active:scale-[0.98] transition disabled:bg-zinc-300 shadow-md shadow-[#0F2B20]/10"
        >
          <Save size={16} strokeWidth={1.5} />
          {imageUploading ? "Photo en cours..." : saving ? "Enregistrement..." : "Enregistrer"}
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
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[var(--outline)]">
        <ImagePlus size={24} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <>
      {/* Placeholder shimmer until image loads */}
      {!loaded && <div className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
