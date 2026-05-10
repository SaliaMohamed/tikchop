"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createOrder, initiatePayment } from "../actions";
import { getPaymentOption, LOCAL_PAYMENT_OPTIONS } from "../../lib/local-commerce";
import { supabase } from "../../lib/supabase";
import {
  CreditCard,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
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

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800";

function productCategory(product) {
  const text = `${product.name || ""} ${product.description || ""}`.toLowerCase();
  if (text.match(/chaussure|sneaker|sandale/)) return "Chaussures";
  if (text.match(/sac|bijou|montre|accessoire/)) return "Accessoires";
  if (text.match(/robe|pagne|habit|mode|t-shirt|chemise/)) return "Vetements";
  if (text.match(/phone|ecouteur|chargeur|montre|electron/)) return "Tech";
  if (text.match(/creme|parfum|huile|beaute|cheveux/)) return "Beaute";
  return "Tout";
}

export default function ShopClient({ seller, products, deliveryZones = [], initialProductId = "" }) {
  const [query, setQuery] = useState("");
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [category, setCategory] = useState("Tout");
  const [selectedProduct, setSelectedProduct] = useState(() => (
    initialProductId ? products.find((item) => item.id === initialProductId) || null : null
  ));
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryType, setDeliveryType] = useState("DELIVERY");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+225 ");
  const [customerNote, setCustomerNote] = useState("");
  const [noteListening, setNoteListening] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("WAVE");
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
      const matchesSearch = !normalizedQuery || `${product.name} ${product.description || ""}`.toLowerCase().includes(normalizedQuery);
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
  const shopReady = availableProducts > 0;

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

  async function handleCheckout(selectedMethod = paymentMethod) {
    if (!customerPhone || (deliveryType === "DELIVERY" && (!deliveryZone || !deliveryAddress))) {
      setCheckoutNotice("Ajoutez votre numero et les informations de livraison.");
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
        customerPhone
      });
      const { orderId, orderRef, productsTotal, deliveryFee, totalToPay } = createdOrder;
      const receiptUrl = `${window.location.origin}/receipt?order=${encodeURIComponent(orderId)}`;
      
      if (selectedPayment.online) {
        const { authorization_url } = await initiatePayment(orderId);
        window.location.href = authorization_url;
        return;
      }
      
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
        total: productsTotal + deliveryFee,
      });
      setCart({});
      setCustomerNote("");
      setCartOpen(false);
      window.location.href = finalUrl;
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

  return (
    <>
      <section className="shop-topbar sticky top-0 z-40 -mx-4 px-5 py-3 md:mx-0 md:rounded-[24px] md:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--text-main)] font-display text-sm font-extrabold text-white shadow-[var(--shadow-sm)]">
              {seller.name?.slice(0, 2).toUpperCase() || "TC"}
              <span className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${shopReady ? "bg-[var(--primary-bright)]" : "bg-[var(--accent)]"}`} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-extrabold text-[var(--text-main)]">{seller.name}</h1>
              <p className="mt-0.5 truncate text-xs font-bold text-[var(--text-dim)]">
                {shopReady ? `${availableProducts} articles prets a commander` : "Boutique en preparation"}
              </p>
            </div>
          </div>
          {cartCount > 0 && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-[18px] bg-[var(--text-main)] px-3 text-sm font-extrabold text-white shadow-[var(--shadow-sm)]"
              aria-label="Voir le panier"
            >
              <ShoppingBag size={19} />
              <span>{cartCount}</span>
            </button>
          )}
        </div>
      </section>

      {checkoutNotice && (
        <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-extrabold text-amber-900 ring-1 ring-amber-200">
          {checkoutNotice}
        </div>
      )}

      <main className="shop-main pt-5">
        {products.length === 0 ? (
          <section className="mt-1 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
            <EmptyShopState seller={seller} isOwnerView={isOwnerView} />
          </section>
        ) : (
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-6">
            <div className="min-w-0">
              <section className="relative overflow-hidden rounded-[30px] bg-[var(--text-main)] p-4 text-white shadow-[var(--shadow-lg)] md:p-6">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[var(--info)]" />
                <div className="relative z-10 grid gap-5 md:grid-cols-[1fr_220px] md:items-end">
                  <div>
                    <p className="quiet-label text-white/54">Boutique WhatsApp</p>
                    <h2 className="mt-2 max-w-2xl font-display text-[2rem] font-extrabold leading-[2.15rem] text-white md:text-[2.75rem] md:leading-[3rem]">
                      Choisissez. Tikchop prepare la commande.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white/68 md:text-base">
                      Paiement, livraison et recu sont regroupes avant l&apos;envoi sur WhatsApp. Vous commandez sans fouiller les statuts.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                    <ShopMetric value={availableProducts} label="Articles" />
                    <ShopMetric value={deliveryZones.length || "CI"} label="Livraison" />
                    <ShopMetric value="WA" label="Commande" />
                  </div>
                </div>
                <div className="relative z-10 mt-5 flex min-h-[58px] items-center gap-3 rounded-[22px] bg-white px-4 text-[var(--text-main)] shadow-[0_18px_42px_rgba(0,0,0,0.18)]">
                  <Search className="shrink-0 text-[var(--primary)]" size={20} />
                  <input
                    value={query.trimStart()}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Chercher robe, sac, chaussure..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-extrabold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-dim)]" aria-label="Effacer la recherche">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </section>

              <section className="mt-4 rounded-[26px] bg-white/86 p-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.36)] md:p-4">
                <div className="mb-3 flex items-end justify-between gap-3 px-1">
                  <div>
                    <p className="quiet-label text-[var(--primary)]">Catalogue</p>
                    <h3 className="font-display text-xl font-extrabold text-[var(--text-main)] md:text-2xl">
                      {filteredProducts.length} article{filteredProducts.length > 1 ? "s" : ""}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--primary)]">
                    Ajout rapide
                  </span>
                </div>
                <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-2 md:-mx-4 md:px-4">
                  {categories.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value)}
                      className={`min-h-[42px] whitespace-nowrap rounded-full px-4 text-sm font-extrabold transition ${
                        item.value === category ? "bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]" : "border border-[var(--line)] bg-white text-[var(--text-main)]"
                      }`}
                    >
                      {item.label}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.68rem] ${item.value === category ? "bg-white/14 text-white" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
                        {item.value === "Tout" ? products.length : products.filter((product) => productCategory(product) === item.value).length}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-3">
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
                  <div className="rounded-[24px] bg-white p-8 text-center shadow-[var(--shadow-sm)] ring-1 ring-[rgba(191,206,197,0.36)]">
                    <h3 className="font-display text-xl font-semibold text-[var(--text-main)]">Aucun article trouve</h3>
                    <p className="mt-2 text-sm text-[var(--text-dim)]">Essayez un autre mot ou une autre categorie.</p>
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
              <span className="font-display text-base font-bold">Panier</span>
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
          displayedDeliveryFee={displayedDeliveryFee}
          deliveryPaymentTiming={deliveryPaymentTiming}
          onlinePaymentTotal={onlinePaymentTotal}
          orderGrandTotal={orderGrandTotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
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
    </>
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
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/10 text-[var(--primary-bright)] ring-1 ring-white/10">
              <Store size={28} />
            </span>
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
    <div className="rounded-[18px] bg-white/10 px-3 py-3 text-center ring-1 ring-white/10 md:text-left">
      <p className="font-display text-lg font-extrabold text-[var(--primary-bright)]">{value}</p>
      <p className="mt-0.5 text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-white/54">{label}</p>
    </div>
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
          <span>{displayedDeliveryFee > 0 ? formatPrice(displayedDeliveryFee) : "A choisir"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <span className="text-sm font-extrabold text-[var(--text-main)]">Total estime</span>
          <span className="font-display text-xl font-extrabold text-[var(--primary)]">{formatPrice(orderGrandTotal)}</span>
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

  return (
    <article className="group flex flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_16px_34px_rgba(13,23,18,0.08)] ring-1 ring-[rgba(191,206,197,0.42)] transition active:scale-[0.99] md:hover:-translate-y-1 md:hover:shadow-[var(--shadow-md)]">
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
          />
          <span className="absolute left-2 top-2 rounded-full bg-white/92 px-2.5 py-1 text-[0.64rem] font-extrabold text-[var(--text-main)] shadow-sm backdrop-blur">
            {productCategory(product)}
          </span>
          {lowStock && (
            <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-[0.62rem] font-extrabold text-white shadow-sm">
              Bientot fini
            </span>
          )}
          {stock === 0 && (
            <span className="absolute inset-x-2 bottom-2 rounded-2xl bg-red-600 px-2 py-2 text-center text-[0.68rem] font-extrabold uppercase text-white shadow-sm">
              Rupture
            </span>
          )}
          <div className="absolute bottom-2 right-2">
            <CartControl quantity={quantity} stock={stock} onAdd={onAdd} onMinus={onMinus} compact />
          </div>
        </div>
        <div className="flex flex-grow flex-col justify-between p-3">
          <h3 className="min-h-[2.5rem] text-sm font-extrabold leading-5 text-[var(--text-main)] line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="font-display text-[1.08rem] font-extrabold leading-none text-[var(--primary)]">{formatPrice(product.price)}</p>
            <p className="text-[0.68rem] font-bold text-[var(--outline)]">
              {stock > 0 ? `${stock} dispo` : "Indispo"}
            </p>
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
            ? "h-11 w-11 bg-[var(--text-main)] text-white shadow-lg disabled:bg-[var(--surface-mid)]"
            : "h-11 min-w-[5.25rem] gap-1 bg-[var(--text-main)] px-3 text-white disabled:bg-[var(--surface-mid)]"
      }`}
      aria-label="Ajouter"
    >
      <Plus size={large ? 22 : 17} />
      {!large && !compact && <span className="text-xs font-extrabold">Ajouter</span>}
    </button>
  );
}

function ProductSheet({ product, quantity, onClose, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/45 backdrop-blur-[3px] md:items-center md:px-3">
      <div className="mx-auto max-h-[92svh] w-full max-w-[430px] overflow-y-auto rounded-t-[30px] bg-white shadow-2xl md:rounded-[30px]">
        <div className="relative aspect-[4/3] bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
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
            {product.description || "Ajoutez cet article au panier puis envoyez la commande directement sur WhatsApp."}
          </p>
          <div className="mt-4 rounded-[20px] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-extrabold text-[var(--text-main)]">Bon a savoir</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
              Vous pourrez preciser taille, couleur, pointure ou repere de livraison dans le panier.
            </p>
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
  displayedDeliveryFee,
  deliveryPaymentTiming,
  onlinePaymentTotal,
  orderGrandTotal,
  paymentMethod,
  setPaymentMethod,
  customerNote,
  setCustomerNote,
  noteListening,
  onNoteVoice
}) {
  const selectedPayment = getPaymentOption(paymentMethod);
  const primaryTotal = selectedPayment.online ? onlinePaymentTotal : orderGrandTotal;
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
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/45 backdrop-blur-[3px]">
      <div className="mx-auto flex max-h-[88svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_-18px_45px_rgba(16,24,20,0.20)]">
        <div className="flex w-full justify-center pt-2 pb-1">
          <div className="h-1 w-8 rounded-full bg-[var(--outline)]/50" />
        </div>
        <div className="flex items-center justify-between border-b border-[var(--outline)]/30 px-5 pb-4">
          <div>
            <p className="quiet-label text-[var(--primary)]">Panier</p>
            <h3 className="font-display text-2xl font-bold text-[var(--text-main)]">Finaliser la commande</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-mid)]" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <CheckoutProgress steps={checkoutReadiness.steps} />

          {cartItems.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] bg-[var(--text-main)] text-white shadow-[var(--shadow-lg)]">
              <div className="h-1 bg-gradient-to-r from-[var(--primary-bright)] via-[var(--accent)] to-[#315bc7]" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="quiet-label text-white/50">Resume commande</p>
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
              <p className="mt-1 text-sm text-[var(--text-dim)]">Ajoutez un article pour preparer le message WhatsApp.</p>
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--primary)]">1</span>
                  <Truck size={18} className="text-[var(--primary)]" />
                  Reception
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType("DELIVERY")}
                    className={`rounded-[22px] border p-4 text-left transition-all ${
                      deliveryType === "DELIVERY"
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]"
                        : "border-[var(--outline)]/40 bg-white text-[var(--text-main)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Truck size={18} />
                      {deliveryType === "DELIVERY" && <CheckCircle2 size={18} />}
                    </div>
                    <p className="mt-4 text-sm font-extrabold">Livraison</p>
                    <p className={`mt-1 text-[0.72rem] font-bold leading-4 ${deliveryType === "DELIVERY" ? "text-white/68" : "text-[var(--text-dim)]"}`}>
                      Indiquez votre commune et votre adresse.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("PICKUP")}
                    className={`rounded-[22px] border p-4 text-left transition-all ${
                      deliveryType === "PICKUP"
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]"
                        : "border-[var(--outline)]/40 bg-white text-[var(--text-main)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Store size={18} />
                      {deliveryType === "PICKUP" && <CheckCircle2 size={18} />}
                    </div>
                    <p className="mt-4 text-sm font-extrabold">Retrait boutique</p>
                    <p className={`mt-1 text-[0.72rem] font-bold leading-4 ${deliveryType === "PICKUP" ? "text-white/68" : "text-[var(--text-dim)]"}`}>
                      Vous venez recuperer votre commande.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--primary)]">2</span>
                  <MapPin size={18} className="text-[var(--primary)]" />
                  Informations
                </h4>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Numero WhatsApp</span>
                  <input
                    type="text"
                    placeholder="Votre numero WhatsApp"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(withIvorianPrefix(e.target.value))}
                    className="mobile-input bg-white"
                  />
                </label>
                {deliveryType === "DELIVERY" && (
                  <>
                    {deliveryZones.length > 0 ? (
                      <>
                        <label className="block">
                          <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Commune</span>
                          <select
                            value={deliveryZone}
                            onChange={(e) => setDeliveryZone(e.target.value)}
                            className="mobile-input bg-white"
                          >
                            <option value="">Choisir votre commune</option>
                            {deliveryZones.map((zone) => (
                              <option key={zone.id} value={zone.name}>
                                {zone.name} - {formatPrice(zone.fee)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                          {deliveryZones.slice(0, 8).map((zone) => (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setDeliveryZone(zone.name)}
                              className={`min-h-[38px] shrink-0 rounded-full px-3 text-xs font-extrabold ${
                                deliveryZone === zone.name
                                  ? "bg-[var(--text-main)] text-white"
                                  : "bg-[var(--surface-soft)] text-[var(--primary)]"
                              }`}
                            >
                              {zone.name}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Commune ou quartier</span>
                        <input
                          type="text"
                          placeholder="Commune ou quartier"
                          value={deliveryZone}
                          onChange={(e) => setDeliveryZone(e.target.value)}
                          className="mobile-input bg-white"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[var(--text-main)]">Adresse ou repere</span>
                      <input
                        type="text"
                        placeholder="Rue, repere, immeuble..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="mobile-input bg-white"
                      />
                    </label>
                  </>
                )}
                <div className="rounded-[20px] border border-[var(--outline)]/35 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[var(--text-main)]">Taille, couleur ou precision</p>
                      <p className="text-xs font-semibold text-[var(--text-dim)]">Optionnel. Vous pouvez aussi dicter.</p>
                    </div>
                    <button
                      type="button"
                      onClick={onNoteVoice}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${noteListening ? "bg-red-500" : "bg-[var(--primary)]"}`}
                      aria-label="Dicter les details"
                    >
                      <Mic size={18} />
                    </button>
                  </div>
                  <textarea
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                    rows="2"
                    placeholder="Ex: robe taille M, couleur rouge, appeler avant livraison..."
                    className="mobile-input min-h-[82px] resize-none bg-[var(--surface-soft)] text-sm"
                  />
                </div>
                <div className="rounded-[20px] bg-[var(--surface-soft)] p-3">
                  <p className="text-sm font-extrabold text-[var(--text-main)]">Resume avant envoi</p>
                  <div className="mt-2 space-y-1 text-sm font-semibold leading-5 text-[var(--text-dim)]">
                    <p>Produits: {formatPrice(cartTotal)}</p>
                    <p>Livraison: {deliveryType === "PICKUP" ? "Retrait boutique" : (deliveryZone || "A choisir")}</p>
                    <p>Total estime: {formatPrice(orderGrandTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--primary)]">3</span>
                  <CreditCard size={18} className="text-[var(--primary)]" />
                  Paiement
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {LOCAL_PAYMENT_OPTIONS.map((option) => (
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
                          {option.online ? "En ligne" : "Local"}
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
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--outline)]/30 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          <div className="space-y-3">
            {cartItems.length > 0 && (
              <div className="rounded-[20px] bg-[var(--surface-soft)] p-3">
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--text-dim)]">
                  <span>Produits</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[var(--text-dim)]">
                  <span>Livraison</span>
                  <span>{displayedDeliveryFee > 0 ? formatPrice(displayedDeliveryFee) : "Aucun frais"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--outline)]/20 pt-3">
                  <span className="text-sm font-extrabold text-[var(--text-main)]">Total a prevoir</span>
                  <span className="font-display text-lg font-extrabold text-[var(--primary)]">{formatPrice(primaryTotal)}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => onCheckout(paymentMethod)}
              disabled={!canCheckout}
              className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
                canCheckout
                  ? selectedPayment.online ? "bg-[var(--text-main)] text-white" : "bg-[#25D366] text-white"
                  : "pointer-events-none bg-[var(--surface-mid)] text-[var(--outline)]"
              }`}
            >
              {selectedPayment.online ? <CreditCard size={18} /> : <MessageCircle size={18} />}
              {isSubmitting
                ? "Preparation..."
                : checkoutReadiness.ready
                  ? `${selectedPayment.online ? "Payer maintenant" : "Confirmer sur WhatsApp"} (${formatPrice(primaryTotal)})`
                  : checkoutReadiness.label}
            </button>
            <p className="text-center text-xs font-semibold leading-4 text-[var(--text-dim)]">
              Le recu Tikchop apparait juste apres la creation de la commande.
            </p>
          </div>
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
          <h2 className="mt-2 font-display text-3xl font-bold leading-9">WhatsApp est ouvert</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/66">
            Envoyez le message prepare au vendeur. Votre recu est deja disponible.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
            <p className="quiet-label text-[var(--primary)]">Reference</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--text-main)]">#{order.orderRef}</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--primary)]">{formatPrice(order.total)}</p>
          </div>
          <a href={order.receiptUrl} className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-sm font-extrabold text-white no-underline">
            <ReceiptText size={18} />
            Voir ou telecharger le recu
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a href={`/${sellerSlug}`} className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-sm font-extrabold text-[var(--primary)] no-underline">
              Continuer achat
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

