import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "PAYSTACK_SECRET_KEY",
  "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL",
];

const DB_CHECKS = [
  {
    label: "sellers vendeur/livraison/WhatsApp",
    run: (supabase) => supabase
      .from("sellers")
      .select("id,name,slug,phone_number,owner_user_id,owner_email,delivery_enabled,pickup_enabled,fixed_delivery_fee,delivery_payment_timing,auto_share_to_driver,paystack_subaccount_code,whatsapp_provider,whatsapp_status,evolution_instance,bot_tone,bot_greeting,bot_payment_preferences,bot_delivery_notes,bot_special_rules")
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
      .select("id,order_ref,seller_id,status,total_amount,customer_phone,payment_method,delivery_type,delivery_zone,delivery_address,delivery_fee,delivery_status,delivery_driver_id,paystack_reference,paystack_authorization_url,paystack_payment_status,paystack_paid_at,whatsapp_receipt_sent_at")
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
];

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
  const key = env.PAYSTACK_SECRET_KEY || env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  if (/live/i.test(key)) return "live";
  if (/test/i.test(key)) return "test";
  return "inconnu";
}

const env = loadEnv();

console.log("Tikchop readiness check");
console.log("-----------------------");

let missingEnvCount = 0;
for (const name of REQUIRED_ENV) {
  const ok = Boolean(env[name]);
  if (!ok) missingEnvCount += 1;
  statusLine(ok, `env ${name}`);
}

statusLine(getPaymentMode(env) === "live", "paiement live", `mode ${getPaymentMode(env)}`);

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\nBase non verifiee: variables Supabase serveur manquantes.");
  process.exit(missingEnvCount ? 1 : 0);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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

console.log("\nResume");
console.log("------");
if (missingEnvCount || dbErrorCount) {
  console.log(`A corriger avant lancement large: ${missingEnvCount} variable(s), ${dbErrorCount} bloc(s) schema.`);
  process.exit(1);
}

console.log("Pret pour un test beta complet.");
