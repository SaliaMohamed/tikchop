"use server";

import { createClient } from "../../../lib/supabase/server";
import { assertSafeSellerPassword } from "../../../lib/password-security";

export async function updateSellerPassword(password) {
  const value = String(password || "");

  if (value.length < 6) {
    throw new Error("Le mot de passe doit avoir au moins 6 caractères.");
  }

  await assertSafeSellerPassword(value);

  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Session invalide.");
  }

  if (!sessionData.session) {
    throw new Error("Lien de récupération expiré ou déjà utilisé. Demandez un nouveau lien.");
  }

  const { error } = await supabase.auth.updateUser({ password: value });
  if (error) {
    throw new Error(error.message || "Impossible de changer le mot de passe.");
  }

  return { ok: true };
}
