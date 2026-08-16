import { supabaseAdmin } from "./supabase-admin";
import { markOrderPaidFromPaystack } from "./order-payments";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function cleanLookup(value) {
  return String(value || "").trim();
}

async function verifyPaystackReference(reference) {
  if (!reference || !PAYSTACK_SECRET) {
    return null;
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok || !payload?.status) {
      return null;
    }

    return payload.data || null;
  } catch (error) {
    console.error("Paystack receipt verification failed:", error);
    return null;
  }
}

async function fetchOrderBy(field, value, mode = "full") {
  if (!supabaseAdmin || !value) {
    return { data: null, error: null };
  }

  const selectFull = `
    id,
    order_ref,
    customer_phone,
    customer_note,
    status,
    payment_method,
    total_amount,
    delivery_type,
    delivery_zone,
    delivery_address,
    delivery_fee,
    delivery_status,
    paystack_reference,
    paystack_paid_at,
    created_at,
    sellers (id, name, slug, phone_number, logo_url, brand_color, physical_address),
    order_items (
      id,
      quantity,
      price_at_time,
      products (id, name, image_url, description)
    )
  `;

  const selectDelivery = `
    id,
    order_ref,
    customer_phone,
    status,
    payment_method,
    total_amount,
    delivery_type,
    delivery_zone,
    delivery_address,
    delivery_fee,
    delivery_status,
    created_at,
    sellers (id, name, slug, phone_number, logo_url, brand_color, physical_address),
    order_items (
      id,
      quantity,
      price_at_time,
      products (id, name, image_url, description)
    )
  `;

  const selectBasic = `
    id,
    order_ref,
    customer_phone,
    status,
    payment_method,
    total_amount,
    created_at,
    sellers (id, name, slug, phone_number, logo_url, brand_color, physical_address),
    order_items (
      id,
      quantity,
      price_at_time,
      products (id, name, image_url, description)
    )
  `;

  const selectQuery = mode === "full" ? selectFull : mode === "delivery" ? selectDelivery : selectBasic;

  return supabaseAdmin
    .from("orders")
    .select(selectQuery)
    .eq(field, value)
    .maybeSingle();
}

export function getReadableOrderRef(order) {
  return order?.order_ref || order?.id?.split("-")?.[0]?.toUpperCase() || "TIKCHOP";
}

export function getReceiptTotals(order) {
  const items = order?.order_items || [];
  const productsTotal = Number(order?.total_amount || 0);
  const deliveryFee = Number(order?.delivery_fee || 0);
  const computedProductsTotal = items.reduce((total, item) => {
    return total + Number(item.price_at_time || 0) * Number(item.quantity || 0);
  }, 0);

  return {
    productsTotal: productsTotal || computedProductsTotal,
    deliveryFee,
    total: (productsTotal || computedProductsTotal) + deliveryFee,
  };
}

export async function getReceiptOrder({ order, reference } = {}) {
  if (!supabaseAdmin) {
    return { order: null, payment: null, error: "Reçu indisponible pour le moment. Réessayez dans quelques instants." };
  }

  const lookup = cleanLookup(order);
  const paystackReference = cleanLookup(reference);
  const payment = await verifyPaystackReference(paystackReference);
  const metadata = payment?.metadata || {};
  const orderId = metadata.order_id || (isUuid(lookup) ? lookup : "");
  const orderRef = metadata.order_ref || (!isUuid(lookup) ? lookup : "");

  const candidates = [
    orderId ? ["id", orderId] : null,
    orderRef ? ["order_ref", orderRef.toUpperCase()] : null,
  ].filter(Boolean);

  for (const [field, value] of candidates) {
    const result = await fetchOrderBy(field, value, "full");
    if (result.data) {
      if (payment?.status === "success" && result.data.status !== "PAID") {
        await markOrderPaidFromPaystack(result.data.id, payment);
        result.data.status = "PAID";
      }

      return { order: result.data, payment, error: null };
    }

    if (result.error && /delivery_|whatsapp_number|paystack_|customer_note/i.test(result.error.message || "")) {
      const fallback = await fetchOrderBy(field, value, "delivery");
      if (fallback.data) {
        if (payment?.status === "success" && fallback.data.status !== "PAID") {
          await markOrderPaidFromPaystack(fallback.data.id, payment);
          fallback.data.status = "PAID";
        }

        return { order: fallback.data, payment, error: null };
      }

      if (fallback.error && /delivery_|whatsapp_number|customer_note/i.test(fallback.error.message || "")) {
        const basicFallback = await fetchOrderBy(field, value, "basic");
        if (basicFallback.data) {
          if (payment?.status === "success" && basicFallback.data.status !== "PAID") {
            await markOrderPaidFromPaystack(basicFallback.data.id, payment);
            basicFallback.data.status = "PAID";
          }

          return { order: basicFallback.data, payment, error: null };
        }
      }
    } else if (result.error) {
      console.error("Receipt order lookup failed:", result.error);
    }
  }

  return { order: null, payment, error: "Reçu introuvable pour cette commande." };
}
