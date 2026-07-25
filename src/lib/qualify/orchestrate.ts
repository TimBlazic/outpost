import { getCurrentProfile, requireStudioSession } from "@/lib/auth/session";
import { getFirmSettings, getLeads } from "@/lib/store";
import { lookupCompanywall } from "./companywall";
import { fetchSite } from "./fetch-site";
import { runPageSpeed } from "./pagespeed";
import { compileResearchMarkdown } from "./research-markdown";
import type { QualifyResult } from "./types";
import { findLeadIdByWebsiteHost, normalizeWebsiteUrl, websiteHost } from "./url";
import { runQualifyDraft, runQualifyVerdict } from "./verdict";

export async function qualifyLead(input: {
  websiteUrl: string;
  companywallUrl?: string | null;
}): Promise<QualifyResult> {
  await requireStudioSession();
  const website = normalizeWebsiteUrl(input.websiteUrl);
  const host = websiteHost(website);

  const [site, lighthouse, leads, settings, profile] = await Promise.all([
    fetchSite(website),
    runPageSpeed(website),
    getLeads(),
    getFirmSettings(),
    getCurrentProfile(),
  ]);

  const companyGuess =
    site.companyNameHint ||
    site.title?.split(/[|\-–—]/)[0]?.trim() ||
    host;

  const companywall = await lookupCompanywall({
    companyName: companyGuess,
    domain: host,
    companywallUrl: input.companywallUrl,
  });

  const ai = await runQualifyVerdict({
    website,
    site,
    lighthouse,
    companywall,
  });

  const description = compileResearchMarkdown({
    website,
    site,
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
    lighthouse,
    companywall,
    verdict: ai.verdict,
    draft,
    suggested,
    duplicateLeadId: findLeadIdByWebsiteHost(leads, host),
  };
}
