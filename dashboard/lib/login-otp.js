import { createHash, randomInt } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code) {
  return createHash("sha256").update(String(code)).digest("hex");
}

export function safeCompare(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export function isOtpExpired(expiresAt) {
  return !expiresAt || new Date(expiresAt).getTime() <= Date.now();
}
