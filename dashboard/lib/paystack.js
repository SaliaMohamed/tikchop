const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

function getAppBaseUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "";
  const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";

  return (explicitUrl || productionUrl || deploymentUrl || "http://localhost:3000").replace(/\/+$/, "");
}

export async function initializeTransaction({ email, amount, metadata, subaccount }) {
  if (!PAYSTACK_SECRET) {
    throw new Error("Paiement en ligne indisponible pour le moment.");
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      metadata,
      ...(subaccount ? { subaccount } : {}),
      callback_url: `${getAppBaseUrl()}/payment/callback`,
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || "Paiement en ligne indisponible. Reessayez ou choisissez WhatsApp.");
  }

  return data.data;
}

export async function verifyTransaction(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
  });

  const data = await response.json();
  return data.data;
}
