"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { createOrder, initiatePayment } from "../actions";
import { getPaymentOption, LOCAL_PAYMENT_OPTIONS } from "../../lib/local-commerce";
import {
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Filter,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";

function cleanPhone(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
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
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [noteListening, setNoteListening] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("WAVE");
  const [orderSuccess, setOrderSuccess] = useState(null);

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
  const featuredProduct = filteredProducts[0] || products[0] || null;
  const availableProducts = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;

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
      alert("Ajoute ton numero et les informations de livraison.");
      return;
    }

    const selectedPayment = getPaymentOption(selectedMethod);

    setIsSubmitting(true);
    try {
      const checkoutItems = cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      
      const { orderId, orderRef, productsTotal, deliveryFee, totalToPay } = await createOrder(seller.id, checkoutItems, {
        paymentMethod: selectedPayment.value,
        deliveryType,
        deliveryZone,
        deliveryAddress,
        customerPhone
      });
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
      
      window.open(finalUrl, '_blank');
      setOrderSuccess({
        orderRef,
        receiptUrl,
        total: productsTotal + deliveryFee,
      });
      setCart({});
      setCustomerNote("");
      setCartOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la commande. Veuillez reessayer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startCustomerNoteVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La dictee vocale n'est pas disponible ici. Utilise le micro du clavier.");
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
      <section className="shop-topbar sticky top-0 z-40 -mx-4 px-5 py-3 md:mx-0 md:rounded-[22px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--text-main)] font-display text-sm font-bold text-white shadow-[var(--shadow-sm)]">
              {seller.name?.slice(0, 2).toUpperCase() || "TC"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-extrabold text-[var(--text-main)]">{seller.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-dim)]">
                <span className="h-2 w-2 rounded-full bg-[var(--primary-bright)]" />
                Commande rapide
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="flex h-12 min-w-12 items-center justify-center gap-1 rounded-2xl bg-[var(--primary)] px-3 text-sm font-extrabold text-white shadow-[var(--shadow-sm)]"
                aria-label="Voir le panier"
              >
                <ShoppingBag size={19} />
                {cartCount}
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuery((current) => current ? "" : " ")}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-main)]"
              aria-label="Rechercher"
            >
              <Search size={21} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </section>

      {query !== "" && (
      <section className="mt-4">
        <div className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 shadow-[var(--shadow-sm)]">
          <Search className="shrink-0 text-[var(--outline)]" size={19} />
          <input
            value={query.trimStart()}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher robe, sac, chaussure..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
            autoFocus
          />
        </div>
      </section>
      )}

      <main className="shop-main pt-5">
      {featuredProduct && (
        <ShopHero
          seller={seller}
          product={featuredProduct}
          totalProducts={products.length}
          availableProducts={availableProducts}
          deliveryZones={deliveryZones}
          onOpen={() => setSelectedProduct(featuredProduct)}
          onAdd={() => addToCart(featuredProduct)}
        />
      )}

      <section>
        <div className="mb-3 mt-6 flex items-center justify-between">
          <div>
            <p className="quiet-label text-[var(--primary)]">Catalogue</p>
            <h2 className="font-display text-2xl font-bold leading-8 text-[var(--text-main)]">Articles disponibles</h2>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--secondary)] shadow-[var(--shadow-sm)]">
            <Filter size={18} />
          </span>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-4">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={`min-h-[42px] whitespace-nowrap rounded-full px-4 text-sm font-extrabold transition ${
                item.value === category ? "bg-[var(--text-main)] text-white shadow-[var(--shadow-sm)]" : "border border-[var(--line)] bg-white text-[var(--text-main)] shadow-[var(--shadow-sm)]"
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

      <section className="mt-0 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
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
          <div className="app-card p-8 text-center">
            <h3 className="font-display text-xl font-semibold text-[var(--text-main)]">Aucun article trouve</h3>
            <p className="mt-2 text-sm text-[var(--text-dim)]">Essaie un autre mot ou une autre categorie.</p>
          </div>
        )}
      </section>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex min-h-[64px] items-center justify-center gap-3 rounded-full bg-[var(--text-main)] px-5 text-white shadow-[0_16px_34px_rgba(16,24,20,0.26)] transition-transform active:scale-95 md:hover:scale-105"
          >
            <ShoppingBag size={28} />
            <span className="font-display text-base font-bold">{formatPrice(cartTotal)}</span>
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

function ShopHero({ seller, product, totalProducts, availableProducts, deliveryZones, onOpen, onAdd }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <section className="shop-hero relative overflow-hidden rounded-[28px] bg-[var(--text-main)] text-white shadow-[var(--shadow-lg)]">
      <SafeProductImage
        src={product.image_url}
        alt={product.name}
        sizes="460px"
        className="object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[#0d1712]/52 to-[#0d1712]/92" />
      <div className="relative z-10 flex min-h-[342px] flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-white/12 px-3 text-xs font-extrabold text-white/88 backdrop-blur">
            <ShieldCheck size={15} />
            Paiement local
          </span>
          <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-extrabold text-[var(--text-main)]">
            <Store size={15} />
            {totalProducts} articles
          </span>
        </div>

        <div>
          <p className="quiet-label text-white/58">{seller.name}</p>
          <h2 className="mt-2 max-w-[18rem] font-display text-[2.35rem] font-bold leading-[2.55rem] text-white">
            Articles prets a commander.
          </h2>
          <p className="mt-2 max-w-[19rem] text-sm font-semibold leading-5 text-white/70">
            {availableProducts} articles en stock. Le client choisit la taille, la couleur ou les details au moment du panier.
          </p>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/12 p-3 backdrop-blur-xl">
            <div className="flex gap-3">
              <button type="button" onClick={onOpen} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] bg-white/10 text-left" aria-label={`Voir ${product.name}`}>
                <SafeProductImage
                  src={product.image_url}
                  alt={product.name}
                  sizes="80px"
                  className="object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-display text-lg font-bold leading-6">{product.name}</p>
                <p className="mt-1 text-base font-extrabold text-[var(--primary-bright)]">{formatPrice(product.price)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/58">
                  <Truck size={14} />
                  {deliveryZones.length > 0 ? `${deliveryZones.length} zones de livraison` : "Livraison a confirmer"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={stock === 0}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary-bright)] px-4 text-sm font-extrabold text-zinc-950 disabled:bg-white/15 disabled:text-white/45"
              >
                <ShoppingBag size={18} />
                Ajouter
              </button>
              <button
                type="button"
                onClick={onOpen}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-white text-[var(--text-main)]"
                aria-label="Voir les details"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductTile({ product, featured = false, quantity, onOpen, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);

  if (featured) {
    return (
      <article className="group relative col-span-2 row-span-2 cursor-pointer overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[var(--shadow-md)]">
        <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
          <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-mid)]">
            <SafeProductImage
              src={product.image_url}
              alt={product.name}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
            />
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-white/94 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-[0.05em] text-[var(--text-main)] shadow-sm backdrop-blur">
            En vitrine
          </span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#101814] via-[#101814]/76 to-transparent p-4 pt-24 text-white">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold leading-7 text-white line-clamp-2">
                  {product.name}
                </h3>
                <p className="mt-1 font-display text-lg font-extrabold text-[var(--primary-bright)]">{formatPrice(product.price)}</p>
              </div>
              <CartControl
                quantity={quantity}
                stock={stock}
                large
                onAdd={onAdd}
                onMinus={onMinus}
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-[0_16px_34px_rgba(13,23,18,0.08)] ring-1 ring-[rgba(191,206,197,0.34)] transition active:scale-[0.99] md:hover:-translate-y-1 md:hover:shadow-[var(--shadow-md)]">
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
        <div className="relative aspect-[4/5] overflow-hidden bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
          />
          <span className="absolute left-2 top-2 rounded-full bg-white/92 px-2.5 py-1 text-[0.64rem] font-extrabold text-[var(--text-main)] shadow-sm backdrop-blur">
            {productCategory(product)}
          </span>
          {stock === 0 && (
            <span className="absolute inset-x-2 bottom-2 rounded-2xl bg-red-600 px-2 py-2 text-center text-[0.68rem] font-extrabold uppercase text-white shadow-sm">
              Rupture
            </span>
          )}
          {stock > 0 && (
            <span className="absolute bottom-2 left-2 rounded-full bg-[var(--primary-bright)] px-3 py-1.5 font-display text-[0.82rem] font-extrabold text-[var(--text-main)] shadow-sm">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
        <div className="flex flex-grow flex-col justify-between p-3.5">
          <h3 className="min-h-[2.6rem] text-sm font-extrabold leading-5 text-[var(--text-main)] line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-[1.05rem] font-extrabold leading-none text-[var(--primary)]">{formatPrice(product.price)}</p>
              <p className="mt-1 text-[0.68rem] font-bold text-[var(--outline)]">Stock {stock}</p>
            </div>
            <CartControl quantity={quantity} stock={stock} onAdd={onAdd} onMinus={onMinus} />
          </div>
        </div>
      </div>
    </article>
  );
}

function CartControl({ quantity, stock, large = false, onAdd, onMinus }) {
  if (quantity > 0) {
    return (
      <div className={`flex items-center gap-2 rounded-full bg-[var(--primary)] px-2 text-white shadow-sm ${large ? "h-12" : "h-10"}`}>
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
      className={`flex items-center justify-center rounded-2xl text-[var(--text-main)] transition disabled:text-[var(--outline)] ${large ? "h-12 w-12 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--surface-mid)]" : "h-10 min-w-10 gap-1 bg-[var(--text-main)] px-2 text-white disabled:bg-[var(--surface-mid)]"}`}
      aria-label="Ajouter"
    >
      <Plus size={large ? 22 : 17} />
      {!large && <span className="hidden text-xs font-extrabold min-[390px]:inline">Ajouter</span>}
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
          <p className="font-display text-base font-bold text-[var(--primary)]">{formatPrice(product.price)}</p>
          <h3 className="mt-1 font-display text-2xl font-bold leading-8 text-[var(--text-main)]">{product.name}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            {product.description || "Ajoute cet article au panier puis envoie la commande directement sur WhatsApp."}
          </p>
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
            <h3 className="font-display text-2xl font-bold text-[var(--text-main)]">Finaliser ma commande</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-mid)]" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <CheckoutProgress steps={checkoutReadiness.steps} />

          {cartItems.length > 0 ? (
          <div className="rounded-[22px] bg-[var(--text-main)] p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="quiet-label text-white/50">Resume</p>
                <h3 className="mt-1 font-display text-xl font-bold text-white">{cartItems.length} article{cartItems.length > 1 ? "s" : ""}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white/50">Total</p>
                <p className="font-display text-xl font-extrabold text-[var(--primary-bright)]">{formatPrice(orderGrandTotal)}</p>
                {displayedDeliveryFee > 0 && <p className="mt-1 text-[0.68rem] font-bold text-white/50">{deliveryNote}</p>}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {cartItems.slice(0, 3).map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
                  <span className="min-w-0 truncate">{quantity} x {product.name}</span>
                  <span className="shrink-0 text-white/70">{formatPrice(Number(product.price || 0) * quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--surface-soft)] p-8 text-center">
            <p className="font-display font-semibold text-[var(--text-main)]">Panier vide</p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">Ajoute un article pour preparer le message WhatsApp.</p>
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
            
            <div className="grid grid-cols-2 rounded-2xl border border-[var(--outline)]/40 bg-[var(--surface-mid)] p-1">
              <button 
                onClick={() => setDeliveryType("DELIVERY")}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-all ${
                  deliveryType === "DELIVERY" ? "bg-white text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)]"
                }`}
              >
                Livraison
              </button>
              <button 
                onClick={() => setDeliveryType("PICKUP")}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-all ${
                  deliveryType === "PICKUP" ? "bg-white text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)]"
                }`}
              >
                Retrait Boutique
              </button>
            </div>
            </div>

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--primary)]">2</span>
                <MapPin size={18} className="text-[var(--primary)]" />
                Informations
              </h4>
              <input 
                type="text" 
                placeholder="Ex: 01 02 03 04 05"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mobile-input bg-white"
              />
              {deliveryType === "DELIVERY" && (
                <>
                  {deliveryZones.length > 0 ? (
                    <>
                      <select
                        value={deliveryZone}
                        onChange={(e) => setDeliveryZone(e.target.value)}
                        className="mobile-input bg-white"
                      >
                        <option value="">Choisir commune / quartier</option>
                        {deliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.name}>
                            {zone.name} - {formatPrice(zone.fee)}
                          </option>
                        ))}
                      </select>
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
                    <input 
                      type="text" 
                      placeholder="Quartier / Zone"
                      value={deliveryZone}
                      onChange={(e) => setDeliveryZone(e.target.value)}
                      className="mobile-input bg-white"
                    />
                  )}
                  <input 
                    type="text" 
                    placeholder="Quartier, rue, repere..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mobile-input bg-white"
                  />
                </>
              )}
              <div className="rounded-[20px] border border-[var(--outline)]/35 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--text-main)]">Taille, couleur ou precision</p>
                    <p className="text-xs font-semibold text-[var(--text-dim)]">Optionnel. Tu peux aussi dicter.</p>
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
                    className={`min-h-[72px] rounded-2xl border p-3 text-left active:scale-[0.99] ${
                      paymentMethod === option.value
                        ? "border-[var(--text-main)] bg-[var(--text-main)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text-main)]"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{option.shortLabel}</span>
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
              Le recu Tikchop sera disponible juste apres la creation de la commande.
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

  if (!hasCart) return { ready: false, label: "Ajoute un article", steps };
  if (!hasPhone) return { ready: false, label: "Ajoute ton numero", steps };
  if (!hasReception) return { ready: false, label: deliveryType === "PICKUP" ? "Choisis reception" : "Complete livraison", steps };

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
            Envoie le message prepare au vendeur. Ton recu est deja disponible.
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

