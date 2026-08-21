"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Music2,
  Package,
  Search,
  Share2,
  Store,
} from "lucide-react";
import { getSellerProducts } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { withClientTimeout } from "../../lib/seller-products-client";
import { friendlyError } from "../../lib/user-facing-error";
import { IllustrationShare } from "../components/TikchopIllustrations";

function formatPrice(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "Prix a confirmer";
  return `${amount.toLocaleString("fr-FR")} F`;
}

function getProductStock(product) {
  return Number.parseInt(product?.stock_quantity || 0, 10) || 0;
}

function isPublished(product) {
  return product?.is_active !== false && getProductStock(product) > 0;
}

function productPath(seller, product) {
  if (!seller?.slug || !product?.id) return "/";
  return `/${seller.slug}?product=${product.id}`;
}

function buildShopCaption(seller, products) {
  const names = products.slice(0, 4).map((product) => product.name).filter(Boolean);
  const preview = names.length ? `\nArticles dispo: ${names.join(", ")}.` : "";

  return [
    `${seller.name || "Ma boutique"} est en ligne sur Tikchop.`,
    "Viens voir les articles, commander sur WhatsApp et payer facilement.",
    preview,
  ].filter(Boolean).join("\n");
}

function buildProductCaption(product, seller, url) {
  return [
    `${product.name || "Article disponible"} - ${formatPrice(product.price)}`,
    product.description ? String(product.description).trim() : "",
    `Disponible chez ${seller.name || "ma boutique"}.`,
    "Commande directement sur WhatsApp.",
    url,
  ].filter(Boolean).join("\n");
}

export default function SocialSharingPage() {
  const seller = useActiveSeller();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      if (!seller.slug) {
        if (alive) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const token = await getSellerAccessToken();
        const data = await withClientTimeout(
          getSellerProducts(seller.slug, token),
          "Articles trop longs à charger.",
        );
        if (alive) setProducts(data || []);
      } catch (loadError) {
        if (alive) setError(friendlyError(loadError, "Impossible de charger les articles."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      alive = false;
    };
  }, [seller.slug]);

  const publicShopUrl = useMemo(() => {
    const path = seller.slug ? `/${seller.slug}` : "/onboarding";
    return origin ? `${origin}${path}` : path;
  }, [origin, seller.slug]);
  const publishedProducts = useMemo(() => products.filter(isPublished), [products]);
  const filteredProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return publishedProducts;
    return publishedProducts.filter((product) => {
      const searchable = `${product.name || ""} ${product.description || ""}`.toLowerCase();
      return searchable.includes(cleanQuery);
    });
  }, [publishedProducts, query]);
  const featuredProducts = publishedProducts.slice(0, 6);
  const shopCaption = useMemo(() => `${buildShopCaption(seller, featuredProducts)}\n${publicShopUrl}`, [seller, featuredProducts, publicShopUrl]);

  const copyText = useCallback(async (text, label = "Texte copie") => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(label);
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setError("Copie impossible. Selectionne le texte puis copie-le manuellement.");
    }
  }, []);

  const shareWhatsApp = useCallback((text) => {
    if (typeof window === "undefined") return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8">
      <section className="overflow-hidden rounded-[30px] bg-[#0F2B20] text-white shadow-[var(--shadow-lg)] ring-1 ring-black/10 md:rounded-[34px]">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_200px_360px]">
          <div className="p-4 md:p-7 flex flex-col justify-center">
            <p className="quiet-label text-[var(--primary-bright)]">Partage</p>
            <h1 className="mt-2 font-display text-[2.05rem] font-black leading-[2.15rem] md:text-5xl md:leading-[1.02]">
              Publier vite. Vendre clair.
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => shareWhatsApp(shopCaption)}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl bg-[var(--primary-bright)] px-4 text-sm font-black text-[#0F2B20] shadow-[0_18px_42px_rgb(240_149_76_/_0.25)]"
              >
                <MessageCircle size={18} />
                Boutique
              </button>
              <button
                type="button"
                onClick={() => copyText(publicShopUrl, "Lien boutique copie")}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/12"
              >
                <Copy size={18} />
                Copier le lien
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center p-4">
            <IllustrationShare size={140} />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-white/10 bg-white/6 p-3 md:grid-cols-1 md:border-l md:border-t-0 md:p-4">
            <ShareStat label="Articles" value={publishedProducts.length} active={publishedProducts.length > 0} />
            <ShareStat label="Textes" value="3" active />
            <ShareStat label="Boutique" value={seller.slug ? "OK" : "A finir"} active={Boolean(seller.slug)} />
          </div>
        </div>
      </section>

      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#E7F6ED] px-4 py-3 text-sm font-black text-[#047857] ring-1 ring-emerald-200">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <main className="mt-4 grid gap-4 md:mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <PlatformCard
              icon={<MessageCircle size={22} />}
              title="WhatsApp"
              text="Statuts et groupes."
              actionLabel="Envoyer"
              onAction={() => shareWhatsApp(shopCaption)}
            />
            <PlatformCard
              icon={<Music2 size={22} />}
              title="TikTok"
              text="Video ou live."
              actionLabel="Copier"
              onAction={() => copyText(`Nouveau chez ${seller.name || "Tikchop"}.\n${featuredProducts[0]?.name || "Articles disponibles"} a commander ici: ${publicShopUrl}`, "Legende TikTok copiee")}
            />
            <PlatformCard
              icon={<Share2 size={22} />}
              title="Instagram"
              text="Story, reel, post."
              actionLabel="Copier"
              onAction={() => copyText(shopCaption, "Caption copiee")}
            />
          </div>

          <section className="rounded-[26px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[#0F2B20]/8 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="quiet-label text-[#059669]">Articles a partager</p>
                <h2 className="font-display text-2xl font-black text-[#0F2B20]">Articles</h2>
              </div>
              <Link href="/add-product" className="inline-flex min-h-[44px] items-center gap-2 rounded-[18px] bg-[#0F2B20] px-4 text-sm font-black text-[#34D399] no-underline">
                <Package size={18} />
                Ajouter
              </Link>
            </div>

            <label className="mt-4 flex min-h-[54px] items-center gap-3 rounded-[20px] bg-[#F6FBF7] px-4 text-[#0F2B20] ring-1 ring-[#0F2B20]/10">
              <Search size={19} className="text-[#059669]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[#0F2B20]/40"
                placeholder="Rechercher..."
              />
            </label>

            {loading ? (
              <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-[24px] bg-[#F6FBF7] text-sm font-black text-[#0F2B20]/50 ring-1 ring-[#0F2B20]/10">
                <Loader2 size={20} className="mr-2 animate-spin text-[#059669]" />
                Chargement...
              </div>
            ) : filteredProducts.length === 0 ? (
              <EmptyShareState hasProducts={products.length > 0} />
            ) : (
              <div className="mt-4 grid gap-3">
                {filteredProducts.map((product) => {
                  const path = productPath(seller, product);
                  const url = origin ? `${origin}${path}` : path;
                  const caption = buildProductCaption(product, seller, url);

                  return (
                    <article key={product.id} className="grid gap-3 rounded-[24px] bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/10 md:grid-cols-[100px_1fr]">
                      <div className="relative h-32 overflow-hidden rounded-[20px] bg-white ring-1 ring-[#0F2B20]/5 md:h-[108px]">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[#059669]/40 bg-[#F6FBF7]">
                            <Package size={26} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black text-[#0F2B20]">{product.name}</h3>
                            <p className="mt-0.5 text-sm font-black text-[#059669]">{formatPrice(product.price)}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-black uppercase text-[#0F2B20]/50 shadow-sm ring-1 ring-[#0F2B20]/5">
                            Stock {getProductStock(product)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <button type="button" onClick={() => copyText(caption, "Texte article copie")} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-[#0F2B20] shadow-sm ring-1 ring-[#0F2B20]/5 active:scale-[0.98] transition-transform">
                            <Copy size={16} />
                            Texte
                          </button>
                          <button type="button" onClick={() => shareWhatsApp(caption)} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#EAF8F0] px-3 text-xs font-black text-[#047857] ring-1 ring-[#059669]/20 active:scale-[0.98] transition-transform">
                            <MessageCircle size={16} />
                            WhatsApp
                          </button>
                          <Link href={path} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#0F2B20] px-3 text-xs font-black text-white no-underline shadow-[0_4px_12px_rgba(15, 43, 32,0.2)] active:scale-[0.98] transition-transform">
                            <ExternalLink size={16} />
                            Voir
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[#0F2B20]/8 md:p-5">
            <p className="quiet-label text-[#059669]">Message</p>
            <h2 className="mt-1 font-display text-xl font-black text-[#0F2B20]">Pret</h2>
            <textarea
              readOnly
              value={shopCaption}
              className="mt-3 min-h-[190px] w-full resize-none rounded-[22px] bg-[#F6FBF7] p-4 text-sm font-bold leading-6 text-[#0F2B20] outline-none ring-1 ring-[#0F2B20]/10"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copyText(shopCaption, "Texte boutique copie")} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-[#0F2B20] px-3 text-sm font-black text-[#34D399] active:scale-[0.98] transition-transform">
                <Copy size={17} />
                Copier
              </button>
              <button type="button" onClick={() => shareWhatsApp(shopCaption)} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-[#EAF8F0] px-3 text-sm font-black text-[#047857] ring-1 ring-[#059669]/20 active:scale-[0.98] transition-transform">
                <Share2 size={17} />
                WhatsApp
              </button>
            </div>
          </section>

          <section className="rounded-[26px] bg-[#fcf1d1] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[#f4c13a]/40 md:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F2B20] text-[#f4c13a]">
                <Bot size={21} />
              </span>
              <div>
                <h2 className="font-display text-xl font-black text-[#133327]">Partagez. Tikchop suit.</h2>
                <p className="mt-1 text-sm font-bold leading-6 text-[#74572a]">Commande et livraison restent dans l&apos;app.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] bg-white p-4 shadow-[var(--shadow-sm)] ring-1 ring-[#0F2B20]/8 md:p-5">
            <p className="quiet-label text-[#059669]">Lien public</p>
            <div className="mt-2 flex items-center gap-2 rounded-[20px] bg-[#F6FBF7] p-2 ring-1 ring-[#0F2B20]/5">
              <span className="min-w-0 flex-1 truncate px-2 text-sm font-black text-[#0F2B20]">{publicShopUrl}</span>
              <button type="button" onClick={() => copyText(publicShopUrl, "Lien copie")} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-white text-[#059669] shadow-sm ring-1 ring-[#0F2B20]/10 active:scale-[0.98]">
                <Copy size={17} />
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function ShareStat({ label, value, active }) {
  return (
    <div className={`rounded-2xl p-3 ring-1 ${active ? "bg-white text-[#0F2B20] ring-white/30" : "bg-white/8 text-white ring-white/10"}`}>
      <strong className="block font-display text-2xl font-black leading-none">{value}</strong>
      <small className={`mt-1 block text-[0.66rem] font-black uppercase leading-3 ${active ? "text-[#3E6B55]" : "text-white/54"}`}>{label}</small>
    </div>
  );
}

function PlatformCard({ icon, title, text, actionLabel, onAction }) {
  const brandKey = String(title || "").toLowerCase();
  let pillStyle = "bg-[#F6FBF7] text-[#059669] ring-[#0F2B20]/5";
  if (brandKey === "whatsapp") pillStyle = "bg-[#ECF5EF] text-[#25d366] ring-[#25d366]/10";
  if (brandKey === "tiktok") pillStyle = "bg-[#09090b] text-white ring-white/10 shadow-[1px_1px_4px_rgba(255,0,80,0.4)]";
  if (brandKey === "instagram") pillStyle = "bg-[linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)] text-white ring-purple-500/10";

  return (
    <article className="rounded-[24px] bg-white p-4 ring-1 ring-[#0F2B20]/8">
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ring-1 ${pillStyle}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-black text-[#0F2B20]">{title}</h3>
          <p className="mt-0.5 text-xs font-bold leading-5 text-[#0F2B20]/50">{text}</p>
        </div>
      </div>
      <button type="button" onClick={onAction} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#F6FBF7] px-3 text-sm font-black text-[#0F2B20] ring-1 ring-[#0F2B20]/10 active:scale-[0.98] transition-transform">
        <Share2 size={17} />
        {actionLabel}
      </button>
    </article>
  );
}

function EmptyShareState({ hasProducts }) {
  return (
    <div className="mt-5 rounded-[24px] bg-[#F6FBF7] p-5 text-center ring-1 ring-[#0F2B20]/10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#059669] shadow-sm">
        {hasProducts ? <Search size={28} /> : <Store size={28} />}
      </span>
      <h3 className="mt-4 font-display text-2xl font-black text-[#0F2B20]">
        {hasProducts ? "Aucun article" : "Ajoutez un article"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-6 text-[#0F2B20]/50">
        {hasProducts ? "Essayez un autre mot." : "Une photo, un nom et un prix suffisent."}
      </p>
      <Link href="/add-product" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-[18px] bg-[#0F2B20] px-5 text-sm font-black text-[#34D399] no-underline shadow-[0_12px_24px_rgba(15, 43, 32,0.15)] active:scale-[0.98] transition-transform">
        Ajouter un article
      </Link>
    </div>
  );
}
