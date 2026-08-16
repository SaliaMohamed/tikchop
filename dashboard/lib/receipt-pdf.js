import { getPaymentOption } from "./local-commerce";
import { deflateSync, inflateSync } from "zlib";

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
  return order?.order_ref || order?.id?.split("-")?.[0]?.toUpperCase() || "TIKCHOP";
}

function getSeller(order) {
  return Array.isArray(order?.sellers) ? order.sellers[0] : order?.sellers;
}

function getTotals(order) {
  const items = order?.order_items || [];
  const productsTotal = items.reduce((sum, item) => {
    return sum + Number(item.price_at_time || 0) * Number(item.quantity || 0);
  }, 0);
  const deliveryFee = Number(order?.delivery_fee || 0);
  return {
    productsTotal,
    deliveryFee,
    total: productsTotal + deliveryFee,
  };
}

function getOrderDate(order) {
  const d = order?.created_at ? new Date(order.created_at) : new Date();
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function getPaymentLabel(order) {
  const opt = getPaymentOption(order?.payment_method);
  return opt?.label || "A confirmer";
}

function getDeliveryLine(order) {
  if (order?.delivery_type === "PICKUP") return "Retrait en boutique";
  const zone = order?.delivery_zone || "";
  const addr = order?.delivery_address || "";
  return [zone, addr].filter(Boolean).join(" - ") || "A confirmer";
}

function wrapString(text, maxLen) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ─── Logo embed helpers ──────────────────────────────────────────────────────
const LOGO_CACHE = new Map();
const LOGO_TTL = 5 * 60 * 1000;

async function fetchLogo(url) {
  if (!url) return null;
  const cached = LOGO_CACHE.get(url);
  if (cached && Date.now() - cached.at < LOGO_TTL) return cached.data;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "";
    const result = { buffer, type };
    LOGO_CACHE.set(url, { data: result, at: Date.now() });
    return result;
  } catch {
    return null;
  }
}

function isJpeg(buf) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng(buf) {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function pngDimensions(buf) {
  // PNG IHDR starts at byte 16
  if (buf.length < 24 || !isPng(buf)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function prepareLogo(url) {
  const logo = await fetchLogo(url);
  if (!logo) return null;
  const buf = logo.buffer;
  if (isJpeg(buf)) {
    return { data: buf, width: null, height: null, kind: "jpeg" };
  }
  if (isPng(buf)) {
    const dims = pngDimensions(buf);
    // PNG needs decompression & reconstruction for flate; skip complex PNG alpha
    return { data: buf, width: dims?.width || 0, height: dims?.height || 0, kind: "png" };
  }
  return null;
}

function zlibDeflate(input) {
  return deflateSync(input);
}

// ─── Content builder ─────────────────────────────────────────────────────────
const W = 595;
const H = 842;
const ML = 50;
const MR = W - 50;
const CW = MR - ML;
const COL_DESC = CW * 0.50;
const COL_PRICE = CW * 0.18;
const COL_QTY = CW * 0.12;
const COL_TOTAL = CW * 0.20;

function rgb(hex) {
  const c = String(hex || "#6C3FC5").replace("#", "");
  if (c.length !== 6) return { r: 108, g: 63, b: 197 };
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

function rgbT(c) {
  return `${(c.r / 255).toFixed(3)} ${(c.g / 255).toFixed(3)} ${(c.b / 255).toFixed(3)}`;
}

export async function buildReceiptPdfBuffer(order, payment = {}) {
  const seller = getSeller(order);
  const totals = getTotals(order);
  const items = order?.order_items || [];
  const orderRef = getOrderRef(order);
  const orderDate = getOrderDate(order);
  const client = order?.customer_phone && order?.customer_phone !== "UNKNOWN"
    ? order.customer_phone : "Non renseigne";
  const sellerPhone = seller?.phone_number || "";
  const sellerAddr = seller?.physical_address || "";
  const brand = rgb(seller?.brand_color || "#6C3FC5");
  const paid = ["PAID", "PREPARED", "DELIVERED"].includes(order?.status) || payment?.status === "success";
  const paymentLabel = getPaymentLabel(order);
  const deliveryLine = getDeliveryLine(order);

  const logo = await prepareLogo(seller?.logo_url);

  const parts = [];
  let y = H - 46;

  // Accent bar
  parts.push(`${rgbT(brand)} rg`, `${ML} ${y} ${CW} 4 re f`);
  y -= 30;

  // ── Header row: title (left) + logo (right) ───────────────────────────────
  const headerY = y;
  parts.push("0 0 0 rg", "/F1 28 Tf", "BT", `${ML} ${headerY} Td`, `(${escapePdfText("Facture")}) Tj`, "ET");
  if (logo) {
    const boxW = 52;
    const boxH = 52;
    const logoX = MR - boxW;
    const logoY = headerY - boxH + 8;
    parts.push(`0.93 0.93 0.93 rg`, `${logoX} ${logoY} ${boxW} ${boxH} re f`);
    const innerX = logoX + 4;
    const innerY = logoY + 4;
    const innerW = boxW - 8;
    const innerH = boxH - 8;
    if (logo.kind === "jpeg") {
      parts.push(`q`, `${innerW} 0 0 ${innerH} ${innerX} ${innerY} cm`, `/Im0 Do`, `Q`);
    } else if (logo.kind === "png" && logo.width && logo.height) {
      const ratio = Math.min(innerW / logo.width, innerH / logo.height);
      const iw = logo.width * ratio;
      const ih = logo.height * ratio;
      const ix = innerX + (innerW - iw) / 2;
      const iy = innerY + (innerH - ih) / 2;
      parts.push(`q`, `${iw} 0 0 ${ih} ${ix} ${iy} cm`, `/Im0 Do`, `Q`);
    }
  }
  y -= 12;

  // Subtitle
  parts.push("/F1 10 Tf", "0.45 0.45 0.45 rg", "BT", `${ML} ${y} Td`,
    `(${escapePdfText(`Commande #${orderRef}  |  ${orderDate}`)}) Tj`, "ET");
  y -= 8;

  // Separator
  parts.push("0.85 0.85 0.85 rg", `${ML} ${y} ${CW} 0.5 re f`);
  y -= 26;

  // ── De / À ─────────────────────────────────────────────────────────────────
  const colLeft = ML;
  const colRight = ML + CW / 2 + 12;
  const startY = y;

  // De (seller)
  parts.push("0 0 0 rg", "/F1 8 Tf", "BT", `${colLeft} ${y} Td`, `(${escapePdfText("De")}) Tj`, "ET");
  y -= 14;
  parts.push("/F1 11 Tf", "0 0 0 rg", "BT", `${colLeft} ${y} Td`,
    `(${escapePdfText(seller?.name || "Tikchop")}) Tj`, "ET");
  y -= 13;
  const sellerLine2 = [sellerPhone, sellerAddr].filter(Boolean);
  const sellerDisplay = sellerLine2.length ? sellerLine2 : ["Cote d'Ivoire"];
  parts.push("/F1 9 Tf", "0.45 0.45 0.45 rg");
  for (const sl of sellerDisplay.slice(0, 2)) {
    parts.push("BT", `${colLeft} ${y} Td`, `(${escapePdfText(sl)}) Tj`, "ET");
    y -= 12;
  }

  // À (client)
  let y2 = startY;
  parts.push("0 0 0 rg", "/F1 8 Tf", "BT", `${colRight} ${y2} Td`, `(${escapePdfText("A")}) Tj`, "ET");
  y2 -= 14;
  parts.push("/F1 11 Tf", "BT", `${colRight} ${y2} Td`, `(${escapePdfText("Client")}) Tj`, "ET");
  y2 -= 13;
  const clientLine = [client, order?.delivery_type === "PICKUP" ? "Retrait boutique" : order?.delivery_zone].filter(Boolean);
  parts.push("/F1 9 Tf", "0.45 0.45 0.45 rg");
  for (const cl of clientLine.slice(0, 2)) {
    parts.push("BT", `${colRight} ${y2} Td`, `(${escapePdfText(cl)}) Tj`, "ET");
    y2 -= 12;
  }

  y = Math.min(y, y2) - 14;

  // Separator
  parts.push("0.85 0.85 0.85 rg", `${ML} ${y} ${CW} 0.5 re f`);
  y -= 24;

  // ── Table header ───────────────────────────────────────────────────────────
  const headerH = 22;
  parts.push(`${rgbT(brand)} rg`, `${ML} ${y - headerH} ${CW} ${headerH} re f`);
  parts.push("/F1 8 Tf", "1 1 1 rg");
  const hY = y - 14;
  const hl = [];
  hl.push("BT", `${ML + 8} ${hY} Td`, "(", "Description", ") Tj", "ET");
  hl.push("BT", `${ML + COL_DESC + COL_PRICE + 2} ${hY} Td`, "(", "Prix unit.", ") Tj", "ET");
  hl.push("BT", `${ML + COL_DESC + COL_PRICE + COL_QTY + 2} ${hY} Td`, "(", "Qte", ") Tj", "ET");
  hl.push("BT", `${ML + COL_DESC + COL_PRICE + COL_QTY + COL_TOTAL - 6} ${hY} Td`, "(", "Montant", ") Tj", "ET");
  parts.push(...hl);
  y -= headerH + 6;

  // ── Rows ───────────────────────────────────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = item.products?.name || "Article";
    const qty = Number(item.quantity || 0);
    const price = Number(item.price_at_time || 0);
    const lineTotal = qty * price;

    if (i % 2 === 0) {
      parts.push("0.97 0.97 0.97 rg", `${ML} ${y - 20} ${CW} 20 re f`);
    }

    const rY = y - 13;
    const nameTrunc = name.length > 35 ? name.slice(0, 32) + "..." : name;
    parts.push("0 0 0 rg", "/F1 9 Tf",
      "BT", `${ML + 6} ${rY} Td`, `(${escapePdfText(nameTrunc)}) Tj`, "ET");
    parts.push("/F1 8.5 Tf", "0.45 0.45 0.45 rg",
      "BT", `${ML + COL_DESC + COL_PRICE - 2} ${rY} Td`, `(${escapePdfText(formatCfa(price))}) Tj`, "ET");
    parts.push("BT", `${ML + COL_DESC + COL_PRICE + COL_QTY - 2} ${rY} Td`, `(${escapePdfText(String(qty))}) Tj`, "ET");
    parts.push("/F1 9 Tf", "0 0 0 rg",
      "BT", `${ML + COL_DESC + COL_PRICE + COL_QTY + COL_TOTAL - 6} ${rY} Td`, `(${escapePdfText(formatCfa(lineTotal))}) Tj`, "ET");
    y -= 22;
  }

  if (items.length === 0) {
    parts.push("0.45 0.45 0.45 rg", "/F1 9 Tf",
      "BT", `${ML + 6} ${y - 13} Td`, `(${escapePdfText("Articles non details")}) Tj`, "ET");
    y -= 22;
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  y -= 6;
  parts.push("0.85 0.85 0.85 rg", `${ML} ${y} ${CW} 0.5 re f`);
  y -= 20;

  const totalsX = ML + CW * 0.58;
  const totalsValX = MR;

  function totalLine(label, value, opts = {}) {
    const size = opts.bold ? 11 : 9.5;
    const color = opts.accent ? rgbT(brand) : "0 0 0";
    parts.push(`0 0 0 rg`, `/F1 ${size} Tf`, "BT", `${totalsX} ${y} Td`, `(${escapePdfText(label)}) Tj`, "ET");
    parts.push(`${color} rg`, `/F1 ${size} Tf`,
      "BT", `${totalsValX} ${y} Td`, `(${escapePdfText(value)}) Tj`, "ET");
    y -= opts.bold ? 18 : 15;
  }

  totalLine("Sous-total", formatCfa(totals.productsTotal));
  if (totals.deliveryFee > 0) {
    totalLine("Livraison", formatCfa(totals.deliveryFee));
  }
  y -= 4;
  parts.push("0.85 0.85 0.85 rg", `${totalsX} ${y} ${MR - totalsX} 0.5 re f`);
  y -= 14;
  totalLine("Total", formatCfa(totals.total), { bold: true, accent: true });
  y -= 4;

  // Payment badge
  const badgeColor = paid ? "0.10 0.55 0.32" : "0.78 0.55 0.08";
  const badgeText = paid ? `Paye : ${paymentLabel}` : `Paiement : ${paymentLabel}`;
  const badgeW = badgeText.length * 4.4 + 14;
  parts.push(`${badgeColor} rg`, `${totalsValX - badgeW} ${y - 12} ${badgeW} 15 re f`);
  parts.push("/F1 8 Tf", "1 1 1 rg",
    "BT", `${totalsValX - badgeW + 7} ${y - 8} Td`, `(${escapePdfText(badgeText)}) Tj`, "ET");
  y -= 28;

  // ── Delivery ───────────────────────────────────────────────────────────────
  parts.push("0.85 0.85 0.85 rg", `${ML} ${y} ${CW} 0.5 re f`);
  y -= 18;
  parts.push("/F1 8 Tf", "0.45 0.45 0.45 rg", "BT", `${ML} ${y} Td`, `(${escapePdfText("LIVRAISON")}) Tj`, "ET");
  y -= 13;
  parts.push("/F1 9.5 Tf", "0 0 0 rg", "BT", `${ML} ${y} Td`, `(${escapePdfText(deliveryLine)}) Tj`, "ET");
  y -= 18;

  // ── Customer note ──────────────────────────────────────────────────────────
  if (order?.customer_note) {
    parts.push("/F1 8 Tf", "0.45 0.45 0.45 rg", "BT", `${ML} ${y} Td`, `(${escapePdfText("PRECISION CLIENT")}) Tj`, "ET");
    y -= 13;
    parts.push("/F1 9 Tf", "0 0 0 rg");
    const noteLines = wrapString(order.customer_note, 60).slice(0, 4);
    for (const nl of noteLines) {
      parts.push("BT", `${ML} ${y} Td`, `(${escapePdfText(nl)}) Tj`, "ET");
      y -= 12;
    }
    y -= 6;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  y -= 10;
  parts.push("0.85 0.85 0.85 rg", `${ML} ${y} ${CW} 0.5 re f`);
  y -= 16;
  parts.push("/F1 7.5 Tf", "0.55 0.55 0.55 rg", "BT", `${ML} ${y} Td`,
    `(${escapePdfText("Ce recu ne remplace pas une facture fiscale. Tikchop - tikchop.app")}) Tj`, "ET");

  const stream = parts.join("\n");

  // ── Object assembly with optional image ────────────────────────────────────
  const fonts = "<< /F1 4 0 R >>";
  const xobj = logo ? "<< /Im0 5 0 R >>" : "";
  const resources = `<< /Font ${fonts} ${logo ? `/XObject ${xobj}` : ""} >>`;

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Contents ${logo ? 6 : 5} 0 R >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  if (logo) {
    if (logo.kind === "jpeg") {
      const imgStream = logo.data.toString("binary");
      objects.push(`<< /Type /XObject /Subtype /Image /Width ${readJpegWidth(logo.data)} /Height ${readJpegHeight(logo.data)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n${imgStream}\nendstream`);
    } else if (logo.kind === "png") {
      // Reassemble a flattened flate-encoded image (strip IDAT/Aux, keep raw RGBA)
      const png = logo.data;
      let width = logo.width;
      let height = logo.height;
      let ctype = -1;
      let bitDepth = 8;
      let idat = Buffer.alloc(0);
      const chunks = [];
      let offset = 8;
      while (offset + 8 <= png.length) {
        const len = png.readUInt32BE(offset);
        const type = png.toString("latin1", offset + 4, offset + 8);
        const data = png.slice(offset + 8, offset + 8 + len);
        if (type === "IHDR") {
          width = data.readUInt32BE(0);
          height = data.readUInt32BE(4);
          bitDepth = data[8];
          ctype = data[9];
        }
        if (type === "IDAT") idat = Buffer.concat([idat, data]);
        chunks.push({ type, len: len + 12 });
        offset += len + 12;
      }

      if (bitDepth === 8 && [0, 2, 4, 6].includes(ctype) && idat.length) {
        const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
        const stride = width * bpp + 1;
        const raw = zlibInflate(idat);
        const out = Buffer.alloc(width * height * (bpp === 3 ? 3 : bpp === 0 ? 1 : bpp === 2 ? 2 : 4));
        let prev = Buffer.alloc(width * bpp);
        for (let row = 0; row < height; row++) {
          const filterType = raw[row * stride];
          const rowData = raw.slice(row * stride + 1, (row + 1) * stride);
          for (let byte = 0; byte < rowData.length; byte++) {
            const a = byte >= bpp ? rowData[byte - bpp] : 0;
            const b = prev[byte] || 0;
            const c = byte >= bpp ? prev[byte - bpp] : 0;
            let v = rowData[byte];
            if (filterType === 1) v = rowData[byte] + a;
            else if (filterType === 2) v = rowData[byte] + b;
            else if (filterType === 3) v = rowData[byte] + Math.floor((a + b) / 2);
            else if (filterType === 4) v = rowData[byte] + paeth(a, b, c);
            rowData[byte] = v & 0xff;
          }
          rowData.copy(out, row * width * bpp);
          prev = rowData;
        }
        const upsampled = ctype === 0 ? out : ctype === 4 ? out : out; // grayscale/rgb/rgba passed through
        const final = ctype === 6 ? alphaCompositeWhite(out, width, height) : ctype === 4 ? grayAlphaToGray(out, width, height) : out;
        const imgStream = zlibDeflate(final).toString("binary");
        const bppF = bpp === 4 ? 3 : bpp === 2 ? 1 : bpp;
        const colorSpace = bppF === 1 ? "/DeviceGray" : "/DeviceRGB";
        objects.push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /FlateDecode /Length ${zlibDeflate(final).length} >>\nstream\n${imgStream}\nendstream`);
      } else {
        // Fallback: skip image if unsupported
        logo.kind = "none";
      }
    } else {
      logo.kind = "none";
    }
  }

  if (logo?.kind === "none") {
    // Rewrite without logo
    const noLogoParts = parts.filter((p) => !/Im0/.test(p));
    const noStream = noLogoParts.join("\n");
    const objContent = `<< /Length ${Buffer.byteLength(noStream, "utf8")} >>\nstream\n${noStream}\nendstream`;
    objects.length = 0;
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font ${fonts} >> /Contents 3 0 R >>`);
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push(objContent);
  } else if (!logo) {
    const objContent = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects.push(objContent);
  } else {
    const objContent = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects.push(objContent);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function zlibInflate(input) {
  return inflateSync(input);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function alphaCompositeWhite(rgba, w, h) {
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2], a = rgba[o + 3] / 255;
    out[i * 3] = Math.round(r * a + 255 * (1 - a));
    out[i * 3 + 1] = Math.round(g * a + 255 * (1 - a));
    out[i * 3 + 2] = Math.round(b * a + 255 * (1 - a));
  }
  return out;
}

function grayAlphaToGray(ga, w, h) {
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 2;
    const g = ga[o], a = ga[o + 1] / 255;
    out[i] = Math.round(g * a + 255 * (1 - a));
  }
  return out;
}

function readJpegWidth(buf) {
  return readJpegDims(buf, 0, 1, true);
}

function readJpegHeight(buf) {
  return readJpegDims(buf, 0, 1, false);
}

function readJpegDims(buf, start, field, isWidth) {
  // Simplified SOF scan (works for baseline JPEG)
  let offset = start + 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) { offset += 1; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
        marker === 0xc5 || marker === 0xc6 || marker === 0xc7 ||
        marker === 0xc9 || marker === 0xca || marker === 0xcb ||
        marker === 0xcd || marker === 0xce || marker === 0xcf) {
      return buf.readUInt16BE(offset + (isWidth ? 7 : 5));
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += len + 2;
  }
  return 0;
}

export function getReceiptPdfFileName(order) {
  return `facture-tikchop-${getOrderRef(order)}.pdf`.toLowerCase();
}