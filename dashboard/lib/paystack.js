const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export const PAYOUT_NETWORKS = {
  ORANGE_MONEY: {
    label: "Orange Money",
    bankCode: process.env.PAYSTACK_ORANGE_MONEY_BANK_CODE || "ORANGE_CI",
    type: "mobile_money",
    autoSubaccount: true,
  },
  MTN_MOMO: {
    label: "MTN MoMo",
    bankCode: process.env.PAYSTACK_MTN_MOMO_BANK_CODE || "MTN_CI",
    type: "mobile_money",
    autoSubaccount: true,
  },
  WAVE: {
    label: "Wave",
    bankCode: process.env.PAYSTACK_WAVE_BANK_CODE || "",
    type: "mobile_money",
    autoSubaccount: Boolean(process.env.PAYSTACK_WAVE_BANK_CODE),
  },
};

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

  const feeBearer = process.env.PAYSTACK_SPLIT_FEE_BEARER === "subaccount" ? "subaccount" : "account";
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency: "XOF",
      metadata,
      ...(subaccount ? { subaccount, bearer: feeBearer } : {}),
      callback_url: `${getAppBaseUrl()}/payment/callback`,
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || "Paiement en ligne indisponible. Reessayez ou choisissez WhatsApp.");
  }

  return data.data;
}

export function normalizePayoutNetwork(value) {
  const key = String(value || "").trim().toUpperCase();
  return PAYOUT_NETWORKS[key] ? key : "";
}

export function getPayoutNetworkConfig(value) {
  const key = normalizePayoutNetwork(value);
  return key ? PAYOUT_NETWORKS[key] : null;
}

export function normalizePayoutPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return digits;
  if (digits.length === 10 || digits.length === 8) return `225${digits}`;
  return digits;
}

export function getPaystackAccountNumber(value) {
  const digits = normalizePayoutPhone(value);
  if (digits.startsWith("225") && digits.length > 10) {
    return digits.slice(3);
  }
  return digits;
}

export async function createPaystackSubaccount({ sellerId, businessName, payoutNetwork, payoutPhone }) {
  if (!PAYSTACK_SECRET) {
    throw new Error("Versement automatique indisponible pour le moment.");
  }

  const networkKey = normalizePayoutNetwork(payoutNetwork);
  const network = getPayoutNetworkConfig(networkKey);
  const accountNumber = getPaystackAccountNumber(payoutPhone);

  if (!network) {
    throw new Error("Choisissez un moyen de depot valide.");
  }

  if (!network.autoSubaccount || !network.bankCode) {
    throw new Error("Ce moyen de depot doit etre verifie manuellement avant activation.");
  }

  if (!accountNumber || accountNumber.length < 8) {
    throw new Error("Numero de depot invalide.");
  }

  const response = await fetch("https://api.paystack.co/subaccount", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: String(businessName || "Boutique Tikchop").trim(),
      settlement_bank: network.bankCode,
      account_number: accountNumber,
      percentage_charge: 0,
      settlement_schedule: "AUTO",
      primary_contact_phone: accountNumber,
      metadata: JSON.stringify({
        seller_id: sellerId,
        tikchop_payout_network: networkKey,
      }),
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || "Compte de reception non active. Verifiez le numero puis reessayez.");
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
