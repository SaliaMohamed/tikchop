"use client";

export function withClientTimeout(promise, message = "Chargement trop long.", timeoutMs = 9000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

export async function fetchSellerProductsFromMobileApi(accessToken) {
  const response = await fetch("/api/mobile/overview", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Articles indisponibles.");
  }

  return payload?.products || [];
}
