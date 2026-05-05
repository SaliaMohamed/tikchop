const technicalErrorPattern = /api|cloudinary|column|configure|configured|database|evolution|fetch|invalid signature|jwt|key|paystack|pgrst|schema|secret|service_role|supabase|token|webhook/i;

export function friendlyError(error, fallback = "Une action n'a pas abouti. Reessaie dans un instant.") {
  const message = typeof error === "string" ? error : error?.message;
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage || technicalErrorPattern.test(cleanMessage)) {
    return fallback;
  }

  return cleanMessage;
}
