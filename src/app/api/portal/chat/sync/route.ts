import { NextResponse } from "next/server";

import {
  loadPortalChatSnapshot,
  loadSessionChatSnapshot,
} from "@/lib/portal/chat-sync";
import { assertPortalAccess } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const revision = searchParams.get("revision")?.trim() || "";

    if (!token && !projectId) {
      return NextResponse.json(
        { error: "Missing token or projectId" },
        { status: 400 }
      );
    }

    const payload = projectId
      ? await loadSessionChatSnapshot(projectId, {
          touchPresence: true,
          markRead: true,
        })
      : await (async () => {
          await assertPortalAccess(token!);
          return loadPortalChatSnapshot(token!, {
            touchPresence: true,
            markRead: true,
          });
        })();

    if (revision && revision === payload.revision) {
      return NextResponse.json(
        {
          revision: payload.revision,
          unchanged: true,
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
      message.includes("session") || message.includes("Forbidden")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
