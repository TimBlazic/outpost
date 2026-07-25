import { NextResponse } from "next/server";

import {
  createInboundLead,
  type InboundLeadPayload,
} from "@/lib/inbound/leads";

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
      {
        ok: false,
        error:
          "OUTPOST_INGEST_SECRET is not configured on the Outpost server",
      },
      { status: 500 }
    );
  }

  const provided = getApiKey(request);
  if (!provided || provided !== expected) return unauthorized();

  let payload: InboundLeadPayload;
  try {
    payload = (await request.json()) as InboundLeadPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await createInboundLead(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create lead";
    const status =
      message.includes("required") || message.includes("Invalid") ? 400 : 500;
    console.error("[inbound lead]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
