/**
 * Onboarding helpers & constants (pure functions).
 */
import { supabase } from "./supabase";
export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

// +225 is always prepended ? user only types local digits
export function buildFullPhone(localDigits) {
  const clean = String(localDigits || "").replace(/\D/g, "");
  return `+225${clean}`;
}

export function hasValidLocalPhone(localDigits) {
  const clean = String(localDigits || "").replace(/\D/g, "");
  return clean.length >= 8 && clean.length <= 10;
}

export function getPhoneAliasEmail(localDigits) {
  const full = buildFullPhone(localDigits).replace(/\D/g, "");
  return full ? `seller-${full}@phone.tikchop.local` : "";
}

export function withTimeout(promise, message, timeoutMs = 14000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function signInWithPasswordControlled(credentials, timeoutMs = 22000) {
  if (!supabase) return { data: null, error: new Error("Connexion vendeur indisponible.") };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || typeof fetch === "undefined") {
    return withTimeout(supabase.auth.signInWithPassword(credentials), "Connexion trop longue. R?essayez.", timeoutMs)
      .catch((error) => ({ data: null, error }));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: new Error(payload.msg || payload.error_description || payload.error || "Connexion impossible.") };
    if (!payload.access_token || !payload.refresh_token) return { data: null, error: new Error("Session incompl?te. R?essayez.") };
    const { data, error } = await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
    if (error) return { data: null, error };
    return { data: { session: data.session || payload, user: data.user || payload.user }, error: null };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Connexion lente. R?essayez dans quelques secondes." : "Connexion impossible. V?rifiez votre r?seau.";
    return { data: null, error: new Error(message) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Password strength ---------------------------------------------------------
export const COMMON_PASSWORDS = new Set(["123456","password","azerty","qwerty","000000","111111","123123","abcdef","motdepasse","tikchop"]);

export function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  const rules = {
    length: pw.length >= 8,
    lengthMin: pw.length >= 6,
    mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
    notCommon: !COMMON_PASSWORDS.has(pw.toLowerCase()),
  };
  const score = [rules.lengthMin, rules.length, rules.mixed, rules.number, rules.special, rules.notCommon]
    .filter(Boolean).length;
  if (score <= 1) return { score: 1, label: "Trop simple", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Faible", color: "#f97316" };
  if (score <= 3) return { score: 3, label: "Moyen", color: "#eab308" };
  if (score <= 4) return { score: 4, label: "Bon", color: "#22c55e" };
  return { score: 5, label: "Excellent", color: "#059669" };
}

export const SHOP_CATEGORIES = [
  { id: "mode", label: "Mode & Vêtements", emoji: "👗" },
  { id: "beaute", label: "Beauté & Cosmétiques", emoji: "💄" },
  { id: "alimentation", label: "Alimentation & Boissons", emoji: "🍕" },
  { id: "electronique", label: "Électronique & Téléphones", emoji: "📱" },
  { id: "maison", label: "Maison & Décoration", emoji: "🏠" },
  { id: "bijoux", label: "Bijoux & Accessoires", emoji: "💎" },
  { id: "sport", label: "Sport & Loisirs", emoji: "⚽" },
  { id: "autre", label: "Autre activité", emoji: "📾" },
];

export const CI_CITIES = ["Abidjan", "Bouaké", "Daloa", "San-Pédro", "Yamoussoukro", "Korhogo", "Man", "Gagnoa", "Autre"];

export const CI_CITY_COMMUNES = {
  Abidjan: [
    "Abobo",
    "Adjamé",
    "Angré",
    "Anyama",
    "Attécoubé",
    "Bingerville",
    "Cocody",
    "Deux Plateaux",
    "Koumassi",
    "Marcory",
    "Niangon",
    "Plateau",
    "Port-Bouët",
    "Riviera",
    "Songon",
    "Treichville",
    "Vridi",
    "Yopougon",
    "Zone 4",
  ],
};