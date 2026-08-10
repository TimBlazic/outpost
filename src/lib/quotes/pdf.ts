import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import type { Quote } from "@/lib/data";
import { stripQuoteMarkdown } from "@/lib/quotes/text";

export type QuoteIssuer = {
  name: string;
  companyName?: string | null;
  siteLabel?: string | null;
  email?: string | null;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CW = PAGE_W - 2 * MARGIN;
const R = PAGE_W - MARGIN;

const C = {
  black: rgb(0.067, 0.067, 0.067),
  dgrey: rgb(0.333, 0.333, 0.333),
  mgrey: rgb(0.533, 0.533, 0.533),
  bgcard: rgb(0.961, 0.961, 0.961),
  divider: rgb(0.8, 0.8, 0.8),
  rowdiv: rgb(0.933, 0.933, 0.933),
};

const LOGO_SIZE = 22;
const logoInk = rgb(0.09, 0.086, 0.078);
const logoCream = rgb(0.969, 0.957, 0.933);

function safe(s: string) {
  return (s || "").replace(/\u2014/g, "-");
}

function fmtDate(iso: string | null, locale: "sl" | "en") {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(locale === "sl" ? "sl-SI" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateLong(iso: string | null, locale: "sl" | "en") {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d
    .toLocaleDateString(locale === "sl" ? "sl-SI" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function fmtMoney(n: number) {
  return `EUR ${n.toFixed(2)}`;
}

function rrFill(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number,
  yBot: number,
  w: number,
  h: number,
  r: number,
  color: ReturnType<typeof rgb>
) {
  const k = 0.5523 * r;
  const d = [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `L ${w} ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    "Z",
  ].join(" ");
  page.drawSvgPath(d, { x, y: yBot + h, color, borderWidth: 0 });
}

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

function wrapLines(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxW: number
): string[] {
  const out: string[] = [];
  for (const para of safe(text).split(/\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const word of para.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxW && cur) {
        out.push(cur);
        cur = word;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export async function buildQuotePdf(
  quote: Quote,
  issuer: QuoteIssuer,
  fonts?: { regular?: Uint8Array; bold?: Uint8Array }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (fonts?.regular || fonts?.bold) doc.registerFontkit(fontkit);
  const font = fonts?.regular
    ? await doc.embedFont(fonts.regular)
    : await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = fonts?.bold
    ? await doc.embedFont(fonts.bold)
    : await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const sl = quote.locale === "sl";
  const L = {
    title: sl ? "PONUDBA" : "QUOTE",
    preparedFor: sl ? "PRIPRAVLJENO ZA" : "PREPARED FOR",
    from: sl ? "OD" : "FROM",
    date: sl ? "DATUM" : "DATE",
    number: sl ? "ŠT. PONUDBE" : "QUOTE NO",
    valid: sl ? "Veljavno do" : "Valid until",
    duration: sl ? "Trajanje projekta" : "Project duration",
    scope: sl ? "OBSEG" : "SCOPE",
    no: "NO",
    desc: sl ? "OPIS" : "DESCRIPTION",
    amount: sl ? "ZNESEK" : "AMOUNT",
    oneTime: sl ? "ENKRATNO" : "ONE-TIME",
    monthly: sl ? "MESEČNO" : "MONTHLY",
    total: sl ? "SKUPAJ" : "TOTAL",
    monthlyTotal: sl ? "MESEČNO" : "MONTHLY",
    perMonth: sl ? "/ mesec" : "/ month",
    vat: sl ? "Zneski vključujejo DDV" : "Amounts include VAT",
    notes: sl ? "OPOMBE" : "NOTES",
  };

  const monthlyItems = quote.monthlyItems ?? [];
  const showMonthly = monthlyItems.length > 0 && quote.monthlyTotal > 0;

  const draw = (
    s: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      maxCh?: number;
    } = {}
  ) => {
    const { size = 9, bold = false, color = C.black, maxCh = 999 } = opts;
    page.drawText(safe(s).slice(0, maxCh), {
      x,
      y,
      font: bold ? fontBold : font,
      size,
      color,
    });
  };
  const drawR = (
    s: string,
    rx: number,
    y: number,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
    } = {}
  ) => {
    const { size = 9, bold = false, color = C.black } = opts;
    const f = bold ? fontBold : font;
    const t = safe(s);
    page.drawText(t, {
      x: rx - f.widthOfTextAtSize(t, size),
      y,
      font: f,
      size,
      color,
    });
  };
  const hline = (y: number, x0 = MARGIN, x1 = R, color = C.divider, thick = 0.6) =>
    page.drawLine({
      start: { x: x0, y },
      end: { x: x1, y },
      thickness: thick,
      color,
    });

  let y = PAGE_H - MARGIN;

  // ── Header (invoice-style) ──────────────────────────────────────────────
  drawOutpostMark(page, MARGIN, y - LOGO_SIZE);
  const issuerName = safe(
    (issuer.companyName || issuer.name || "Tim Blažič").slice(0, 44)
  );
  draw(issuerName, MARGIN + 34, y - 16, { size: 18, bold: true });
  drawR(L.title, R, y - 16, { size: 18, bold: true });
  const dateIso =
    quote.sentAt?.slice(0, 10) ?? quote.createdAt.slice(0, 10);
  drawR(`${L.date}. ${fmtDate(dateIso, quote.locale)}`, R, y - 30, {
    size: 9,
    color: C.dgrey,
  });
  y -= 52;

  // ── Grey card: PREPARED FOR | FROM ──────────────────────────────────────
  const CARD_PAD = 20;
  const col2x = MARGIN + CW / 2;
  const cardTop = y;

  const recipientName =
    quote.clientCompany.trim() || quote.clientName.trim() || "—";
  const leftLines = [
    ...(quote.clientName.trim() && quote.clientCompany.trim()
      ? [quote.clientName]
      : []),
    ...(quote.clientEmail.trim() ? [quote.clientEmail] : []),
  ];
  const rightLines = [
    ...(issuer.siteLabel ? [issuer.siteLabel] : ["timblazic.dev"]),
    ...(issuer.email ? [issuer.email] : []),
    ...(issuer.name && issuer.companyName ? [issuer.name] : []),
  ];

  const leftDepth =
    CARD_PAD + 8 + 12 + 10.5 + 8 + Math.max(leftLines.length, 0) * 13.5;
  const rightDepth =
    CARD_PAD + 8 + 12 + 10.5 + 8 + Math.max(rightLines.length, 0) * 13.5;
  const CARD_H = Math.max(leftDepth, rightDepth) + CARD_PAD;

  rrFill(page, MARGIN, cardTop - CARD_H, CW, CARD_H, 8, C.bgcard);

  let cy = cardTop - CARD_PAD;
  draw(L.preparedFor, MARGIN + CARD_PAD, cy, {
    size: 8,
    bold: true,
    color: C.mgrey,
  });
  cy -= 20;
  draw(safe(recipientName.slice(0, 38)), MARGIN + CARD_PAD, cy, {
    size: 10,
    bold: true,
  });
  cy -= 18.5;
  for (const line of leftLines) {
    draw(line, MARGIN + CARD_PAD, cy, { size: 9.5, color: C.dgrey, maxCh: 42 });
    cy -= 13.5;
  }

  let iy = cardTop - CARD_PAD;
  draw(L.from, col2x + CARD_PAD, iy, { size: 8, bold: true, color: C.mgrey });
  iy -= 20;
  draw(
    safe((issuer.companyName || issuer.name || "Tim Blažič").slice(0, 38)),
    col2x + CARD_PAD,
    iy,
    { size: 10, bold: true }
  );
  iy -= 18.5;
  for (const line of rightLines) {
    draw(line, col2x + CARD_PAD, iy, { size: 9.5, color: C.dgrey, maxCh: 42 });
    iy -= 13.5;
  }

  y = cardTop - CARD_H - 24;

  // ── Meta row ────────────────────────────────────────────────────────────
  draw(`${L.date}: ${fmtDateLong(dateIso, quote.locale)}`, MARGIN, y, {
    size: 9.5,
    color: C.dgrey,
  });
  y -= 14;
  draw(`${L.number}: ${quote.number || "—"}`, MARGIN, y, {
    size: 9.5,
    bold: true,
  });
  if (quote.validUntil) {
    drawR(
      `${L.valid}: ${fmtDate(quote.validUntil, quote.locale)}`,
      R,
      y,
      { size: 9.5, color: C.dgrey }
    );
  }
  y -= 14;
  if (quote.projectDuration.trim()) {
    draw(
      `${L.duration}: ${safe(quote.projectDuration.trim())}`,
      MARGIN,
      y,
      { size: 9.5, color: C.dgrey }
    );
    y -= 14;
  }
  y -= 8;

  // ── Scope (compact prose) ───────────────────────────────────────────────
  const scopeBody = stripQuoteMarkdown(quote.scope);
  if (scopeBody.trim()) {
    draw(L.scope, MARGIN, y, { size: 8, bold: true, color: C.mgrey });
    y -= 14;
    for (const line of wrapLines(scopeBody, font, 9.5, CW)) {
      if (y < MARGIN + 120) break;
      if (line === "") {
        y -= 6;
        continue;
      }
      draw(line, MARGIN, y, { size: 9.5, color: C.dgrey });
      y -= 13;
    }
    y -= 12;
  }

  // ── Line items table (invoice-style header + rows) ──────────────────────
  const tL = MARGIN + 4;
  const tR = R - 4;
  const tW = tR - tL;
  const cNoL = tL;
  const cDescL = tL + tW * (1 / 12);
  const cAmtR = tR;
  const theadH = 26;
  const rowH = 32;

  const drawItemsTable = (
    items: Array<{ description: string; amount: number }>,
    sectionLabel?: string
  ) => {
    if (sectionLabel) {
      draw(sectionLabel, MARGIN, y, { size: 8, bold: true, color: C.mgrey });
      y -= 14;
    }
    rrFill(page, MARGIN, y - theadH, CW, theadH, 8, C.bgcard);
    const thY = y - 17;
    draw(L.no, cNoL, thY, { size: 8, bold: true, color: C.mgrey });
    draw(L.desc, cDescL, thY, { size: 8, bold: true, color: C.mgrey });
    drawR(L.amount, cAmtR, thY, { size: 8, bold: true, color: C.mgrey });
    y -= theadH;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      y -= rowH;
      const rY = y + rowH / 2 - 3;
      if (i < items.length - 1) {
        hline(y, MARGIN + 4, R - 4, C.rowdiv, 0.5);
      }
      draw(String(i + 1), cNoL, rY, { size: 9.5, color: C.mgrey });
      draw(
        safe(stripQuoteMarkdown(item.description || "—").slice(0, 52)),
        cDescL,
        rY,
        { size: 9.5 }
      );
      drawR(fmtMoney(item.amount), cAmtR, rY, { size: 9.5, bold: true });
    }
  };

  const oneTimeItems = quote.lineItems.length
    ? quote.lineItems
    : [{ description: "—", amount: 0 }];
  drawItemsTable(oneTimeItems, showMonthly ? L.oneTime : undefined);

  if (showMonthly) {
    y -= 16;
    drawItemsTable(monthlyItems, L.monthly);
  }

  y -= 12;
  const totBlockW = 260;
  const totL = R - totBlockW;
  draw(`${L.total} EUR:`, totL, y, { size: 9.5, bold: true });
  drawR(quote.total.toFixed(2), R, y, { size: 9.5, bold: true });
  y -= 14;
  if (showMonthly) {
    draw(`${L.monthlyTotal} EUR ${L.perMonth}:`, totL, y, {
      size: 9.5,
      bold: true,
    });
    drawR(quote.monthlyTotal.toFixed(2), R, y, { size: 9.5, bold: true });
    y -= 14;
  }
  drawR(L.vat, R, y, { size: 8, color: C.mgrey });
  y -= 24;

  // ── Notes ───────────────────────────────────────────────────────────────
  const notesBody = stripQuoteMarkdown(quote.notes);
  if (notesBody.trim()) {
    hline(y + 6, MARGIN, R, C.divider, 0.5);
    y -= 10;
    draw(L.notes, MARGIN, y, { size: 8, bold: true, color: C.mgrey });
    y -= 14;
    for (const line of wrapLines(notesBody, font, 9.5, CW)) {
      if (y < MARGIN + 40) break;
      if (line === "") {
        y -= 6;
        continue;
      }
      draw(line, MARGIN, y, { size: 9.5, color: C.dgrey });
      y -= 13;
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  hline(MARGIN + 24, MARGIN, R, C.divider, 0.5);
  draw(
    safe(
      `${issuer.name || "Tim Blažič"} · ${issuer.siteLabel || "timblazic.dev"}`
    ),
    MARGIN,
    MARGIN + 10,
    { size: 8, color: C.mgrey }
  );

  return doc.save();
}
