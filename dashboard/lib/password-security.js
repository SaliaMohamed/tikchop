import { createHash } from "node:crypto";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

const WEAK_PASSWORD_PATTERNS = [
  /^123456/,
  /^password$/i,
  /^motdepasse$/i,
  /^azerty/i,
  /^qwerty/i,
  /^000000/,
  /^111111/,
];

function isTooSimple(password) {
  const value = String(password || "").trim();
  if (value.length < 6) return true;
  if (WEAK_PASSWORD_PATTERNS.some((pattern) => pattern.test(value))) return true;
  if (/^(.)\1{5,}$/.test(value)) return true;
  return false;
}

export async function assertSafeSellerPassword(password) {
  const value = String(password || "");

  if (isTooSimple(value)) {
    throw new Error("Choisissez un mot de passe moins facile à deviner.");
  }

  if (process.env.TIKCHOP_SKIP_PWNED_PASSWORD_CHECK === "1") {
    return;
  }

  const sha1 = createHash("sha1").update(value).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  let response;
  try {
    response = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Tikchop seller auth",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return;

  const body = await response.text();
  const leaked = body
    .split(/\r?\n/)
    .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);

  if (leaked) {
    throw new Error("Ce mot de passe est trop connu. Choisissez-en un autre pour securiser votre boutique.");
  }
}
