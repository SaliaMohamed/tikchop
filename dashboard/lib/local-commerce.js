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
    label: "Paiement a la livraison",
    shortLabel: "A la livraison",
    hint: "Le plus courant: paiement apres reception",
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
    hint: "Paiement direct au numero vendeur",
    online: false,
  },
  {
    value: "MTN_MONEY",
    label: "MTN MoMo",
    shortLabel: "MTN MoMo",
    hint: "Paiement direct au numero vendeur",
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
  return String(process.env.NEXT_PUBLIC_TIKCHOP_ONLINE_PAYMENTS_ENABLED || "").toLowerCase() === "true";
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
