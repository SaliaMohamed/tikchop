import { NextResponse } from "next/server";
import { getReceiptOrder } from "../../../../lib/receipt";
import { buildReceiptPdfBuffer, getReceiptPdfFileName } from "../../../../lib/receipt-pdf";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const order = url.searchParams.get("order");
  const receipt = await getReceiptOrder({ reference, order });

  if (!receipt.order) {
    return NextResponse.json(
      { error: "Recu indisponible. Verifiez le lien ou contactez la boutique." },
      { status: 404 },
    );
  }

  const buffer = await buildReceiptPdfBuffer(receipt.order, receipt.payment);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${getReceiptPdfFileName(receipt.order)}"`,
      "Cache-Control": "no-store",
    },
  });
}
