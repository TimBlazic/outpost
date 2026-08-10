import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatAddressLines } from "@/lib/formatAddress";

export type InvoiceForPdf = {
  invoiceNumber: string;
  issueDate: number;
  dueDate: number;
  serviceExecutionDate?: number | null;
  currency: string;
  lineItems: Array<{
    description: string;
    qty: number;
    unit?: string | null;
    unitPrice: number;
    taxRate?: number;
  }>;
  monthlyItems?: Array<{
    description: string;
    qty: number;
    unit?: string | null;
    unitPrice: number;
    taxRate?: number;
  }>;
  subtotal: number;
  taxTotal: number;
  total: number;
  monthlyTotal?: number;
  invoiceDescription?: string | null;
  notes?: string | null;
};

export type CustomerForPdf = {
  name: string;
  companyName?: string | null;
  address?: string | null;
  email?: string | null;
  vatId?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
};

export type IssuerForPdf = {
  name: string;
  companyName?: string | null;
  address?: string | null;
  vatId?: string | null;
  vatStatus?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  issuePlace?: string | null;
};

// ─── Layout ───────────────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;           // outer page margin
const CW     = PAGE_W - 2 * MARGIN;
const R      = PAGE_W - MARGIN;

// ─── Palette — mirrors the React component exactly ────────────────────────────
const C = {
  black:   rgb(0.067, 0.067, 0.067),  // #111
  dgrey:   rgb(0.333, 0.333, 0.333),  // #555
  mgrey:   rgb(0.533, 0.533, 0.533),  // #888
  lgrey:   rgb(0.600, 0.600, 0.600),  // #999
  bgcard:  rgb(0.961, 0.961, 0.961),  // #f5f5f5
  divider: rgb(0.800, 0.800, 0.800),  // #ccc
  rowdiv:  rgb(0.933, 0.933, 0.933),  // #eee  (row border)
};

const LOGO_SIZE = 22;
/** Outpost mark — ink square + cream ring */
const logoInk = rgb(0.09, 0.086, 0.078); // #171614
const logoCream = rgb(0.969, 0.957, 0.933); // #f7f4ee
const DEFAULT_ISSUER_NAME = "Your company name";

function drawOutpostMark(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number,
  yBot: number,
  size = LOGO_SIZE
) {
  const r = Math.max(3, size * 0.22);
  rrFill(page, x, yBot, size, size, r, logoInk);
  page.drawCircle({
    x: x + size / 2,
    y: yBot + size / 2,
    size: size * 0.28,
    borderWidth: Math.max(1.5, size * 0.1),
    borderColor: logoCream,
  });
}

/** Pass-through — custom TTF font handles čžš natively. */
function safe(s: string): string {
  if (!s) return s;
  // Only replace the em-dash which pdf-lib chokes on regardless of font
  return s.replace(/\u2014/g, "-");
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function fmtDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}).toUpperCase();
}
function fmtMoney(currency: string, n: number): string {
  return `${currency} ${n.toFixed(2)}`;
}
function computeTotals(lineItems: InvoiceForPdf["lineItems"]) {
  let subtotal=0, taxTotal=0;
  for (const l of lineItems) {
    const lt = l.qty * l.unitPrice;
    subtotal += lt;
    taxTotal += (lt * (l.taxRate ?? 0)) / 100;
  }
  return { subtotal, taxTotal, total: subtotal + taxTotal };
}

// Rounded rectangle helper (PDF has no native border-radius)
// ─── Shape helpers ───────────────────────────────────────────────────────────
// pdf-lib drawSvgPath: anchor (x,y) = TOP-LEFT of bounding box.
// Path y increases DOWNWARD (SVG convention), x increases right.
// So (0,0) = top-left, (w,h) = bottom-right.

function rrFill(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number, yBot: number, w: number, h: number,
  r: number, color: ReturnType<typeof rgb>
) {
  const k = 0.5523 * r;
  // Anchor at top-left = (x, yBot+h); path goes clockwise, y increases downward
  const d = [
    `M ${r} 0`, `L ${w-r} 0`,
    `C ${w-r+k} 0 ${w} ${r-k} ${w} ${r}`,
    `L ${w} ${h-r}`,
    `C ${w} ${h-r+k} ${w-r+k} ${h} ${w-r} ${h}`,
    `L ${r} ${h}`,
    `C ${r-k} ${h} 0 ${h-r+k} 0 ${h-r}`,
    `L 0 ${r}`,
    `C 0 ${r-k} ${r-k} 0 ${r} 0`,
    "Z",
  ].join(" ");
  page.drawSvgPath(d, { x, y: yBot + h, color, borderWidth: 0 });
}

// Rounded top corners only (flat bottom) — for table header
function rrTopFill(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number, yBot: number, w: number, h: number,
  r: number, color: ReturnType<typeof rgb>
) {
  const k = 0.5523 * r;
  const d = [
    `M ${r} 0`, `L ${w-r} 0`,
    `C ${w-r+k} 0 ${w} ${r-k} ${w} ${r}`,
    `L ${w} ${h}`,   // straight down — flat bottom-right
    `L 0 ${h}`,      // straight across bottom
    `L 0 ${r}`,      // straight up — flat bottom-left
    `C 0 ${r-k} ${r-k} 0 ${r} 0`,
    "Z",
  ].join(" ");
  page.drawSvgPath(d, { x, y: yBot + h, color, borderWidth: 0 });
}

// Border only — 4 lines drawn AFTER content so no overwrite
function rrStroke(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number, yBot: number, w: number, h: number,
  _r: number, color: ReturnType<typeof rgb>, thick = 0.8
) {
  const top = yBot + h;
  page.drawLine({ start:{x,      y:top},  end:{x:x+w, y:top},  thickness:thick, color });
  page.drawLine({ start:{x,      y:yBot}, end:{x:x+w, y:yBot}, thickness:thick, color });
  page.drawLine({ start:{x,      y:yBot}, end:{x,     y:top},  thickness:thick, color });
  page.drawLine({ start:{x:x+w,  y:yBot}, end:{x:x+w, y:top},  thickness:thick, color });
}

const roundedRect       = rrFill;
const roundedTopRect    = rrTopFill;
const roundedRectStroke = rrStroke;

export async function generateInvoicePdf(
  invoice: InvoiceForPdf,
  customer: CustomerForPdf,
  issuer: IssuerForPdf,
  options?: {
    logoPngBytes?: Uint8Array;
    /** @deprecated use signatureBytes */
    signaturePngBytes?: Uint8Array;
    signatureBytes?: Uint8Array;
    signatureContentType?: string;
    fontRegularBytes?: Uint8Array;
    fontBoldBytes?: Uint8Array;
  }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (options?.fontRegularBytes ?? options?.fontBoldBytes) {
    doc.registerFontkit(fontkit);
  }
  // Use custom TTF (supports čžš) if provided, otherwise fall back to Helvetica
  const font = options?.fontRegularBytes
    ? await doc.embedFont(options.fontRegularBytes)
    : await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = options?.fontBoldBytes
    ? await doc.embedFont(options.fontBoldBytes)
    : await doc.embedFont(StandardFonts.HelveticaBold);
  const page     = doc.addPage([PAGE_W, PAGE_H]);

  const hline = (y: number, x0=MARGIN, x1=R, color=C.divider, thick=0.6) =>
    page.drawLine({start:{x:x0,y},end:{x:x1,y},thickness:thick,color});

  const draw = (s:string, x:number, y:number,
    opts:{size?:number;bold?:boolean;color?:ReturnType<typeof rgb>;maxCh?:number}={}
  ) => {
    const {size=9,bold=false,color=C.black,maxCh=999}=opts;
    page.drawText(safe(s.slice(0,maxCh)),{x,y,font:bold?fontBold:font,size,color});
  };
  const drawR = (s:string, rx:number, y:number,
    opts:{size?:number;bold?:boolean;color?:ReturnType<typeof rgb>}={}
  ) => {
    const {size=9,bold=false,color=C.black}=opts;
    const f=bold?fontBold:font;
    page.drawText(safe(s),{x:rx-f.widthOfTextAtSize(safe(s),size),y,font:f,size,color});
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. HEADER  — logo + big issuer name (left)  |  INVOICE + date (right)
  //    mirrors: flex items-center justify-between gap-4 mb-10
  //    logo: w-[22px] h-[22px]   name: text-2xl font-bold
  // ════════════════════════════════════════════════════════════════════════════
  let y = PAGE_H - MARGIN;

  // Logo (22×22) — custom PNG if provided, otherwise Outpost mark
  if (options?.logoPngBytes && options.logoPngBytes.length > 0) {
    try {
      const img = await doc.embedPng(options.logoPngBytes);
      page.drawImage(img,{x:MARGIN,y:y-LOGO_SIZE,width:LOGO_SIZE,height:LOGO_SIZE});
    } catch {
      drawOutpostMark(page, MARGIN, y - LOGO_SIZE);
    }
  } else {
    drawOutpostMark(page, MARGIN, y - LOGO_SIZE);
  }

  // Issuer name — text-2xl ≈ 18pt, font-bold, tracking-tight
  const issuerName = safe((issuer.companyName||issuer.name||DEFAULT_ISSUER_NAME).slice(0,44));
  draw(issuerName, MARGIN+34, y-16, {size:18, bold:true});

  // "INVOICE" — same 18pt right-aligned + date below
  drawR("INVOICE", R, y-16, {size:18, bold:true});
  drawR(`DATE. ${fmtDate(invoice.issueDate)}`, R, y-30, {size:9, color:C.dgrey});

  y -= 52; // mb-10 ≈ 40px → 52 with logo height

  // ════════════════════════════════════════════════════════════════════════════
  // 2. GREY CARD  (rounded-lg = 8px radius, p-5 = 20px padding)
  //    mirrors: grid grid-cols-2 rounded-lg bg-[#f5f5f5] p-5 mb-6
  // ════════════════════════════════════════════════════════════════════════════
  const CARD_PAD = 20;   // p-5 = 20px
  const col2x    = MARGIN + CW / 2;
  const cardTop  = y;

  const custLines: string[] = [
    ...(customer.address ? formatAddressLines(customer.address) : []),
    ...(customer.email ? [customer.email] : []),
    ...((customer.taxNumber??customer.vatId) ? [`Tax: ${customer.taxNumber??customer.vatId}`] : []),
    ...(customer.registrationNumber ? [`Reg. no.: ${customer.registrationNumber}`] : []),
  ];
  const issLines: string[] = [
    ...(issuer.iban     ? [`IBAN: ${issuer.iban}`]         : []),
    ...(issuer.bankName ? [`Bank: ${issuer.bankName}`]     : []),
    ...(issuer.bic      ? [`BIC: ${issuer.bic}`]           : []),
    ...(issuer.registrationNumber ? [`Reg. no.: ${issuer.registrationNumber}`] : []),
    ...(issuer.taxNumber ? [`Tax no.: ${issuer.taxNumber}`] : []),
    ...(issuer.vatStatus?.trim() ? [issuer.vatStatus.trim()] : []),
  ];

  // label(11px→8pt) + mb-3(12) + name(14px→10.5pt) + mt-2(8) + lines(13px→9.5pt, space-y-1=4)
  const leftDepth  = CARD_PAD + 8 + 12 + 10.5 + 8 + Math.max(custLines.length,0) * 13.5;
  const rightDepth = CARD_PAD + 8 + 12 + 10.5 + 8 + Math.max(issLines.length,0) * 13.5;
  const contentDepth = Math.max(leftDepth, rightDepth);
  const CARD_H = contentDepth + CARD_PAD;

  // rounded-lg fill (stroke added after content)
  roundedRect(page, MARGIN, cardTop - CARD_H, CW, CARD_H, 8, C.bgcard);

  // Left: INVOICE TO
  let cy = cardTop - CARD_PAD;
  draw("INVOICE TO", MARGIN+CARD_PAD, cy, {size:8, bold:true, color:C.mgrey});
  cy -= 20; // mb-3 ≈ 12 + label height 8
  // Customer / firm name: text-sm font-bold → 10pt bold
  draw(safe((customer.companyName||customer.name||"—").slice(0,38)), MARGIN+CARD_PAD, cy, {size:10, bold:true});
  cy -= 18.5; // mt-2 + name height
  for (const line of custLines) {
    draw(line, MARGIN+CARD_PAD, cy, {size:9.5, color:C.dgrey, maxCh:42});
    cy -= 13.5;
  }

  // Right: PAYMENT INFO
  let iy = cardTop - CARD_PAD;
  draw("PAYMENT INFO", col2x+CARD_PAD, iy, {size:8, bold:true, color:C.mgrey});
  iy -= 20;
  // issuer name: text-sm font-bold → 10pt bold
  draw(safe((issuer.companyName||issuer.name||DEFAULT_ISSUER_NAME).slice(0,38)), col2x+CARD_PAD, iy, {size:10, bold:true});
  iy -= 18.5; // mt-2 + name height
  for (const line of issLines) {
    draw(line, col2x+CARD_PAD, iy, {size:9.5, color:C.dgrey, maxCh:42});
    iy -= 13.5;
  }

  y = cardTop - CARD_H - 24; // mb-6 = 24

  // ════════════════════════════════════════════════════════════════════════════
  // 3. DATE + INVOICE NO / Due  (mb-4)
  //    mirrors: text-[13px] text-[#555]  /  text-sm font-bold  +  text-sm text-[#555]
  // ════════════════════════════════════════════════════════════════════════════
  draw(`DATE: ${fmtDateLong(invoice.issueDate)}`, MARGIN, y, {size:9.5, color:C.dgrey});
  y -= 14; // mt-2
  draw(`INVOICE NO: ${invoice.invoiceNumber}`, MARGIN, y, {size:9.5, bold:true});
  drawR(`Due: ${fmtDate(invoice.dueDate)}`, R, y, {size:9.5, color:C.dgrey});
  y -= 18; // gap before table

  // ════════════════════════════════════════════════════════════════════════════
  // 4. ITEMS TABLE
  //    header: grid bg-[#f5f5f5] rounded-t-lg py-3 px-2 text-[11px] font-bold uppercase
  //    rows:   grid py-3 px-2 text-sm border-b border-[#eee]
  //    NO divider above header, NO divider below last row
  // ════════════════════════════════════════════════════════════════════════════
  // Column x positions (mirror grid-cols-12, px-2=4px inset)
  const tL  = MARGIN + 4;   // px-2
  const tR  = R - 4;
  const tW  = tR - tL;

  // col proportions: 1|4|1|1|2|3 out of 12
  const cNoL    = tL;
  const cDescL  = tL + tW * (1/12);
  const cQtyR   = tL + tW * (6/12);
  const cUnitR  = tL + tW * (7/12);
  const cPriceR = tL + tW * (9/12);
  const cTotR   = tR;

  const theadH = 26;
  const rowH = 32;
  const monthlyItems = invoice.monthlyItems ?? [];
  const showMonthly =
    monthlyItems.length > 0 && (invoice.monthlyTotal ?? 0) > 0;

  const drawItemsTable = (
    items: InvoiceForPdf["lineItems"],
    sectionLabel?: string
  ) => {
    if (sectionLabel) {
      draw(sectionLabel, MARGIN, y, { size: 8, bold: true, color: C.mgrey });
      y -= 14;
    }
    rrFill(page, MARGIN, y - theadH, CW, theadH, 8, C.bgcard);
    const thY = y - 17;
    draw("NO", cNoL, thY, { size: 8, bold: true, color: C.mgrey });
    draw("DESCRIPTION", cDescL, thY, { size: 8, bold: true, color: C.mgrey });
    drawR("QUANTITY", cQtyR, thY, { size: 8, bold: true, color: C.mgrey });
    drawR("UNIT", cUnitR, thY, { size: 8, bold: true, color: C.mgrey });
    drawR("UNIT PRICE", cPriceR, thY, { size: 8, bold: true, color: C.mgrey });
    drawR("TOTAL", cTotR, thY, { size: 8, bold: true, color: C.mgrey });
    y -= theadH;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      y -= rowH;
      const lineTotal = item.qty * item.unitPrice;
      const rY = y + rowH / 2 - 3;

      if (i < items.length - 1) {
        hline(y, MARGIN + 4, R - 4, C.rowdiv, 0.5);
      }

      draw(String(i + 1), cNoL, rY, { size: 9.5, color: C.mgrey });
      draw(safe((item.description || "—").slice(0, 34)), cDescL, rY, {
        size: 9.5,
      });
      drawR(String(item.qty), cQtyR, rY, { size: 9.5, color: C.dgrey });
      drawR(safe((item.unit || "—").slice(0, 10)), cUnitR, rY, {
        size: 9.5,
        color: C.dgrey,
      });
      drawR(fmtMoney(invoice.currency, item.unitPrice), cPriceR, rY, {
        size: 9.5,
        color: C.dgrey,
      });
      drawR(fmtMoney(invoice.currency, lineTotal), cTotR, rY, {
        size: 9.5,
        bold: true,
      });
    }
  };

  drawItemsTable(invoice.lineItems, showMonthly ? "ONE-TIME" : undefined);

  if (showMonthly) {
    y -= 16;
    drawItemsTable(monthlyItems, "MONTHLY");
  }

  y -= 4; // small gap before totals

  // ════════════════════════════════════════════════════════════════════════════
  // 5. TOTAL  — flex justify-end, min-w-[240px], space-y-2, text-sm
  //    mirrors: only show subtotal/tax when taxTotal > 0
  // ════════════════════════════════════════════════════════════════════════════
  const { subtotal, taxTotal, total } = computeTotals(invoice.lineItems);
  const monthlyTotals = computeTotals(monthlyItems);

  const totBlockW = 260;
  const totL = R - totBlockW;
  let ty = y - 8;

  if (taxTotal > 0) {
    // Subtotal row
    draw("Subtotal", totL, ty, {size:9.5, color:C.dgrey});
    drawR(fmtMoney(invoice.currency,subtotal), R, ty, {size:9.5, color:C.dgrey});
    ty -= 14;
    // Tax row
    draw("Tax", totL, ty, {size:9.5, color:C.dgrey});
    drawR(fmtMoney(invoice.currency,taxTotal), R, ty, {size:9.5, color:C.dgrey});
    ty -= 14;
  }

  // pt-2 divider above total line
  ty -= 4;
  // Total row — text-sm font-bold both sides
  draw(`TOTAL AMOUNT PAYABLE IN ${invoice.currency}:`, totL, ty, {size:9.5, bold:true});
  drawR(total.toFixed(2), R, ty, {size:9.5, bold:true});
  ty -= 14;
  if (showMonthly) {
    draw(`MONTHLY IN ${invoice.currency}:`, totL, ty, { size: 9.5, bold: true });
    drawR(monthlyTotals.total.toFixed(2), R, ty, { size: 9.5, bold: true });
  }

  y = ty - 24; // gap before notes

  // ════════════════════════════════════════════════════════════════════════════
  // 6. NOTES  — border-t border-[#ccc] mt-6 pt-4
  //    text-[13px] text-[#555] space-y-2 leading-relaxed
  // ════════════════════════════════════════════════════════════════════════════
  hline(y+6, MARGIN, R, C.divider, 0.5);
  y -= 8;

  const taxDisclaimer: string[] = [];
  if (taxTotal > 0) {
    taxDisclaimer.push(
      "Tax or VAT amounts are summarized above and included in the total where line items specify a tax rate."
    );
  } else if (issuer.vatStatus?.trim()) {
    taxDisclaimer.push(
      "For your tax or VAT registration status, see the payment details section above."
    );
  } else {
    taxDisclaimer.push(
      "No VAT or sales tax is charged on this invoice based on the line items and rates shown."
    );
  }

  const noteLines: string[] = [
    ...taxDisclaimer,
    "",
    ...(issuer.iban && issuer.bankName
      ? [`Pay to: ${issuer.iban} (${issuer.bankName})`, ""]
      : []),
    `Payment reference: Invoice No. ${invoice.invoiceNumber}`,
    "",
    "Please pay by the due date shown above.",
    "Late payments may incur interest or fees as allowed under your agreement or applicable law.",
    ...(invoice.notes?.trim() ? ["", ...invoice.notes.trim().split("\n")] : []),
  ];

  const noteMaxW = R - MARGIN;
  for (const line of noteLines) {
    if (line === "") { y -= 8; continue; }
    const words = line.split(" ");
    let currentLine = "";
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(safe(test), 9.5) > noteMaxW && currentLine) {
        draw(currentLine, MARGIN, y, {size:9.5, color:C.dgrey});
        y -= 14;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      draw(currentLine, MARGIN, y, {size:9.5, color:C.dgrey});
      y -= 14;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. SIGNATURE  — mt-10 flex justify-end, w-[160px], centered
  //    mirrors: optional sig image h-10 w-[120px] + border-b + name text-sm
  // ════════════════════════════════════════════════════════════════════════════
  const sigBlockW  = 160;
  const sigBlockL  = R - sigBlockW;
  const sigLineY   = MARGIN + 55;
  const sigName    = safe(issuer?.name?.slice(0, 30) || "Your name");

  const sigBytes = options?.signatureBytes ?? options?.signaturePngBytes;
  if (sigBytes && sigBytes.length > 0) {
    try {
      const ct = (options?.signatureContentType ?? "").toLowerCase();
      const sigImg =
        ct.includes("jpeg") || ct.includes("jpg")
          ? await doc.embedJpg(sigBytes)
          : await doc.embedPng(sigBytes).catch(async () => doc.embedJpg(sigBytes));
      const imgX = sigBlockL + (sigBlockW - 120) / 2;
      page.drawImage(sigImg, {x:imgX, y:sigLineY+6, width:120, height:38});
    } catch { /* fallback to line only */ }
  }

  // border-b border-[#ccc]
  page.drawLine({
    start:{x:sigBlockL, y:sigLineY-2},
    end:  {x:R,         y:sigLineY-2},
    thickness:0.6, color:C.divider,
  });

  // name centered below line — text-sm = 9.5pt
  const nameW = font.widthOfTextAtSize(sigName, 9.5);
  draw(sigName, sigBlockL+(sigBlockW-nameW)/2, sigLineY-14, {size:9.5, color:C.dgrey});

  // ════════════════════════════════════════════════════════════════════════════
  // 8. FOOTER  — border-t border-[#ccc] mt-8 pt-3, text-[11px] text-[#999]
  // ════════════════════════════════════════════════════════════════════════════
  hline(MARGIN+24, MARGIN, R, C.divider, 0.5);

  const addrPart = formatAddressLines(issuer.address??"").join(" ") || (issuer.address??"").split("\n").join(", ");
  const footerL  = safe([addrPart, issuer.email].filter(Boolean).join("  •  ").slice(0,72));
  const footerR  = safe([issuer.phone, issuer.email].filter(Boolean).join("   ").slice(0,50));

  draw(footerL,  MARGIN, MARGIN+12, {size:8, color:C.lgrey});
  drawR(footerR, R,      MARGIN+12, {size:8, color:C.lgrey});

  return doc.save();
}