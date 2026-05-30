import { readFileSync } from "node:fs";
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

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const sellerSlug = arg("--seller", "");

console.log("Tikchop field-test cleanup");
console.log("--------------------------");

let query = supabase
  .from("orders")
  .select("id,order_ref,seller_id,sellers!inner(slug,name)")
  .like("order_ref", "TEST%");

if (sellerSlug) {
  query = query.eq("sellers.slug", sellerSlug);
}

const { data: orders, error } = await query;
if (error) {
  throw new Error(error.message);
}

if (!orders?.length) {
  console.log("OK - aucune commande TEST a nettoyer.");
  process.exit(0);
}

const orderIds = orders.map((order) => order.id);
const sellerIds = Array.from(new Set(orders.map((order) => order.seller_id).filter(Boolean)));

await supabase.from("order_items").delete().in("order_id", orderIds);
await supabase.from("orders").delete().in("id", orderIds);

if (sellerIds.length) {
  const { data: testProducts } = await supabase
    .from("products")
    .select("id")
    .in("seller_id", sellerIds)
    .eq("name", "Article test terrain Tikchop");

  if (testProducts?.length) {
    await supabase.from("products").delete().in("id", testProducts.map((product) => product.id));
  }

  const { data: testDrivers } = await supabase
    .from("delivery_drivers")
    .select("id")
    .in("seller_id", sellerIds)
    .eq("name", "Livreur test terrain");

  if (testDrivers?.length) {
    await supabase.from("delivery_drivers").delete().in("id", testDrivers.map((driver) => driver.id));
  }
}

console.log(`OK - ${orders.length} commande(s) TEST supprimee(s).`);
for (const order of orders) {
  console.log(`- ${order.order_ref} (${order.sellers?.slug || "boutique"})`);
}
