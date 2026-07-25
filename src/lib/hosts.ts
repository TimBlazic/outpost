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

export function buildPortalPath(token: string) {
  return `/portal/${token}`;
}

/** Absolute portal link. Prefers NEXT_PUBLIC_PORTAL_URL, then fallbackOrigin. */
export function buildPortalUrl(token: string, fallbackOrigin?: string) {
  const base =
    getPortalBaseUrl() || normalizeBase(fallbackOrigin) || getAdminBaseUrl();
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
