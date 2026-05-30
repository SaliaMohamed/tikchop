import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_IMAGE = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const DEFAULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    colors: { type: "array", items: { type: "string" } },
    suggested_sizes: { type: "array", items: { type: "string" } },
    size: { type: "string" },
    quantity: { type: "number" },
    confidence: { type: "number" },
  },
  required: ["name", "description", "category", "colors", "suggested_sizes", "size", "quantity", "confidence"],
};

loadEnvLocal();

const args = parseArgs(process.argv.slice(2));
const imageUrl = args.image || process.env.TEST_VISION_IMAGE_URL || DEFAULT_IMAGE;
const providers = (args.provider || "all").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const providerList = providers.includes("all") ? ["gemini", "openrouter", "openai"] : providers;

for (const provider of providerList) {
  const startedAt = Date.now();
  try {
    const result = await analyze(provider, imageUrl);
    console.log(JSON.stringify({
      provider,
      ok: true,
      ms: Date.now() - startedAt,
      model: result.model,
      analysis: result.analysis,
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      provider,
      ok: false,
      ms: Date.now() - startedAt,
      error: error.message,
    }, null, 2));
  }
}

async function analyze(provider, imageUrl) {
  if (provider === "gemini") return analyzeGemini(imageUrl);
  if (provider === "openrouter") return analyzeOpenRouter(imageUrl);
  if (provider === "openai") return analyzeOpenAI(imageUrl);
  throw new Error(`Provider inconnu: ${provider}`);
}

async function analyzeGemini(imageUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant.");

  const image = await readImageAsBase64(imageUrl);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: image.mimeType, data: image.base64 } },
          { text: productAnalysisPrompt() },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: DEFAULT_SCHEMA,
        temperature: 0.15,
        maxOutputTokens: 1200,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini impossible.");
  const text = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  return { model, analysis: normalize(parseJson(text)) };
}

async function analyzeOpenRouter(imageUrl) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-32b-instruct";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tikchop.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Tikchop",
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `${productAnalysisPrompt()}\nRetourne uniquement un JSON valide.` },
          { type: "image_url", image_url: { url: optimizeImageUrl(imageUrl) } },
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: 900,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenRouter impossible.");
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => part.text || "").join("\n") : content;
  return { model, analysis: normalize(parseJson(text)) };
}

async function analyzeOpenAI(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: productAnalysisPrompt() },
          { type: "input_image", image_url: optimizeImageUrl(imageUrl), detail: "low" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "tikchop_product_analysis",
          strict: true,
          schema: DEFAULT_SCHEMA,
        },
      },
      max_output_tokens: 900,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI impossible.");
  const text = data.output_text
    || data.output?.flatMap((item) => item.content || []).find((content) => content.type === "output_text")?.text;
  return { model, analysis: normalize(parseJson(text)) };
}

async function readImageAsBase64(imageUrl) {
  const response = await fetch(optimizeImageUrl(imageUrl));
  if (!response.ok) throw new Error("Image impossible a lire.");
  const mimeType = response.headers.get("content-type")?.startsWith("image/")
    ? response.headers.get("content-type")
    : "image/jpeg";
  const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  return { mimeType, base64 };
}

function productAnalysisPrompt() {
  return [
    "Analyse cette photo de produit pour une boutique en ligne Tikchop a Abidjan.",
    "Retourne un nom usuel court en francais simple, comme une vendeuse l'ecrirait sur WhatsApp.",
    "Pense comme une assistante catalogue: le resultat doit aider a publier vite un article.",
    "Si une personne porte le produit, nomme le vetement ou l'accessoire visible, pas la personne.",
    "Retourne une petite description vendeuse, la categorie, les couleurs visibles, et les tailles possibles si c'est un vetement ou une chaussure.",
    "Ne devine pas de marque si elle n'est pas clairement visible.",
    "Ne remplis pas le prix, la taille definitive ni la quantite depuis la photo.",
    "Retourne toujours size comme chaine vide et quantity comme 1.",
    "Champs JSON attendus: name, description, category, colors, suggested_sizes, size, quantity, confidence.",
  ].join("\n");
}

function parseJson(textOutput) {
  const raw = String(textOutput || "").trim();
  if (!raw) throw new Error("Reponse vide.");
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objectMatch) throw new Error("Reponse non JSON.");
      return JSON.parse(objectMatch[0]);
    }
  }
}

function normalize(analysis) {
  return {
    name: String(analysis?.name || "").trim(),
    description: String(analysis?.description || "").trim(),
    category: String(analysis?.category || "").trim(),
    colors: Array.isArray(analysis?.colors) ? analysis.colors.map(String).filter(Boolean) : [],
    suggested_sizes: Array.isArray(analysis?.suggested_sizes) ? analysis.suggested_sizes.map(String).filter(Boolean) : [],
    size: String(analysis?.size || "").trim(),
    quantity: Number.isFinite(Number(analysis?.quantity)) ? Number(analysis.quantity) : 1,
    confidence: Number.isFinite(Number(analysis?.confidence)) ? Number(analysis.confidence) : 0,
  };
}

function optimizeImageUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto:good,w_768,c_limit/");
}

function parseArgs(argv) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "1"];
  }));
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}
