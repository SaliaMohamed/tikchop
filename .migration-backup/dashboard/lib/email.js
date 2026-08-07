export async function sendTransactionalEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Tikchop <onboarding@resend.dev>";

  if (!apiKey || !to) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
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
  });

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
    text: `Bienvenue ${displayName}. Ton compte vendeur Tikchop est pret. Connecte-toi pour creer ou gerer ta boutique.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101814">
        <h1 style="margin:0 0 12px">Bienvenue sur Tikchop</h1>
        <p>Bonjour ${displayName}, ton compte vendeur est pret.</p>
        <p>Tu peux maintenant creer ta mini-boutique, publier tes articles et recevoir les commandes.</p>
      </div>
    `,
  });
}
