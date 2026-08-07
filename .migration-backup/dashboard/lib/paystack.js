const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function initializeTransaction({ email, amount, metadata, subaccount }) {
  if (!PAYSTACK_SECRET) {
    throw new Error("Paystack secret key is missing");
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Paystack works in kobo/cents
      metadata,
      ...(subaccount ? { subaccount } : {}),
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/callback`,
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || "Failed to initialize Paystack transaction");
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
