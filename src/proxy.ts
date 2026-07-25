import { type NextRequest, NextResponse } from "next/server";

import {
  getHostRole,
  getRequestHostname,
  isClientHostAllowedPath,
  isPortalPath,
  resolvePortalBaseUrl,
} from "@/lib/hosts";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const hostname = getRequestHostname(request.headers.get("host"));
  const role = getHostRole(hostname);
  const { pathname, search } = request.nextUrl;

  // client.timblazic.dev — portal only
  if (role === "client") {
    if (pathname === "/") return updateSession(request);

    if (!isClientHostAllowedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/client-login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return updateSession(request);
  }

  // admin.timblazic.dev — send /portal/* to client.* (env or admin→client rewrite)
  if (role === "admin" && isPortalPath(pathname)) {
    const portalBase = resolvePortalBaseUrl(
      request.nextUrl.origin || hostname
    );
    if (portalBase && !portalBase.includes(`://${hostname}`)) {
      return NextResponse.redirect(`${portalBase}${pathname}${search}`);
    }
  }

  // Studio (+ unified localhost) auth session
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
