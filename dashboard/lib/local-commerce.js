export const ABIDJAN_DELIVERY_AREAS = [
  "Abobo",
  "Adjame",
  "Angre",
  "Anyama",
  "Attecoube",
  "Bingerville",
  "Cocody",
  "Deux Plateaux",
  "Koumassi",
  "Marcory",
  "Niangon",
  "Plateau",
  "Port-Bouet",
  "Riviera",
  "Songon",
  "Treichville",
  "Vridi",
  "Yopougon",
  "Zone 4",
];

export const LOCAL_PAYMENT_OPTIONS = [
  {
    value: "CASH_ON_DELIVERY",
    label: "Paiement à la livraison",
    shortLabel: "À la livraison",
    hint: "Le plus courant: paiement après réception",
    online: false,
    recommended: true,
  },
  {
    value: "WAVE",
    label: "Wave",
    shortLabel: "Wave",
    hint: "Argent direct vendeur",
    online: false,
  },
  {
    value: "ORANGE_MONEY",
    label: "Orange Money",
    shortLabel: "Orange",
    hint: "Paiement direct au numéro vendeur",
    online: false,
  },
  {
    value: "MTN_MONEY",
    label: "MTN MoMo",
    shortLabel: "MTN MoMo",
    hint: "Paiement direct au numéro vendeur",
    online: false,
  },
  {
    value: "PAYSTACK",
    label: "Carte / Djamo",
    shortLabel: "Carte / Djamo",
    hint: "Carte bancaire ou Djamo compatible",
    online: true,
    fallback: true,
  },
];

export const ALLOWED_PAYMENT_METHODS = LOCAL_PAYMENT_OPTIONS.map((option) => option.value);
export const DEFAULT_ACCEPTED_PAYMENT_METHODS = [
  "CASH_ON_DELIVERY",
  "WAVE",
  "ORANGE_MONEY",
  "MTN_MONEY",
];

export function onlinePaymentsEnabled() {
  return false;
}

export function normalizeAcceptedPaymentMethods(input, fallback = DEFAULT_ACCEPTED_PAYMENT_METHODS) {
  let values = [];

  if (Array.isArray(input)) {
    values = input;
  } else if (typeof input === "string" && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      values = Array.isArray(parsed) ? parsed : input.split(/[,\s]+/);
    } catch {
      values = input.split(/[,\s]+/);
    }
  }

  const unique = Array.from(new Set(
    values
      .map((value) => String(value || "").trim().toUpperCase())
      .filter((value) => ALLOWED_PAYMENT_METHODS.includes(value)),
  ));

  if (unique.length > 0) return unique;
  return [...fallback];
}

export function getSellerDefaultPaymentMethod(seller, acceptedMethods) {
  const accepted = acceptedMethods || normalizeAcceptedPaymentMethods(seller?.accepted_payment_methods);
  const preferred = String(seller?.default_payment_method || "").trim().toUpperCase();
  if (accepted.includes(preferred)) return preferred;
  if (accepted.includes("CASH_ON_DELIVERY")) return "CASH_ON_DELIVERY";
  return accepted[0] || "CASH_ON_DELIVERY";
}

export function getSellerAcceptedPaymentOptions(seller, { includeUnavailableOnline = false } = {}) {
  const accepted = normalizeAcceptedPaymentMethods(seller?.accepted_payment_methods);
  const onlineEnabled = onlinePaymentsEnabled();
  const paystackReady = onlineEnabled && Boolean(seller?.paystack_subaccount_code || seller?.payout_status === "paystack_ready");
  const filtered = LOCAL_PAYMENT_OPTIONS.filter((option) => {
    if (!accepted.includes(option.value)) return false;
    if (option.online && !onlineEnabled) return false;
    if (option.online && !includeUnavailableOnline && !paystackReady) return false;
    return true;
  });

  if (filtered.length > 0) return filtered;
  return LOCAL_PAYMENT_OPTIONS.filter((option) => option.value === "CASH_ON_DELIVERY");
}

export function paymentMethodsNeedDirectPhone(methods) {
  return normalizeAcceptedPaymentMethods(methods, []).some((method) => (
    method === "WAVE" || method === "ORANGE_MONEY" || method === "MTN_MONEY"
  ));
}

export function getPaymentOption(value) {
  return LOCAL_PAYMENT_OPTIONS.find((option) => option.value === value) || LOCAL_PAYMENT_OPTIONS[0];
}

// ---------------------------------------------------------------------------
// Personnalisation des pratiques commerciales locales par le vendeur
// (Marchandage, Acompte, Échange/Troc, Rachat occasion, Retrait en boutique)
// ---------------------------------------------------------------------------

export function parseLocalCommerceSettings(seller = {}) {
  let parsed = {};
  if (seller?.bot_special_rules) {
    try {
      const raw = String(seller.bot_special_rules).trim();
      if (raw.startsWith("{") && raw.endsWith("}")) {
        parsed = JSON.parse(raw);
      }
    } catch {
      // not json
    }
  }

  return {
    negotiation_enabled: seller?.bot_negotiation_enabled ?? parsed.negotiation_enabled ?? true,
    max_discount_pct: Number(seller?.bot_max_discount_pct ?? parsed.max_discount_pct ?? 15),
    bulk_discount_pct: Number(seller?.bot_bulk_discount_pct ?? parsed.bulk_discount_pct ?? 20),
    deposit_enabled: seller?.bot_deposit_enabled ?? parsed.deposit_enabled ?? true,
    min_deposit_pct: Number(seller?.bot_min_deposit_pct ?? parsed.min_deposit_pct ?? 30),
    min_deposit_amount: Number(seller?.bot_min_deposit_amount ?? parsed.min_deposit_amount ?? 2000),
    exchange_enabled: seller?.bot_exchange_enabled ?? parsed.exchange_enabled ?? true,
    exchange_notes: seller?.bot_exchange_notes ?? parsed.exchange_notes ?? "",
    used_items_enabled: seller?.bot_used_items_enabled ?? parsed.used_items_enabled ?? true,
    used_items_notes: seller?.bot_used_items_notes ?? parsed.used_items_notes ?? "",
    pickup_enabled: seller?.pickup_enabled ?? parsed.pickup_enabled ?? true,
    pickup_address: seller?.physical_address ?? seller?.address ?? parsed.pickup_address ?? "",
    special_notes: parsed.special_notes ?? (String(seller?.bot_special_rules || "").trim().startsWith("{") ? "" : seller?.bot_special_rules || ""),
  };
}

export function encodeLocalCommerceRules(profile = {}) {
  return JSON.stringify({
    negotiation_enabled: profile.bot_negotiation_enabled !== false,
    max_discount_pct: Number(profile.bot_max_discount_pct) || 15,
    bulk_discount_pct: Number(profile.bot_bulk_discount_pct) || 20,
    deposit_enabled: profile.bot_deposit_enabled !== false,
    min_deposit_pct: Number(profile.bot_min_deposit_pct) || 30,
    min_deposit_amount: Number(profile.bot_min_deposit_amount) || 2000,
    exchange_enabled: profile.bot_exchange_enabled !== false,
    exchange_notes: String(profile.bot_exchange_notes || "").trim(),
    used_items_enabled: profile.bot_used_items_enabled !== false,
    used_items_notes: String(profile.bot_used_items_notes || "").trim(),
    pickup_enabled: profile.pickup_enabled !== false,
    pickup_address: String(profile.physical_address || "").trim(),
    special_notes: String(profile.bot_special_rules || "").trim(),
  });
}
