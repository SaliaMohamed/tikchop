import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE_REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL",
];

const ONLINE_PAYMENT_ENV = [
  "PAYSTACK_SECRET_KEY",
  "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
];

const DB_CHECKS = [
  {
    label: "sellers vendeur/livraison/WhatsApp",
    run: (supabase) => supabase
      .from("sellers")
      .select("id,name,slug,phone_number,owner_user_id,owner_email,delivery_enabled,pickup_enabled,fixed_delivery_fee,delivery_payment_timing,auto_share_to_driver,accepted_payment_methods,default_payment_method,payout_network,payout_phone,payout_bank_code,payout_status,paystack_subaccount_code,paystack_subaccount_created_at,subscription_active,subscription_status,whatsapp_provider,whatsapp_status,evolution_instance,bot_tone,bot_greeting,bot_payment_preferences,bot_delivery_notes,bot_special_rules")
      .limit(1),
  },
  {
    label: "products IA/variantes",
    run: (supabase) => supabase
      .from("products")
      .select("id,seller_id,name,price,stock_quantity,image_url,product_variants,product_keywords")
      .limit(1),
  },
  {
    label: "orders commande/livraison/paiement",
    run: (supabase) => supabase
      .from("orders")
      .select("id,order_ref,seller_id,status,total_amount,customer_phone,payment_method,delivery_type,delivery_zone,delivery_address,delivery_fee,delivery_status,delivery_driver_id,paystack_reference,paystack_authorization_url,paystack_payment_status,paystack_paid_at,paystack_split_subaccount_code,paystack_split_bearer,paystack_settlement_status,whatsapp_receipt_sent_at")
      .limit(1),
  },
  {
    label: "delivery_zones",
    run: (supabase) => supabase
      .from("delivery_zones")
      .select("id,seller_id,name,fee,is_active")
      .limit(1),
  },
  {
    label: "delivery_drivers",
    run: (supabase) => supabase
      .from("delivery_drivers")
      .select("id,seller_id,name,phone_number,zone,is_active")
      .limit(1),
  },
  {
    label: "messages dedoublonnage bot",
    run: (supabase) => supabase
      .from("messages")
      .select("id,external_message_id,seller_slug,customer_phone,client,statut,created_at")
      .limit(1),
  },
  {
    label: "handoff pause bot vendeur",
    run: (supabase) => supabase
      .from("tikchop_customer_handoffs")
      .select("seller_slug,customer_phone,instance_name,paused_until,last_from_me_at,updated_at")
      .limit(1),
  },
  {
    label: "followups clients WhatsApp",
    run: (supabase) => supabase
      .from("tikchop_customer_followups")
      .select("id,seller_id,seller_slug,customer_phone,product_name,sent_at")
      .limit(1),
  },
];

const PRIVATE_SELLER_TABLES = ["sellers", "products", "orders", "order_items", "delivery_zones", "delivery_drivers"];

function loadEnv() {
  const env = {};
  let content = "";

  try {
    content = readFileSync(".env.local", "utf8");
  } catch {
    return env;
  }

  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function statusLine(ok, label, detail = "") {
  const mark = ok ? "OK" : "A FAIRE";
  console.log(`${mark} - ${label}${detail ? `: ${detail}` : ""}`);
}

function getPaymentMode(env) {
  if (String(env.NEXT_PUBLIC_TIKCHOP_ONLINE_PAYMENTS_ENABLED || "").toLowerCase() !== "true") {
    return "off";
  }
  const key = env.PAYSTACK_SECRET_KEY || env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  if (/live/i.test(key)) return "live";
  if (/test/i.test(key)) return "test";
  return "inconnu";
}

function getVisionProviders(env) {
  return [
    env.GEMINI_API_KEY ? "gemini" : "",
    env.OPENROUTER_API_KEY ? "openrouter" : "",
    env.OPENAI_API_KEY ? "openai" : "",
  ].filter(Boolean);
}

const env = loadEnv();
const onlinePayments = String(env.NEXT_PUBLIC_TIKCHOP_ONLINE_PAYMENTS_ENABLED || "").toLowerCase() === "true";
const REQUIRED_ENV = onlinePayments ? [...BASE_REQUIRED_ENV, ...ONLINE_PAYMENT_ENV] : BASE_REQUIRED_ENV;

console.log("Tikchop readiness check");
console.log("-----------------------");

let missingEnvCount = 0;
for (const name of REQUIRED_ENV) {
  const ok = Boolean(env[name]);
  if (!ok) missingEnvCount += 1;
  statusLine(ok, `env ${name}`);
}

if (onlinePayments) {
  statusLine(getPaymentMode(env) === "live", "paiement live", `mode ${getPaymentMode(env)}`);
} else {
  statusLine(true, "paiement local", "Wave, Orange, MTN et paiement a la livraison");
}

const visionProviders = getVisionProviders(env);
const preferredVisionProviders = String(env.AI_VISION_PROVIDER || "")
  .toLowerCase()
  .split(/[,\s>]+/)
  .map((provider) => provider.trim())
  .filter(Boolean);
const missingPreferredProviders = preferredVisionProviders.filter((provider) => !visionProviders.includes(provider));
statusLine(visionProviders.length > 0, "IA analyse photo", visionProviders.length ? `active: ${visionProviders.join(", ")}` : "aucun provider");
if (preferredVisionProviders.length > 0) {
  statusLine(
    missingPreferredProviders.length === 0,
    `ordre IA prefere ${preferredVisionProviders.join(", ")}`,
    missingPreferredProviders.length === 0 ? "pret" : `manquant: ${missingPreferredProviders.join(", ")}`,
  );
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\nBase non verifiee: variables Supabase serveur manquantes.");
  process.exit(missingEnvCount ? 1 : 0);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let dbErrorCount = 0;
console.log("\nSchema Supabase");
console.log("---------------");

for (const check of DB_CHECKS) {
  const { error } = await check.run(supabase);
  if (error) {
    dbErrorCount += 1;
    statusLine(false, check.label, error.message);
  } else {
    statusLine(true, check.label);
  }
}

let isolationErrorCount = 0;
console.log("\nIsolation vendeur Supabase");
console.log("--------------------------");

const { count: unownedSellerCount, error: unownedSellerError } = await supabase
  .from("sellers")
  .select("id", { count: "exact", head: true })
  .is("owner_user_id", null);

if (unownedSellerError) {
  isolationErrorCount += 1;
  statusLine(false, "aucune boutique sans owner_user_id", unownedSellerError.message);
} else {
  const ok = (unownedSellerCount || 0) === 0;
  if (!ok) isolationErrorCount += 1;
  statusLine(ok, "aucune boutique sans owner_user_id", `${unownedSellerCount || 0} orpheline(s)`);
}

for (const table of PRIVATE_SELLER_TABLES) {
  const { count, error } = await supabaseAnon
    .from(table)
    .select("id", { count: "exact", head: true });
  const ok = Boolean(error) || (count || 0) === 0;
  if (!ok) isolationErrorCount += 1;
  statusLine(ok, `anon ne lit pas public.${table}`, error?.message || `${count || 0} ligne(s) exposee(s)`);
}

console.log("\nResume");
console.log("------");
if (missingEnvCount || dbErrorCount || isolationErrorCount) {
  console.log(`A corriger avant lancement large: ${missingEnvCount} variable(s), ${dbErrorCount} bloc(s) schema, ${isolationErrorCount} probleme(s) isolation.`);
  process.exit(1);
}

console.log("Pret pour un test beta complet.");
