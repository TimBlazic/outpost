export function normalizeWebsiteUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Website URL is required");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    throw new Error("Invalid website URL");
  }
  if (!u.hostname.includes(".")) throw new Error("Invalid website URL");
  u.hash = "";
  const href = u.toString();
  return href.endsWith("/") && u.pathname === "/"
    ? href.slice(0, -1)
    : href.replace(/\/$/, "");
}

export function websiteHost(url: string): string {
  return new URL(normalizeWebsiteUrl(url)).hostname
    .replace(/^www\./i, "")
    .toLowerCase();
}

export function findLeadIdByWebsiteHost(
  leads: { id: string; website: string }[],
  host: string
): string | null {
  const target = host.replace(/^www\./i, "").toLowerCase();
  for (const lead of leads) {
    if (!lead.website?.trim()) continue;
    try {
      if (websiteHost(lead.website) === target) return lead.id;
    } catch {
      /* ignore bad stored urls */
    }
  }
  return null;
}
