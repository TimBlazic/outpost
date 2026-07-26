import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { ensureQuoteNumbered } from "@/lib/quotes/actions";
import { renderQuotePdf } from "@/lib/quotes/render";
import { getFirmSettings, getQuoteById } from "@/lib/store";
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
    await getCurrentUserId();
  }

  const { id } = await params;
  let quote = await getQuoteById(id);
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!quote.number) {
    quote = (await ensureQuoteNumbered(id)) ?? quote;
  }

  const settings = await getFirmSettings();
  const bytes = await renderQuotePdf(quote, settings);
  const filename = `${quote.number || "draft"}-${quote.id}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
