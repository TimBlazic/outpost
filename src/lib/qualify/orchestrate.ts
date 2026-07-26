import { getCurrentProfile, requireStudioSession } from "@/lib/auth/session";
import { getFirmSettings, getLeads } from "@/lib/store";
import { lookupCompanywall } from "./companywall";
import { fetchSite } from "./fetch-site";
import { extractCompanyIdentity } from "./identity";
import { runPageSpeed } from "./pagespeed";
import { compileResearchMarkdown } from "./research-markdown";
import type { QualifyResult } from "./types";
import { findLeadIdByWebsiteHost, normalizeWebsiteUrl, websiteHost } from "./url";
import { runQualifyDraft, runQualifyVerdict } from "./verdict";

export async function qualifyLead(input: {
  websiteUrl: string;
  companywallUrl?: string | null;
  /** Prior name from Hunt / CRM — used before Companywall search. */
  knownCompanyName?: string | null;
}): Promise<QualifyResult> {
  await requireStudioSession();
  const website = normalizeWebsiteUrl(input.websiteUrl);
  const host = websiteHost(website);
  const known = input.knownCompanyName?.trim() || null;

  const [site, lighthouse, leads, settings, profile] = await Promise.all([
    fetchSite(website),
    runPageSpeed(website),
    getLeads(),
    getFirmSettings(),
    getCurrentProfile(),
  ]);

  // Resolve real company name from page (+ known prior) before Companywall.
  const identity = await extractCompanyIdentity({
    website,
    site,
    knownCompanyName: known,
  });

  // Prefer high-confidence identity; fall back to known Maps/CRM name for search.
  const cwQuery =
    identity.confidence >= 55
      ? identity.companyName
      : known || identity.companyName;

  const companywall = await lookupCompanywall({
    companyName: cwQuery,
    domain: host,
    companywallUrl: input.companywallUrl,
  });

  const ai = await runQualifyVerdict({
    website,
    site,
    identity,
    lighthouse,
    companywall,
  });

  const description = compileResearchMarkdown({
    website,
    site,
    identity,
    lighthouse,
    companywall,
    verdict: ai.verdict,
  });

  const suggested = {
    ...ai.suggested,
    source: "Cold email" as const,
    description,
  };

  const senderName =
    profile.name?.split(" ")[0] || settings.firmName || "Tim";

  const draft = await runQualifyDraft({
    website,
    suggested,
    settings,
    senderName,
  });

  return {
    website,
    site,
    identity,
    lighthouse,
    companywall,
    verdict: ai.verdict,
    draft,
    suggested,
    duplicateLeadId: findLeadIdByWebsiteHost(leads, host),
  };
}

/**
 * Re-run only Companywall scrape + AI verdict + draft, keeping site / identity / Lighthouse.
 * Used when auto-match is wrong and the user pastes the correct Companywall URL.
 */
export async function requalifyWithCompanywall(input: {
  previous: QualifyResult;
  companywallUrl: string;
}): Promise<QualifyResult> {
  await requireStudioSession();
  const cwUrl = input.companywallUrl.trim();
  if (!cwUrl) {
    throw new Error("Paste a Companywall URL first");
  }

  const { previous } = input;
  const host = websiteHost(previous.website);

  const [companywall, settings, profile] = await Promise.all([
    lookupCompanywall({
      companyName: previous.identity.companyName,
      domain: host,
      companywallUrl: cwUrl,
    }),
    getFirmSettings(),
    getCurrentProfile(),
  ]);

  const ai = await runQualifyVerdict({
    website: previous.website,
    site: previous.site,
    identity: previous.identity,
    lighthouse: previous.lighthouse,
    companywall,
  });

  const description = compileResearchMarkdown({
    website: previous.website,
    site: previous.site,
    identity: previous.identity,
    lighthouse: previous.lighthouse,
    companywall,
    verdict: ai.verdict,
  });

  const suggested = {
    ...ai.suggested,
    source: "Cold email" as const,
    description,
  };

  const senderName =
    profile.name?.split(" ")[0] || settings.firmName || "Tim";

  const draft = await runQualifyDraft({
    website: previous.website,
    suggested,
    settings,
    senderName,
  });

  return {
    website: previous.website,
    site: previous.site,
    identity: previous.identity,
    lighthouse: previous.lighthouse,
    companywall,
    verdict: ai.verdict,
    draft,
    suggested,
    duplicateLeadId: previous.duplicateLeadId,
  };
}
