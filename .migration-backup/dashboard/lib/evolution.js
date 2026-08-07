const DEFAULT_EVOLUTION_API_URL = "https://evolution-tikchop.76.13.59.214.sslip.io";

function getEvolutionConfig() {
  const baseUrl = (process.env.EVOLUTION_API_URL || DEFAULT_EVOLUTION_API_URL).replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiKey) {
    return null;
  }

  return { baseUrl, apiKey };
}

export async function sendEvolutionText({ instanceName, number, text }) {
  const config = getEvolutionConfig();
  const cleanNumber = String(number || "").replace(/[^\d]/g, "");
  const cleanInstance = String(instanceName || "").trim();

  if (!config || !cleanInstance || !cleanNumber || !text) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`${config.baseUrl}/message/sendText/${encodeURIComponent(cleanInstance)}`, {
    method: "POST",
    headers: {
      apikey: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: cleanNumber,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new Error(message || payload?.error || "Evolution API refused the message.");
  }

  return { ok: true, payload };
}

export async function sendEvolutionMedia({
  instanceName,
  number,
  media,
  mediatype = "document",
  mimetype = "application/pdf",
  fileName = "recu-tikchop.pdf",
  caption = "",
}) {
  const config = getEvolutionConfig();
  const cleanNumber = String(number || "").replace(/[^\d]/g, "");
  const cleanInstance = String(instanceName || "").trim();

  if (!config || !cleanInstance || !cleanNumber || !media) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`${config.baseUrl}/message/sendMedia/${encodeURIComponent(cleanInstance)}`, {
    method: "POST",
    headers: {
      apikey: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: cleanNumber,
      mediatype,
      mimetype,
      media,
      fileName,
      caption,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new Error(message || payload?.error || "Evolution API refused the media.");
  }

  return { ok: true, payload };
}
