"use server";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabase-admin";
// getCloudinaryConfig, getCloudinaryCleanProductUrl defined below
// AI vision functions defined below

import { requireSellerBySlug } from "./auth";
import { normalizeProductVariants } from "./shared";

/**
 * Product management & AI vision server actions.
 */
export async function uploadProductImage(formData) {
  const file = formData?.get("image");

  if (!file || typeof file === "string") {
    throw new Error("Image manquante.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Selectionnez une vraie image.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image trop lourde. Maximum 8 MB.");
  }

  const cloudinary = getCloudinaryConfig();
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/products/${timestamp}-${createHash("sha1")
    .update(`${file.name}-${file.size}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return {
    url: data.secure_url,
    cleanUrl: getCloudinaryCleanProductUrl(data.secure_url),
    publicId: data.public_id,
  };
}

export async function uploadSellerLogo(formData) {
  const file = formData?.get("image");

  if (!file || typeof file === "string") {
    throw new Error("Image manquante.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Selectionnez une vraie image.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image trop lourde. Maximum 8 MB.");
  }

  const cloudinary = getCloudinaryConfig();
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/logos/${timestamp}-${createHash("sha1")
    .update(`${file.name}-${file.size}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return {
    url: data.secure_url,
    cleanUrl: data.secure_url,
    publicId: data.public_id,
  };
}

export async function removeProductBackground(imageUrl, options = {}) {
  await requireSellerUser();

  const sourceUrl = String(imageUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("Photo manquante.");
  }

  if (!sourceUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error("Fond propre disponible seulement apres envoi de la photo.");
  }

  const serviceUrl = String(process.env.REMBG_API_URL || process.env.BACKGROUND_REMOVAL_API_URL || "").replace(/\/+$/, "");
  if (!serviceUrl) {
    throw new Error("Fond propre pas encore active. Ajoutez REMBG_API_URL cote serveur.");
  }

  const imageResponse = await fetch(getAiOptimizedImageUrl(sourceUrl));
  if (!imageResponse.ok) {
    throw new Error("Photo impossible a preparer.");
  }

  const imageType = imageResponse.headers.get("content-type")?.startsWith("image/")
    ? imageResponse.headers.get("content-type")
    : "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const removePayload = new FormData();
  removePayload.append("image", new Blob([imageBuffer], { type: imageType }), "tikchop-product.jpg");
  removePayload.append("background", normalizeBackgroundOption(options.background));

  const headers = {};
  if (process.env.REMBG_API_KEY) {
    headers["x-api-key"] = process.env.REMBG_API_KEY;
  }

  const removeResponse = await fetch(`${serviceUrl}/remove`, {
    method: "POST",
    headers,
    body: removePayload,
  });

  if (!removeResponse.ok) {
    throw new Error("Fond propre indisponible. Reessayez ou gardez la photo claire.");
  }

  const outputType = removeResponse.headers.get("content-type")?.startsWith("image/")
    ? removeResponse.headers.get("content-type")
    : "image/png";
  const outputBuffer = Buffer.from(await removeResponse.arrayBuffer());
  const cloudinary = getCloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `tikchop/products-background/${timestamp}-${createHash("sha1")
    .update(`${sourceUrl}-${outputBuffer.length}-${timestamp}`)
    .digest("hex")
    .slice(0, 12)}`;
  const uploaded = await uploadBufferToCloudinary({
    buffer: outputBuffer,
    mimeType: outputType,
    publicId,
    cloudinary,
  });

  return {
    url: uploaded.secure_url,
    cleanUrl: getCloudinaryCleanProductUrl(uploaded.secure_url),
    publicId: uploaded.public_id,
  };
}

async function uploadBufferToCloudinary({ buffer, mimeType, publicId, cloudinary }) {
  const cloudName = cloudinary.cloudName;
  const apiKey = cloudinary.apiKey;
  const apiSecret = cloudinary.apiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary n'est pas configure.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const payload = new FormData();
  payload.append("file", new Blob([buffer], { type: mimeType }), "tikchop-product-clean.png");
  payload.append("api_key", apiKey);
  payload.append("timestamp", String(timestamp));
  payload.append("public_id", publicId);
  payload.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: payload,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload image impossible.");
  }

  return data;
}

function normalizeBackgroundOption(value) {
  const background = String(value || "warm").trim().toLowerCase();
  if (["white", "gray", "warm", "transparent"].includes(background)) return background;
  return "warm";
}

function getCloudinaryConfig() {
  const directConfig = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };

  if (directConfig.cloudName && directConfig.apiKey && directConfig.apiSecret) {
    return directConfig;
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) return directConfig;

  try {
    const url = new URL(cloudinaryUrl);
    return {
      cloudName: directConfig.cloudName || url.hostname,
      apiKey: directConfig.apiKey || decodeURIComponent(url.username),
      apiSecret: directConfig.apiSecret || decodeURIComponent(url.password),
    };
  } catch {
    return directConfig;
  }
}

export async function analyzeProductImage(imageUrl, voiceHint = "") {
  if (!imageUrl) {
    throw new Error("Image manquante.");
  }

  let lastError = null;

  for (const provider of getVisionProviderOrder()) {
    try {
      if (provider === "gemini") return await analyzeProductImageWithGemini(imageUrl, voiceHint);
      if (provider === "openai") return await analyzeProductImageWithOpenAI(imageUrl, voiceHint);
      if (provider === "openrouter") return await analyzeProductImageWithOpenRouter(imageUrl, voiceHint);
    } catch (err) {
      console.error(`${provider} vision failed:`, err);
      lastError = err;
    }
  }

  console.warn("AI analysis failed or not configured. Returning empty product data. Last error:", lastError);
  return normalizeProductAnalysis({});
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000, timeoutMessage = "Service trop lent.") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeProductImagesBatch(imageUrls = [], voiceHint = "") {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 6) : [];
  if (urls.length === 0) return [];

  const providerOrder = getVisionProviderOrder();

  if (providerOrder[0] !== "gemini") {
    return Promise.all(urls.map((url) => analyzeProductImage(url, voiceHint)));
  }

  try {
    return await analyzeProductImagesBatchWithGemini(urls, voiceHint);
  } catch (err) {
    console.error("Gemini batch failed:", err);
    return Promise.all(urls.map((url) => analyzeProductImage(url, voiceHint)));
  }
}

async function analyzeProductImageWithGemini(imageUrl, voiceHint = "") {
  const imageResponse = await fetchWithTimeout(
    getAiOptimizedImageUrl(imageUrl),
    {},
    8000,
    "Photo trop lente a lire pour l'IA.",
  );
  if (!imageResponse.ok) {
    throw new Error("Image impossible a lire pour l'IA.");
  }

  const mimeType = imageResponse.headers.get("content-type")?.startsWith("image/")
    ? imageResponse.headers.get("content-type")
    : "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const imageBase64 = imageBuffer.toString("base64");
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
            { text: productAnalysisPrompt(voiceHint) },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: productAnalysisSchema(),
        temperature: 0.15,
        maxOutputTokens: 1600,
      },
    }),
  }, 18000, "Analyse Gemini trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse Gemini impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Analyse Gemini vide.");
  }

  return normalizeProductAnalysis(parseJsonModelOutput(textOutput));
}

async function analyzeProductImagesBatchWithGemini(imageUrls, voiceHint = "") {
  const imageParts = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    const imageResponse = await fetchWithTimeout(
      getAiOptimizedImageUrl(imageUrl),
      {},
      8000,
      `Image ${index + 1} trop lente a lire pour l'IA.`,
    );
    if (!imageResponse.ok) {
      throw new Error(`Image ${index + 1} impossible a lire pour l'IA.`);
    }

    const mimeType = imageResponse.headers.get("content-type")?.startsWith("image/")
      ? imageResponse.headers.get("content-type")
      : "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    imageParts.push(
      { text: `IMAGE ${index + 1}` },
      {
        inline_data: {
          mime_type: mimeType,
          data: imageBuffer.toString("base64"),
        },
      },
    );
  }

  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: productBatchAnalysisPrompt(imageUrls.length, voiceHint) },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: productBatchAnalysisSchema(),
        temperature: 0.12,
        maxOutputTokens: Math.max(2200, imageUrls.length * 850),
      },
    }),
  }, 22000, "Analyse Gemini en lot trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse Gemini en lot impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Analyse Gemini en lot vide.");
  }

  const parsed = parseJsonModelOutput(textOutput);
  const products = Array.isArray(parsed?.products) ? parsed.products : [];

  return imageUrls.map((_, index) => normalizeProductAnalysis(products[index] || {}));
}

async function analyzeProductImageWithOpenAI(imageUrl, voiceHint = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: productAnalysisPrompt(voiceHint),
            },
            {
              type: "input_image",
              image_url: getAiOptimizedImageUrl(imageUrl),
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tikchop_product_analysis",
          strict: true,
          schema: productAnalysisSchema(),
        },
      },
      max_output_tokens: 500,
    }),
  }, 18000, "Analyse OpenAI trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse IA impossible.");
  }

  const textOutput = data.output_text
    || data.output?.flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

  if (!textOutput) {
    throw new Error("Analyse IA vide.");
  }

  const analysis = parseJsonModelOutput(textOutput);

  return normalizeProductAnalysis(analysis);
}

async function analyzeProductImageWithOpenRouter(imageUrl, voiceHint = "") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-32b-instruct";

  if (!apiKey || !model) {
    throw new Error("OpenRouter vision non configure.");
  }

  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tikchop.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Tikchop",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                productAnalysisPrompt(voiceHint),
                "Retourne uniquement un JSON valide avec ces champs: name, description, category, colors, suggested_sizes, size, quantity, confidence.",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: {
                url: getAiOptimizedImageUrl(imageUrl),
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: 900,
    }),
  }, 20000, "Analyse OpenRouter trop lente.");

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Analyse OpenRouter impossible.");
  }

  const content = data.choices?.[0]?.message?.content;
  const textOutput = Array.isArray(content)
    ? content.map((part) => part.text || "").join("\n")
    : content;

  if (!textOutput) {
    throw new Error("Analyse OpenRouter vide.");
  }

  return normalizeProductAnalysis(parseJsonModelOutput(textOutput));
}

export async function parseVoiceProductWithAI(text, hint = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return {};

  let lastError = null;

  for (const provider of getVisionProviderOrder()) {
    try {
      if (provider === "gemini") return await parseVoiceWithGemini(cleanText, hint);
      if (provider === "openrouter") return await parseVoiceWithOpenRouter(cleanText, hint);
      if (provider === "openai") return await parseVoiceWithOpenAI(cleanText, hint);
    } catch (err) {
      console.error(`${provider} voice parse failed:`, err);
      lastError = err;
    }
  }

  console.warn("Voice AI parse unavailable. Falling back to regex. Last error:", lastError);
  return {};
}

export async function parseVoiceProductsWithAI(text, hint = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];

  let lastError = null;

  for (const provider of getVisionProviderOrder()) {
    try {
      if (provider === "gemini") return await parseVoiceBatchWithGemini(cleanText, hint);
      if (provider === "openrouter") return await parseVoiceBatchWithOpenRouter(cleanText, hint);
      if (provider === "openai") return await parseVoiceBatchWithOpenAI(cleanText, hint);
    } catch (err) {
      console.error(`${provider} voice batch parse failed:`, err);
      lastError = err;
    }
  }

  console.warn("Voice batch AI parse unavailable. Fallback regex:", lastError);
  return [];
}

async function parseVoiceWithGemini(text, hint) {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: voiceProductPrompt(text, hint) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: voiceProductSchema(),
        temperature: 0.1,
        maxOutputTokens: 900,
      },
    }),
  }, 15000, "Interpretation vocale Gemini trop lente.");

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Interpretation vocale Gemini impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Interpretation vocale Gemini vide.");
  }

  return normalizeVoiceProduct(parseJsonModelOutput(textOutput));
}

async function parseVoiceBatchWithGemini(text, hint) {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: voiceBatchPrompt(text, hint) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: voiceBatchSchema(),
        temperature: 0.1,
        maxOutputTokens: 2200,
      },
    }),
  }, 18000, "Interpretation vocale lot Gemini trop lente.");

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Interpretation vocale lot Gemini impossible.");
  }

  const textOutput = data.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === "string")?.text;

  if (!textOutput) {
    throw new Error("Interpretation vocale lot Gemini vide.");
  }

  const parsed = parseJsonModelOutput(textOutput);
  const products = Array.isArray(parsed?.products) ? parsed.products : [];
  return products.map(normalizeVoiceProduct).filter((product) => product.name || product.price);
}

async function callOpenRouterChatCompletion({ text, hint, systemHint, jsonName }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-32b-instruct";

  if (!apiKey) {
    throw new Error("OpenRouter voice non configure.");
  }

  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tikchop.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Tikchop",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: `${systemHint}\n\nDictation: ${JSON.stringify(text)}\n${hint ? `Indication: ${hint}` : ""}\nRetourne uniquement un JSON valide.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
    }),
  }, 16000, "Interpretation vocale OpenRouter trop lente.");

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Interpretation vocale OpenRouter impossible.");
  }

  const content = data.choices?.[0]?.message?.content;
  const textOutput = Array.isArray(content)
    ? content.map((part) => part.text || "").join("\n")
    : content;

  if (!textOutput) {
    throw new Error("Interpretation vocale OpenRouter vide.");
  }

  return parseJsonModelOutput(textOutput);
}

async function parseVoiceWithOpenRouter(text, hint) {
  const parsed = await callOpenRouterChatCompletion({
    text,
    hint,
    systemHint: [
      "Tu interprets la dictee d'une vendeuse de boutique Tikchop (Cote d'Ivoire).",
      "Extrais une fiche produit exploitable. Convertit les nombres en lettres en chiffres (ex: trois mille cinq cent francs => 3500).",
      "Nom court et vendable, rayon simple, couleurs, taille/pointure uniquement si dictee, stock par defaut 1.",
      "Champs: name, description, category, colors, size, price, stock_quantity, confidence.",
    ].join("\n"),
  });
  return normalizeVoiceProduct(parsed);
}

async function parseVoiceBatchWithOpenRouter(text, hint) {
  const parsed = await callOpenRouterChatCompletion({
    text,
    hint,
    systemHint: [
      "Tu interprets la dictee de plusieurs articles d'une vendeuse (ex: 'sandales 8000, puis robe bleue 15000').",
      "Separe chaque article, convertit les nombres en lettres en chiffres.",
      "Retourne un JSON avec un tableau products.",
      "Chaque fiche: name, description, category, colors, size, price, stock_quantity, confidence.",
    ].join("\n"),
  });
  const products = Array.isArray(parsed?.products) ? parsed.products : [];
  return products.map(normalizeVoiceProduct).filter((product) => product.name || product.price);
}

async function parseVoiceWithOpenAI(text, hint) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: voiceProductPrompt(text, hint),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tikchop_voice_product",
          strict: true,
          schema: voiceProductSchema(),
        },
      },
      max_output_tokens: 500,
    }),
  }, 15000, "Interpretation vocale OpenAI trop lente.");

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Interpretation vocale IA impossible.");
  }

  const textOutput = data.output_text
    || data.output?.flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

  if (!textOutput) {
    throw new Error("Interpretation vocale vide.");
  }

  return normalizeVoiceProduct(parseJsonModelOutput(textOutput));
}

async function parseVoiceBatchWithOpenAI(text, hint) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [voiceBatchPrompt(text, hint), "Retourne uniquement le JSON valide."].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tikchop_voice_products",
          strict: true,
          schema: voiceBatchSchema(),
        },
      },
      max_output_tokens: 700,
    }),
  }, 16000, "Interpretation vocale lot IA trop lente.");

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Interpretation vocale lot IA impossible.");
  }

  const textOutput = data.output_text
    || data.output?.flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

  if (!textOutput) {
    throw new Error("Interpretation vocale lot vide.");
  }

  const parsed = parseJsonModelOutput(textOutput);
  const products = Array.isArray(parsed?.products) ? parsed.products : [];
  return products.map(normalizeVoiceProduct).filter((product) => product.name || product.price);
}

function voiceProductPrompt(text, hint = "") {
  return [
    "Tu interprets la dictee d'une vendeuse de boutique en ligne Tikchop (Abidjan, Cote d'Ivoire).",
    `Dictation: ${JSON.stringify(text)}`,
    "Extrais une fiche produit utilitaire: nom court et vendable, rayon simple, couleurs, taille ou pointure uniquement si dictes, stock par defaut 1.",
    "Convertit tous les nombres en lettres en chiffres: 'trois mille cinq cent francs' => 3500, 'dix' => 10, 'quarante-deux' => 42.",
    "Le prix est en francs CFA: 'a 5000' ou '5000f' => price \"5000\".",
    "Un grand nombre sans unite (>= 1000) est souvent le prix, plus petit (1-1000) souvent la taille, pointure, quantite ou stock.",
    "Ne devine pas le prix s'il n'est pas dicte.",
    hint ? `Indication vendeur: ${hint}` : "",
    "Retourne les champs: name, description, category, colors, size, price, stock_quantity, confidence.",
  ].filter(Boolean).join("\n");
}

function voiceBatchPrompt(text, hint = "") {
  return [
    "Tu interpretes la dictee de plusieurs articles d'une vendeuse de boutique Tikchop.",
    `Dictation: ${JSON.stringify(text)}`,
    "Separe chaque article dicte (transition par 'puis', 'et', 'aussi', 'ensuite', virgule, changement de sujet, nouveau nom + prix).",
    "Ne cree pas deux fiches pour le meme article; fusionne les details repartis sur plusieurs phrases.",
    "Convertit tous les nombres en lettres en chiffres.",
    "Le prix est en francs CFA. Un grand nombre (>= 1000) est souvent le prix.",
    "Retourne un objet JSON avec un tableau products, chaque fiche: name, description, category, colors, size, price, stock_quantity, confidence.",
    hint ? `Indication vendeur: ${hint}` : "",
    "Si la dictee ne contient qu'un article, retourne products avec un seul element.",
  ].filter(Boolean).join("\n");
}

function voiceProductSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "Nom court et vendable du produit." },
      description: { type: "string", description: "Description vendeuse courte." },
      category: { type: "string", description: "Rayon simple du produit." },
      colors: { type: "array", items: { type: "string" }, description: "Couleurs dictees." },
      size: { type: "string", description: "Taille, pointure ou format dicte, sinon vide." },
      price: { type: "string", description: "Prix en francs CFA en chiffres, uniquement si dicte." },
      stock_quantity: { type: "string", description: "Quantite en stock, 1 par defaut." },
      confidence: { type: "number", description: "Confiance entre 0 et 1." },
    },
    required: ["name", "description", "category", "colors", "size", "price", "stock_quantity", "confidence"],
  };
}

function voiceBatchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      products: {
        type: "array",
        items: voiceProductSchema(),
      },
    },
    required: ["products"],
  };
}

function normalizeVoiceProduct(parsed = {}) {
  const priceRaw = String(parsed.price ?? "").replace(/[^\d]/g, "");
  const stockRaw = String(parsed.stock_quantity ?? "").replace(/[^\d]/g, "");
  return {
    name: String(parsed.name || "").trim(),
    description: String(parsed.description || "").trim(),
    category: String(parsed.category || "").trim(),
    colors: Array.isArray(parsed.colors) ? parsed.colors.filter(Boolean).map(String).slice(0, 5) : [],
    size: String(parsed.size || "").trim().toUpperCase(),
    price: priceRaw,
    stock_quantity: stockRaw || "1",
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
  };
}

function getVisionProviderOrder() {
  const configured = [
    process.env.GEMINI_API_KEY ? "gemini" : "",
    process.env.OPENROUTER_API_KEY ? "openrouter" : "",
    process.env.OPENAI_API_KEY ? "openai" : "",
  ].filter(Boolean);

  const preferred = String(process.env.AI_VISION_PROVIDER || "")
    .toLowerCase()
    .split(/[,\s>]+/)
    .map((provider) => provider.trim())
    .filter(Boolean);

  if (preferred.length === 0) {
    return configured;
  }

  const ordered = preferred.filter((provider, index) => (
    configured.includes(provider) && preferred.indexOf(provider) === index
  ));

  return [...ordered, ...configured.filter((provider) => !ordered.includes(provider))];
}

function getAiOptimizedImageUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto:good,w_768,c_limit/");
}

function getCloudinaryCleanProductUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  return url.replace(
    "/image/upload/",
    "/image/upload/e_improve:indoor,e_auto_brightness,e_auto_contrast,e_auto_color/c_pad,w_1200,h_1200,b_rgb:f6fbf7/f_auto,q_auto:good/",
  );
}

function parseJsonModelOutput(textOutput) {
  const raw = String(textOutput || "").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objectMatch) throw new Error("Reponse IA non lisible.");
      return JSON.parse(objectMatch[0]);
    }
  }
}

function productAnalysisPrompt(voiceHint = "") {
  return [
    "Analyse cette photo de produit pour une boutique en ligne Tikchop a Abidjan.",
    "Retourne une fiche directement utile a une vendeuse: nom court, rayon clair, couleurs visibles, tailles possibles.",
    "Pense comme une assistante de catalogue WhatsApp: le resultat doit aider a publier vite, pas seulement decrire l'image.",
    "Si l'indication vendeur contient Type de boutique ou Contexte du lot, utilise-la comme priorite forte pour identifier l'objet vendu.",
    "Regarde d'abord l'objet au centre, l'objet tenu, porte ou pose pour la vente. Ignore le decor, les fleurs, le sol, le lit, le mur et les mains sauf s'ils sont le produit.",
    "Ne nomme jamais le decor comme produit: fleurs, jardin, plante, table, sol, mur, lit, cintre, mannequin ou main ne sont pas l'article sauf indication vendeur explicite.",
    "Si un bijou, une montre, un sac, une paire de chaussures ou un accessoire est petit dans l'image, privilegie cet objet plutot que l'arriere-plan.",
    "Exemples de noms utiles selon le type: Collier femme, Bracelet, Montre, Sac a main, Parfum, Creme visage, Chargeur USB-C, Ecouteurs, Plat attieke, Ustensile cuisine, Robe, Sandales.",
    "Categories simples a privilegier: Accessoires, Bijoux, Beaute, Telephones, Maison, Alimentation, Vetements, Chaussures, Sacs, Autre.",
    "Le nom doit etre vendable en francais simple, sans phrase longue, sans emoji et sans marque inventee.",
    "Si une personne porte le produit, nomme le vetement ou l'accessoire visible, pas la personne.",
    "La description doit etre courte, concrete et rassurante: 8 a 16 mots, avec coupe, couleur, matiere apparente ou usage si visible.",
    "Ne devine pas de marque si elle n'est pas clairement visible.",
    "Si la photo est ambigue, donne un nom generique utile plutot que de laisser vide.",
    "Ne remplis pas la taille definitive ni la quantite depuis la photo: le vendeur les renseigne au clavier ou au vocal.",
    "Retourne toujours size comme chaine vide et quantity comme 1, sauf si l'indication vocale du vendeur les donne explicitement.",
    "Si la photo montre seulement un detail ou un angle, decris le produit principal probable sans affirmer trop fort et baisse confidence.",
    "Si l'utilisateur donne une indication vendeur, utilise-la pour corriger le nom, la categorie et les suggested_sizes quand elle parle du produit.",
    voiceHint ? `Indication vendeur: ${voiceHint}` : "",
  ].filter(Boolean).join("\n");
}

function productBatchAnalysisPrompt(count, voiceHint = "") {
  return [
    `Analyse ${count} photos de produits pour une boutique Tikchop a Abidjan.`,
    "Retourne exactement une fiche par image, dans le meme ordre: IMAGE 1, IMAGE 2, etc.",
    "Chaque fiche doit avoir un nom court et vendable en francais simple.",
    "Fais comme une assistante catalogue: tu dois aider a publier vite un lot de photos, pas ecrire une description vague.",
    "Si l'indication vendeur contient Type de boutique ou Contexte du lot, utilise-la comme priorite forte pour nommer les articles.",
    "Dans chaque image, identifie l'objet vendu au centre, tenu, porte ou pose pour la vente. Ignore le decor et l'arriere-plan.",
    "Ne nomme jamais le decor comme produit: fleurs, jardin, plante, table, sol, mur, lit, cintre, mannequin ou main ne sont pas l'article sauf indication vendeur explicite.",
    "Si un accessoire est petit devant un decor charge, nomme l'accessoire et non le decor.",
    "Exemples de noms utiles selon le type: collier femme, bracelet, montre, sac a main, parfum, creme visage, chargeur USB-C, ecouteurs, plat attieke, ustensile cuisine, robe, sandales.",
    "Categories simples a privilegier: Accessoires, Bijoux, Beaute, Telephones, Maison, Alimentation, Vetements, Chaussures, Sacs, Autre.",
    "Si une personne porte un article, identifie l'article vendu visible, pas la personne.",
    "La description de chaque fiche doit etre courte et vendeuse: coupe, couleur, matiere apparente ou usage si visible.",
    "Ne mets jamais le prix: le vendeur le saisira lui-meme.",
    "Ne devine pas la marque. Si l'image est ambigue, donne un nom generique utile et baisse confidence.",
    "Pour les vetements, propose quelques tailles possibles dans suggested_sizes, mais laisse size vide sauf indication vocale.",
    "Si plusieurs images semblent etre des angles du meme article, garde le meme nom de base pour aider le vendeur a les fusionner ensuite.",
    voiceHint ? `Indication vendeur pour tout le lot: ${voiceHint}` : "",
  ].filter(Boolean).join("\n");
}

function productAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "Nom court et courant du produit." },
      description: { type: "string", description: "Description vendeuse courte." },
      category: { type: "string", description: "Categorie simple du produit." },
      colors: { type: "array", items: { type: "string" }, description: "Couleurs visibles." },
      suggested_sizes: { type: "array", items: { type: "string" }, description: "Tailles ou pointures possibles." },
      size: { type: "string", description: "Taille definitive seulement si donnee par le vendeur." },
      quantity: { type: "number", description: "Quantite definitive, 1 par defaut." },
      confidence: { type: "number", description: "Confiance entre 0 et 1." },
    },
    required: ["name", "description", "category", "colors", "suggested_sizes", "size", "quantity", "confidence"],
  };
}

function productBatchAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      products: {
        type: "array",
        items: productAnalysisSchema(),
      },
    },
    required: ["products"],
  };
}

function normalizeProductAnalysis(analysis) {
  return {
    name: String(analysis.name || "").trim(),
    description: String(analysis.description || "").trim(),
    category: String(analysis.category || "").trim(),
    colors: Array.isArray(analysis.colors) ? analysis.colors.filter(Boolean).map(String) : [],
    suggested_sizes: Array.isArray(analysis.suggested_sizes) ? analysis.suggested_sizes.filter(Boolean).map(String) : [],
    size: String(analysis.size || "").trim(),
    quantity: Number.isFinite(Number(analysis.quantity)) ? Number(analysis.quantity) : 1,
    confidence: Number.isFinite(Number(analysis.confidence)) ? Number(analysis.confidence) : 0,
  };
}

