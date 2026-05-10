const technicalErrorPattern = /api|cloudinary|column|configure|configured|database|erreur|error|evolution|failed|fetch|impossible|invalid|jwt|key|missing|paystack|pgrst|schema|secret|service_role|supabase|token|webhook/i;
const userActionPattern = /appuyez|boutique|compte|connectez|email|mot de passe|numero|réessayez|reessayez|telephone|whatsapp/i;

export function friendlyError(error, fallback = "Action non terminee pour le moment.") {
  const message = typeof error === "string" ? error : error?.message;
  const cleanMessage = String(message || "").trim();

  if (cleanMessage && userActionPattern.test(cleanMessage)) {
    return cleanMessage;
  }

  if (!cleanMessage || technicalErrorPattern.test(cleanMessage)) {
    return fallback;
  }

  return cleanMessage;
}
