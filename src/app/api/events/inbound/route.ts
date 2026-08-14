import { NextResponse } from "next/server";

import {
  ingestSiteEvent,
  type InboundSiteEventPayload,
} from "@/lib/inbound/events";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function getApiKey(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return request.headers.get("x-outpost-key")?.trim() || "";
}

export async function POST(request: Request) {
  const expected = process.env.OUTPOST_INGEST_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "OUTPOST_INGEST_SECRET is not configured on the Outpost server" },
      { status: 500 },
    );
  }

  const provided = getApiKey(request);
  if (!provided || provided !== expected) return unauthorized();

  let payload: InboundSiteEventPayload;
  try {
    payload = (await request.json()) as InboundSiteEventPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await ingestSiteEvent(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to ingest event";
    const status = message.includes("required") || message.includes("Invalid") ? 400 : 500;
    console.error("[inbound event]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
