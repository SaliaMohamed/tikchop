import { readFileSync } from "node:fs";
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

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function cleanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return digits;
  if (digits.length === 10) return `225${digits}`;
  return digits;
}

function findDeepString(value, keys) {
  if (!value || typeof value !== "object") return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepString(item, keys);
      if (found) return found;
    }
    return "";
  }

  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key.toLowerCase()) && typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  for (const item of Object.values(value)) {
    const found = findDeepString(item, keys);
    if (found) return found;
  }

  return "";
}

function normalizeCode(value) {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw || raw.length > 32) return "";
  return raw;
}

function formatCode(value) {
  return String(value || "").match(/.{1,4}/g)?.join(" ") || value || "";
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text ? { raw: text } : null;
  }
}

async function evolutionRequest(baseUrl, apiKey, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await readJson(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new Error(message || data?.error || `Evolution HTTP ${response.status}`);
  }

  return data;
}

async function deleteInstance(baseUrl, apiKey, instanceName) {
  try {
    await evolutionRequest(baseUrl, apiKey, `/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (!/not found|404|introuvable/i.test(error.message || "")) {
      throw error;
    }
  }
}

const env = loadEnv();
const phone = cleanPhone(getArg("--phone") || process.env.TIKCHOP_PAIRING_TEST_PHONE);
const keep = process.argv.includes("--keep");
const instanceName = getArg("--instance") || `tikchop-code-test-${crypto.randomUUID().slice(0, 8)}`;
const baseUrl = String(env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = env.EVOLUTION_API_KEY;
const webhookUrl = env.N8N_TIKCHOP_EVOLUTION_WEBHOOK_URL || "";

console.log("Tikchop WhatsApp pairing-code test");
console.log("----------------------------------");

if (!baseUrl || !apiKey) {
  console.error("ECHEC - EVOLUTION_API_URL ou EVOLUTION_API_KEY manquant.");
  process.exit(1);
}

if (phone.length < 11) {
  console.error("ECHEC - Ajoute un numero: npm run test:whatsapp-code -- --phone +2250700000000");
  process.exit(1);
}

console.log(`Instance temporaire: ${instanceName}`);
console.log(`Numero teste: +${phone}`);
console.log(`Mode: ${keep ? "conserver l'instance pour test reel" : "nettoyage automatique"}`);

try {
  await deleteInstance(baseUrl, apiKey, instanceName);

  const createPayload = {
    instanceName,
    qrcode: false,
    number: phone,
    integration: "WHATSAPP-BAILEYS",
    webhook: webhookUrl
      ? {
        enabled: true,
        url: `${webhookUrl}?seller=${encodeURIComponent(instanceName)}`,
        byEvents: false,
        base64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      }
      : undefined,
  };

  await evolutionRequest(baseUrl, apiKey, "/instance/create", {
    method: "POST",
    body: JSON.stringify(createPayload),
  });
  console.log("OK - instance code-only creee");

  const connectData = await evolutionRequest(
    baseUrl,
    apiKey,
    `/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phone)}`,
  );

  const code = normalizeCode(findDeepString(connectData, ["pairingcode", "pairing_code", "pairing", "code"]));
  if (!code) {
    throw new Error("Evolution n'a pas renvoye de pairingCode pour ce numero.");
  }

  console.log(`OK - code WhatsApp temporaire recu: ${formatCode(code)}`);
  console.log("Action telephone: WhatsApp > Appareils connectes > Lier avec un numero > entrer ce code.");

  if (!keep) {
    await deleteInstance(baseUrl, apiKey, instanceName);
    console.log("OK - instance temporaire supprimee");
  } else {
    console.log(`INFO - instance conservee: ${instanceName}`);
    console.log(`Nettoyage apres test: node scripts/test-whatsapp-pairing-code.mjs --phone +${phone} --instance ${instanceName}`);
  }
} catch (error) {
  if (!keep) {
    await deleteInstance(baseUrl, apiKey, instanceName).catch(() => {});
  }
  console.error(`ECHEC - ${error.message}`);
  process.exit(1);
}
