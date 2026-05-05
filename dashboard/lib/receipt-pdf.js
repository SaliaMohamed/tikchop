import { getPaymentOption } from "./local-commerce";

function escapePdfText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatCfa(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} CFA`;
}

function getOrderRef(order) {
  return order?.order_ref || order?.id?.slice(0, 8)?.toUpperCase() || "TIKCHOP";
}

function getTotals(order) {
  const items = order?.order_items || [];
  const productsTotal = Number(order?.total_amount || 0) || items.reduce((sum, item) => {
    return sum + Number(item.price_at_time || 0) * Number(item.quantity || 0);
  }, 0);
  const deliveryFee = Number(order?.delivery_fee || 0);

  return {
    productsTotal,
    deliveryFee,
    total: productsTotal + deliveryFee,
  };
}

function wrapLine(text, maxLength = 76) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildReceiptLines(order, payment = {}) {
  payment = payment || {};
  const seller = Array.isArray(order.sellers) ? order.sellers[0] : order.sellers;
  const totals = getTotals(order);
  const items = order.order_items || [];
  const paidAt = payment.paid_at || payment.transaction_date || order.paystack_paid_at || order.created_at;
  const date = paidAt ? new Date(paidAt).toLocaleString("fr-FR") : "Non renseignee";
  const paymentStatus = ["PAID", "PREPARED", "DELIVERED"].includes(order.status) ? "confirme" : "a confirmer";

  const lines = [
    { text: "RECU TIKCHOP", size: 20, gap: 24 },
    { text: `Commande: ${getOrderRef(order)}`, size: 14, gap: 18 },
    { text: `Boutique: ${seller?.name || "Tikchop"}`, size: 11 },
    { text: `Client: ${order.customer_phone || "Non renseigne"}`, size: 11 },
    { text: `Date: ${date}`, size: 11 },
    { text: `Paiement: ${getPaymentOption(order.payment_method).label} - ${paymentStatus}`, size: 11, gap: 18 },
    { text: "ARTICLES", size: 13, gap: 15 },
  ];

  if (items.length) {
    for (const item of items) {
      const name = item.products?.name || "Article";
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price_at_time || 0);
      const total = quantity * price;
      lines.push({ text: `${quantity} x ${name} - ${formatCfa(total)}`, size: 10 });
    }
  } else {
    lines.push({ text: "Articles non detailles dans le recu.", size: 10 });
  }

  lines.push(
    { text: "", size: 10, gap: 12 },
    { text: `Sous-total: ${formatCfa(totals.productsTotal)}`, size: 11 },
    { text: `Livraison: ${formatCfa(totals.deliveryFee)}`, size: 11 },
    { text: `TOTAL: ${formatCfa(totals.total)}`, size: 15, gap: 20 },
    { text: "Commande prise en charge. Gardez ce recu pour le vendeur ou le livreur.", size: 10 },
  );

  return lines.flatMap((line) => {
    const wrapped = wrapLine(line.text, line.size >= 14 ? 45 : 76);
    return wrapped.map((text, index) => ({
      text,
      size: line.size,
      gap: index === wrapped.length - 1 ? line.gap : undefined,
    }));
  });
}

export function buildReceiptPdfBuffer(order, payment = {}) {
  const lines = buildReceiptLines(order, payment);
  const contentLines = ["BT", "/F1 12 Tf", "50 790 Td"];
  let currentSize = 12;

  for (const line of lines) {
    const size = line.size || 11;
    const gap = line.gap || Math.max(size + 5, 15);
    if (size !== currentSize) {
      contentLines.push(`/F1 ${size} Tf`);
      currentSize = size;
    }
    contentLines.push(`(${escapePdfText(line.text)}) Tj`);
    contentLines.push(`0 -${gap} Td`);
  }

  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

export function getReceiptPdfFileName(order) {
  return `recu-tikchop-${getOrderRef(order)}.pdf`.toLowerCase();
}
