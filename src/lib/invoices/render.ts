import { promises as fs } from "fs";
import path from "path";

import type { FirmSettings, Invoice } from "@/lib/data";
import {
  generateInvoicePdf,
  type CustomerForPdf,
  type InvoiceForPdf,
  type IssuerForPdf,
} from "@/lib/invoices/pdf";
import { loadSignatureBytes } from "@/lib/invoices/signature";

function dateToTs(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).getTime();
}

async function readPublicFile(rel: string) {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", rel));
  } catch {
    return undefined;
  }
}

export async function renderInvoicePdf(
  invoice: Invoice,
  settings: FirmSettings
): Promise<Uint8Array> {
  const inv: InvoiceForPdf = {
    invoiceNumber: invoice.invoiceNumber || "DRAFT",
    issueDate: dateToTs(invoice.issueDate),
    dueDate: dateToTs(invoice.dueDate),
    currency: invoice.currency,
    lineItems: invoice.lineItems.map((l) => ({
      description: l.description,
      qty: l.qty,
      unit: l.unit || null,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })),
    monthlyItems: (invoice.monthlyItems ?? []).map((l) => ({
      description: l.description,
      qty: l.qty,
      unit: l.unit || null,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })),
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    monthlyTotal: invoice.monthlyTotal ?? 0,
    notes: invoice.notes || null,
  };

  const company =
    invoice.clientSnapshot.companyName.trim() ||
    invoice.clientSnapshot.name.trim();
  const customer: CustomerForPdf = {
    // Bill-to shows company only (Harvey uses companyName || name).
    name: company,
    companyName: company || null,
    address: invoice.clientSnapshot.address || null,
    email: invoice.clientSnapshot.email || null,
    vatId: invoice.clientSnapshot.vatId || null,
    taxNumber: invoice.clientSnapshot.taxNumber || null,
    registrationNumber: invoice.clientSnapshot.registrationNumber || null,
  };

  const issuer: IssuerForPdf = {
    // Personal name on signature; company on header / payment info.
    name: settings.firmName,
    companyName: settings.billingCompanyName || settings.firmName,
    address: settings.billingAddress || null,
    vatId: settings.vatId || null,
    vatStatus: settings.vatStatus || null,
    iban: settings.iban || null,
    bic: settings.bic || null,
    bankName: settings.bankName || null,
    registrationNumber: settings.registrationNumber || null,
    taxNumber: settings.taxNumber || null,
    email: settings.billingEmail || null,
    phone: settings.billingPhone || null,
    issuePlace: settings.issuePlace || null,
  };

  const [fontRegularBytes, fontBoldBytes, signature] = await Promise.all([
    readPublicFile("fonts/LiberationSans-Regular.ttf"),
    readPublicFile("fonts/LiberationSans-Bold.ttf"),
    loadSignatureBytes(settings.signaturePath),
  ]);

  return generateInvoicePdf(inv, customer, issuer, {
    fontRegularBytes,
    fontBoldBytes,
    signatureBytes: signature?.bytes,
    signatureContentType: signature?.contentType,
  });
}
