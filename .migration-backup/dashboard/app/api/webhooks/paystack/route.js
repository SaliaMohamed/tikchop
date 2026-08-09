import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { markOrderPaidFromPaystack, sendPaystackReceiptMessage } from "../../../../lib/order-payments";

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
      const paymentReference = data.reference;

      if (!orderId) {
        console.error("Paystack webhook: missing order_id in metadata");
        return NextResponse.json({ received: true });
      }

      if (!supabaseAdmin) {
        console.error("Paystack webhook: Supabase admin not initialized");
        return NextResponse.json({ error: "DB not configured" }, { status: 500 });
      }

      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("id, total_amount, paystack_payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        console.error("Paystack webhook: order not found", orderId);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.paystack_payment_status === "success") {
        return NextResponse.json({ received: true, duplicate: true });
      }

      const expectedAmountKobo = Math.round(Number(order.total_amount) * 100);
      const paidAmountKobo = Number(data.amount);

      if (paidAmountKobo !== expectedAmountKobo) {
        console.error(
          `Paystack webhook: amount mismatch for order ${orderId}. Expected ${expectedAmountKobo}, got ${paidAmountKobo}`
        );
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
      }

      const { error } = await markOrderPaidFromPaystack(orderId, {
        ...data,
        reference: paymentReference,
      });

      if (error) {
        console.error("Paystack webhook: Supabase update error:", error);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      try {
        await sendPaystackReceiptMessage(orderId, data);
      } catch (receiptError) {
        console.error("Paystack webhook: WhatsApp receipt message failed:", receiptError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
