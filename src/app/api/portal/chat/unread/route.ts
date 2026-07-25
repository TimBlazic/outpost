import { NextResponse } from "next/server";

import { assertClientProjectAccess } from "@/lib/client-accounts/access";
import { countUnreadMessages } from "@/lib/portal/chat-sync-shared";
import { portalGetMessages, portalGetProjectByToken } from "@/lib/portal/repo";
import { assertPortalAccess } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const token = params.get("token")?.trim();
    const projectId = params.get("projectId")?.trim();

    if (!token && !projectId) {
      return NextResponse.json(
        { error: "Missing token or projectId" },
        { status: 400 }
      );
    }

    let project;
    if (projectId) {
      ({ project } = await assertClientProjectAccess(projectId));
    } else {
      await assertPortalAccess(token!);
      project = await portalGetProjectByToken(token!);
      if (!project) {
        return NextResponse.json(
          { error: "Portal not found" },
          { status: 404 }
        );
      }
    }

    const messages = await portalGetMessages(project.id);
    const total = countUnreadMessages(
      messages,
      "client",
      project.portalClientLastReadAt
    );
    return NextResponse.json(
      { total },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status =
      message.includes("session") || message.includes("Forbidden")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
