"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createOrder, initiatePayment } from "../actions";
import { getPaymentOption, getSellerAcceptedPaymentOptions, getSellerDefaultPaymentMethod } from "../../lib/local-commerce";
import { supabase } from "../../lib/supabase";
import {
  CreditCard,
  CheckCircle2,
  ChevronRight,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";

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
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
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

function getDirectPaymentInstruction(seller, selectedPayment, amountToPay, deliveryPaymentTiming, deliveryType, deliveryFee) {
  if (!selectedPayment || selectedPayment.online) {
    return "Un lien de paiement securise va s'ouvrir.";
  }

  if (selectedPayment.value === "CASH_ON_DELIVERY") {
    return `Paiement apres reception: prevoyez ${formatPrice(amountToPay)}.`;
  }

  const phone = formatPhoneDisplay(getSellerPaymentPhone(seller));
  const method = selectedPayment.shortLabel || selectedPayment.label;
  const amountText = formatPrice(amountToPay);
  const deliveryText = deliveryType === "DELIVERY" && deliveryPaymentTiming === "AT_RECEPTION" && Number(deliveryFee || 0) > 0
    ? ` La livraison (${formatPrice(deliveryFee)}) se paie apres reception.`
    : "";

  if (!phone) {
    return `${method}: le vendeur confirme le numero de paiement sur WhatsApp.${deliveryText}`;
  }

  return `${method}: payez ${amountText} directement au ${phone}, puis envoyez la preuve sur WhatsApp.${deliveryText}`;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800";
const EXTRA_IMAGES_PATTERN = /\n?\[\[TIKCHOP_EXTRA_IMAGES:([^\]]*)\]\]/i;

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
  return Array.from(new Set([
    product?.image_url || FALLBACK_IMAGE,
    ...getExtraProductImages(product?.description),
  ].filter(Boolean)));
}

function productCategory(product) {
  const text = `${product.name || ""} ${getCleanProductDescription(product.description)}`.toLowerCase();
  if (text.match(/chaussure|sneaker|sandale/)) return "Chaussures";
  if (text.match(/sac|bijou|montre|accessoire/)) return "Accessoires";
  if (text.match(/robe|pagne|habit|mode|t-shirt|chemise/)) return "Vetements";
  if (text.match(/phone|ecouteur|chargeur|montre|electron/)) return "Tech";
  if (text.match(/creme|parfum|huile|beaute|cheveux/)) return "Beaute";
  return "Tout";
}

export default function ShopClient({ seller, products, deliveryZones = [], initialProductId = "" }) {
  const deliveryEnabled = seller.delivery_enabled !== false;
  const pickupEnabled = seller.pickup_enabled !== false;
  const initialDeliveryType = deliveryEnabled ? "DELIVERY" : "PICKUP";
  const initialPaymentOptions = getSellerAcceptedPaymentOptions(seller);
  const initialPaymentMethod = getSellerDefaultPaymentMethod(seller, initialPaymentOptions.map((option) => option.value));
  const [query, setQuery] = useState("");
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [category, setCategory] = useState("Tout");
  const [selectedProduct, setSelectedProduct] = useState(() => (
    initialProductId ? products.find((item) => item.id === initialProductId) || null : null
  ));
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
      { value: "Vetements", label: "Vetements" },
      { value: "Accessoires", label: "Accessoires" },
      { value: "Chaussures", label: "Chaussures" },
      { value: "Beaute", label: "Beaute" },
      { value: "Tech", label: "Tech" },
    ].filter((item) => item.value === "Tout" || values.has(item.value));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !normalizedQuery || `${product.name} ${getCleanProductDescription(product.description)}`.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "Tout" || productCategory(product) === category;
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
  const cartTotal = cartItems.reduce((total, item) => total + Number(item.product.price || 0) * item.quantity, 0);
  const selectedZone = deliveryZones.find((zone) => zone.name === deliveryZone);
  const displayedDeliveryFee = deliveryType === "DELIVERY"
    ? Number(selectedZone?.fee ?? seller.fixed_delivery_fee ?? 0)
    : 0;
  const deliveryPaymentTiming = seller.delivery_payment_timing || "AT_RECEPTION";
  const deliveryFeePaidOnline = deliveryType === "DELIVERY" && deliveryPaymentTiming === "INCLUDED";
  const onlinePaymentTotal = cartTotal + (deliveryFeePaidOnline ? displayedDeliveryFee : 0);
  const orderGrandTotal = cartTotal + displayedDeliveryFee;
  const availableProducts = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;
  const availableProductsLabel = `${availableProducts} article${availableProducts > 1 ? "s" : ""}`;
  const shopReady = availableProducts > 0;
  const singleProductLayout = filteredProducts.length === 1;
  const paymentOptions = useMemo(() => getSellerAcceptedPaymentOptions(seller), [seller]);
  const effectivePaymentMethod = paymentOptions.some((option) => option.value === paymentMethod)
    ? paymentMethod
    : getSellerDefaultPaymentMethod(seller, paymentOptions.map((option) => option.value));
  const paymentLabels = paymentOptions
    .filter((option) => ["WAVE", "ORANGE_MONEY", "MTN_MONEY", "CASH_ON_DELIVERY"].includes(option.value))
    .slice(0, 4);

  useEffect(() => {
    let active = true;

    async function detectOwnerView() {
      if (!supabase || !seller.owner_user_id) return;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (active) setIsOwnerView(Boolean(userId && userId === seller.owner_user_id));
    }

    detectOwnerView();

    return () => {
      active = false;
    };
  }, [seller.owner_user_id]);

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
    if (!customerPhone || (deliveryType === "DELIVERY" && (!deliveryZone || !deliveryAddress))) {
      setCheckoutNotice("Ajoutez votre numero WhatsApp, la commune et l'adresse de livraison.");
      return;
    }

    const selectedPayment = getPaymentOption(selectedMethod);

    setIsSubmitting(true);
    setCheckoutNotice("");
    let createdOrder = null;
    try {
      const checkoutItems = cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      
      createdOrder = await createOrder(seller.id, checkoutItems, {
        paymentMethod: selectedPayment.value,
        deliveryType,
        deliveryZone,
        deliveryAddress,
        customerPhone,
        customerNote
      });
      const { orderId, orderRef, productsTotal, deliveryFee, totalToPay } = createdOrder;
      const receiptUrl = `${window.location.origin}/receipt?order=${encodeURIComponent(orderId)}`;
      
      if (selectedPayment.online) {
        const { authorization_url } = await initiatePayment(orderId);
        window.location.href = authorization_url;
        return;
      }

      const amountToPayNow = selectedPayment.value === "CASH_ON_DELIVERY"
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
        `Bonjour ${seller.name}, je veux confirmer ma commande Tikchop.`,
        ``,
        `Commande: ${orderRef}`,
        `Articles:`,
        ...cartItems.map(({ product, quantity }) => {
          const lineTotal = Number(product.price || 0) * quantity;
          return `- ${quantity} x ${product.name} - ${formatPrice(lineTotal)}`;
        }),
        `---`,
        `Produits: ${formatPrice(productsTotal)}`,
        `Livraison: ${deliveryType === "PICKUP" ? "Retrait boutique" : deliveryZone}`,
        `Frais livraison: ${formatPrice(deliveryFee)}`,
        `TOTAL: ${formatPrice(productsTotal + deliveryFee)}`,
        `---`,
        `Numero client: ${customerPhone}`,
        `Commune: ${deliveryType === "PICKUP" ? "Retrait" : deliveryZone}`,
        `Adresse: ${deliveryType === "PICKUP" ? "Retrait boutique" : deliveryAddress}`,
        customerNote ? `Details client: ${customerNote}` : `Details client: A confirmer si besoin`,
        `Paiement souhaite: ${selectedPayment.label}`,
        `Instruction paiement: ${paymentInstruction}`,
        selectedPayment.value === "CASH_ON_DELIVERY"
          ? `Montant a payer apres reception: ${formatPrice(productsTotal + deliveryFee)}`
          : deliveryPaymentTiming === "AT_RECEPTION" && deliveryType === "DELIVERY"
            ? `Livraison a payer apres reception: ${formatPrice(deliveryFee)}`
            : `Montant a regler maintenant: ${formatPrice(totalToPay)}`,
        `Recu client: ${receiptUrl}`,
        `---`,
        `Ref Commande: ${orderRef}`,
      ].join("\n");
      const finalUrl = `https://wa.me/${cleanPhone(seller.phone_number)}?text=${encodeURIComponent(textWithOrder)}`;
      
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
      setCheckoutNotice(createdOrder?.orderRef
        ? `Commande ${createdOrder.orderRef} enregistree, mais le paiement en ligne ne s'ouvre pas. Reessayez ou choisissez Wave/WhatsApp.`
        : "Commande non terminee. Verifiez la connexion puis reessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startCustomerNoteVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCheckoutNotice("La dictee vocale n'est pas disponible ici. Utilisez le micro du clavier.");
      return;
    }

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

  const brandColor = seller.brand_color || "#008f5a";
  const brandColorLight = `${brandColor}12`; // soft overlay
  const brandStyles = {
    "--primary": brandColor,
    "--accent": brandColor,
    "--surface-soft": brandColorLight,
  };

  return (
    <div style={brandStyles} className="w-full">
      <section className="shop-topbar sticky top-0 z-40 -mx-4 px-4 py-3 md:mx-0 md:rounded-[24px] md:px-4 md:py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--text-main)] font-display text-[0.72rem] font-extrabold text-white shadow-[var(--shadow-sm)] md:h-11 md:w-11 md:rounded-[15px] overflow-hidden">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                seller.name?.slice(0, 2).toUpperCase() || "TC"
              )}
              <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-[1.5px] border-white ${shopReady ? "bg-[var(--primary-bright)]" : "bg-orange-400"}`} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[0.95rem] font-extrabold text-[var(--text-main)] md:text-base">{seller.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.65rem] font-semibold text-[var(--text-dim)]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${shopReady ? "bg-[var(--primary-bright)]" : "bg-orange-400"}`} />
                {shopReady ? `${availableProductsLabel} disponible${availableProducts > 1 ? "s" : ""}` : "Préparation en cours"}
              </p>
            </div>
          </div>
          {cartCount > 0 ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-[16px] bg-[var(--text-main)] px-3 text-sm font-extrabold text-white shadow-[var(--shadow-sm)] active:scale-[0.97] transition"
              aria-label="Voir le panier"
            >
              <ShoppingBag size={18} />
              <span>{cartCount}</span>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-bright)] px-1 text-[0.56rem] font-extrabold text-[#06100a]">{cartCount}</span>
            </button>
          ) : (
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-[0.66rem] font-extrabold text-[var(--primary)] ring-1 ring-[rgba(0,143,90,0.1)]">
              Gratuit
            </span>
          )}
        </div>
      </section>

      {checkoutNotice && (
        <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-extrabold text-amber-900 ring-1 ring-amber-200">
          {checkoutNotice}
        </div>
      )}

      <main className="shop-main pt-3 md:pt-5">
        {products.length === 0 ? (
          <section className="mt-1 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
            <EmptyShopState seller={seller} isOwnerView={isOwnerView} />
          </section>
        ) : (
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-6">
            <div className="min-w-0">
              {/* Hero boutique compact et épuré style Aynid */}
              <section className="shop-hero relative overflow-hidden rounded-[26px] p-4 text-white shadow-[var(--shadow-lg)] md:rounded-[32px] md:p-6">
                {/* Bande couleur en haut */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary-bright)] to-[#008f5a]" />
                
                <div className="relative z-10">
                  {/* Badge boutique */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[var(--primary-bright)]">
                      <Sparkles size={11} />
                      Boutique {seller.name}
                    </span>
                    {deliveryZones.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[0.62rem] font-bold text-white/70">
                        <Truck size={11} />
                        {deliveryZones.length} zones
                      </span>
                    )}
                  </div>

                  {/* Titre principal ultra concis */}
                  <h2 className="mt-3 font-display text-[1.45rem] font-extrabold leading-[1.5rem] text-white md:mt-4 md:text-4xl md:leading-tight">
                    Choisissez,<br className="md:hidden" /> commandez,<br className="md:hidden" /> recevez.
                  </h2>

                  {/* Barre de recherche flottante */}
                  <div className="mt-3.5 flex min-h-[50px] items-center gap-3 rounded-[18px] bg-white px-3.5 text-[var(--text-main)] shadow-[0_8px_24px_rgba(0,0,0,0.14)] md:mt-4">
                    <Search className="shrink-0 text-[var(--primary)]" size={18} />
                    <input
                      value={query.trimStart()}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={`Chercher dans ${seller.name}...`}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none placeholder:font-normal placeholder:text-[var(--outline)]"
                    />
                    {query && (
                      <button type="button" onClick={() => setQuery("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)] transition hover:bg-gray-100" aria-label="Effacer la recherche">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Trust rail mobile compact */}
                  <ShopMobileTrustRail availableProducts={availableProducts} deliveryZones={deliveryZones} paymentLabels={paymentLabels} />
                </div>
              </section>

              {/* Filtre catégories - horizontal scroll épuré */}
              <section className="mt-3 rounded-[22px] bg-white p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.3)] md:mt-4 md:rounded-[26px] md:p-4">
                <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
                  <h3 className="text-sm font-black text-[var(--text-main)]">
                    {filteredProducts.length} article{filteredProducts.length > 1 ? "s" : ""}
                  </h3>
                  {query && (
                    <button onClick={() => setQuery("")} className="text-[0.68rem] font-bold text-[var(--primary)] underline" type="button">Effacer filtre</button>
                  )}
                </div>
                <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 md:-mx-4 md:px-4">
                  {categories.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value)}
                      className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[0.8rem] font-extrabold transition active:scale-[0.97] md:min-h-[40px] md:px-4 ${
                        item.value === category
                          ? "bg-[var(--text-main)] text-white shadow-sm"
                          : "bg-[var(--surface-soft)] text-[var(--text-main)] hover:bg-gray-100"
                      }`}
                    >
                      {item.label}
                      <span className={`rounded-full px-1.5 py-0.5 text-[0.62rem] ${item.value === category ? "bg-white/15 text-white" : "bg-white text-[var(--primary)]"}`}>
                        {item.value === "Tout" ? products.length : products.filter((product) => productCategory(product) === item.value).length}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8">
                {filteredProducts.length > 0 ? (
                  <div className={`grid gap-2.5 md:gap-3 xl:grid-cols-3 ${
                    singleProductLayout
                      ? "grid-cols-1 justify-items-center sm:grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}>
                    {filteredProducts.map((product) => (
                      <div key={product.id} className={singleProductLayout ? "w-full max-w-[360px] sm:max-w-none" : "w-full"}>
                        <ProductTile
                          product={product}
                          quantity={cart[product.id] || 0}
                          onOpen={() => setSelectedProduct(product)}
                          onAdd={() => addToCart(product)}
                          onMinus={() => decrement(product.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[24px] bg-white p-10 text-center shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.3)]">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
                      <Search size={24} />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-extrabold text-[var(--text-main)]">Aucun article trouvé</h3>
                    <p className="mt-1.5 text-sm font-semibold text-[var(--text-dim)]">Essayez un autre mot ou une autre catégorie.</p>
                    <button
                      type="button"
                      onClick={() => { setQuery(""); setCategory("Tout"); }}
                      className="mt-4 rounded-full bg-[var(--text-main)] px-5 py-2.5 text-sm font-extrabold text-white"
                    >
                      Voir tous les articles
                    </button>
                  </div>
                )}
              </section>

            </div>

            <DesktopCartDock
              cartItems={cartItems}
              cartTotal={cartTotal}
              displayedDeliveryFee={displayedDeliveryFee}
              orderGrandTotal={orderGrandTotal}
              onOpen={() => setCartOpen(true)}
            />
          </div>
        )}
      </main>

      {cartCount > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 md:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[24px] bg-[var(--text-main)] px-5 text-white shadow-[0_16px_34px_rgba(16,24,20,0.26)] transition-transform active:scale-95"
          >
            <span className="flex items-center gap-3">
              <ShoppingBag size={24} />
              <span className="font-display text-base font-bold">Voir le panier</span>
            </span>
            <span className="font-display text-base font-extrabold text-[var(--primary-bright)]">{formatPrice(cartTotal)}</span>
            <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-bright)] px-1 text-xs font-extrabold text-zinc-950">
              {cartCount}
            </span>
          </button>
        </div>
      )}

      {selectedProduct && (
        <ProductSheet
          key={selectedProduct.id}
          product={selectedProduct}
          quantity={cart[selectedProduct.id] || 0}
          onClose={() => setSelectedProduct(null)}
          onAdd={() => addToCart(selectedProduct)}
          onMinus={() => decrement(selectedProduct.id)}
        />
      )}

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
          deliveryPaymentTiming={deliveryPaymentTiming}
          onlinePaymentTotal={onlinePaymentTotal}
          orderGrandTotal={orderGrandTotal}
          paymentMethod={effectivePaymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentOptions={paymentOptions}
          customerNote={customerNote}
          setCustomerNote={setCustomerNote}
          noteListening={noteListening}
          onNoteVoice={startCustomerNoteVoice}
        />
      )}

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

function EmptyShopState({ seller, isOwnerView = false }) {
  const whatsappNumber = cleanPhone(seller.phone_number);
  const message = `Bonjour ${seller.name}, je veux voir les articles disponibles.`;
  const href = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : "";

  return (
    <div className="overflow-hidden rounded-[32px] bg-white shadow-[var(--shadow-md)] ring-1 ring-[rgba(191,206,197,0.42)] md:grid md:grid-cols-[1.1fr_0.9fr]">
      <div className="relative min-h-[260px] bg-[var(--text-main)] p-5 text-white md:min-h-[420px] md:p-7">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            {seller.logo_url ? (
              <div className="relative h-14 w-14 overflow-hidden rounded-[20px] bg-white ring-1 ring-white/10">
                <img src={seller.logo_url} alt="Logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/10 text-[var(--primary-bright)] ring-1 ring-white/10">
                <Store size={28} />
              </span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white/74 ring-1 ring-white/10">
              Bientot en ligne
            </span>
          </div>
          <div className="mt-10">
            <p className="quiet-label text-white/52">{seller.name}</p>
            <h3 className="mt-2 max-w-md font-display text-3xl font-extrabold leading-9 text-white md:text-5xl md:leading-[3.4rem]">
              Les articles arrivent.
            </h3>
            <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-white/66 md:text-base">
              La boutique se prepare. Vous pouvez deja demander les photos, les tailles ou les prix directement sur WhatsApp.
            </p>
          </div>
        </div>
      </div>
      <div className="grid content-between gap-4 p-4 md:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-[var(--surface-soft)] p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--primary)] shadow-sm">
              <MessageCircle size={19} />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-[var(--text-main)]">
                {isOwnerView ? "Prochaine action vendeur" : "Commande par message"}
              </span>
              <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--text-dim)]">
                {isOwnerView
                  ? "Ajoutez une photo, un prix et un stock pour ouvrir une vraie boutique client."
                  : "Envoyez un message au vendeur sans attendre que tout le catalogue soit publie."}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-[#fff7dd] p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#9b6500] shadow-sm">
              <Truck size={19} />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-[var(--text-main)]">Livraison a confirmer</span>
              <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--text-dim)]">
                Le vendeur vous donne les disponibilites, le prix final et le mode de paiement.
              </span>
            </span>
          </div>
        </div>
        <div className="grid gap-3">
          {isOwnerView && (
            <Link
              href="/add-product"
              className="flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] bg-[var(--text-main)] text-base font-extrabold text-white no-underline"
            >
              <ShoppingBag size={20} />
              Ajouter le premier article
            </Link>
          )}
          <a
            href={href || undefined}
            className={`flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] text-base font-extrabold no-underline ${
              href ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]" : "pointer-events-none bg-[var(--surface-mid)] text-[var(--text-dim)]"
            }`}
          >
            <MessageCircle size={18} />
            Ecrire sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function ShopMetric({ value, label }) {
  return (
    <div className="rounded-[15px] bg-white/10 px-2.5 py-2 text-center ring-1 ring-white/10 md:rounded-[18px] md:px-3 md:py-3 md:text-left">
      <p className="font-display text-base font-extrabold text-[var(--primary-bright)] md:text-lg">{value}</p>
      <p className="mt-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.08em] text-white/54 md:text-[0.66rem]">{label}</p>
    </div>
  );
}

function ShopMobileTrustRail({ availableProducts, deliveryZones, paymentLabels }) {
  const chips = [
    { icon: <ShoppingBag size={14} />, label: `${availableProducts} article${availableProducts > 1 ? "s" : ""}` },
    { icon: <Truck size={14} />, label: deliveryZones.length ? "Frais par commune" : "Livraison a confirmer" },
    { icon: <ReceiptText size={14} />, label: "Recu partageable" },
  ];
  const cashOnDelivery = paymentLabels.some((option) => option.value === "CASH_ON_DELIVERY");

  return (
    <div className="relative z-10 mt-2.5 space-y-1.5 md:hidden">
      <div className="grid grid-cols-3 gap-1.5">
        {chips.map((chip) => (
          <div key={chip.label} className="flex min-w-0 min-h-[38px] items-center gap-1.5 rounded-full bg-white/10 px-1.5 ring-1 ring-white/10">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-bright)] text-[#06100a]">
              {chip.icon}
            </span>
            <span className="block min-w-0 text-[0.56rem] font-extrabold leading-3 text-white/76">{chip.label}</span>
          </div>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {cashOnDelivery && (
          <span className="shrink-0 rounded-full bg-[var(--primary-bright)] px-2.5 py-1.5 text-[0.62rem] font-extrabold text-[#06100a]">
            Paiement a la livraison
          </span>
        )}
        {paymentLabels.slice(0, 5).map((option) => (
          <span key={option.value} className="shrink-0 rounded-full bg-white px-2.5 py-1.5 text-[0.62rem] font-extrabold text-[var(--text-main)]">
            {option.shortLabel || option.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShopFlowStrip() {
  const steps = [
    { icon: <Search size={16} />, title: "1. Choisir", text: "Article" },
    { icon: <ShoppingBag size={16} />, title: "2. Panier", text: "Quantite" },
    { icon: <Truck size={16} />, title: "3. Livrer", text: "Commune" },
    { icon: <ReceiptText size={16} />, title: "4. Recu", text: "Preuve" },
  ];

  return (
    <section className="mt-3 grid grid-cols-4 gap-1.5 md:mt-4 md:gap-2">
      {steps.map((step) => (
        <div key={step.title} className="min-w-0 rounded-[18px] bg-white p-2 text-center shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.38)] md:grid md:min-h-[76px] md:grid-cols-[auto_1fr] md:items-center md:gap-2 md:rounded-[22px] md:p-3 md:text-left">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)] md:mx-0 md:h-11 md:w-11">
            {step.icon}
          </span>
          <span className="min-w-0">
            <strong className="mt-1 block truncate text-[0.66rem] font-extrabold leading-3 text-[var(--text-main)] md:mt-0 md:text-sm md:leading-5">{step.title}</strong>
            <small className="hidden text-xs font-bold text-[var(--text-dim)] md:block">{step.text}</small>
          </span>
        </div>
      ))}
    </section>
  );
}

function DesktopCartDock({ cartItems, cartTotal, displayedDeliveryFee, orderGrandTotal, onOpen }) {
  return (
    <aside className="sticky top-24 hidden rounded-[28px] bg-white p-4 shadow-[var(--shadow-md)] ring-1 ring-[rgba(191,206,197,0.42)] md:block">
      <div className="rounded-[24px] bg-[var(--text-main)] p-4 text-white">
        <p className="quiet-label text-white/50">Panier client</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold text-white">
          {cartItems.length > 0 ? `${cartItems.length} article${cartItems.length > 1 ? "s" : ""}` : "Aucun article"}
        </h3>
        <p className="mt-2 text-sm font-semibold leading-5 text-white/62">
          Le panier reste visible sur PC pour confirmer la commande sans perdre le catalogue.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {cartItems.length > 0 ? (
          cartItems.slice(0, 4).map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center gap-3 rounded-[18px] bg-[var(--surface-soft)] p-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white">
                <SafeProductImage src={product.image_url} alt={product.name} sizes="48px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[var(--text-main)]">{product.name}</p>
                <p className="text-xs font-bold text-[var(--text-dim)]">{quantity} x {formatPrice(product.price)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] bg-[var(--surface-soft)] p-4 text-sm font-bold leading-5 text-[var(--text-dim)]">
            Ajoutez un article pour voir le resume ici.
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-white p-3">
        <div className="flex items-center justify-between text-sm font-bold text-[var(--text-dim)]">
          <span>Produits</span>
          <span>{formatPrice(cartTotal)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm font-bold text-[var(--text-dim)]">
          <span>Livraison</span>
          <span>{cartItems.length > 0 ? (displayedDeliveryFee > 0 ? formatPrice(displayedDeliveryFee) : "A choisir") : "A choisir"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <span className="text-sm font-extrabold text-[var(--text-main)]">Total estime</span>
          <span className="font-display text-xl font-extrabold text-[var(--primary)]">{cartItems.length > 0 ? formatPrice(orderGrandTotal) : formatPrice(0)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={`mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] text-sm font-extrabold ${
          cartItems.length > 0 ? "bg-[var(--text-main)] text-white" : "bg-[var(--surface-mid)] text-[var(--text-dim)]"
        }`}
      >
        <ShoppingBag size={18} />
        {cartItems.length > 0 ? "Finaliser la commande" : "Panier vide"}
      </button>
    </aside>
  );
}

function ProductTile({ product, quantity, onOpen, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);
  const lowStock = stock > 0 && stock < 4;
  const extraImageCount = getExtraProductImages(product.description).length;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_16px_rgba(13,23,18,0.07)] ring-1 ring-[rgba(191,206,197,0.35)] transition active:scale-[0.98] md:rounded-[24px] md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_28px_rgba(13,23,18,0.12)]">
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-[var(--surface-mid)] md:aspect-[4/5]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-[1.04]"
          />
          {/* Gradient bas */}
          <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
          
          {/* Badge catégorie */}
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[0.58rem] font-extrabold text-[var(--text-main)] shadow-sm backdrop-blur-sm">
            {productCategory(product)}
          </span>

          {/* Stock faible */}
          {lowStock && (
            <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[0.58rem] font-extrabold text-white shadow-sm">
              Bientôt fini
            </span>
          )}

          {/* Photos supplémentaires */}
          {extraImageCount > 0 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.58rem] font-extrabold text-[var(--text-main)] shadow-sm">
              +{extraImageCount} photo{extraImageCount > 1 ? "s" : ""}
            </span>
          )}

          {/* Rupture */}
          {stock === 0 && (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/60 py-2 text-center text-[0.68rem] font-extrabold uppercase tracking-wide text-white">
              Rupture
            </span>
          )}

          {/* Bouton panier flottant en bas à droite */}
          <div className="absolute bottom-2 right-2">
            <CartControl quantity={quantity} stock={stock} onAdd={onAdd} onMinus={onMinus} compact />
          </div>
        </div>

        {/* Infos produit */}
        <div className="flex flex-grow flex-col gap-1.5 p-2.5 md:p-3">
          <h3 className="text-[0.8rem] font-extrabold leading-[1.1rem] text-[var(--text-main)] line-clamp-2 md:text-[0.88rem] md:leading-5">
            {product.name}
          </h3>
          <div className="flex items-center justify-between gap-1">
            <p className="font-display text-[1rem] font-extrabold leading-none text-[var(--primary)] md:text-[1.05rem]">{formatPrice(product.price)}</p>
            {stock > 0 ? (
              <p className="rounded-full bg-[var(--surface-soft)] px-1.5 py-0.5 text-[0.58rem] font-extrabold text-[var(--text-dim)]">
                {stock} dispo
              </p>
            ) : (
              <p className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.58rem] font-extrabold text-red-500">
                Indispo
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}


function CartControl({ quantity, stock, large = false, compact = false, onAdd, onMinus }) {
  if (quantity > 0) {
    return (
      <div className={`flex items-center gap-2 rounded-full bg-[var(--primary)] px-2 text-white shadow-sm ${large ? "h-12" : compact ? "h-9" : "h-10"}`}>
        <button type="button" onClick={(event) => { event.stopPropagation(); onMinus(); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10" aria-label="Retirer">
          <Minus size={14} />
        </button>
        <span className="text-sm font-bold">{quantity}</span>
        <button type="button" onClick={(event) => { event.stopPropagation(); onAdd(); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10" aria-label="Ajouter">
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onAdd(); }}
      disabled={stock === 0}
      className={`flex items-center justify-center rounded-2xl text-[var(--text-main)] transition disabled:text-[var(--outline)] ${
        large
          ? "h-12 w-12 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--surface-mid)]"
          : compact
            ? "h-10 min-w-[5.7rem] gap-1.5 bg-[var(--text-main)] px-3 text-white shadow-lg disabled:bg-[var(--surface-mid)]"
            : "h-11 min-w-[5.25rem] gap-1 bg-[var(--text-main)] px-3 text-white disabled:bg-[var(--surface-mid)]"
      }`}
      aria-label="Ajouter"
    >
      <Plus size={large ? 22 : 17} />
      {!large && <span className="text-xs font-extrabold">Ajouter</span>}
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
    <div className="fixed inset-0 z-[260] flex items-end bg-black/45 backdrop-blur-[3px] md:items-center md:px-3">
      <div className="mx-auto max-h-[92svh] w-full max-w-[430px] overflow-y-auto rounded-t-[30px] bg-white shadow-2xl md:rounded-[30px]">
        <div className="relative aspect-[4/3] bg-[var(--surface-mid)]">
          <SafeProductImage
            src={activeImage}
            alt={product.name}
            sizes="430px"
            className="object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/94 px-3 py-1 text-xs font-extrabold text-[var(--text-main)] shadow-sm">
            {stock > 0 ? `Stock ${stock}` : "Rupture"}
          </span>
          <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-950" aria-label="Fermer">
            <X size={19} />
          </button>
          {gallery.length > 1 && (
            <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto pb-0.5">
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ${
                    activeImageIndex === index ? "ring-[var(--primary-bright)]" : "ring-white/70"
                  }`}
                  aria-label={`Voir photo ${index + 1}`}
                >
                  <SafeProductImage src={image} alt="" sizes="56px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-bold text-[var(--primary)]">{formatPrice(product.price)}</p>
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[0.7rem] font-extrabold text-[var(--text-main)]">
              {productCategory(product)}
            </span>
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold leading-8 text-[var(--text-main)]">{product.name}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            {description || "Ajoutez cet article au panier puis envoyez la commande directement sur WhatsApp."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[20px] bg-[var(--surface-soft)] p-3">
              <ShieldCheck className="text-[var(--primary)]" size={18} />
              <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--text-dim)]">Commande</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[var(--text-main)]">Resume WhatsApp propre</p>
            </div>
            <div className="rounded-[20px] bg-[var(--surface-soft)] p-3">
              <Truck className="text-[var(--primary)]" size={18} />
              <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--text-dim)]">Livraison</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[var(--text-main)]">Commune et adresse au panier</p>
            </div>
          </div>
          <div className="mt-5">
            {quantity > 0 ? (
              <div className="flex min-h-[58px] items-center justify-between rounded-2xl bg-[var(--primary)] px-4 text-white">
                <button type="button" onClick={onMinus} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Minus size={18} />
                </button>
                <span className="font-semibold">{quantity} dans le panier</span>
                <button type="button" onClick={onAdd} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                disabled={stock === 0}
                className="min-h-[58px] w-full rounded-2xl bg-[var(--primary-bright)] text-base font-extrabold text-[#042719] disabled:bg-[var(--surface-mid)] disabled:text-[var(--outline)]"
              >
                Ajouter au panier
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
  deliveryPaymentTiming,
  onlinePaymentTotal,
  orderGrandTotal,
  paymentMethod,
  setPaymentMethod,
  paymentOptions,
  customerNote,
  setCustomerNote,
  noteListening,
  onNoteVoice
}) {
  const selectedPayment = getPaymentOption(paymentMethod);
  const directPaymentOptions = (paymentOptions || []).filter((option) => !option.online);
  const fallbackPaymentOptions = (paymentOptions || []).filter((option) => option.online);
  const primaryTotal = selectedPayment.online ? onlinePaymentTotal : orderGrandTotal;
  const amountToPayNow = selectedPayment.value === "CASH_ON_DELIVERY"
    ? orderGrandTotal
    : selectedPayment.online
      ? onlinePaymentTotal
      : cartTotal + (deliveryPaymentTiming === "INCLUDED" ? displayedDeliveryFee : 0);
  const paymentInstruction = getDirectPaymentInstruction(
    seller,
    selectedPayment,
    amountToPayNow,
    deliveryPaymentTiming,
    deliveryType,
    displayedDeliveryFee,
  );
  const checkoutReadiness = getCheckoutReadiness({
    cartItems,
    deliveryType,
    deliveryZone,
    deliveryAddress,
    customerPhone,
  });
  const canCheckout = checkoutReadiness.ready && !isSubmitting;
  const deliveryNote = deliveryPaymentTiming === "AT_RECEPTION"
    ? "Livraison payable apres reception"
    : deliveryPaymentTiming === "OFFERED"
      ? "Livraison offerte par la boutique"
      : "Livraison incluse au paiement";

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="mx-auto flex max-h-[90svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(16,24,20,0.22)]">
        {/* Drag handle */}
        <div className="flex w-full justify-center pt-3 pb-1.5">
          <div className="h-[3px] w-10 rounded-full bg-[var(--outline)]/40" />
        </div>

        {/* En-tête compact */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 pb-3.5">
          <div>
            <p className="text-[0.62rem] font-extrabold uppercase tracking-widest text-[var(--primary)]">Commande</p>
            <h3 className="font-display text-xl font-extrabold text-[var(--text-main)]">
              {cartItems.length} article{cartItems.length > 1 ? "s" : ""} · {formatPrice(cartTotal)}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-mid)] transition hover:bg-gray-200" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <CheckoutProgress steps={checkoutReadiness.steps} />
          <CheckoutActionHint readiness={checkoutReadiness} />


          {cartItems.length > 0 ? (
            <div className="hidden overflow-hidden rounded-[24px] bg-[var(--text-main)] text-white shadow-[var(--shadow-lg)] md:block">
              <div className="h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[#315bc7]" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="quiet-label text-white/50">Resume visible par le vendeur</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-white">{cartItems.length} article{cartItems.length > 1 ? "s" : ""}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white/50">Total estime</p>
                    <p className="font-display text-xl font-extrabold text-[var(--primary-bright)]">{formatPrice(orderGrandTotal)}</p>
                    {displayedDeliveryFee > 0 && <p className="mt-1 text-[0.68rem] font-bold text-white/50">{deliveryNote}</p>}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {cartItems.slice(0, 4).map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-[20px] bg-white/10 p-2.5">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                        <SafeProductImage
                          src={product.image_url}
                          alt={product.name}
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-white">{product.name}</p>
                        <p className="mt-0.5 text-[0.68rem] font-bold text-white/58">{quantity} x {formatPrice(product.price)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-white/78">
                        {formatPrice(Number(product.price || 0) * quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[var(--surface-soft)] p-8 text-center">
            <p className="font-display font-semibold text-[var(--text-main)]">Panier vide</p>
              <p className="mt-1 text-sm text-[var(--text-dim)]">Ajoutez un article pour creer le message WhatsApp.</p>
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="space-y-5">
              {/* Étape 1 — WhatsApp */}
              <div className="space-y-2.5">
                <h4 className="flex items-center gap-2 text-[0.82rem] font-extrabold uppercase tracking-wider text-[var(--text-dim)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[0.6rem] font-extrabold text-white">1</span>
                  Votre WhatsApp
                </h4>
                <input
                  type="text"
                  placeholder="+225 07 00 00 00 00"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(withIvorianPrefix(e.target.value))}
                  className="mobile-input bg-white"
                />
              </div>

              {/* Étape 2 — Livraison */}
              <div className="space-y-2.5">
                <h4 className="flex items-center gap-2 text-[0.82rem] font-extrabold uppercase tracking-wider text-[var(--text-dim)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[0.6rem] font-extrabold text-white">2</span>
                  Réception
                </h4>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => deliveryEnabled && setDeliveryType("DELIVERY")}
                    disabled={!deliveryEnabled}
                    className={`flex flex-1 items-center gap-2.5 rounded-[18px] border p-3 text-left transition-all active:scale-[0.98] ${
                      deliveryType === "DELIVERY"
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white"
                        : deliveryEnabled
                          ? "border-[var(--line)] bg-white text-[var(--text-main)]"
                          : "border-[var(--line)] bg-zinc-50 text-zinc-300"
                    }`}
                  >
                    <Truck size={16} />
                    <div>
                      <p className="text-sm font-extrabold">Livraison</p>
                      <p className={`text-[0.68rem] font-semibold ${deliveryType === "DELIVERY" ? "text-white/70" : "text-[var(--text-dim)]"}`}>
                        {deliveryEnabled ? "À domicile" : "Désactivée"}
                      </p>
                    </div>
                    {deliveryType === "DELIVERY" && <CheckCircle2 size={16} className="ml-auto shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => pickupEnabled && setDeliveryType("PICKUP")}
                    disabled={!pickupEnabled}
                    className={`flex flex-1 items-center gap-2.5 rounded-[18px] border p-3 text-left transition-all active:scale-[0.98] ${
                      deliveryType === "PICKUP"
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white"
                        : pickupEnabled
                          ? "border-[var(--line)] bg-white text-[var(--text-main)]"
                          : "border-[var(--line)] bg-zinc-50 text-zinc-300"
                    }`}
                  >
                    <Store size={16} />
                    <div>
                      <p className="text-sm font-extrabold">Retrait</p>
                      <p className={`text-[0.68rem] font-semibold ${deliveryType === "PICKUP" ? "text-white/70" : "text-[var(--text-dim)]"}`}>
                        {pickupEnabled ? "En boutique" : "Désactivé"}
                      </p>
                    </div>
                    {deliveryType === "PICKUP" && <CheckCircle2 size={16} className="ml-auto shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Étape 3 — Adresse & précisions */}
              <div className="space-y-2.5">
                <h4 className="flex items-center gap-2 text-[0.82rem] font-extrabold uppercase tracking-wider text-[var(--text-dim)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[0.6rem] font-extrabold text-white">3</span>
                  Adresse & précisions
                </h4>
                {deliveryType === "DELIVERY" && (
                  <>
                    {deliveryZones.length > 0 ? (
                      <>
                        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                          {deliveryZones.slice(0, 10).map((zone) => (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setDeliveryZone(zone.name)}
                              className={`min-h-[34px] shrink-0 rounded-full px-3 text-[0.75rem] font-extrabold transition ${
                                deliveryZone === zone.name
                                  ? "bg-[var(--text-main)] text-white"
                                  : "bg-[var(--surface-soft)] text-[var(--text-main)]"
                              }`}
                            >
                              {zone.name} · {formatPrice(zone.fee)}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <input
                        type="text"
                        placeholder="Commune ou quartier"
                        value={deliveryZone}
                        onChange={(e) => setDeliveryZone(e.target.value)}
                        className="mobile-input bg-white"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Adresse ou repère (rue, immeuble...)"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="mobile-input bg-white"
                    />
                  </>
                )}
                <div className="flex items-start gap-2.5 rounded-[18px] border border-[var(--line)] bg-white p-3">
                  <textarea
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                    rows="2"
                    placeholder="Taille, couleur, précision... (optionnel)"
                    className="mobile-input min-h-[62px] flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none ring-0 focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={onNoteVoice}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition ${noteListening ? "bg-red-500" : "bg-[var(--primary)]"}`}
                    aria-label="Dicter les détails"
                  >
                    <Mic size={16} />
                  </button>
                </div>
                <div className="rounded-[16px] bg-[var(--surface-soft)] px-3.5 py-3">
                  <p className="text-[0.78rem] font-extrabold text-[var(--text-main)]">Récapitulatif</p>
                  <div className="mt-1.5 space-y-0.5 text-[0.75rem] font-semibold text-[var(--text-dim)]">
                    <p>Produits : {formatPrice(cartTotal)}</p>
                    <p>Livraison : {deliveryType === "PICKUP" ? "Retrait boutique" : (deliveryZone || "À choisir")}</p>
                    <p className="font-extrabold text-[var(--text-main)]">Total estimé : {formatPrice(orderGrandTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--primary)]">4</span>
                  <CreditCard size={18} className="text-[var(--primary)]" />
                  Paiement
                </h4>
                <div className="rounded-[20px] bg-[#ecfff5] p-3 text-sm font-bold leading-5 text-[#073f28] ring-1 ring-[#baf7d6]">
                  A Abidjan, beaucoup de clients paient a la livraison. La boutique choisit les options disponibles.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {directPaymentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      className={`min-h-[84px] rounded-[22px] border p-3 text-left active:scale-[0.99] ${
                        paymentMethod === option.value
                          ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]"
                          : "border-[var(--line)] bg-white text-[var(--text-main)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-extrabold ${paymentMethod === option.value ? "bg-white/10 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
                          {option.recommended ? "Recommande" : "Direct"}
                        </span>
                        {paymentMethod === option.value && <CheckCircle2 size={17} />}
                      </div>
                      <span className="mt-3 block text-sm font-extrabold">{option.shortLabel}</span>
                      <span className={`mt-1 block text-[0.68rem] font-bold leading-4 ${paymentMethod === option.value ? "text-white/62" : "text-[var(--text-dim)]"}`}>
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
                {fallbackPaymentOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMethod(option.value)}
                    className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[22px] border p-3 text-left active:scale-[0.99] ${
                      paymentMethod === option.value
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]"
                        : "border-[var(--line)] bg-white text-[var(--text-main)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold">{option.shortLabel}</span>
                      <span className={`mt-1 block text-xs font-bold leading-4 ${paymentMethod === option.value ? "text-white/62" : "text-[var(--text-dim)]"}`}>
                        {option.hint}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-[0.65rem] font-extrabold ${paymentMethod === option.value ? "bg-white/10 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
                      Carte
                    </span>
                  </button>
                ))}
                <div className="rounded-[20px] bg-[var(--surface-soft)] p-3 text-xs font-bold leading-4 text-[var(--text-dim)]">
                  {paymentInstruction}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)] bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3.5">
          {cartItems.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold text-[var(--text-dim)]">
                  {cartItems.length} article{cartItems.length > 1 ? "s" : ""} · {displayedDeliveryFee > 0 ? `+${formatPrice(displayedDeliveryFee)} livraison` : "Livraison à confirmer"}
                </p>
                <p className="font-display text-2xl font-extrabold text-[var(--text-main)]">{formatPrice(primaryTotal)}</p>
              </div>
              <button
                onClick={() => onCheckout(paymentMethod)}
                disabled={!canCheckout}
                className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[18px] text-sm font-extrabold transition active:scale-[0.98] ${
                  canCheckout
                    ? selectedPayment.online
                      ? "bg-[var(--text-main)] text-white shadow-[0_4px_20px_rgba(13,23,18,0.25)]"
                      : "bg-[#25D366] text-white shadow-[0_4px_20px_rgba(37,211,102,0.3)]"
                    : "pointer-events-none bg-[var(--surface-mid)] text-[var(--outline)]"
                }`}
              >
                {isSubmitting
                  ? "Préparation..."
                  : checkoutReadiness.ready
                    ? (
                      <>
                        {selectedPayment.online ? <CreditCard size={17} /> : <MessageCircle size={17} />}
                        {selectedPayment.online ? "Payer" : "WhatsApp"}
                      </>
                    )
                    : checkoutReadiness.label}
              </button>
            </div>
          )}
          {!cartItems.length && (
            <button disabled className="flex min-h-[52px] w-full items-center justify-center rounded-[18px] bg-[var(--surface-mid)] text-sm font-extrabold text-[var(--outline)]">
              Ajoutez un article pour commander
            </button>
          )}
          <p className="text-center text-[0.65rem] font-semibold leading-4 text-[var(--text-dim)]">
            Un récap propre est envoyé au vendeur via WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}

function getCheckoutReadiness({ cartItems, deliveryType, deliveryZone, deliveryAddress, customerPhone }) {
  const hasCart = cartItems.length > 0;
  const hasPhone = cleanPhone(customerPhone).length >= 8;
  const hasReception = deliveryType === "PICKUP" || (deliveryZone && deliveryAddress.trim().length >= 3);
  const steps = [
    { label: "Panier", done: hasCart },
    { label: "Contact", done: hasPhone },
    { label: "Reception", done: hasReception },
  ];

  if (!hasCart) return { ready: false, label: "Ajoutez un article", steps };
  if (!hasPhone) return { ready: false, label: "Ajoutez votre numero", steps };
  if (!hasReception) return { ready: false, label: deliveryType === "PICKUP" ? "Choisissez la reception" : "Completez la livraison", steps };

  return { ready: true, label: "Pret", steps };
}

function CheckoutActionHint({ readiness }) {
  const doneCount = readiness.steps.filter((step) => step.done).length;
  const nextStep = readiness.steps.find((step) => !step.done);
  const title = readiness.ready ? "Tout est pret" : `Encore ${readiness.steps.length - doneCount} etape${readiness.steps.length - doneCount > 1 ? "s" : ""}`;
  const text = readiness.ready
    ? "Vous pouvez confirmer. Le vendeur recevra un recap propre avec le lien du recu."
    : nextStep?.label === "Contact"
      ? "Ajoutez votre numero WhatsApp pour que la boutique puisse vous joindre."
      : nextStep?.label === "Reception"
        ? "Choisissez comment recevoir la commande et ajoutez l'adresse si livraison."
        : "Ajoutez au moins un article au panier.";

  return (
    <div className={`rounded-[20px] p-3 ring-1 ${
      readiness.ready
        ? "bg-[#ecfff5] text-[#073f28] ring-[#baf7d6]"
        : "bg-amber-50 text-amber-950 ring-amber-200"
    }`}>
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 opacity-75">{text}</p>
    </div>
  );
}

function CheckoutProgress({ steps }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-[var(--surface-soft)] p-2">
      {steps.map((step, index) => (
        <div key={step.label} className={`rounded-2xl px-2 py-2 text-center ${step.done ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-dim)]"}`}>
          <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-xl text-xs font-extrabold ${step.done ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--text-dim)]"}`}>
            {step.done ? <CheckCircle2 size={15} /> : index + 1}
          </span>
          <p className="mt-1 text-[0.68rem] font-extrabold">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function OrderSuccessSheet({ order, sellerSlug, onClose }) {
  return (
    <div className="fixed inset-0 z-[270] flex items-end justify-center bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-[3px] md:items-center">
      <div className="w-full max-w-[430px] overflow-hidden rounded-t-[30px] bg-white shadow-2xl md:rounded-[30px]">
        <div className="bg-[var(--text-main)] p-5 text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-bright)] text-[var(--text-main)]">
            <CheckCircle2 size={27} />
          </div>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-white/50">Commande creee</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-9">Commande enregistree</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/66">
            Le message vendeur est pret et votre recu est deja disponible.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
            <p className="quiet-label text-[var(--primary)]">Reference</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--text-main)]">#{order.orderRef}</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--primary)]">{formatPrice(order.total)}</p>
          </div>
          {order.whatsappUrl && (
            <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-extrabold text-white no-underline">
              <MessageCircle size={18} />
              Envoyer au vendeur
            </a>
          )}
          <a href={order.receiptUrl} className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-sm font-extrabold text-white no-underline">
            <ReceiptText size={18} />
            Voir ou telecharger le recu
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a href={`/${sellerSlug}`} className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-sm font-extrabold text-[var(--primary)] no-underline">
              Continuer l&apos;achat
            </a>
            <button type="button" onClick={onClose} className="min-h-[52px] rounded-2xl bg-[var(--text-main)] text-sm font-extrabold text-white">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SafeProductImage({ src, alt, sizes, className }) {
  const [imageSrc, setImageSrc] = useState(src || FALLBACK_IMAGE);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized
      onError={() => setImageSrc(FALLBACK_IMAGE)}
    />
  );
}

