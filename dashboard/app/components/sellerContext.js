"use client";

import { useSyncExternalStore } from "react";

export const SELLER_STORAGE_KEY = "tikchop:activeSeller";

export const defaultSeller = {
  id: "",
  name: "Salia Boutique",
  slug: "salia",
  phone_number: "",
};

let cachedSellerValue = "";
let cachedSeller = defaultSeller;

export function getSellerInitials(seller = defaultSeller) {
  return String(seller.name || seller.slug || "Tikchop")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TC";
}

export function normalizeSeller(seller) {
  return {
    id: seller?.id || "",
    name: seller?.name || defaultSeller.name,
    slug: seller?.slug || defaultSeller.slug,
    phone_number: seller?.phone_number || "",
  };
}

export function readActiveSeller() {
  if (typeof window === "undefined") return defaultSeller;

  try {
    const stored = window.localStorage.getItem(SELLER_STORAGE_KEY);
    return stored ? normalizeSeller(JSON.parse(stored)) : defaultSeller;
  } catch {
    return defaultSeller;
  }
}

export function writeActiveSeller(seller) {
  if (typeof window === "undefined") return;

  const normalized = normalizeSeller(seller);
  window.localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("tikchop:seller-changed", { detail: normalized }));
}

export function useActiveSeller() {
  const snapshot = useSyncExternalStore(
    subscribeToSellerChanges,
    getActiveSellerSnapshot,
    getDefaultSellerSnapshot,
  );

  return snapshot;
}

function subscribeToSellerChanges(callback) {
  if (typeof window === "undefined") return () => {};

  function handleSellerChanged() {
    callback();
  }

  function handleStorage(event) {
    if (event.key === SELLER_STORAGE_KEY) {
      callback();
    }
  }

  window.addEventListener("tikchop:seller-changed", handleSellerChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("tikchop:seller-changed", handleSellerChanged);
    window.removeEventListener("storage", handleStorage);
  };
}

function getActiveSellerSnapshot() {
  if (typeof window === "undefined") return defaultSeller;

  const value = window.localStorage.getItem(SELLER_STORAGE_KEY) || "";
  if (value === cachedSellerValue) {
    return cachedSeller;
  }

  cachedSellerValue = value;
  cachedSeller = readActiveSeller();
  return cachedSeller;
}

function getDefaultSellerSnapshot() {
  return defaultSeller;
}
