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
    value: "WAVE",
    label: "Wave",
    shortLabel: "Wave",
    hint: "Paiement mobile local",
    online: false,
  },
  {
    value: "ORANGE_MONEY",
    label: "Orange Money",
    shortLabel: "Orange",
    hint: "Le vendeur confirme les instructions",
    online: false,
  },
  {
    value: "MTN_MONEY",
    label: "MTN MoMo",
    shortLabel: "MTN MoMo",
    hint: "Le vendeur confirme les instructions",
    online: false,
  },
  {
    value: "CASH_ON_DELIVERY",
    label: "Paiement a la livraison",
    shortLabel: "A la livraison",
    hint: "Le client paie apres reception",
    online: false,
  },
  {
    value: "PAYSTACK",
    label: "Carte / Djamo",
    shortLabel: "Djamo",
    hint: "Carte bancaire ou carte prepaye via lien securise",
    online: true,
  },
];

export function getPaymentOption(value) {
  return LOCAL_PAYMENT_OPTIONS.find((option) => option.value === value) || LOCAL_PAYMENT_OPTIONS[0];
}
