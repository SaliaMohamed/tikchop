/**
 * Voice-to-product parsing functions.
 * Convert spoken text into structured product data.
 */
export function parseVoiceProductLegacy(text) {
  const originalText = String(text || "");
  const source = String(text || "").toLowerCase();
  const explicitPriceMatch = source.match(/(?:prix|a)\s*(\d[\d\s.]*)/i)
    || source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i);
  const quantityMatch = source.match(/(?:quantite|quantité|qte|stock|reste|il y a)\s*(\d+)/i)
    || source.match(/\b(\d+)\s*(?:piece|pièce|pieces|pièces|article|articles|dispo|disponible|disponibles)\b/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const loosePriceMatch = explicitPriceMatch ? null : [...originalText.matchAll(/\d[\d\s.]*/g)]
    .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
    .find((match) => match.digits.length >= 4 || Number(match.digits) >= 1000);
  const spokenPrice = explicitPriceMatch || loosePriceMatch ? "" : parseSpokenPrice(source);
  const price = explicitPriceMatch
    ? explicitPriceMatch[1].replace(/[^\d]/g, "")
    : loosePriceMatch?.digits || spokenPrice;
  const priceTextToRemove = explicitPriceMatch?.[0] || loosePriceMatch?.raw || "";
  const quantity = quantityMatch?.[1] || parseSpokenQuantity(source) || "1";
  const name = originalText
    .replace(priceTextToRemove, "")
    .replace(/(?:prix|a)?\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:[-\s]+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille/i, "")
    .replace(/(?:prix|a)\s*(\d[\d\s.]*)/i, "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|cfa)/i, "")
    .replace(/(?:quantite|quantité|qte|stock|reste|il y a)\s*\d+/i, "")
    .replace(/(?:quantite|quantité|qte|stock|reste|il y a)\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/i, "")
    .replace(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pièce|pieces|pièces|article|articles|dispo|disponible|disponibles)\b/i, "")
    .replace(/(?:taille|size|pointure)\s*[a-z0-9]+/i, "")
    .replace(/[,.]/g, " ")
    .trim();

  return {
    name,
    price,
    size: sizeMatch?.[1]?.toUpperCase() || "",
    stock_quantity: quantity,
  };
}

export function normalizeSpokenText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseVoiceProduct(text) {
  const originalText = String(text || "");
  const source = normalizeSpokenText(text);
  const explicitPriceMatch = source.match(/(?:prix|a|au prix de|vendu a|coute)\s*(\d[\d\s.]*)/i)
    || source.match(/(\d[\d\s.]*)\s*(f|fcfa|franc|francs|cfa)/i);
  const quantityMatch = source.match(/(?:quantite|qte|stock|reste|il y a)\s*(\d+)/i)
    || source.match(/\b(\d+)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  const sizeMatch = source.match(/(?:taille|size|pointure)\s*([a-z0-9]+)/i);
  const spokenSize = parseSpokenSize(source);
  const loosePriceMatch = explicitPriceMatch ? null : [...source.matchAll(/\d[\d\s.]*/g)]
    .map((match) => ({ raw: match[0], digits: match[0].replace(/[^\d]/g, "") }))
    .find((match) => match.digits.length >= 4 || Number(match.digits) >= 1000);
  const spokenPrice = explicitPriceMatch || loosePriceMatch ? "" : parseSpokenPrice(source);
  const price = explicitPriceMatch
    ? explicitPriceMatch[1].replace(/[^\d]/g, "")
    : loosePriceMatch?.digits || spokenPrice;
  const quantity = quantityMatch?.[1] || parseSpokenQuantity(source) || "";
  const name = originalText
    .replace(new RegExp(escapeRegExp(explicitPriceMatch?.[0] || loosePriceMatch?.raw || ""), "i"), "")
    .replace(/(?:prix|a|au prix de|vendu a|coute)?\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:[-\s]+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille/i, "")
    .replace(/(\d[\d\s.]*)\s*(f|fcfa|franc|francs|cfa)/i, "")
    .replace(/(?:quantite|qte|stock|reste|il y a)\s*\d+/i, "")
    .replace(/(?:quantite|qte|stock|reste|il y a)\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/i, "")
    .replace(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i, "")
    .replace(/(?:taille|size|pointure)\s+(xs|small|petit|s|m|medium|moyen|l|large|xl|xxl|\d{1,3}|trente|quarante|vingt)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?/i, "")
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name,
    price,
    size: spokenSize || sizeMatch?.[1]?.toUpperCase() || "",
    stock_quantity: quantity,
  };
}

export function parseSpokenSize(source) {
  const normalized = normalizeSpokenText(source);
  const direct = normalized.match(/(?:taille|size)\s+(xs|small|petit|s|m|medium|moyen|l|large|xl|xxl|\d{1,3})\b/i);
  const pointureNumber = normalized.match(/pointure\s+(\d{2})\b/i);

  if (pointureNumber) return pointureNumber[1];
  if (direct) {
    const value = direct[1].toLowerCase();
    if (["small", "petit"].includes(value)) return "S";
    if (["medium", "moyen"].includes(value)) return "M";
    if (value === "large") return "L";
    return value.toUpperCase();
  }

  const tens = {
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
  };
  const units = {
    un: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
  };
  const wordSize = normalized.match(/pointure\s+(vingt|trente|quarante|cinquante)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\b/i);
  if (!wordSize) return "";

  const value = (tens[wordSize[1]] || 0) + (units[wordSize[2]] || 0);
  return value > 0 ? String(value) : "";
}

export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSpokenPrice(source) {
  const normalized = String(source || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ");
  const units = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
  };
  const extras = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
  const match = normalized.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante)(?:\s+(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix))?\s+mille\b/i);
  if (!match) return "";
  const amount = (units[match[1]] || 0) + (extras[match[2]] || 0);
  return amount > 0 ? String(amount * 1000) : "";
}

export function parseSpokenQuantity(source) {
  const normalized = String(source || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = {
    un: "1",
    une: "1",
    deux: "2",
    trois: "3",
    quatre: "4",
    cinq: "5",
    six: "6",
    sept: "7",
    huit: "8",
    neuf: "9",
    dix: "10",
  };
  const match = normalized.match(/(?:quantite|qte|stock|reste|il y a)\s+(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i);
  if (match) return words[match[1]] || "";

  const looseNumeric = normalized.match(/\b(\d+)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  if (looseNumeric) return looseNumeric[1];

  const looseWord = normalized.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:piece|pieces|article|articles|dispo|disponible|disponibles)\b/i);
  return looseWord ? words[looseWord[1]] || "" : "";
}