import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  const content = readFileSync(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://dashboard-mu-blue-xduynfs3jo.vercel.app").replace(/\/+$/, "");
const sellerSlug = arg("--seller", "braman");
const customerPhone = arg("--customer", "+225 07 88 77 66 55");
const driverPhoneArg = arg("--driver-phone", "");
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
const orderRef = `TEST${suffix}`;

console.log("Tikchop field test order");
console.log("------------------------");
console.log(`Boutique cible: /${sellerSlug}`);

const { data: seller, error: sellerError } = await supabase
  .from("sellers")
  .select("id,name,slug,phone_number,whatsapp_status,evolution_instance")
  .eq("slug", sellerSlug)
  .single();

assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique introuvable.");

const { data: existingProducts, error: productLoadError } = await supabase
  .from("products")
  .select("id,name,price,stock_quantity")
  .eq("seller_id", seller.id)
  .order("created_at", { ascending: false })
  .limit(1);

assertOk(!productLoadError, productLoadError?.message || "Articles non charges.");

let product = existingProducts?.[0] || null;
if (!product) {
  const { data: createdProduct, error: createProductError } = await supabase
    .from("products")
    .insert([{
      seller_id: seller.id,
      name: "Article test terrain Tikchop",
      price: 12500,
      stock_quantity: 3,
      image_url: "/landing/raffia-bags.jpg",
      description: "Article cree pour tester le cycle commande/livraison Tikchop.",
      product_keywords: "test, terrain, tikchop",
    }])
    .select("id,name,price,stock_quantity")
    .single();

  assertOk(!createProductError && createdProduct?.id, createProductError?.message || "Article test non cree.");
  product = createdProduct;
  console.log(`OK - article test cree: ${product.name}`);
} else {
  console.log(`OK - article existant utilise: ${product.name}`);
}

const { data: zones, error: zoneError } = await supabase
  .from("delivery_zones")
  .select("id,name,fee")
  .eq("seller_id", seller.id)
  .eq("is_active", true)
  .order("created_at", { ascending: true })
  .limit(1);

assertOk(!zoneError, zoneError?.message || "Zones non chargees.");
const zone = zones?.[0] || { name: "Cocody", fee: 1000 };

const { data: existingDrivers, error: driverLoadError } = await supabase
  .from("delivery_drivers")
  .select("id,name,phone_number,zone,is_active")
  .eq("seller_id", seller.id)
  .eq("is_active", true)
  .order("created_at", { ascending: false })
  .limit(1);

assertOk(!driverLoadError, driverLoadError?.message || "Livreurs non charges.");

let driver = existingDrivers?.[0] || null;
if (!driver) {
  const driverPhone = driverPhoneArg || seller.phone_number || "";
  const { data: createdDriver, error: createDriverError } = await supabase
    .from("delivery_drivers")
    .insert([{
      seller_id: seller.id,
      name: "Livreur test terrain",
      phone_number: driverPhone,
      zone: zone.name,
      is_active: true,
    }])
    .select("id,name,phone_number,zone,is_active")
    .single();

  assertOk(!createDriverError && createdDriver?.id, createDriverError?.message || "Livreur test non cree.");
  driver = createdDriver;
  console.log(`OK - livreur test cree: ${driver.name}`);
} else {
  console.log(`OK - livreur existant utilise: ${driver.name}`);
}

const productPrice = Number(product.price || 12500);
const deliveryFee = Number(zone.fee || 1000);
const { data: order, error: orderError } = await supabase
  .from("orders")
  .insert([{
    seller_id: seller.id,
    order_ref: orderRef,
    customer_phone: customerPhone,
    status: "PAID",
    total_amount: productPrice,
    payment_method: "WAVE",
    delivery_type: "DELIVERY",
    delivery_zone: zone.name,
    delivery_address: "TEST TERRAIN - ne pas livrer - verifier fiche livreur",
    delivery_fee: deliveryFee,
    delivery_status: "PENDING",
    delivery_driver_id: driver.id,
  }])
  .select("id,order_ref")
  .single();

assertOk(!orderError && order?.id, orderError?.message || "Commande test non creee.");

const { error: itemError } = await supabase
  .from("order_items")
  .insert([{
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    price_at_time: productPrice,
  }]);

assertOk(!itemError, itemError?.message || "Ligne commande test non creee.");

console.log(`OK - commande test creee: ${order.order_ref}`);
console.log("");
console.log("A ouvrir maintenant:");
console.log(`- Commandes vendeur: ${appUrl}/orders`);
console.log(`- Boutique publique: ${appUrl}/${seller.slug}`);
console.log(`- Recu client: ${appUrl}/receipt?order=${order.id}`);
console.log("");
console.log("Cycle terrain a faire dans l'app:");
console.log("1. Ouvrir Commandes.");
console.log(`2. Ouvrir la commande ${order.order_ref}.`);
console.log("3. Marquer colis pret.");
console.log("4. Envoyer la fiche au livreur test.");
console.log("5. Marquer livree apres verification.");
