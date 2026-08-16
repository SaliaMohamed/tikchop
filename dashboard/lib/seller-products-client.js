"use client";

export function withClientTimeout(promise, message = "Chargement trop long.", timeoutMs = 9000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}
