import { buildPortalPath, buildPortalUrl, getPortalBaseUrl } from "@/lib/hosts";

export { buildPortalPath, buildPortalUrl, getPortalBaseUrl };

/** Client-side portal URL for a project token. */
export function portalUrlForToken(token: string | null | undefined) {
  if (!token) return "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  return buildPortalUrl(token, origin);
}
