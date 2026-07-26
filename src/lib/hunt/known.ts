import type { Lead } from "@/lib/data";
import { normalizeCompanyText } from "@/lib/qualify/companywall";
import { websiteHost } from "@/lib/qualify/url";

export type HuntKnownIndex = {
  terminalPlaceIds: Set<string>;
  /** host → lead id */
  hosts: Map<string, string>;
  /** `${normName}|${normCity}` → lead id */
  nameCity: Map<string, string>;
};

export type HuntMatchInput = {
  placeId: string;
  name: string;
  city: string | null;
  website: string | null;
};

export type HuntKnownMatch =
  | { kind: "place" }
  | { kind: "website"; leadId: string }
  | { kind: "name_city"; leadId: string };

/** City from Address: line in description, else null. */
export function extractLeadCitySignal(lead: Lead): string | null {
  const desc = lead.description ?? "";
  const m = desc.match(/^\s*Address:\s*(.+)$/im);
  if (!m) return null;
  const address = m[1].trim();
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const tail = parts[parts.length - 1] ?? "";
  const cityish = tail.replace(/^\d{3,5}\s+/, "").trim();
  const norm = normalizeCompanyText(cityish);
  return norm || null;
}

export function buildHuntKnownIndex(
  leads: Lead[],
  terminalPlaceIds: string[]
): HuntKnownIndex {
  const hosts = new Map<string, string>();
  const nameCity = new Map<string, string>();
  for (const lead of leads) {
    if (lead.website?.trim()) {
      try {
        const host = websiteHost(lead.website);
        if (host && !hosts.has(host)) hosts.set(host, lead.id);
      } catch {
        /* ignore bad urls */
      }
    }
    const city = extractLeadCitySignal(lead);
    if (!city) continue;
    const name = normalizeCompanyText(lead.company);
    if (!name) continue;
    const key = `${name}|${city}`;
    if (!nameCity.has(key)) nameCity.set(key, lead.id);
  }
  return {
    terminalPlaceIds: new Set(terminalPlaceIds),
    hosts,
    nameCity,
  };
}

export function matchKnown(
  index: HuntKnownIndex,
  input: HuntMatchInput
): HuntKnownMatch | null {
  if (index.terminalPlaceIds.has(input.placeId)) {
    return { kind: "place" };
  }
  if (input.website?.trim()) {
    try {
      const host = websiteHost(input.website);
      const leadId = index.hosts.get(host);
      if (leadId) return { kind: "website", leadId };
    } catch {
      /* ignore */
    }
  }
  const cityNorm = input.city ? normalizeCompanyText(input.city) : "";
  const nameNorm = normalizeCompanyText(input.name);
  if (cityNorm && nameNorm) {
    const leadId = index.nameCity.get(`${nameNorm}|${cityNorm}`);
    if (leadId) return { kind: "name_city", leadId };
  }
  return null;
}
