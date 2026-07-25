import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/invoices/render";
import { getFirmSettings, getInvoiceById } from "@/lib/store";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isSupabaseEnabled()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // File-store mode still binds a local user id.
    await getCurrentUserId();
  }

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getFirmSettings();
  const bytes = await renderInvoicePdf(invoice, settings);
  const filename = `${invoice.invoiceNumber || "draft"}-${invoice.id}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
