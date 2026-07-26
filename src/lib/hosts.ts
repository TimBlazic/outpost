/**
 * Host roles for split deploy:
 * - admin.*  → studio CRM
 * - client.* → client portal
 * - localhost / preview → both (unified)
 */

export type HostRole = "admin" | "client" | "unified";

function stripPort(hostname: string) {
  return hostname.split(":")[0]?.toLowerCase() ?? "";
}

function normalizeBase(url: string | undefined) {
  return (url ?? "").trim().replace(/\/$/, "");
}

function hostnameFromUrl(url: string | undefined) {
  const base = normalizeBase(url);
  if (!base) return "";
  try {
    return stripPort(new URL(base).hostname);
  } catch {
    return "";
  }
}

/** Hostname from Host header or URL, without port. */
export function getRequestHostname(hostHeader: string | null | undefined) {
  return stripPort(hostHeader ?? "");
}

export function getHostRole(hostname: string): HostRole {
  const host = stripPort(hostname);
  if (!host) return "unified";

  const adminHost =
    stripPort(process.env.NEXT_PUBLIC_ADMIN_HOST ?? "") ||
    hostnameFromUrl(process.env.NEXT_PUBLIC_ADMIN_URL);
  const portalHost =
    stripPort(process.env.NEXT_PUBLIC_PORTAL_HOST ?? "") ||
    hostnameFromUrl(process.env.NEXT_PUBLIC_PORTAL_URL);

  if (adminHost && host === adminHost) return "admin";
  if (portalHost && host === portalHost) return "client";

  // Convention when env hosts are unset
  if (host.startsWith("admin.")) return "admin";
  if (host.startsWith("client.")) return "client";

  return "unified";
}

export function getAdminBaseUrl() {
  return normalizeBase(process.env.NEXT_PUBLIC_ADMIN_URL);
}

export function getPortalBaseUrl() {
  return normalizeBase(process.env.NEXT_PUBLIC_PORTAL_URL);
}

/** Resolve the public client-portal origin (login, callback, etc.). */
export function getClientPortalOrigin(requestOrigin?: string) {
  const origin = normalizeBase(requestOrigin);
  if (origin) {
    try {
      const host = stripPort(new URL(origin).hostname);
      if (host === "localhost" || host === "127.0.0.1") {
        return origin;
      }
      if (getHostRole(host) === "client") {
        return origin;
      }
    } catch {
      /* fall through */
    }
  }

  const portal = getPortalBaseUrl();
  if (portal) return portal;
  if (origin) return origin;
  return "http://localhost:3000";
}

/**
 * OTP callback after the client requests a fresh magic link from /client-login.
 * - localhost → stay on local origin (dev)
 * - client host → that origin
 * - otherwise → NEXT_PUBLIC_PORTAL_URL (production client portal)
 */
export function getClientAuthCallbackUrl(
  requestOrigin?: string,
  nextPath: string = "/"
) {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const url = new URL(
    `${getClientPortalOrigin(requestOrigin)}/auth/callback`
  );
  url.searchParams.set("next", next);
  return url.toString();
}

/** Stable URL to share with clients (does not expire). */
export function getClientPortalLoginUrl(
  requestOrigin?: string,
  portalEmail?: string | null,
  portalLocale?: "en" | "sl" | null
) {
  const url = new URL(`${getClientPortalOrigin(requestOrigin)}/client-login`);
  const email = (portalEmail ?? "").trim().toLowerCase();
  if (email) url.searchParams.set("email", email);
  if (portalLocale === "sl") url.searchParams.set("lang", "sl");
  return url.toString();
}

/**
 * When studio runs on admin.*, portal lives on client.* of the same root domain.
 * Prefer NEXT_PUBLIC_PORTAL_URL; otherwise rewrite admin → client from the current origin/host.
 */
export function resolvePortalBaseUrl(fallbackOriginOrHost?: string) {
  const fromEnv = getPortalBaseUrl();
  if (fromEnv) return fromEnv;

  const raw = (fallbackOriginOrHost ?? "").trim();
  if (!raw) return "";

  try {
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(`https://${raw}`);
    const host = stripPort(url.hostname);
    if (host.startsWith("admin.")) {
      url.hostname = `client.${host.slice("admin.".length)}`;
      return normalizeBase(url.origin);
    }
    return normalizeBase(url.origin);
  } catch {
    return normalizeBase(raw);
  }
}

export function buildPortalPath(token: string) {
  return `/portal/${token}`;
}

/** Absolute portal link. Prefers NEXT_PUBLIC_PORTAL_URL, then admin→client rewrite. */
export function buildPortalUrl(token: string, fallbackOrigin?: string) {
  const base = resolvePortalBaseUrl(fallbackOrigin);
  return `${base}${buildPortalPath(token)}`;
}

export function isPortalPath(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

export function isClientHostAllowedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/client-login" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/projects") ||
    isPortalPath(pathname) ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/portal/") ||
    pathname.startsWith("/api/files/")
  );
}
