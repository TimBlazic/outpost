"use server";

import {
  addActivity,
  addNote,
  createLead,
} from "@/lib/actions";
import { getCurrentProfile, requireStudioSession } from "@/lib/auth/session";
import type { Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import { getFirmSettings } from "@/lib/store";
import { applyQualifyToLead } from "./apply";
import {
  bulkEnqueueSelectedLeads,
  bulkEnqueueUnscoredLeads,
  countActiveQualifyJobs,
  enqueueLeadQualify,
  isLeadQualifyQueued,
} from "./jobs";
import { qualifyLead, requalifyWithCompanywall } from "./orchestrate";
import type { QualifyRating, QualifyResult } from "./types";
import { runQualifyDraft } from "./verdict";

export async function runLeadQualifyAction(input: {
  websiteUrl: string;
  companywallUrl?: string;
  knownCompanyName?: string;
}): Promise<QualifyResult> {
  await requireStudioSession();
  return qualifyLead({
    websiteUrl: input.websiteUrl,
    companywallUrl: input.companywallUrl?.trim() || null,
    knownCompanyName: input.knownCompanyName?.trim() || null,
  });
}

/** Paste correct Companywall URL → re-scrape + verdict + draft only. */
export async function requalifyWithCompanywallAction(input: {
  previous: QualifyResult;
  companywallUrl: string;
}): Promise<QualifyResult> {
  await requireStudioSession();
  return requalifyWithCompanywall({
    previous: input.previous,
    companywallUrl: input.companywallUrl,
  });
}

export async function reviseQualifyDraftAction(input: {
  website: string;
  suggested: QualifyResult["suggested"];
  draft: { subject: string; body: string };
  revisionNotes: string;
}): Promise<{ subject: string; body: string }> {
  await requireStudioSession();
  const [settings, profile] = await Promise.all([
    getFirmSettings(),
    getCurrentProfile(),
  ]);
  return runQualifyDraft({
    website: input.website,
    suggested: input.suggested,
    settings,
    senderName: profile.name?.split(" ")[0] || settings.firmName || "Tim",
    revisionNotes: input.revisionNotes,
    previousDraft: input.draft,
  });
}

export async function saveQualifiedLeadAction(input: {
  company: string;
  website: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  category: Lead["category"];
  status: LeadStatus;
  value: number;
  description: string;
  draftSubject: string;
  draftBody: string;
  saveDraftNote: boolean;
  qualifyScore?: number | null;
  qualifyRating?: QualifyRating | null;
}): Promise<{ leadId: string }> {
  const me = await requireStudioSession();
  const category = leadCategories.includes(input.category)
    ? input.category
    : "Local business";

  const leadId = await createLead({
    company: input.company.trim() || "Unknown",
    website: input.website.trim(),
    contact: input.contact.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    country: input.country.trim(),
    category,
    source: "Cold email",
    ownerId: me.id,
    status: input.status,
    value: Number.isFinite(input.value) ? input.value : 0,
    probability: input.status === "Ready to contact" ? 30 : 15,
    nextFollowUp: null,
    tags: ["qualified"],
    description: input.description,
    qualifyScore: input.qualifyScore ?? null,
    qualifyRating: input.qualifyRating ?? null,
  });

  await addActivity(leadId, {
    type: "note",
    title: "Qualified from URL",
    detail: input.website,
  });

  if (input.saveDraftNote && input.draftBody.trim()) {
    await addNote(leadId, {
      title: input.draftSubject.trim() || "Cold email draft",
      body: input.draftBody,
      pinned: false,
    });
  }

  return { leadId };
}

/** Run full research on an existing lead and auto-apply (no review gate). */
export async function qualifyExistingLeadAction(leadId: string): Promise<{
  rating: QualifyRating;
  status: LeadStatus;
}> {
  await requireStudioSession();
  return applyQualifyToLead(leadId);
}

export async function enqueueLeadQualifyAction(
  leadId: string,
  opts?: { force?: boolean }
) {
  await requireStudioSession();
  return enqueueLeadQualify(leadId, opts);
}

export async function bulkEnqueueUnscoredLeadsAction() {
  await requireStudioSession();
  return bulkEnqueueUnscoredLeads();
}

export async function bulkEnqueueSelectedLeadsAction(leadIds: string[]) {
  await requireStudioSession();
  return bulkEnqueueSelectedLeads(leadIds);
}

export async function getQualifyJobCountsAction() {
  await requireStudioSession();
  return countActiveQualifyJobs();
}

export async function isLeadQualifyQueuedAction(leadId: string) {
  await requireStudioSession();
  return isLeadQualifyQueued(leadId);
}
