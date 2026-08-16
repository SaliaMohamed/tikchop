import { NextResponse } from "next/server";
import crypto from "crypto";
import { markOrderPaidFromPaystack, sendPaystackReceiptMessage } from "../../../../lib/order-payments";
import { sendPushToSeller } from "../../../../lib/push-notifications";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req) {
  try {
    if (!PAYSTACK_SECRET) {
      return NextResponse.json({ error: "Paystack secret missing" }, { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;
    const data = body.data;

    if (event === "charge.success") {
      const orderId = data.metadata?.order_id;

      if (orderId) {
        const { data: paidOrder, error } = await markOrderPaidFromPaystack(orderId, data);

        if (error) {
          console.error("Supabase update error:", error);
          return NextResponse.json({ error: "DB update failed" }, { status: 500 });
        }

        sendPushToSeller(
          { sellerId: paidOrder?.seller_id },
          {
            title: "Paiement reçu",
            body: `Commande ${paidOrder?.order_ref || orderId.slice(0, 8).toUpperCase()} payée — à préparer.`,
            url: "/orders",
          },
        ).catch(() => {});

        try {
          await sendPaystackReceiptMessage(orderId, data);
        } catch (receiptError) {
          console.error("WhatsApp receipt message failed:", receiptError);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
