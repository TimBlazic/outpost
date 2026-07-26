import { NextResponse } from "next/server";

import { flushLeadQualifyJobs } from "@/lib/qualify/jobs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await flushLeadQualifyJobs();
  return NextResponse.json(result);
}

export const POST = GET;
