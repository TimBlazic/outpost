import { getCurrentProfile } from "@/lib/auth/session";
import { getFirmSettings, getLeads } from "@/lib/store";
import { lookupCompanywall } from "./companywall";
import { fetchSite } from "./fetch-site";
import { extractCompanyIdentity } from "./identity";
import { runPageSpeed } from "./pagespeed";
import { compileResearchMarkdown } from "./research-markdown";
import type {
  QualifyIdentityResult,
  QualifyLighthouseResult,
  QualifyResult,
  QualifySiteResult,
} from "./types";
import { findLeadIdByWebsiteHost, normalizeWebsiteUrl, websiteHost } from "./url";
import { runQualifyDraft, runQualifyVerdict } from "./verdict";

function emptySite(error: string): QualifySiteResult {
  return {
    title: null,
    description: null,
    companyNameHint: null,
    identitySnippets: [],
    excerpt: "",
    emails: [],
    phones: [],
    error,
  };
}

function identityFromName(name: string): QualifyIdentityResult {
  return {
    companyName: name,
    tradeName: null,
    confidence: 65,
    source: "heuristic",
    notes: "Qualified from company name (no website)",
  };
}

export async function qualifyLead(input: {
  websiteUrl?: string | null;
  companywallUrl?: string | null;
  /** Prior name from Hunt / CRM — used before Companywall search. */
  knownCompanyName?: string | null;
  /** Extra CRM context when site is missing (category, notes…). */
  leadContext?: string | null;
}): Promise<QualifyResult> {
  const known = input.knownCompanyName?.trim() || null;
  const rawUrl = input.websiteUrl?.trim() || "";
  if (!rawUrl && !known) {
    throw new Error("Company name or website is required to qualify");
  }

  const [leads, settings, profile] = await Promise.all([
    getLeads(),
    getFirmSettings(),
    getCurrentProfile(),
  ]);

  let website = "";
  let host = "";
  let site: QualifySiteResult;
  let lighthouse: QualifyLighthouseResult;
  let identity: QualifyIdentityResult;

  if (rawUrl) {
    website = normalizeWebsiteUrl(rawUrl);
    host = websiteHost(website);
    const [fetchedSite, fetchedLh] = await Promise.all([
      fetchSite(website),
      runPageSpeed(website),
    ]);
    site = fetchedSite;
    lighthouse = fetchedLh;
    identity = await extractCompanyIdentity({
      website,
      site,
      knownCompanyName: known,
    });
  } else {
    site = emptySite("No website on lead");
    lighthouse = { status: "skipped", error: "No website" };
    identity = identityFromName(known!);
  }

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
    leadContext: input.leadContext ?? null,
    hasWebsite: Boolean(website),
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
    duplicateLeadId: host ? findLeadIdByWebsiteHost(leads, host) : null,
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
  const cwUrl = input.companywallUrl.trim();
  if (!cwUrl) {
    throw new Error("Paste a Companywall URL first");
  }

  const { previous } = input;
  let host = "";
  try {
    if (previous.website.trim()) host = websiteHost(previous.website);
  } catch {
    host = "";
  }

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
    hasWebsite: Boolean(previous.website.trim()),
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
