/**
 * r2-storage.js
 * Module d'upload vers Cloudflare R2 (compatible S3) + génération d'URL ImageKit.
 *
 * Variables d'environnement requises :
 *   R2_ACCOUNT_ID         — ID du compte Cloudflare
 *   R2_ACCESS_KEY_ID      — Clé d'accès R2
 *   R2_SECRET_ACCESS_KEY  — Clé secrète R2
 *   R2_BUCKET_NAME        — Nom du bucket (ex: tikshop-production)
 *   IMAGEKIT_URL_ENDPOINT — URL de base ImageKit (ex: https://ik.imagekit.io/tikshop)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "tikshop-production",
    imagekitEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/$/, ""),
  };
}

function getS3Client(config) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Génère la clé S3 pour un fichier produit.
 * Exemple : products/1727920000-a1b2c3.jpg
 */
function buildObjectKey(folder, filename) {
  const timestamp = Math.round(Date.now() / 1000);
  const safe = (filename || "image")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase()
    .slice(0, 40);
  return `${folder}/${timestamp}-${safe}`;
}

/**
 * Déduit le Content-Type depuis l'extension ou le type MIME fourni.
 */
function resolveMimeType(filename, mimeType) {
  if (mimeType && mimeType.startsWith("image/")) return mimeType;
  const ext = String(filename || "").split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/**
 * Construit l'URL ImageKit pour un objet R2.
 * ImageKit est configuré pour lire le bucket R2 comme source.
 * @param {string} objectKey  — clé R2 (ex: "products/1727920000-abc.jpg")
 * @param {string} transform  — transformations ImageKit optionnelles (ex: "tr:w-500,q-80,f-auto")
 */
export function buildImageKitUrl(objectKey, transform = "") {
  const config = getR2Config();
  const base = config.imagekitEndpoint || "https://ik.imagekit.io/tikshop";
  const key = objectKey.startsWith("/") ? objectKey : `/${objectKey}`;
  if (transform) {
    return `${base}/${transform}${key}`;
  }
  return `${base}${key}`;
}

/**
 * URL ImageKit optimisée pour l'affichage produit (carte + vitrine).
 * Équivalent des transformations Cloudinary précédentes.
 */
export function buildImageKitProductUrl(objectKey) {
  return buildImageKitUrl(objectKey, "tr:w-1200,h-1200,c-pad,bg-F6FBF7,q-80,f-auto");
}

/**
 * URL ImageKit pour la miniature (liste produits).
 */
export function buildImageKitThumbUrl(objectKey) {
  return buildImageKitUrl(objectKey, "tr:w-400,h-400,c-fill,q-70,f-auto");
}

/**
 * Upload un objet File (ou Blob) vers R2.
 * @param {File|Blob} file
 * @param {string}    folder  — dossier cible dans le bucket (ex: "products", "logos")
 * @returns {{ url: string, cleanUrl: string, publicId: string }}
 */
export async function uploadFileToR2(file, folder = "products") {
  const config = getR2Config();

  if (!config.accessKeyId || !config.secretAccessKey || !config.accountId) {
    throw new Error("R2 n'est pas configuré. Vérifiez R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID.");
  }
  if (!config.imagekitEndpoint) {
    throw new Error("IMAGEKIT_URL_ENDPOINT manquant.");
  }

  const filename = file.name || "upload.jpg";
  const mimeType = resolveMimeType(filename, file.type);
  const objectKey = buildObjectKey(folder, filename);

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  const client = getS3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: body,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = buildImageKitUrl(objectKey);
  const cleanUrl = buildImageKitProductUrl(objectKey);

  return { url, cleanUrl, publicId: objectKey };
}

/**
 * Upload un Buffer (pour les traitements côté serveur : suppression de fond, etc.)
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} folder
 * @param {string} [nameHint]  — nom de fichier optionnel pour l'extension
 * @returns {{ url: string, cleanUrl: string, publicId: string }}
 */
export async function uploadBufferToR2(buffer, mimeType, folder = "products", nameHint = "image") {
  const config = getR2Config();

  if (!config.accessKeyId || !config.secretAccessKey || !config.accountId) {
    throw new Error("R2 n'est pas configuré. Vérifiez R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID.");
  }
  if (!config.imagekitEndpoint) {
    throw new Error("IMAGEKIT_URL_ENDPOINT manquant.");
  }

  const ext = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const objectKey = buildObjectKey(folder, `${nameHint}${ext}`);

  const client = getS3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = buildImageKitUrl(objectKey);
  const cleanUrl = buildImageKitProductUrl(objectKey);

  return { url, cleanUrl, publicId: objectKey };
}

/**
 * Upload depuis une donnée base64 (utilisé par le bot natif pour les médias chat).
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} folder
 * @returns {{ url: string, publicId: string, resourceType: string } | null}
 */
export async function uploadBase64ToR2(base64, mimeType = "image/jpeg", folder = "chat-media") {
  try {
    const buffer = Buffer.from(base64, "base64");
    const result = await uploadBufferToR2(buffer, mimeType, folder, "media");
    return {
      url: result.url,
      publicId: result.publicId,
      resourceType: mimeType.startsWith("audio/") ? "audio" : "image",
    };
  } catch (err) {
    console.warn("[r2-storage] uploadBase64ToR2 error:", err.message);
    return null;
  }
}

/**
 * Vérifie que les variables R2 sont présentes (utile pour les checks de readiness).
 */
export function isR2Configured() {
  const config = getR2Config();
  return Boolean(
    config.accountId &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName &&
    config.imagekitEndpoint
  );
}
