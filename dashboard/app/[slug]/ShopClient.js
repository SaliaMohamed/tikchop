"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { createOrder, initiatePayment } from "../actions";
import { getPaymentOption, LOCAL_PAYMENT_OPTIONS } from "../../lib/local-commerce";
import {
  ChevronRight,
  CreditCard,
  Filter,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
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
  const [paymentMethod, setPaymentMethod] = useState("WAVE");

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
        `Paiement souhaite: ${selectedPayment.label}`,
        selectedPayment.value === "CASH_ON_DELIVERY"
          ? `Montant a payer apres reception: ${formatPrice(productsTotal + deliveryFee)}`
          : deliveryPaymentTiming === "AT_RECEPTION" && deliveryType === "DELIVERY"
            ? `Livraison a payer apres reception: ${formatPrice(deliveryFee)}`
            : `Montant a regler maintenant: ${formatPrice(totalToPay)}`,
        `---`,
        `Ref Commande: ${orderRef}`,
      ].join("\n");
      const finalUrl = `https://wa.me/${cleanPhone(seller.phone_number)}?text=${encodeURIComponent(textWithOrder)}`;
      
      window.open(finalUrl, '_blank');
      setCart({});
      setCartOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la commande. Veuillez reessayer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="sticky top-0 z-40 -mx-4 border-b border-white/70 bg-white/92 px-5 py-3 shadow-[0_8px_26px_rgba(16,24,20,0.06)] backdrop-blur-xl md:mx-0 md:rounded-2xl md:border md:border-[var(--line)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--text-main)] font-display text-sm font-bold text-white shadow-[var(--shadow-sm)]">
              {seller.name?.slice(0, 2).toUpperCase() || "TC"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-extrabold text-[var(--text-main)]">{seller.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-dim)]">
                <span className="h-2 w-2 rounded-full bg-[var(--primary-bright)]" />
                Boutique active
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

      <main className="pt-5">
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
            {filteredProducts.map((product, index) => (
              <ProductTile
                key={product.id}
                product={product}
                featured={index === 0}
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
        />
      )}
    </>
  );
}

function ShopHero({ seller, product, totalProducts, availableProducts, deliveryZones, onOpen, onAdd }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <section className="relative overflow-hidden rounded-[26px] bg-[var(--text-main)] text-white shadow-[var(--shadow-md)]">
      <button type="button" onClick={onOpen} className="absolute inset-0 z-0 text-left" aria-label={`Voir ${product.name}`}>
        <SafeProductImage
          src={product.image_url}
          alt={product.name}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-[0.42]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-[#101814] via-[#101814]/70 to-[#101814]/12" />
      </button>

      <div className="relative z-10 flex min-h-[360px] flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-white/12 px-3 text-xs font-extrabold text-white/86 backdrop-blur">
            <ShieldCheck size={15} />
            Achat via WhatsApp
          </span>
          <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-extrabold text-[var(--text-main)]">
            <Store size={15} />
            {totalProducts} articles
          </span>
        </div>

        <div>
          <p className="quiet-label text-white/55">{seller.name}</p>
          <h2 className="mt-2 max-w-[18rem] font-display text-[2.25rem] font-bold leading-[2.55rem] text-white">
            Selection du moment
          </h2>
          <p className="mt-2 max-w-[18rem] text-sm font-semibold leading-5 text-white/68">
            {availableProducts} articles en stock. Commande rapide, retrait ou livraison.
          </p>

          <div className="mt-4 rounded-[20px] bg-white/12 p-3 backdrop-blur">
            <div className="flex gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                <SafeProductImage
                  src={product.image_url}
                  alt={product.name}
                  sizes="80px"
                  className="object-cover"
                />
              </div>
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
    <article className="group flex flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)] transition active:scale-[0.99]">
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
          />
          <span className="absolute left-2 top-2 rounded-full bg-white/92 px-2.5 py-1 text-[0.64rem] font-extrabold text-[var(--text-main)] shadow-sm">
            {productCategory(product)}
          </span>
          {stock === 0 && (
            <span className="absolute inset-x-2 bottom-2 rounded-2xl bg-red-600 px-2 py-2 text-center text-[0.68rem] font-extrabold uppercase text-white shadow-sm">
              Rupture
            </span>
          )}
        </div>
        <div className="flex flex-grow flex-col justify-between p-3">
          <h3 className="min-h-[2.6rem] text-sm font-extrabold leading-5 text-[var(--text-main)] line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-base font-extrabold leading-none text-[var(--primary)]">{formatPrice(product.price)}</p>
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
      className={`flex items-center justify-center rounded-2xl text-[var(--text-main)] transition disabled:text-[var(--outline)] ${large ? "h-12 w-12 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--surface-mid)]" : "h-10 w-10 bg-[var(--text-main)] text-white disabled:bg-[var(--surface-mid)]"}`}
      aria-label="Ajouter"
    >
      <Plus size={large ? 22 : 17} />
    </button>
  );
}

function ProductSheet({ product, quantity, onClose, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/45 backdrop-blur-[3px] md:items-center md:px-3">
      <div className="mx-auto max-h-[92svh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-white shadow-2xl md:rounded-[26px]">
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
  setPaymentMethod
}) {
  const selectedPayment = getPaymentOption(paymentMethod);
  const primaryTotal = selectedPayment.online ? onlinePaymentTotal : orderGrandTotal;
  const deliveryNote = deliveryPaymentTiming === "AT_RECEPTION"
    ? "Livraison payable apres reception"
    : deliveryPaymentTiming === "OFFERED"
      ? "Livraison offerte par la boutique"
      : "Livraison incluse au paiement";

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/45 backdrop-blur-[3px]">
      <div className="mx-auto flex max-h-[84svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_-18px_45px_rgba(16,24,20,0.20)]">
        <div className="flex w-full justify-center pt-2 pb-1">
          <div className="h-1 w-8 rounded-full bg-[var(--outline)]/50" />
        </div>
        <div className="flex items-center justify-between border-b border-[var(--outline)]/30 px-5 pb-4">
          <div>
            <p className="quiet-label text-[var(--primary)]">Panier</p>
            <h3 className="font-display text-2xl font-bold text-[var(--text-main)]">Finaliser</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-mid)]" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
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
            </div>

            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-main)]">
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
              disabled={!cartItems.length || isSubmitting}
              className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
                cartItems.length && !isSubmitting
                  ? selectedPayment.online ? "bg-[var(--text-main)] text-white" : "bg-[#25D366] text-white"
                  : "pointer-events-none bg-[var(--surface-mid)] text-[var(--outline)]"
              }`}
            >
              {selectedPayment.online ? <CreditCard size={18} /> : <MessageCircle size={18} />}
              {isSubmitting ? "Preparation..." : `${selectedPayment.online ? "Payer maintenant" : "Confirmer sur WhatsApp"} (${formatPrice(primaryTotal)})`}
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

