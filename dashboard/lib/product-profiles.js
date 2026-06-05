export const PRODUCT_PROFILE_STORAGE_KEY = "tikchop:productProfile";

export const PRODUCT_PROFILES = [
  {
    id: "general",
    label: "General",
    shortLabel: "Articles",
    keywords: "articles divers, accessoires, produits du quotidien",
    presets: ["Accessoires", "Maison", "Bijoux", "Sacs", "Food"],
    optionPresets: ["Unique", "Couleur", "Format"],
    sizeLabel: "Option",
    sizePlaceholder: "Couleur, modele, format...",
    quantityLabel: "Stock",
    categorySuggestions: ["Accessoires", "Maison", "Beaute", "Food"],
    priceSuggestions: ["5000", "10000", "15000"],
  },
  {
    id: "fashion",
    label: "Mode",
    shortLabel: "Mode",
    keywords: "vetements, chaussures, sacs, accessoires de mode",
    presets: ["Vetements", "Chaussures", "Sacs", "Bijoux", "Pagne"],
    optionPresets: ["Taille", "Couleur", "Pointure"],
    sizeLabel: "Taille / option",
    sizePlaceholder: "M, L, 38, noir...",
    quantityLabel: "Stock",
    categorySuggestions: ["Vetements", "Chaussures", "Sacs", "Accessoires"],
    priceSuggestions: ["5000", "10000", "15000"],
  },
  {
    id: "beauty",
    label: "Beaute",
    shortLabel: "Beaute",
    keywords: "cosmetiques, parfums, cremes, maquillage, soins",
    presets: ["Parfums", "Cremes", "Maquillage", "Savons", "Soins"],
    optionPresets: ["50 ml", "100 ml", "Pack"],
    sizeLabel: "Format",
    sizePlaceholder: "50 ml, pack, couleur...",
    quantityLabel: "Stock",
    categorySuggestions: ["Parfums", "Cremes", "Maquillage", "Soins"],
    priceSuggestions: ["3000", "5000", "8000"],
  },
  {
    id: "electronics",
    label: "Tech",
    shortLabel: "Tech",
    keywords: "telephones, accessoires electroniques, chargeurs, ecouteurs",
    presets: ["Telephones", "Chargeurs", "Ecouteurs", "Coques", "Cables"],
    optionPresets: ["Modele", "Couleur", "Memoire"],
    sizeLabel: "Modele",
    sizePlaceholder: "iPhone 11, USB-C, 128 Go...",
    quantityLabel: "Pieces",
    categorySuggestions: ["Telephones", "Accessoires", "Chargeurs", "Ecouteurs"],
    priceSuggestions: ["5000", "10000", "25000"],
  },
  {
    id: "home",
    label: "Maison",
    shortLabel: "Maison",
    keywords: "maison, cuisine, decoration, ustensiles, linge",
    presets: ["Cuisine", "Decoration", "Linge", "Ustensiles", "Maison"],
    optionPresets: ["Petit", "Grand", "Lot"],
    sizeLabel: "Format",
    sizePlaceholder: "Petit, grand, lot de 3...",
    quantityLabel: "Stock",
    categorySuggestions: ["Cuisine", "Decoration", "Maison", "Ustensiles"],
    priceSuggestions: ["3000", "7000", "12000"],
  },
  {
    id: "food",
    label: "Food",
    shortLabel: "Food",
    keywords: "nourriture, boissons, plats, epicerie, gateaux",
    presets: ["Plats", "Gateaux", "Boissons", "Epicerie", "Snacks"],
    optionPresets: ["Portion", "Pack", "Grand"],
    sizeLabel: "Format",
    sizePlaceholder: "Portion, pack, 1 kg...",
    quantityLabel: "Stock",
    categorySuggestions: ["Plats", "Boissons", "Epicerie", "Snacks"],
    priceSuggestions: ["1000", "2500", "5000"],
  },
];

export function getProductProfile(profileId) {
  return PRODUCT_PROFILES.find((profile) => profile.id === profileId) || PRODUCT_PROFILES[0];
}

export function getStoredProductProfileId(sellerKey = "default") {
  if (typeof window === "undefined") return "general";

  try {
    return window.localStorage.getItem(`${PRODUCT_PROFILE_STORAGE_KEY}:${sellerKey}`) || window.localStorage.getItem(PRODUCT_PROFILE_STORAGE_KEY) || "general";
  } catch {
    return "general";
  }
}

export function storeProductProfileId(profileId, sellerKey = "default") {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PRODUCT_PROFILE_STORAGE_KEY, profileId || "general");
    if (sellerKey) {
      window.localStorage.setItem(`${PRODUCT_PROFILE_STORAGE_KEY}:${sellerKey}`, profileId || "general");
    }
  } catch {
    // Local preference only. Ignore private browsing/storage failures.
  }
}
