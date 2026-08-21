/**
 * Canal de messagerie Tikchop.
 * "native" = messagerie interne (djassaman natif, sans n8n/Evolution).
 * "whatsapp" = canal Evolution API/n8n historique.
 * Source de vérité : colonne messages.channel (migration 2026-08-21-native-message-channel).
 */

export const CHANNEL_WHATSAPP = "whatsapp";
export const CHANNEL_NATIVE = "native";
export const NATIVE_CLIENT_SUFFIX = "@native";
export const NATIVE_DEFAULT_NAME = "Client Tikchop";

export function getMessageChannel(row = {}) {
  const explicit = String(row?.channel || "").toLowerCase().trim();
  if (explicit === CHANNEL_NATIVE || explicit === CHANNEL_WHATSAPP) return explicit;
  return String(row?.client || "").includes(NATIVE_CLIENT_SUFFIX) ? CHANNEL_NATIVE : CHANNEL_WHATSAPP;
}

export function isNativeChannel(channel) {
  return getMessageChannel({ channel }) === CHANNEL_NATIVE;
}

export function buildNativeClientKey(sellerSlug, name, clientId) {
  return `${sellerSlug} : ${String(name || "").trim()} : ${String(clientId || "").trim()}${NATIVE_CLIENT_SUFFIX}`;
}

export function buildWhatsAppClientKey(sellerSlug, senderLabel, phone) {
  return `${sellerSlug} : ${String(senderLabel || "").trim()} : ${String(phone || "").trim()}@s.whatsapp.net`;
}