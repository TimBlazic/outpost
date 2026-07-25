import { NextResponse } from "next/server";

import { assertClientProjectAccess } from "@/lib/client-accounts/access";
import { touchPortalClientPresence } from "@/lib/portal/chat-sync";
import { portalGetProjectByToken } from "@/lib/portal/repo";
import { assertPortalAccess } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

/** Heartbeat while the client has any portal tab open. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      projectId?: string;
    };
    const token = body.token?.trim();
    const projectId = body.projectId?.trim();

    if (!token && !projectId) {
      return NextResponse.json(
        { error: "Missing token or projectId" },
        { status: 400 }
      );
    }

    if (projectId) {
      const { project } = await assertClientProjectAccess(projectId);
      await touchPortalClientPresence(project.id);
    } else {
      await assertPortalAccess(token!);
      const project = await portalGetProjectByToken(token!);
      if (!project) {
        return NextResponse.json(
          { error: "Portal not found" },
          { status: 404 }
        );
      }
      await touchPortalClientPresence(project.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status =
      message.includes("session") || message.includes("Forbidden")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
