import { NextResponse } from "next/server";

import { requireClientSession } from "@/lib/client-accounts/session";
import { renderInvoicePdf } from "@/lib/invoices/render";
import {
  getFirmSettings,
  getInvoiceById,
  getProjectById,
} from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let client;
  try {
    ({ client } = await requireClientSession());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice || invoice.status !== "issued") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!invoice.projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectById(invoice.projectId);
  if (!project || project.clientId !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getFirmSettings();
  const bytes = await renderInvoicePdf(invoice, settings);
  const filename = `${invoice.invoiceNumber || "invoice"}-${invoice.id}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
