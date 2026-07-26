import { NextResponse } from "next/server";

import { requireStudioSession } from "@/lib/auth/session";
import { loadStudioChatSnapshot } from "@/lib/portal/chat-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStudioSession(request);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId")?.trim();
    const revision = searchParams.get("revision")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const payload = await loadStudioChatSnapshot(projectId, { markRead: true });
    if (revision && revision === payload.revision) {
      // Still return presence — client online can change without new messages.
      return NextResponse.json(
        {
          revision: payload.revision,
          unchanged: true,
          clientOnline: payload.clientOnline,
          unreadCount: 0,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(payload, {
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
