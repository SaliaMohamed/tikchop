import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

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

function line(ok, label, detail = "") {
  const mark = ok ? "OK" : "ECHEC";
  console.log(`${mark} - ${label}${detail ? `: ${detail}` : ""}`);
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestOk(url, expectedContentType = "") {
  const response = await fetch(url, { redirect: "follow" });
  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());

  assertOk(response.ok, `${url} retourne ${response.status}`);
  if (expectedContentType) {
    assertOk(contentType.includes(expectedContentType), `${url} content-type ${contentType}`);
  }

  return { response, contentType, bytes };
}

const env = loadEnv();
const appUrl = (env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
const slug = `beta-smoke-${suffix}`;
const phone = `2250700${suffix.slice(0, 6)}`;
const orderRef = `BETA${suffix.slice(0, 4).toUpperCase()}`;
const created = {
  sellerId: null,
  productIds: [],
  orderId: null,
  orderItemIds: [],
  zoneIds: [],
  driverIds: [],
};

console.log("Tikchop beta smoke test");
console.log("-----------------------");
console.log(`Boutique temporaire: /${slug}`);

try {
  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .insert([{
      name: "Beta Smoke Tikchop",
      slug,
      phone_number: phone,
      delivery_enabled: true,
      pickup_enabled: true,
      fixed_delivery_fee: 1500,
      delivery_payment_timing: "AT_RECEPTION",
      auto_share_to_driver: false,
      whatsapp_provider: "tikchop_standard",
      whatsapp_status: "standard_active",
      bot_tone: "Francais ivoirien simple, poli, direct.",
      bot_payment_preferences: "Wave, Orange Money, MTN MoMo, Djamo, paiement a la livraison.",
    }])
    .select("id, slug")
    .single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "vendeur non cree");
  created.sellerId = seller.id;
  line(true, "creation boutique temporaire", `/${seller.slug}`);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .insert([
      {
        seller_id: seller.id,
        name: "Robe beta smoke",
        price: 17500,
        stock_quantity: 3,
        image_url: "/landing/fatim-jeune-friperie.jpg",
        description: "Article temporaire pour test beta Tikchop.",
        product_variants: [{ label: "Tailles", values: ["S", "M", "L"] }],
        product_keywords: "robe, vetement, test",
      },
      {
        seller_id: seller.id,
        name: "Sac beta smoke",
        price: 10000,
        stock_quantity: 2,
        image_url: "/landing/raffia-bags.jpg",
        description: "Deuxieme article temporaire pour verifier le catalogue.",
        product_variants: [{ label: "Couleurs", values: ["Naturel", "Noir"] }],
        product_keywords: "sac, accessoire, test",
      },
    ])
    .select("id, name, price");
  assertOk(!productsError && products?.length === 2, productsError?.message || "produits non crees");
  created.productIds = products.map((product) => product.id);
  line(true, "creation de 2 articles");

  const { data: zone, error: zoneError } = await supabase
    .from("delivery_zones")
    .insert([{ seller_id: seller.id, name: "Cocody Smoke", fee: 1500, is_active: true }])
    .select("id")
    .single();
  assertOk(!zoneError && zone?.id, zoneError?.message || "zone non creee");
  created.zoneIds.push(zone.id);
  line(true, "creation zone livraison");

  const { data: driver, error: driverError } = await supabase
    .from("delivery_drivers")
    .insert([{ seller_id: seller.id, name: "Livreur Smoke", phone_number: "2250700000000", zone: "Cocody Smoke", is_active: true }])
    .select("id")
    .single();
  assertOk(!driverError && driver?.id, driverError?.message || "livreur non cree");
  created.driverIds.push(driver.id);
  line(true, "creation livreur");

  const shop = await requestOk(`${appUrl}/${slug}`, "text/html");
  const shopHtml = shop.bytes.toString("utf8");
  assertOk(shopHtml.includes("Beta Smoke Tikchop") || shopHtml.includes("Robe beta smoke"), "boutique publique chargee sans contenu attendu");
  line(true, "boutique publique production", `${appUrl}/${slug}`);

  const firstProduct = products[0];
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([{
      seller_id: seller.id,
      order_ref: orderRef,
      customer_phone: "+225 07 88 77 66 55",
      status: "PAID",
      total_amount: Number(firstProduct.price),
      payment_method: "WAVE",
      delivery_type: "DELIVERY",
      delivery_zone: "Cocody Smoke",
      delivery_address: "Adresse smoke test, ne pas livrer",
      delivery_fee: 1500,
      delivery_status: "PENDING",
      delivery_driver_id: driver.id,
    }])
    .select("id, order_ref")
    .single();
  assertOk(!orderError && order?.id, orderError?.message || "commande non creee");
  created.orderId = order.id;
  line(true, "creation commande", order.order_ref);

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .insert([{ order_id: order.id, product_id: firstProduct.id, quantity: 1, price_at_time: Number(firstProduct.price) }])
    .select("id");
  assertOk(!itemError && items?.length === 1, itemError?.message || "ligne commande non creee");
  created.orderItemIds = items.map((item) => item.id);
  line(true, "creation ligne commande");

  const receiptHtml = await requestOk(`${appUrl}/receipt?order=${order.id}`, "text/html");
  assertOk(receiptHtml.bytes.toString("utf8").includes(order.order_ref), "recu HTML sans reference commande");
  line(true, "recu client HTML");

  const receiptPdf = await requestOk(`${appUrl}/api/receipt/pdf?order=${order.id}`, "application/pdf");
  assertOk(receiptPdf.bytes.length > 900, "PDF recu trop petit");
  line(true, "recu PDF telechargeable", `${receiptPdf.bytes.length} octets`);

  const { data: prepared, error: preparedError } = await supabase
    .from("orders")
    .update({ status: "PREPARED", delivery_status: "READY" })
    .eq("id", order.id)
    .select("id, status, delivery_status")
    .single();
  assertOk(!preparedError && prepared?.status === "PREPARED", preparedError?.message || "statut PREPARED non applique");
  line(true, "statut commande colis pret");
} finally {
  if (created.orderItemIds.length) {
    await supabase.from("order_items").delete().in("id", created.orderItemIds);
  }
  if (created.orderId) {
    await supabase.from("orders").delete().eq("id", created.orderId);
  }
  if (created.zoneIds.length) {
    await supabase.from("delivery_zones").delete().in("id", created.zoneIds);
  }
  if (created.driverIds.length) {
    await supabase.from("delivery_drivers").delete().in("id", created.driverIds);
  }
  if (created.productIds.length) {
    await supabase.from("products").delete().in("id", created.productIds);
  }
  if (created.sellerId) {
    await supabase.from("sellers").delete().eq("id", created.sellerId);
  }
  line(true, "nettoyage donnees temporaires");
}

console.log("\nSmoke test beta termine.");
