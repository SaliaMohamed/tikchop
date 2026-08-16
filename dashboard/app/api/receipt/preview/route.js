import { NextResponse } from "next/server";
import { buildReceiptPdfBuffer } from "../../../../lib/receipt-pdf";

export const dynamic = "force-dynamic";

const SAMPLE_ORDER = {
  id: "preview-0001-0000-0000-000000000001",
  order_ref: "AB23CD45",
  customer_phone: "+225 07 12 34 56 78",
  customer_note: "Livrer entre 14h et 18h, appeler en arrivant.",
  status: "PAID",
  payment_method: "WAVE",
  total_amount: "42500",
  delivery_type: "DELIVERY",
  delivery_zone: "Abidjan - Cocody",
  delivery_address: "Riviera Palmeraie, rue des Jardins",
  delivery_fee: "1500",
  delivery_status: "READY",
  created_at: "2026-08-14T10:30:00.000Z",
  sellers: {
    name: "Boutique La Grace",
    slug: "la-grace",
    phone_number: "+225 07 09 08 07 06",
    brand_color: "#6C3FC5",
    physical_address: "Abidjan, Marcory Zone 4",
    logo_url: "https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png",
  },
  order_items: [
    { id: "p1", quantity: 2, price_at_time: "12000", products: { name: "Robe en pagne premium" } },
    { id: "p2", quantity: 1, price_at_time: "18500", products: { name: "Sac a main cuir" } },
  ],
};

export async function GET() {
  const buffer = await buildReceiptPdfBuffer(SAMPLE_ORDER, { status: "success", paid_at: "2026-08-14T10:35:00.000Z" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-preview.docx"`,
      "Cache-Control": "no-store",
    },
  });
}