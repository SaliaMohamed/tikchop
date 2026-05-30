import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PRIVATE_TABLES = ["sellers", "products", "orders", "order_items", "delivery_zones", "delivery_drivers"];

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

function printResult(ok, label, detail = "") {
  const mark = ok ? "OK" : "A CORRIGER";
  console.log(`${mark} - ${label}${detail ? `: ${detail}` : ""}`);
}

async function countRows(supabase, table, builder = (query) => query) {
  const { count, error } = await builder(
    supabase.from(table).select("id", { count: "exact", head: true }),
  );

  if (error) return { error: error.message, count: null };
  return { count: count || 0, error: "" };
}

const env = loadEnv();

console.log("Tikchop seller isolation check");
console.log("------------------------------");

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Variables Supabase manquantes.");
  process.exit(1);
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;

console.log("\nOwnership data");
console.log("--------------");

const sellerTotal = await countRows(admin, "sellers");
const unownedSellers = await countRows(admin, "sellers", (query) => query.is("owner_user_id", null));

printResult(!sellerTotal.error, "sellers lisible avec service role", sellerTotal.error || `${sellerTotal.count} boutique(s)`);
printResult(!unownedSellers.error && unownedSellers.count === 0, "aucune boutique sans owner_user_id", unownedSellers.error || `${unownedSellers.count} orpheline(s)`);

if (sellerTotal.error || unownedSellers.error || unownedSellers.count !== 0) {
  failures += 1;
}

console.log("\nAnon access");
console.log("-----------");

for (const table of PRIVATE_TABLES) {
  const result = await countRows(anon, table);
  const blocked = Boolean(result.error) || result.count === null || result.count === 0;
  printResult(blocked, `anon ne voit pas public.${table}`, result.error || `${result.count || 0} ligne(s) exposee(s)`);
  if (!blocked) failures += 1;
}

console.log("\nResume");
console.log("------");

if (failures) {
  console.log("Isolation vendeur incomplete. Applique dashboard/supabase-migrations/2026-05-16-seller-auth-isolation-rls.sql dans Supabase.");
  process.exit(1);
}

console.log("Isolation vendeur OK.");
