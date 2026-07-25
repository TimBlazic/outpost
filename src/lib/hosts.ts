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
    isPortalPath(pathname) ||
    pathname.startsWith("/api/files") ||
    pathname.startsWith("/auth")
  );
}
