"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { createOrder, initiatePayment } from "../actions";
import {
  CreditCard,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
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
  if (text.match(/robe|pagne|habit|mode|t-shirt|chemise/)) return "Vêtements";
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

  const categories = useMemo(() => {
    const values = new Set(products.map((product) => productCategory(product)));
    return [
      { value: "Tout", label: "Tous les produits" },
      { value: "Vêtements", label: "Vêtements" },
      { value: "Accessoires", label: "Accessoires" },
      { value: "Chaussures", label: "Chaussures" },
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

  function removeItem(productId) {
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  const whatsappText = [
    `Bonjour ${seller.name}, je veux commander :`,
    ...cartItems.map(({ product, quantity }) => `- ${quantity} x ${product.name} (${formatPrice(product.price)}) Ref: ${product.id}`),
    `Total: ${formatPrice(cartTotal)}`,
    "Mode de paiement souhaite: Wave",
  ].join("\n");

  const whatsappUrl = `https://wa.me/${cleanPhone(seller.phone_number)}?text=${encodeURIComponent(whatsappText)}`;

  async function handleCheckout(method = "WHATSAPP") {
    if (!customerPhone || (deliveryType === "DELIVERY" && (!deliveryZone || !deliveryAddress))) {
      alert("Veuillez remplir toutes les informations de livraison.");
      return;
    }

    setIsSubmitting(true);
    try {
      const checkoutItems = cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      
      const { orderId, orderRef, productsTotal, deliveryFee, totalToPay } = await createOrder(seller.id, checkoutItems, {
        paymentMethod: method === "PAYSTACK" ? "PAYSTACK" : "WAVE",
        deliveryType,
        deliveryZone,
        deliveryAddress,
        customerPhone
      });
      
      if (method === "PAYSTACK") {
        const { authorization_url } = await initiatePayment(orderId);
        window.location.href = authorization_url;
        return;
      }
      
      const textWithOrder = [
        `Bonjour ${seller.name}, je veux commander :`,
        ...cartItems.map(({ product, quantity }) => `- ${quantity} x ${product.name} (${formatPrice(product.price)})`),
        `---`,
        `Produits: ${formatPrice(productsTotal)}`,
        `Livraison (${deliveryType === 'PICKUP' ? 'Retrait' : 'Zone ' + deliveryZone}): ${formatPrice(deliveryFee)}`,
        `TOTAL: ${formatPrice(productsTotal + deliveryFee)}`,
        `---`,
        `Client: ${customerPhone}`,
        `Adresse: ${deliveryAddress}`,
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
      <section className="sticky top-0 z-40 -mx-4 border-b border-[var(--outline)]/30 bg-white px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:mx-0 md:rounded-xl md:border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--outline)]/50 bg-[var(--surface-mid)] font-display text-sm font-bold text-[var(--primary)]">
              {seller.name?.slice(0, 2).toUpperCase() || "TC"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-semibold text-[var(--text-main)]">{seller.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--text-dim)]">
                <span className="h-2 w-2 rounded-full bg-[var(--primary-bright)]" />
                En ligne
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuery((current) => current ? "" : " ")}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--text-main)]"
            aria-label="Rechercher"
          >
            <Search size={22} strokeWidth={2.4} />
          </button>
        </div>
      </section>

      {query !== "" && (
      <section className="mt-5">
        <div className="flex min-h-[54px] items-center gap-3 rounded-xl border border-[var(--outline)]/70 bg-white px-4">
          <Search className="shrink-0 text-[var(--outline)]" size={19} />
          <input
            value={query.trimStart()}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un article"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--outline)]"
            autoFocus
          />
        </div>
      </section>
      )}

      <section className="mt-8 min-h-[52px]">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={`min-h-[40px] whitespace-nowrap rounded-full px-5 text-sm font-semibold transition ${
                item.value === category ? "bg-[var(--primary)] text-white" : "border border-[var(--outline)]/30 bg-[var(--surface-mid)] text-[var(--text-main)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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

      {cartCount > 0 && (
        <div className="fixed bottom-[92px] right-5 z-40 md:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_8px_30px_rgba(16,185,129,0.30)]"
          >
            <ShoppingBag size={28} />
            <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-red-600 px-1 text-[0.62rem] font-bold text-white">
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
          onAdd={addToCart}
          onMinus={decrement}
          onRemove={removeItem}
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
        />
      )}
    </>
  );
}

function ProductTile({ product, featured = false, quantity, onOpen, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);

  if (featured) {
    return (
      <article className="app-card group relative col-span-2 row-span-2 cursor-pointer overflow-hidden">
        <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
          <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-mid)]">
            <SafeProductImage
              src={product.image_url}
              alt={product.name}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
            />
          </div>
          <span className="absolute left-4 top-4 rounded bg-white/90 px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-main)] backdrop-blur">
            Nouveau
          </span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/86 to-transparent p-4 pt-14">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold leading-7 text-[var(--text-main)] drop-shadow-sm line-clamp-2">
                  {product.name}
                </h3>
                <p className="mt-1 font-display text-base font-semibold text-[var(--primary)]">{formatPrice(product.price)}</p>
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
    <article className="app-card group flex flex-col overflow-hidden transition active:scale-[0.99]">
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-active:scale-105 md:group-hover:scale-105"
          />
          {stock === 0 && (
            <span className="absolute left-3 top-3 rounded bg-red-600 px-2 py-1 text-[0.62rem] font-bold uppercase text-white">
              Rupture
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-base font-semibold leading-6 text-[var(--text-main)] line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="font-display text-base font-semibold text-[var(--primary)]">{formatPrice(product.price)}</p>
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
      <div className={`flex items-center gap-2 rounded-full bg-[var(--primary)] px-2 text-white ${large ? "h-12" : "h-9"}`}>
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
      className={`flex items-center justify-center rounded-full text-[var(--text-main)] transition disabled:text-[var(--outline)] ${large ? "h-12 w-12 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--surface-mid)]" : "h-9 w-9 bg-[var(--surface-mid)]"}`}
      aria-label="Ajouter"
    >
      <Plus size={large ? 22 : 17} />
    </button>
  );
}

function ProductSheet({ product, quantity, onClose, onAdd, onMinus }) {
  const stock = Number(product.stock_quantity || 0);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/40 backdrop-blur-[2px] md:items-center md:px-3">
      <div className="mx-auto max-h-[92svh] w-full max-w-[430px] overflow-y-auto rounded-t-xl bg-white shadow-2xl md:rounded-xl">
        <div className="relative aspect-[4/3] bg-[var(--surface-mid)]">
          <SafeProductImage
            src={product.image_url}
            alt={product.name}
            sizes="430px"
            className="object-cover"
          />
          <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-950">
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
              <div className="flex min-h-[56px] items-center justify-between rounded-xl bg-[var(--primary)] px-4 text-white">
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
                className="min-h-[56px] w-full rounded-xl bg-[var(--primary-bright)] text-base font-semibold text-[#042719] disabled:bg-[var(--surface-mid)] disabled:text-[var(--outline)]"
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
  onAdd, 
  onMinus, 
  onRemove,
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
  displayedDeliveryFee
}) {
  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/40 backdrop-blur-[2px] md:items-center md:px-3">
      <div className="mx-auto flex max-h-[94vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl md:rounded-xl">
        <div className="flex items-center justify-between border-b border-[var(--outline)]/30 px-5 py-4">
          <h3 className="font-display text-2xl font-bold text-[var(--text-main)]">Finaliser la commande</h3>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-mid)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cartItems.length > 0 ? (
          <div className="space-y-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-dim)]">Resume ({cartItems.length} article{cartItems.length > 1 ? "s" : ""})</p>
              <p className="font-display font-semibold text-[var(--primary)]">{formatPrice(cartTotal + displayedDeliveryFee)}</p>
            </div>
            {cartItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex gap-3 rounded-xl bg-[var(--surface-soft)] p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-mid)]">
                  <SafeProductImage
                    src={product.image_url}
                    alt={product.name}
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-[var(--text-main)]">{product.name}</p>
                  <p className="text-sm font-semibold text-[var(--primary)]">{formatPrice(product.price)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => onMinus(product.id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                      <Minus size={14} />
                    </button>
                    <span className="min-w-5 text-center text-sm font-extrabold">{quantity}</span>
                    <button type="button" onClick={() => onAdd(product)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => onRemove(product.id)} className="self-start rounded-full p-2 text-[var(--outline)]">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--surface-soft)] p-8 text-center">
            <p className="font-display font-semibold text-[var(--text-main)]">Panier vide</p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">Ajoute un article pour preparer le message WhatsApp.</p>
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-dim)]">Total a payer</p>
              <p className="font-display text-xl font-bold text-[var(--primary)]">{formatPrice(cartTotal + displayedDeliveryFee)}</p>
            </div>

            <h4 className="text-sm font-semibold text-[var(--text-dim)]">Type de reception</h4>
            
            <div className="grid grid-cols-2 rounded-xl border border-[var(--outline)]/40 bg-[var(--surface-mid)] p-1">
              <button 
                onClick={() => setDeliveryType("DELIVERY")}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                  deliveryType === "DELIVERY" ? "bg-white text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)]"
                }`}
              >
                Livraison
              </button>
              <button 
                onClick={() => setDeliveryType("PICKUP")}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                  deliveryType === "PICKUP" ? "bg-white text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)]"
                }`}
              >
                Retrait Boutique
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[var(--text-dim)]">Vos informations</h4>
              <input 
                type="text" 
                placeholder="Ton numero WhatsApp"
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
                      <option value="">Choisir une zone</option>
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
                      className="mobile-input bg-zinc-50"
                    />
                  )}
                  <input 
                    type="text" 
                    placeholder="Adresse ou point de repere"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mobile-input bg-white"
                  />
                </>
              )}
            </div>
          </div>
        )}
        </div>

        <div className="border-t border-[var(--outline)]/30 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          <div className="space-y-3">
            <button
              onClick={() => onCheckout("PAYSTACK")}
              disabled={!cartItems.length || isSubmitting}
              className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold ${
                cartItems.length && !isSubmitting ? "bg-[var(--primary)] text-white" : "pointer-events-none bg-[var(--surface-mid)] text-[var(--outline)]"
              }`}
            >
              <CreditCard size={18} />
              {isSubmitting ? "Initialisation..." : `Payer en ligne (${formatPrice(cartTotal + displayedDeliveryFee)})`}
            </button>
            <button
              onClick={() => onCheckout("WHATSAPP")}
              disabled={!cartItems.length || isSubmitting}
              className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold ${
                cartItems.length && !isSubmitting ? "bg-[#25D366] text-white" : "pointer-events-none bg-[var(--surface-mid)] text-[var(--outline)]"
              }`}
            >
              <MessageCircle size={18} />
              {isSubmitting ? "Creation..." : "Envoyer sur WhatsApp"}
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

