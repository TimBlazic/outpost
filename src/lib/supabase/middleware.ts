import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getHostRole, getRequestHostname } from "@/lib/hosts";

import { getSupabaseEnv, isSupabaseEnabled } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseEnabled()) {
    return supabaseResponse;
  }

  const { url, key } = getSupabaseEnv();
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const hostname = getRequestHostname(request.headers.get("host"));
  const role = getHostRole(hostname);
  const isClientHost = role === "client";
  const loginPath = isClientHost ? "/client-login" : "/login";
  const isLogin = pathname === "/login" || pathname === "/client-login";
  const isAuthCallback = pathname.startsWith("/auth");
  const isPortal = pathname.startsWith("/portal");
  const isInboundApi = pathname.startsWith("/api/leads/inbound");

  if (!user && !isLogin && !isAuthCallback && !isPortal && !isInboundApi) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = loginPath;
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
