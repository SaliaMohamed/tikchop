import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_N8N_WORKFLOW_ID = "tkchopEvobd8516ea";
const EXPECTED_WEBHOOK_PATH = "tikchop-evolution-whatsapp";

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
  const mark = ok ? "OK" : "A CORRIGER";
  console.log(`${mark} - ${label}${detail ? `: ${detail}` : ""}`);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text ? { raw: text } : null;
  }
}

function normalizeEvolutionState(payload) {
  return String(
    payload?.instance?.state
    || payload?.instance?.connectionStatus
    || payload?.state
    || payload?.connectionState
    || payload?.connectionStatus
    || payload?.status
    || "",
  ).toLowerCase();
}

function getWebhookUrl(payload) {
  return String(payload?.url || payload?.webhook?.url || payload?.data?.url || "").trim();
}

function getWebhookEnabled(payload) {
  return Boolean(payload?.enabled ?? payload?.webhook?.enabled ?? payload?.data?.enabled);
}

const env = loadEnv();

console.log("Tikchop WhatsApp stack check");
console.log("----------------------------");

let failures = 0;
for (const key of [
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "N8N_URL",
  "N8N_API_KEY",
  "N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  const ok = Boolean(env[key]);
  if (!ok) failures += 1;
  statusLine(ok, `env ${key}`);
}

const webhookUrl = String(env.N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL || "");
const webhookLooksRight = webhookUrl.includes(EXPECTED_WEBHOOK_PATH);
if (!webhookLooksRight) failures += 1;
statusLine(webhookLooksRight, "webhook n8n Tikchop Evolution", webhookUrl || "manquant");

if (!failures) {
  const evolutionBase = env.EVOLUTION_API_URL.replace(/\/+$/, "");
  const n8nBase = env.N8N_URL.replace(/\/+$/, "");

  console.log("\nEvolution API");
  console.log("-------------");
  try {
    const response = await fetch(`${evolutionBase}/instance/fetchInstances`, {
      headers: { apikey: env.EVOLUTION_API_KEY },
    });
    const payload = await readJson(response);
    const instances = Array.isArray(payload) ? payload : Array.isArray(payload?.instances) ? payload.instances : [];
    statusLine(response.ok, "API Evolution joignable", `${response.status} ${response.statusText}`);
    if (!response.ok) failures += 1;
    console.log(`INFO - instances Evolution visibles: ${instances.length}`);
  } catch (error) {
    failures += 1;
    statusLine(false, "API Evolution joignable", error.message);
  }

  console.log("\nn8n");
  console.log("---");
  try {
    const response = await fetch(`${n8nBase}/api/v1/workflows?limit=100`, {
      headers: { "X-N8N-API-KEY": env.N8N_API_KEY },
    });
    const payload = await readJson(response);
    const workflows = Array.isArray(payload?.data) ? payload.data : [];
    const target = workflows.find((workflow) => workflow.id === EXPECTED_N8N_WORKFLOW_ID)
      || workflows.find((workflow) => /Tikchop Sales Bot V2 - Evolution API/i.test(workflow.name || ""));
    const ok = response.ok && Boolean(target?.active);
    if (!ok) failures += 1;
    statusLine(ok, "workflow Tikchop Evolution actif", target ? `${target.name} (${target.id}) active=${target.active}` : "introuvable");
  } catch (error) {
    failures += 1;
    statusLine(false, "workflow Tikchop Evolution actif", error.message);
  }

  console.log("\nSupabase WhatsApp");
  console.log("-----------------");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: sellers, error: sellersError } = await supabase
    .from("sellers")
    .select("id,name,slug,whatsapp_provider,whatsapp_status,evolution_instance,phone_number")
    .not("evolution_instance", "is", null)
    .limit(20);

  if (sellersError) {
    failures += 1;
    statusLine(false, "colonnes WhatsApp vendeur", sellersError.message);
  } else {
    statusLine(true, "colonnes WhatsApp vendeur", `${sellers.length} boutique(s) avec instance`);

    let openCount = 0;
    for (const seller of sellers) {
      const instanceName = seller.evolution_instance || seller.slug;
      const expectedConnected = ["connected", "open", "standard_active"].includes(String(seller.whatsapp_status || "").toLowerCase());
      let statePayload = null;
      let webhookPayload = null;

      try {
        const stateResponse = await fetch(`${evolutionBase}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
          headers: { apikey: env.EVOLUTION_API_KEY },
        });
        statePayload = await readJson(stateResponse);
        const state = normalizeEvolutionState(statePayload);
        if (["open", "connected"].includes(state)) openCount += 1;
        const ok = expectedConnected ? stateResponse.ok && ["open", "connected"].includes(state) : true;
        if (!ok) failures += 1;
        const detail = stateResponse.ok
          ? state || "etat inconnu"
          : expectedConnected
            ? `HTTP ${stateResponse.status}`
            : `non connectee attendue (${stateResponse.status})`;
        statusLine(ok, `instance ${instanceName} (${seller.slug})`, detail);
      } catch (error) {
        if (expectedConnected) failures += 1;
        statusLine(!expectedConnected, `instance ${instanceName} (${seller.slug})`, error.message);
      }

      try {
        const webhookResponse = await fetch(`${evolutionBase}/webhook/find/${encodeURIComponent(instanceName)}`, {
          headers: { apikey: env.EVOLUTION_API_KEY },
        });
        webhookPayload = await readJson(webhookResponse);
        const webhookUrl = getWebhookUrl(webhookPayload);
        const ok = expectedConnected
          ? webhookResponse.ok && getWebhookEnabled(webhookPayload) && webhookUrl.includes(EXPECTED_WEBHOOK_PATH)
          : true;
        if (!ok) failures += 1;
        const detail = webhookResponse.ok
          ? webhookUrl || "url vide"
          : expectedConnected
            ? `HTTP ${webhookResponse.status}`
            : `non connecte attendu (${webhookResponse.status})`;
        statusLine(ok, `webhook ${instanceName}`, detail);
      } catch (error) {
        if (expectedConnected) failures += 1;
        statusLine(!expectedConnected, `webhook ${instanceName}`, error.message);
      }
    }

    const hasOpenInstance = openCount > 0;
    if (!hasOpenInstance) failures += 1;
    statusLine(hasOpenInstance, "au moins une instance WhatsApp ouverte", `${openCount} ouverte(s)`);
  }
}

console.log("\nResume");
console.log("------");

if (failures) {
  console.log(`${failures} probleme(s) WhatsApp/Evolution a corriger.`);
  process.exit(1);
}

console.log("Stack WhatsApp/Evolution OK.");
