import 'regenerator-runtime/runtime';
import { paiseToRupeeLabel, quantityMilliToText } from '@invoice-gst/shared';
import type { InvoiceItem, InvoiceWithItems, Vendor } from '@invoice-gst/types';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { stateLabel } from '../../constants/states';

export type InvoicePdfInput = {
  vendor: Vendor;
  invoice: InvoiceWithItems;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.11, 0.098, 0.086);
const MUTED = rgb(0.42, 0.384, 0.345);
const LINE = rgb(0.886, 0.847, 0.784);
const GREEN = rgb(0.122, 0.302, 0.227);
const DANGER = rgb(0.608, 0.173, 0.173);

const COL = {
  hsn: 268,
  qty: 328,
  rate: 378,
  gst: 448,
  amount: PAGE_WIDTH - MARGIN,
} as const;

type Color = ReturnType<typeof rgb>;
type Cursor = { page: PDFPage; y: number };
type Drawer = {
  text: (value: string) => string;
  money: (paise: number) => string;
};

export async function generateInvoicePDF(
  input: InvoicePdfInput,
  fontBytes: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const draw = createDrawer(font);
  const { vendor, invoice } = input;

  doc.setTitle(invoice.invoiceNumber);
  doc.setAuthor(vendor.businessName);
  doc.setCreator('GST Invoice');

  let cursor = addPage(doc);
  cursor = writeLine(cursor, doc, font, draw.text(documentTitle(vendor)), 18, INK, 24);
  cursor = writeLine(cursor, doc, font, draw.text(vendor.businessName), 14, GREEN, 18);
  for (const line of vendorDetailLines(vendor)) {
    cursor = writeLine(cursor, doc, font, draw.text(line), 9, MUTED, 12);
  }

  cursor = gap(cursor, 8);
  cursor = rule(cursor, doc);
  cursor = gap(cursor, 14);

  cursor = writeLine(cursor, doc, font, `Invoice  ${draw.text(invoice.invoiceNumber)}`, 11, INK, 15);
  cursor = writeLine(
    cursor,
    doc,
    font,
    `Date  ${formatInvoiceDate(invoice.finalizedAt ?? invoice.createdAt)}`,
    10,
    INK,
    14,
  );
  cursor = writeLine(
    cursor,
    doc,
    font,
    `Place of supply  ${draw.text(stateLabel(invoice.placeOfSupplyStateCode))}`,
    10,
    INK,
    14,
  );
  cursor = writeLine(
    cursor,
    doc,
    font,
    invoice.isInterState ? 'Supply  Inter-state (IGST)' : 'Supply  Intra-state (CGST + SGST)',
    10,
    INK,
    14,
  );
  cursor = writeLine(
    cursor,
    doc,
    font,
    `Status  ${invoice.status} · ${invoice.paymentStatus}`,
    10,
    invoice.status === 'cancelled' ? DANGER : INK,
    16,
  );

  cursor = writeLine(cursor, doc, font, 'Bill to', 11, GREEN, 14);
  for (const line of customerLines(invoice)) {
    cursor = writeLine(cursor, doc, font, draw.text(line), 10, INK, 13);
  }

  cursor = gap(cursor, 10);
  cursor = tableHeader(cursor, doc, font);
  for (const item of invoice.items) {
    cursor = tableRow(cursor, doc, font, draw, item);
  }

  cursor = gap(cursor, 8);
  cursor = rule(cursor, doc);
  cursor = gap(cursor, 16);

  const summary: Array<[string, string, boolean]> = [
    ['Subtotal', draw.money(invoice.subtotalPaise), false],
  ];
  if (invoice.discountPaise !== 0) {
    summary.push(['Discount', draw.money(invoice.discountPaise), false]);
  }
  summary.push(['Taxable', draw.money(invoice.taxablePaise), false]);
  if (vendor.gstRegistrationType !== 'composition') {
    summary.push(
      ['CGST', draw.money(invoice.cgstPaise), false],
      ['SGST', draw.money(invoice.sgstPaise), false],
      ['IGST', draw.money(invoice.igstPaise), false],
    );
  }
  if (invoice.roundOffPaise !== 0) {
    summary.push(['Round off', draw.money(invoice.roundOffPaise), false]);
  }
  summary.push(['Total', draw.money(invoice.totalPaise), true]);

  for (const [label, value, strong] of summary) {
    cursor = summaryRow(cursor, doc, font, label, value, strong ? 12 : 10);
  }

  if (invoice.payments.length > 0) {
    cursor = gap(cursor, 8);
    cursor = writeLine(cursor, doc, font, 'Payments', 11, GREEN, 14);
    for (const payment of invoice.payments) {
      cursor = writeLine(
        cursor,
        doc,
        font,
        `${payment.method}  ${draw.money(payment.amountPaise)}  ${formatInvoiceDate(payment.paidAt)}`,
        10,
        INK,
        13,
      );
    }
  }

  if (invoice.notes) {
    cursor = gap(cursor, 8);
    cursor = writeLine(cursor, doc, font, 'Notes', 11, GREEN, 14);
    for (const line of wrap(font, draw.text(invoice.notes), 10, CONTENT_WIDTH)) {
      cursor = writeLine(cursor, doc, font, line, 10, INK, 13);
    }
  }

  cursor = gap(cursor, 18);
  cursor = writeLine(
    cursor,
    doc,
    font,
    'Generated on this device. This is not an e-invoice.',
    8,
    MUTED,
    11,
  );

  if (invoice.status === 'cancelled') {
    for (const page of doc.getPages()) {
      page.drawText('CANCELLED', {
        x: 150,
        y: 400,
        size: 42,
        font,
        color: DANGER,
        opacity: 0.18,
      });
    }
  }

  return doc.save();
}

function documentTitle(vendor: Vendor): string {
  return vendor.gstRegistrationType === 'composition' ? 'BILL OF SUPPLY' : 'TAX INVOICE';
}

function vendorDetailLines(vendor: Vendor): string[] {
  const lines: string[] = [];
  if (vendor.tradeName) {
    lines.push(vendor.tradeName);
  }
  const address = [vendor.addressLine1, vendor.addressLine2, vendor.city, vendor.pincode]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  if (address) {
    lines.push(address);
  }
  lines.push(`State ${stateLabel(vendor.stateCode)}`);
  if (vendor.gstin) {
    lines.push(`GSTIN ${vendor.gstin}`);
  }
  if (vendor.phone) {
    lines.push(`Phone ${vendor.phone}`);
  }
  if (vendor.email) {
    lines.push(vendor.email);
  }
  return lines;
}

function customerLines(invoice: InvoiceWithItems): string[] {
  const customer = invoice.customerSnapshot;
  const lines = [customer.name];
  if (customer.phone) {
    lines.push(customer.phone);
  }
  if (customer.gstin) {
    lines.push(`GSTIN ${customer.gstin}`);
  }
  lines.push(customer.stateCode ? stateLabel(customer.stateCode) : 'State same as shop');
  return lines;
}

function formatInvoiceDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function gstLabel(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}

function createDrawer(font: PDFFont): Drawer {
  const supported = new Set(font.getCharacterSet());
  const rupee = supported.has(0x20b9);

  function text(value: string): string {
    let result = '';
    for (const char of value) {
      const code = char.codePointAt(0);
      result += code !== undefined && supported.has(code) ? char : '?';
    }
    return result;
  }

  function money(paise: number): string {
    const label = paiseToRupeeLabel(paise);
    return text(rupee ? label : label.replace('₹', 'Rs '));
  }

  return { text, money };
}

function addPage(doc: PDFDocument): Cursor {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: GREEN,
  });
  return { page, y: PAGE_HEIGHT - MARGIN };
}

function room(cursor: Cursor, doc: PDFDocument, needed: number): Cursor {
  if (cursor.y - needed >= MARGIN) {
    return cursor;
  }
  return addPage(doc);
}

function gap(cursor: Cursor, amount: number): Cursor {
  return { page: cursor.page, y: cursor.y - amount };
}

function writeLine(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  value: string,
  size: number,
  color: Color,
  step: number,
): Cursor {
  const next = room(cursor, doc, step);
  next.page.drawText(value, {
    x: MARGIN,
    y: next.y - size,
    size,
    font,
    color,
  });
  return { page: next.page, y: next.y - step };
}

function rule(cursor: Cursor, doc: PDFDocument): Cursor {
  const next = room(cursor, doc, 8);
  next.page.drawLine({
    start: { x: MARGIN, y: next.y },
    end: { x: PAGE_WIDTH - MARGIN, y: next.y },
    thickness: 0.6,
    color: LINE,
  });
  return next;
}

function drawRight(
  page: PDFPage,
  font: PDFFont,
  value: string,
  size: number,
  right: number,
  y: number,
  color: Color,
) {
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: right - width, y, size, font, color });
}

function tableHeader(cursor: Cursor, doc: PDFDocument, font: PDFFont): Cursor {
  const next = room(cursor, doc, 28);
  const y = next.y - 10;
  next.page.drawText('Item', { x: MARGIN, y, size: 9, font, color: MUTED });
  next.page.drawText('HSN', { x: COL.hsn, y, size: 9, font, color: MUTED });
  next.page.drawText('Qty', { x: COL.qty, y, size: 9, font, color: MUTED });
  next.page.drawText('Rate', { x: COL.rate, y, size: 9, font, color: MUTED });
  next.page.drawText('GST', { x: COL.gst, y, size: 9, font, color: MUTED });
  drawRight(next.page, font, 'Amount', 9, COL.amount, y, MUTED);
  const ruled = rule({ page: next.page, y: y - 6 }, doc);
  return { page: ruled.page, y: ruled.y - 14 };
}

function tableRow(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  draw: Drawer,
  item: InvoiceItem,
): Cursor {
  const name = draw.text(item.productNameSnapshot);
  const local = item.localNameSnapshot ? draw.text(item.localNameSnapshot) : '';
  const nameLines = wrap(font, name, 10, COL.hsn - MARGIN - 8);
  const rowHeight = 14 + nameLines.length * 12 + (local ? 12 : 0);
  let next = room(cursor, doc, rowHeight + 8);
  if (next.page !== cursor.page) {
    next = tableHeader(next, doc, font);
    next = room(next, doc, rowHeight + 8);
  }

  const top = next.y - 10;
  nameLines.forEach((line, index) => {
    next.page.drawText(line, {
      x: MARGIN,
      y: top - index * 12,
      size: 10,
      font,
      color: INK,
    });
  });
  let used = nameLines.length * 12;
  if (local) {
    next.page.drawText(local, {
      x: MARGIN,
      y: top - used,
      size: 8,
      font,
      color: MUTED,
    });
    used += 12;
  }

  const metaY = top;
  next.page.drawText(draw.text(item.hsnSnapshot ?? '-'), {
    x: COL.hsn,
    y: metaY,
    size: 9,
    font,
    color: INK,
  });
  next.page.drawText(`${quantityMilliToText(item.quantityMilli)} ${draw.text(item.unitSnapshot)}`, {
    x: COL.qty,
    y: metaY,
    size: 9,
    font,
    color: INK,
  });
  next.page.drawText(draw.money(item.unitPricePaise), {
    x: COL.rate,
    y: metaY,
    size: 9,
    font,
    color: INK,
  });
  next.page.drawText(gstLabel(item.gstRateBps), {
    x: COL.gst,
    y: metaY,
    size: 9,
    font,
    color: INK,
  });
  drawRight(next.page, font, draw.money(item.lineTotalPaise), 9, COL.amount, metaY, INK);

  return { page: next.page, y: top - used - 8 };
}

function summaryRow(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  label: string,
  value: string,
  size: number,
): Cursor {
  const next = room(cursor, doc, size + 6);
  const y = next.y - size;
  next.page.drawText(label, { x: 360, y, size, font, color: label === 'Total' ? GREEN : INK });
  drawRight(next.page, font, value, size, COL.amount, y, label === 'Total' ? GREEN : INK);
  return { page: next.page, y: y - 6 };
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const pieces = breakWord(font, word, size, maxWidth);
    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
        }
        current = piece;
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function breakWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }
  const pieces: string[] = [];
  let current = '';
  for (const char of word) {
    const candidate = current + char;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        pieces.push(current);
      }
      current = char;
    }
  }
  if (current) {
    pieces.push(current);
  }
  return pieces;
}
