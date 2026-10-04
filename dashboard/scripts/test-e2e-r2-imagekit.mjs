import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = "1c2e48fb820d07a9f34311406e4f09e6";
const accessKeyId = "ab4b2a97c8338c00d6ff968774f9af82";
const secretAccessKey = "5ce707ba3eb6ee809a3a0d8caeadd63db41dd177c68e3d4828f4632b95f50289";
const bucket = "tikshop-production";
const imagekit = "https://ik.imagekit.io/tikshop";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

// A valid 1x1 transparent PNG file
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function testFullLoop() {
  const fileKey = `products/test/live-check-${Date.now()}.png`;

  console.log("1. Upload de l'image de test sur Cloudflare R2...");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: png1x1,
      ContentType: "image/png",
    })
  );
  console.log("✅ Upload R2 réussi !");

  const ikDirectUrl = `${imagekit}/${fileKey}`;
  const ikTransformedUrl = `${imagekit}/tr:w-100,f-auto/${fileKey}`;

  console.log("\n2. Vérification de la lecture via ImageKit :");
  console.log("- URL directe :", ikDirectUrl);
  console.log("- URL optimisée :", ikTransformedUrl);

  try {
    const res = await fetch(ikDirectUrl);
    console.log(`\nRéponse ImageKit HTTP status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log("🎉 SUCCÈS TOTAL : ImageKit a servi l'image stockée sur Cloudflare R2 !");
    } else {
      console.log("ℹ️ ImageKit a retourné un statut non-200. Détail:", await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Erreur fetch ImageKit :", err.message);
  }
}

testFullLoop();
