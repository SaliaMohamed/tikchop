export async function sendTransactionalEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Tikchop <onboarding@resend.dev>";

  if (!apiKey || !to) {
    return { skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  }).finally(() => clearTimeout(timeout));

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Tikchop email error:", body);
    return { skipped: false, error: body?.message || "Email non envoye." };
  }

  return { skipped: false, id: body?.id };
}

export async function sendSellerWelcomeEmail({ email, name }) {
  if (!email) return { skipped: true };

  const displayName = name || "vendeur";

  return sendTransactionalEmail({
    to: email,
    subject: "Bienvenue sur Tikchop",
    text: `Bienvenue ${displayName}. Votre compte vendeur Tikchop est pret. Connectez-vous pour creer ou gerer votre boutique.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101814">
        <h1 style="margin:0 0 12px">Bienvenue sur Tikchop</h1>
        <p>Bonjour ${displayName}, votre compte vendeur est pret.</p>
        <p>Vous pouvez maintenant creer votre boutique en ligne, publier vos articles et recevoir les commandes.</p>
      </div>
    `,
  });
}
