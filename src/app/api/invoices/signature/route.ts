import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { loadSignatureBytes } from "@/lib/invoices/signature";
import { getFirmSettings } from "@/lib/store";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const settings = await getFirmSettings();
  const loaded = await loadSignatureBytes(settings.signaturePath);
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(loaded.bytes), {
    headers: {
      "Content-Type": loaded.contentType,
      "Cache-Control": "private, no-cache",
    },
  });
}
