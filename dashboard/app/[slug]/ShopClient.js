"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createOrder, initiatePayment } from "../actions";
import {
  getPaymentOption,
  getSellerAcceptedPaymentOptions,
  getSellerDefaultPaymentMethod,
} from "../../lib/local-commerce";
import { supabase } from "../../lib/supabase";
import {
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";
import { IllustrationSearch } from "../components/TikchopIllustrations";

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

function withIvorianPrefix(value) {
  const input = String(value || "").trim();
  if (!input || input === "+") return "+225 ";
  if (input.startsWith("+")) return input;
  return `+225 ${input.replace(/^225/, "").trim()}`;
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F CFA`;
}

function formatPhoneDisplay(value) {
  const digits = cleanPhone(value);
  if (!digits) return "";
  const local = digits.startsWith("225") ? digits.slice(3) : digits;
  const grouped = local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return digits.startsWith("225") ? `+225 ${grouped}` : grouped;
}

function getSellerPaymentPhone(seller) {
  return seller?.payout_phone || seller?.phone_number || "";
}

function getDirectPaymentInstruction(
  seller,
  selectedPayment,
  amountToPay,
  deliveryPaymentTiming,
  deliveryType,
  deliveryFee,
) {
  if (!selectedPayment || selectedPayment.online) {
    return "Un lien de paiement sécurisé va s'ouvrir.";
  }

  if (selectedPayment.value === "CASH_ON_DELIVERY") {
    return `Paiement à la livraison : prévoyez ${formatPrice(amountToPay)}.`;
  }

  const phone = formatPhoneDisplay(getSellerPaymentPhone(seller));
  const method = selectedPayment.shortLabel || selectedPayment.label;
  const amountText = formatPrice(amountToPay);
  const deliveryText =
    deliveryType === "DELIVERY" &&
    deliveryPaymentTiming === "AT_RECEPTION" &&
    Number(deliveryFee || 0) > 0
      ? ` La livraison (${formatPrice(deliveryFee)}) se règle à la réception.`
      : "";

  if (!phone) {
    return `${method} : la boutique confirme le numéro de paiement sur WhatsApp.${deliveryText}`;
  }

  return `${method} : réglez ${amountText} au ${phone}, puis partagez la preuve sur WhatsApp.${deliveryText}`;
}

const FALLBACK_IMAGE = "";
const EXTRA_IMAGES_PATTERN = /\n?\[\[TIKCHOP_EXTRA_IMAGES:([^\]]*)\]\]/i;

// ImageKit transformation presets (remplace Cloudinary)
const IMAGEKIT_CARD_TRANSFORM = "tr:w-600,h-600,c-fill,q-80,f-auto";
const IMAGEKIT_DETAIL_TRANSFORM = "tr:w-900,h-900,c-fill,q-80,f-auto";
const IMAGEKIT_THUMB_TRANSFORM = "tr:w-160,h-160,c-fill,q-70,f-auto";

// Cloudinary constants kept for backward compatibility with existing product URLs in DB
const CLOUDINARY_CARD_TRANSFORM =
  "e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_fill,g_auto,w_600,h_600/f_auto,q_auto:good";
const CLOUDINARY_DETAIL_TRANSFORM =
  "e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_fill,g_auto,w_900,h_900/f_auto,q_auto:good";
const CLOUDINARY_THUMB_TRANSFORM =
  "e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_fill,g_auto,w_160,h_160/f_auto,q_auto:eco";

function getCloudinaryOptimizedUrl(src, transform) {
  const value = String(src || "").trim();
  if (!value) return value;

  // ImageKit URL → apply ImageKit transform
  if (value.includes("ik.imagekit.io")) {
    // Map Cloudinary transform strings to ImageKit equivalents
    let ikTransform = IMAGEKIT_CARD_TRANSFORM;
    if (transform === CLOUDINARY_DETAIL_TRANSFORM) ikTransform = IMAGEKIT_DETAIL_TRANSFORM;
    if (transform === CLOUDINARY_THUMB_TRANSFORM) ikTransform = IMAGEKIT_THUMB_TRANSFORM;
    // Strip any existing tr: param then apply new one
    const withoutTr = value.replace(/\/tr:[^/]+\//, "/");
    return withoutTr.replace(
      /^(https:\/\/ik\.imagekit\.io\/[^/]+)\//,
      `$1/${ikTransform}/`
    );
  }

  // Legacy Cloudinary URL → apply Cloudinary transform
  if (!transform || !value.includes("/image/upload/")) return value;
  const marker = "/image/upload/";
  const markerIndex = value.indexOf(marker);
  const prefix = value.slice(0, markerIndex + marker.length);
  const rest = value.slice(markerIndex + marker.length);
  const versionMatch = rest.match(/\/?v\d+\//);
  if (!versionMatch || versionMatch.index === undefined) {
    return `${prefix}${transform}/${rest}`;
  }
  const versionStart = versionMatch.index + (versionMatch[0].startsWith("/") ? 1 : 0);
  return `${prefix}${transform}/${rest.slice(versionStart)}`;
}

function getCleanProductDescription(description) {
  return String(description || "").replace(EXTRA_IMAGES_PATTERN, "").trim();
}

function getExtraProductImages(description) {
  const match = String(description || "").match(EXTRA_IMAGES_PATTERN);
  if (!match?.[1]) return [];

  return match[1]
    .split("|")
    .map((value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    })
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getProductGallery(product) {
  return Array.from(
    new Set([
      product?.image_url || FALLBACK_IMAGE,
      ...getExtraProductImages(product?.description),
    ].filter(Boolean)),
  );
}

function productCategory(product) {
  const text = `${product.name || ""} ${getCleanProductDescription(
    product.description,
  )}`.toLowerCase();
  if (text.match(/chaussure|sneaker|sandale|talon/)) return "Chaussures";
  if (text.match(/sac|bijou|montre|accessoire|lunette/)) return "Accessoires";
  if (text.match(/robe|pagne|habit|mode|t-shirt|chemise|pantalon|costume/))
    return "Vêtements";
  if (text.match(/phone|iphone|ecouteur|chargeur|montre|electronique|ordinateur/))
    return "High-Tech";
  if (text.match(/creme|parfum|huile|beaute|cheveux|savon|maquillage/))
    return "Beauté";
  return "Tout";
}

export default function ShopClient({
  seller,
  products,
  deliveryZones = [],
  initialProductId = "",
}) {
  const deliveryEnabled = seller.delivery_enabled !== false;
  const pickupEnabled = seller.pickup_enabled !== false;
  const initialDeliveryType = deliveryEnabled ? "DELIVERY" : "PICKUP";
  const initialPaymentOptions = getSellerAcceptedPaymentOptions(seller);
  const initialPaymentMethod = getSellerDefaultPaymentMethod(
    seller,
    initialPaymentOptions.map((option) => option.value),
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tout");
  const [selectedProduct, setSelectedProduct] = useState(() =>
    initialProductId ? products.find((item) => item.id === initialProductId) || null : null,
  );
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryType, setDeliveryType] = useState(initialDeliveryType);
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+225 ");
  const [customerNote, setCustomerNote] = useState("");
  const [noteListening, setNoteListening] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [checkoutNotice, setCheckoutNotice] = useState("");

  const categories = useMemo(() => {
    const values = new Set(products.map((product) => productCategory(product)));
    return [
      { value: "Tout", label: "Tout" },
      { value: "Vêtements", label: "Vêtements" },
      { value: "Chaussures", label: "Chaussures" },
      { value: "Accessoires", label: "Accessoires" },
      { value: "Beauté", label: "Beauté" },
      { value: "High-Tech", label: "High-Tech" },
    ].filter((item) => item.value === "Tout" || values.has(item.value));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !normalizedQuery ||
        `${product.name} ${getCleanProductDescription(product.description)}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesCategory =
        category === "Tout" || productCategory(product) === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, products, query]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((item) => item.id === productId);
        return product ? { product, quantity } : null;
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (total, item) => total + Number(item.product.price || 0) * item.quantity,
    0,
  );
  const selectedZone = deliveryZones.find((zone) => zone.name === deliveryZone);
  const displayedDeliveryFee =
    deliveryType === "DELIVERY"
      ? Number(selectedZone?.fee ?? seller.fixed_delivery_fee ?? 0)
      : 0;
  const deliveryPaymentTiming = seller.delivery_payment_timing || "AT_RECEPTION";
  const deliveryFeePaidOnline =
    deliveryType === "DELIVERY" && deliveryPaymentTiming === "INCLUDED";
  const onlinePaymentTotal = cartTotal + (deliveryFeePaidOnline ? displayedDeliveryFee : 0);
  const orderGrandTotal = cartTotal + displayedDeliveryFee;

  const paymentOptions = useMemo(() => getSellerAcceptedPaymentOptions(seller), [seller]);
  const effectivePaymentMethod = paymentOptions.some(
    (option) => option.value === paymentMethod,
  )
    ? paymentMethod
    : getSellerDefaultPaymentMethod(
        seller,
        paymentOptions.map((option) => option.value),
      );

  function addToCart(product, quantity = 1) {
    const stock = Number(product.stock_quantity || 0);
    if (stock <= 0) return;

    setCart((current) => {
      const currentQuantity = current[product.id] || 0;
      return {
        ...current,
        [product.id]: Math.min(stock, currentQuantity + quantity),
      };
    });
  }

  function decrement(productId) {
    setCart((current) => {
      const currentQuantity = current[productId] || 0;
      if (currentQuantity <= 1) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: currentQuantity - 1 };
    });
  }

  async function handleCheckout(selectedMethod = effectivePaymentMethod) {
    if (
      !customerPhone ||
      (deliveryType === "DELIVERY" && (!deliveryZone || !deliveryAddress))
    ) {
      setCheckoutNotice("Veuillez renseigner votre WhatsApp, commune et adresse.");
      return;
    }

    const selectedPayment = getPaymentOption(selectedMethod);
    setIsSubmitting(true);
    setCheckoutNotice("");

    try {
      const checkoutItems = cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));

      const createdOrder = await createOrder(seller.id, checkoutItems, {
        paymentMethod: selectedPayment.value,
        deliveryType,
        deliveryZone,
        deliveryAddress,
        customerPhone,
        customerNote,
      });

      const { orderId, orderRef, productsTotal, deliveryFee, totalToPay } = createdOrder;
      const receiptUrl = `${window.location.origin}/receipt?order=${encodeURIComponent(
        orderId,
      )}`;

      if (selectedPayment.online) {
        const { authorization_url } = await initiatePayment(orderId);
        window.location.href = authorization_url;
        return;
      }

      const amountToPayNow =
        selectedPayment.value === "CASH_ON_DELIVERY"
          ? productsTotal + deliveryFee
          : totalToPay;
      const paymentInstruction = getDirectPaymentInstruction(
        seller,
        selectedPayment,
        amountToPayNow,
        deliveryPaymentTiming,
        deliveryType,
        deliveryFee,
      );

      const textWithOrder = [
        `Bonjour ${seller.name}, je confirme ma commande sur votre boutique Tikchop.`,
        ``,
        `🧾 *Commande #${orderRef}*`,
        `Articles :`,
        ...cartItems.map(({ product, quantity }) => {
          const lineTotal = Number(product.price || 0) * quantity;
          return `• ${quantity}× ${product.name} — ${formatPrice(lineTotal)}`;
        }),
        `---`,
        `Sous-total : ${formatPrice(productsTotal)}`,
        `Livraison : ${deliveryType === "PICKUP" ? "Retrait en boutique" : deliveryZone}`,
        `Frais livraison : ${formatPrice(deliveryFee)}`,
        `*TOTAL : ${formatPrice(productsTotal + deliveryFee)}*`,
        `---`,
        `Téléphone client : ${customerPhone}`,
        deliveryType === "PICKUP"
          ? `Mode : Retrait boutique`
          : `Adresse : ${deliveryZone} — ${deliveryAddress}`,
        customerNote ? `Précision : ${customerNote}` : "",
        `Mode de règlement : ${selectedPayment.label}`,
        `Instruction : ${paymentInstruction}`,
        ``,
        `Consulter le reçu : ${receiptUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      const finalUrl = `https://wa.me/${cleanPhone(seller.phone_number)}?text=${encodeURIComponent(
        textWithOrder,
      )}`;

      setOrderSuccess({
        orderRef,
        receiptUrl,
        whatsappUrl: finalUrl,
        total: productsTotal + deliveryFee,
      });
      setCart({});
      setCustomerNote("");
      setCartOpen(false);
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setCheckoutNotice("Une erreur est survenue lors de la commande. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startCustomerNoteVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setNoteListening(true);
    recognition.onend = () => setNoteListening(false);
    recognition.onerror = () => setNoteListening(false);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setCustomerNote((current) => [current, text].filter(Boolean).join(" ").trim());
    };
    recognition.start();
  }

  const brandColor = seller.brand_color || "#059669";
  const brandStyles = {
    "--primary": brandColor,
    "--accent": brandColor,
  };

  return (
    <div style={brandStyles} className="min-h-screen bg-[#F8FAF9] text-zinc-900">
      {/* Topbar Boutique */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-zinc-200">
              {seller.logo_url ? (
                <Image
                  src={seller.logo_url}
                  alt={seller.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <span className="text-xs font-black text-emerald-800">
                  {seller.name?.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold text-zinc-900 md:text-base">
                {seller.name}
              </h1>
              <p className="flex items-center gap-1.5 text-[0.68rem] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Boutique certifiée Tikchop
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {seller.slug && (
              <Link
                href={`/${seller.slug}/chat`}
                className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/60 transition active:scale-95 no-underline"
              >
                <MessageCircle size={14} />
                <span className="hidden sm:inline">Discuter</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition active:scale-95 shadow-sm"
              aria-label="Voir le panier"
            >
              <ShoppingBag size={16} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[0.55rem] font-black text-zinc-950">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Corps du Storefront */}
      <main className="mx-auto max-w-4xl px-3.5 py-4 md:px-4 md:py-6">
        {/* Barre de Recherche & Catégories */}
        <section className="space-y-3">
          <div className="relative flex items-center rounded-2xl bg-white px-3.5 shadow-sm ring-1 ring-zinc-200/80">
            <Search size={17} className="text-zinc-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un article..."
              className="min-h-[46px] w-full bg-transparent px-2.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filtres Catégories Horizontaux */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((item) => {
              const active = category === item.value;
              const count =
                item.value === "Tout"
                  ? products.length
                  : products.filter((p) => productCategory(p) === item.value).length;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
                    active
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[0.62rem] ${
                      active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Grille de Produits */}
        <section className="mt-4 pb-28 md:pb-12">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] || 0}
                  onOpen={() => setSelectedProduct(product)}
                  onAdd={() => addToCart(product)}
                  onMinus={() => decrement(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200/80">
              <IllustrationSearch size={90} />
              <h3 className="mt-3 font-display text-base font-bold text-zinc-900">
                Aucun article trouvé
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Essayez un autre mot-clé ou sélectionnez une autre catégorie.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("Tout");
                }}
                className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Floating Sticky Cart Bar on Mobile */}
      {cartCount > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 md:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 font-black text-xs">
                {cartCount}
              </div>
              <span className="text-xs font-extrabold text-white/90">
                {cartCount} article{cartCount > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-black text-emerald-400">
                {formatPrice(cartTotal)}
              </span>
              <span className="rounded-xl bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                Commander →
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Modal Fiche Produit */}
      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          quantity={cart[selectedProduct.id] || 0}
          onClose={() => setSelectedProduct(null)}
          onAdd={() => addToCart(selectedProduct)}
          onMinus={() => decrement(selectedProduct.id)}
        />
      )}

      {/* Tiroir Panier & Commande */}
      {cartOpen && (
        <CartSheet
          cartItems={cartItems}
          cartTotal={cartTotal}
          isSubmitting={isSubmitting}
          onCheckout={handleCheckout}
          onClose={() => setCartOpen(false)}
          deliveryType={deliveryType}
          setDeliveryType={setDeliveryType}
          deliveryZone={deliveryZone}
          setDeliveryZone={setDeliveryZone}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          seller={seller}
          deliveryZones={deliveryZones}
          deliveryEnabled={deliveryEnabled}
          pickupEnabled={pickupEnabled}
          displayedDeliveryFee={displayedDeliveryFee}
          orderGrandTotal={orderGrandTotal}
          paymentMethod={effectivePaymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentOptions={paymentOptions}
          customerNote={customerNote}
          setCustomerNote={setCustomerNote}
          noteListening={noteListening}
          onNoteVoice={startCustomerNoteVoice}
          checkoutNotice={checkoutNotice}
        />
      )}

      {/* Écran Succès de Commande */}
      {orderSuccess && (
        <OrderSuccessSheet
          order={orderSuccess}
          sellerSlug={seller.slug}
          onClose={() => setOrderSuccess(null)}
        />
      )}
    </div>
  );
}

function ProductTile({ product, quantity, onOpen, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);
  const lowStock = stock > 0 && stock < 4;
  const isOutOfStock = stock === 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all active:scale-[0.98] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
      {/* Conteneur Image */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-50"
      >
        <SafeProductImage
          src={product.image_url}
          alt={product.name}
          sizes="(max-width: 768px) 50vw, 25vw"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          transform={CLOUDINARY_CARD_TRANSFORM}
        />

        {/* Badges sur l'image */}
        {isOutOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-zinc-900 shadow-sm">
              Rupture
            </span>
          </div>
        ) : lowStock ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[0.62rem] font-bold text-white shadow-sm backdrop-blur-sm">
            Plus que {stock}
          </span>
        ) : null}
      </div>

      {/* Informations Produit Sous l'Image */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => e.key === "Enter" && onOpen()}
          className="cursor-pointer text-left"
        >
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-zinc-900 md:text-sm">
            {product.name}
          </h3>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-1.5">
          <span className="font-display text-xs font-black text-emerald-700 md:text-sm">
            {formatPrice(product.price)}
          </span>

          <div onClick={(e) => e.stopPropagation()}>
            <CartControl
              quantity={quantity}
              stock={stock}
              onAdd={onAdd}
              onMinus={onMinus}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function CartControl({ quantity, stock, onAdd, onMinus }) {
  if (quantity > 0) {
    return (
      <div className="flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-1.5 text-white shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMinus();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          aria-label="Moins"
        >
          <Minus size={12} />
        </button>
        <span className="px-1 text-xs font-black">{quantity}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          aria-label="Plus"
        >
          <Plus size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      disabled={stock === 0}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400 shadow-sm"
      aria-label="Ajouter au panier"
    >
      <Plus size={15} />
    </button>
  );
}

function ProductSheet({ product, quantity, onClose, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);
  const gallery = useMemo(() => getProductGallery(product), [product]);
  const description = getCleanProductDescription(product.description);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = gallery[activeImageIndex] || gallery[0] || FALLBACK_IMAGE;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-4">
      <div className="mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:rounded-3xl">
        {/* Photo Gallery */}
        <div className="relative aspect-square w-full bg-slate-100">
          <SafeProductImage
            src={activeImage}
            alt={product.name}
            sizes="500px"
            className="object-cover"
            transform={CLOUDINARY_DETAIL_TRANSFORM}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md backdrop-blur"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          {gallery.length > 1 && (
            <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-2 ${
                    activeImageIndex === idx ? "ring-emerald-500" : "ring-transparent"
                  }`}
                >
                  <SafeProductImage
                    src={img}
                    alt=""
                    sizes="48px"
                    className="object-cover"
                    transform={CLOUDINARY_THUMB_TRANSFORM}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Détails Produit */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-emerald-700">
                {productCategory(product)}
              </span>
              <h2 className="mt-0.5 font-display text-xl font-bold text-zinc-900">
                {product.name}
              </h2>
            </div>
            <p className="font-display text-lg font-black text-emerald-700">
              {formatPrice(product.price)}
            </p>
          </div>

          {description && (
            <p className="mt-3 text-xs leading-relaxed text-zinc-600 whitespace-pre-line">
              {description}
            </p>
          )}

          <div className="mt-6">
            {quantity > 0 ? (
              <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-emerald-700 px-4 text-white">
                <button
                  type="button"
                  onClick={onMinus}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
                >
                  <Minus size={16} />
                </button>
                <span className="text-sm font-bold">{quantity} dans le panier</span>
                <button
                  type="button"
                  onClick={onAdd}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
                >
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                disabled={stock === 0}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-sm font-bold text-white transition active:scale-[0.98] disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                <ShoppingBag size={17} />
                <span>{stock > 0 ? "Ajouter au panier" : "Article épuisé"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSheet({
  cartItems,
  cartTotal,
  isSubmitting,
  onCheckout,
  onClose,
  deliveryType,
  setDeliveryType,
  deliveryZone,
  setDeliveryZone,
  deliveryAddress,
  setDeliveryAddress,
  customerPhone,
  setCustomerPhone,
  seller,
  deliveryZones,
  deliveryEnabled,
  pickupEnabled,
  displayedDeliveryFee,
  orderGrandTotal,
  paymentMethod,
  setPaymentMethod,
  paymentOptions,
  customerNote,
  setCustomerNote,
  noteListening,
  onNoteVoice,
  checkoutNotice,
}) {
  const selectedPayment = getPaymentOption(paymentMethod);
  const directPaymentOptions = (paymentOptions || []).filter((opt) => !opt.online);
  const onlinePaymentOptions = (paymentOptions || []).filter((opt) => opt.online);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-4">
      <div className="mx-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl">
        {/* Header Tiroir */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <div>
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700">
              Votre commande
            </span>
            <h3 className="font-display text-base font-extrabold text-zinc-900">
              {cartItems.length} article{cartItems.length > 1 ? "s" : ""} · {formatPrice(cartTotal)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {checkoutNotice && (
          <div className="mx-4 mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
            {checkoutNotice}
          </div>
        )}

        {/* Scrollable Form */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* 1. Liste des articles */}
          <div className="divide-y divide-zinc-100 rounded-2xl bg-slate-50 p-3 ring-1 ring-zinc-200/60">
            {cartItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-zinc-900">{product.name}</p>
                  <p className="text-[0.7rem] text-zinc-500">
                    {quantity} × {formatPrice(product.price)}
                  </p>
                </div>
                <span className="font-display text-xs font-bold text-zinc-900">
                  {formatPrice(Number(product.price || 0) * quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* 2. Réception */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-800">Mode de récupération</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!deliveryEnabled}
                onClick={() => setDeliveryType("DELIVERY")}
                className={`flex items-center gap-2 rounded-xl p-3 text-left transition ${
                  deliveryType === "DELIVERY"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-slate-50 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Truck size={16} />
                <div>
                  <p className="text-xs font-bold">Livraison</p>
                  <p className="text-[0.65rem] opacity-70">À domicile</p>
                </div>
              </button>

              <button
                type="button"
                disabled={!pickupEnabled}
                onClick={() => setDeliveryType("PICKUP")}
                className={`flex items-center gap-2 rounded-xl p-3 text-left transition ${
                  deliveryType === "PICKUP"
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-slate-50 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Store size={16} />
                <div>
                  <p className="text-xs font-bold">Retrait</p>
                  <p className="text-[0.65rem] opacity-70">En boutique</p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Coordonnées & Adresse */}
          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-bold text-zinc-800">Numéro WhatsApp</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(withIvorianPrefix(e.target.value))}
                placeholder="+225 07 00 00 00 00"
                className="mt-1 flex h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-medium text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {deliveryType === "DELIVERY" && (
              <>
                <div>
                  <label className="text-xs font-bold text-zinc-800">Commune de livraison</label>
                  {deliveryZones.length > 0 ? (
                    <div className="no-scrollbar mt-1 flex gap-1.5 overflow-x-auto pb-1">
                      {deliveryZones.map((z) => (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => setDeliveryZone(z.name)}
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                            deliveryZone === z.name
                              ? "bg-emerald-700 text-white"
                              : "bg-slate-50 text-zinc-700 ring-1 ring-zinc-200"
                          }`}
                        >
                          {z.name} ({formatPrice(z.fee)})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={deliveryZone}
                      onChange={(e) => setDeliveryZone(e.target.value)}
                      placeholder="Ex: Cocody, Yopougon, Marcory..."
                      className="mt-1 flex h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-medium text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-800">Adresse / Point de repère</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Quartier, rue, immeuble..."
                    className="mt-1 flex h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-medium text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-zinc-800">Note ou précision (optionnel)</label>
              <div className="mt-1 flex items-center rounded-xl bg-slate-50 px-3 ring-1 ring-zinc-200">
                <input
                  type="text"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Taille, couleur, heure souhaitée..."
                  className="h-11 w-full bg-transparent text-xs font-medium text-zinc-900 outline-none"
                />
                <button
                  type="button"
                  onClick={onNoteVoice}
                  className={`p-1 text-zinc-400 ${noteListening ? "text-red-500" : ""}`}
                >
                  <Mic size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Mode de Règlement */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-800">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2">
              {directPaymentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`rounded-xl p-3 text-left transition ${
                    paymentMethod === opt.value
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-slate-50 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  <p className="text-xs font-bold">{opt.shortLabel || opt.label}</p>
                  <p className="mt-0.5 text-[0.62rem] opacity-70">{opt.hint}</p>
                </button>
              ))}
              {onlinePaymentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`rounded-xl p-3 text-left transition ${
                    paymentMethod === opt.value
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-slate-50 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  <p className="text-xs font-bold">{opt.shortLabel || opt.label}</p>
                  <p className="mt-0.5 text-[0.62rem] opacity-70">Carte / Mobile en ligne</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Checkout */}
        <div className="border-t border-zinc-100 bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-500">Total net à payer</span>
            <span className="font-display text-xl font-black text-emerald-700">
              {formatPrice(orderGrandTotal)}
            </span>
          </div>

          <button
            type="button"
            disabled={isSubmitting || !cleanPhone(customerPhone)}
            onClick={() => onCheckout(paymentMethod)}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-md transition active:scale-[0.98] hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {isSubmitting ? (
              <span>Préparation de la commande...</span>
            ) : selectedPayment.online ? (
              <>
                <CreditCard size={17} />
                <span>Payer en ligne</span>
              </>
            ) : (
              <>
                <MessageCircle size={17} />
                <span>Confirmer sur WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderSuccessSheet({ order, sellerSlug, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 text-center shadow-2xl md:rounded-3xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={30} />
        </div>
        <h3 className="mt-4 font-display text-xl font-black text-zinc-900">
          Commande enregistrée !
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Référence <strong className="text-zinc-900">#{order.orderRef}</strong> —{" "}
          {formatPrice(order.total)}
        </p>

        <div className="mt-5 space-y-2">
          {order.whatsappUrl && (
            <a
              href={order.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm no-underline"
            >
              <MessageCircle size={16} />
              <span>Ouvrir WhatsApp vendeur</span>
            </a>
          )}
          <a
            href={order.receiptUrl}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900 no-underline hover:bg-zinc-200"
          >
            <ReceiptText size={16} />
            <span>Voir mon reçu d&apos;achat</span>
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs font-bold text-zinc-400 hover:text-zinc-700"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function SafeProductImage({
  src,
  alt,
  sizes,
  className,
  transform = "",
  priority = false,
}) {
  const [prevProps, setPrevProps] = useState({ src, transform });
  const [imageSrc, setImageSrc] = useState(() =>
    getCloudinaryOptimizedUrl(src, transform),
  );

  if (src !== prevProps.src || transform !== prevProps.transform) {
    setPrevProps({ src, transform });
    setImageSrc(getCloudinaryOptimizedUrl(src, transform));
  }

  if (!imageSrc) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-zinc-400">
        <Package size={24} />
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt || "Article"}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setImageSrc("")}
    />
  );
}

