import { type NextRequest, NextResponse } from "next/server";

import {
  getHostRole,
  getPortalBaseUrl,
  getRequestHostname,
  isClientHostAllowedPath,
  isPortalPath,
} from "@/lib/hosts";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const hostname = getRequestHostname(request.headers.get("host"));
  const role = getHostRole(hostname);
  const { pathname, search } = request.nextUrl;

  // client.timblazic.dev — portal only
  if (role === "client") {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }

    if (!isClientHostAllowedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // No studio auth on the portal host
    return NextResponse.next({ request });
  }

  // admin.timblazic.dev — send /portal/* to the client host when configured
  if (role === "admin" && isPortalPath(pathname)) {
    const portalBase = getPortalBaseUrl();
    if (portalBase) {
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
