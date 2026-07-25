import { NextResponse } from "next/server";

import { requireStudioSession } from "@/lib/auth/session";
import { getStudioUnreadSnapshot } from "@/lib/portal/chat-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStudioSession();

    const snapshot = await getStudioUnreadSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status =
      message.includes("Unauthorized") || message.includes("Forbidden")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
