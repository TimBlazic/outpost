import { NextResponse } from "next/server";

import { getHostRole, getRequestHostname } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: string | null) {
  if (!next) return "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function loginPathForHost(hostHeader: string | null) {
  const role = getHostRole(getRequestHostname(hostHeader));
  // Magic links are client-only; on localhost/unified send failures to client login.
  return role === "admin" ? "/login" : "/client-login";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const host = request.headers.get("host");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const redirectUrl = new URL(loginPathForHost(host), url.origin);
      redirectUrl.searchParams.set("error", "auth");
      redirectUrl.searchParams.set("next", next);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
