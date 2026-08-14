"use server";

import { supabaseAdmin } from "../../../lib/supabase-admin";

import { requireSellerBySlug } from "./auth";
import { normalizeProductVariants } from "./shared";

/**
 * Product CRUD, delivery zones & drivers.
 */
export async function addProduct(product, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(product?.seller_id, accessToken);

  const payload = {
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 0),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    seller_id: product.seller_id,
  };

if (!payload.seller_id || !payload.name || payload.price <= 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select("id")
    .single();

  if (error && /product_variants|product_keywords|schema cache|column/i.test(error.message || "")) {
    const { product_variants, product_keywords, ...fallbackPayload } = payload;
    const fallback = await supabaseAdmin
      .from("products")
      .insert([fallbackPayload])
      .select("id")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addProductsBulk(products, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const sellerIds = [...new Set((products || []).map((product) => product?.seller_id).filter(Boolean))];
  if (sellerIds.length !== 1) {
    throw new Error("Les produits doivent appartenir a une seule boutique.");
  }
  await requireSellerById(sellerIds[0], accessToken);

  const payload = (products || []).map((product) => ({
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 1),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    seller_id: product.seller_id,
})).filter((product) => (
    product.seller_id
    && product.name
    && product.price > 0
    && product.stock_quantity >= 0
  ));

  if (payload.length === 0) {
    throw new Error("Aucun produit valide a ajouter.");
  }

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert(payload)
    .select("id");

  if (error && /product_variants|product_keywords|schema cache|column/i.test(error.message || "")) {
    const fallbackPayload = payload.map(({ product_variants, product_keywords, ...product }) => product);
    const fallback = await supabaseAdmin
      .from("products")
      .insert(fallbackPayload)
      .select("id");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSellerProducts(slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id, slug");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT_FULL)
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  if (error && isSchemaColumnError(error)) {
    const fallback = await supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT_LEGACY)
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data || [];
  }

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateProduct(productId, product, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  const payload = {
    name: String(product.name || "").trim(),
    price: normalizeProductPrice(product.price),
    stock_quantity: normalizeProductStock(product.stock_quantity, 0),
    description: String(product.description || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    product_variants: normalizeProductVariants(product.product_variants || product.variants_text),
    product_keywords: String(product.product_keywords || "").trim() || null,
    is_active: product.is_active === false ? false : true,
  };

  if (!productId || !payload.name || payload.price < 0 || payload.stock_quantity < 0) {
    throw new Error("Invalid product payload.");
  }

  return updateProductWithFallback(productId, seller.id, payload);
}

export async function updateProductQuick(productId, updates, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates || {}, "stock_quantity")) {
    const stock = Number.parseInt(updates.stock_quantity ?? 0, 10);
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error("Stock invalide.");
    }
    payload.stock_quantity = stock;
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "is_active")) {
    payload.is_active = Boolean(updates.is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Aucune modification a enregistrer.");
  }

  return updateProductWithFallback(productId, seller.id, payload);
}

export async function duplicateProduct(productId, slug, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const seller = await requireSellerBySlug(slug, accessToken, "id");

  let { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_SELECT_FULL)
    .eq("id", productId)
    .eq("seller_id", seller.id)
    .single();

  if (productError && isSchemaColumnError(productError)) {
    const fallback = await supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT_LEGACY)
      .eq("id", productId)
      .eq("seller_id", seller.id)
      .single();
    product = fallback.data;
    productError = fallback.error;
  }

  if (productError || !product) {
    throw new Error(productError?.message || "Article introuvable.");
  }

  const payload = {
    seller_id: seller.id,
    name: `${String(product.name || "Article").trim()} copie`,
    price: Number(product.price || 0),
    stock_quantity: Math.max(1, Number.parseInt(product.stock_quantity || 1, 10)),
    description: product.description || null,
    image_url: product.image_url || null,
    product_variants: Array.isArray(product.product_variants) ? product.product_variants : [],
    product_keywords: product.product_keywords || null,
    is_active: true,
  };

  let { data, error } = await supabaseAdmin
    .from("products")
    .insert([payload])
    .select(PRODUCT_SELECT_FULL)
    .single();

  if (error && isSchemaColumnError(error)) {
    const { product_variants, product_keywords, is_active, ...fallbackPayload } = payload;
    const fallback = await supabaseAdmin
      .from("products")
      .insert([fallbackPayload])
      .select(PRODUCT_SELECT_LEGACY)
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addDeliveryZone(sellerId, zone, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const payload = {
    seller_id: sellerId,
    name: String(zone.name || "").trim(),
    fee: Number(zone.fee || 0),
    is_active: true,
  };

  if (!payload.seller_id || !payload.name || payload.fee < 0) {
    throw new Error("Invalid delivery zone.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDeliveryZone(zoneId, zone, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingZone, error: existingZoneError } = await supabaseAdmin
    .from("delivery_zones")
    .select("seller_id")
    .eq("id", zoneId)
    .single();

  if (existingZoneError || !existingZone) {
    throw new Error("Zone introuvable.");
  }

  await requireSellerById(existingZone.seller_id, accessToken);

  const payload = {
    name: String(zone.name || "").trim(),
    fee: Number(zone.fee || 0),
    is_active: zone.is_active ?? true,
  };

  if (!zoneId || !payload.name || payload.fee < 0) {
    throw new Error("Invalid delivery zone.");
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .update(payload)
    .eq("id", zoneId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addDeliveryZonesBulk(sellerId, zones, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  await requireSellerById(sellerId, accessToken);

  const cleanZones = (zones || [])
    .map((zone) => ({
      seller_id: sellerId,
      name: String(zone.name || "").trim(),
      fee: Number(zone.fee || 0),
      is_active: true,
    }))
    .filter((zone) => zone.name && zone.fee >= 0);

  if (cleanZones.length === 0) {
    throw new Error("Aucune zone valide.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("delivery_zones")
    .select("name")
    .eq("seller_id", sellerId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingNames = new Set((existing || []).map((zone) => zone.name.toLowerCase()));
  const payload = cleanZones.filter((zone) => !existingNames.has(zone.name.toLowerCase()));

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .insert(payload)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function deleteDeliveryZone(zoneId, accessToken) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized.");
  }

  const { data: existingZone, error: existingZoneError } = await supabaseAdmin
    .from("delivery_zones")
    .select("seller_id")
    .eq("id", zoneId)
    .single();

  if (existingZoneError || !existingZone) {
    throw new Error("Zone introuvable.");
  }

  await requireSellerById(existingZone.seller_id, accessToken);

  const { error } = await supabaseAdmin
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

