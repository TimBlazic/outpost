"use server";

import { revalidatePath } from "next/cache";

import {
  addActivity,
  addNote,
  createLead,
} from "@/lib/actions";
import { getCurrentProfile, requireStudioSession } from "@/lib/auth/session";
import type { Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import { getFirmSettings, getLeadById, getLeads, saveLeads } from "@/lib/store";
import { qualifyLead, requalifyWithCompanywall } from "./orchestrate";
import { computeFitScore } from "./score";
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

function statusForRating(
  rating: QualifyRating,
  current: LeadStatus
): LeadStatus {
  if (rating === "go") return "Ready to contact";
  if (rating === "maybe") return "Researching";
  return current;
}

/** Keep deal values realistic for SI indie studio websites. */
function clampSloveniaDealValue(
  value: number,
  category: Lead["category"]
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const localish = [
    "Local business",
    "Restaurant",
    "Healthcare",
    "Real estate",
  ].includes(category);
  const max = localish ? 4500 : 8000;
  const min = 800;
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Run full research on an existing lead and auto-apply (no review gate). */
export async function qualifyExistingLeadAction(leadId: string): Promise<{
  rating: QualifyRating;
  status: LeadStatus;
}> {
  await requireStudioSession();
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error("Lead not found");
  if (!lead.website?.trim()) {
    throw new Error("Lead has no website to qualify");
  }

  const result = await qualifyLead({
    websiteUrl: lead.website,
    knownCompanyName: lead.company,
  });
  const rating = result.verdict.rating;
  const s = result.suggested;
  const category = leadCategories.includes(s.category)
    ? s.category
    : lead.category;
  const status = statusForRating(rating, lead.status);
  const tags = new Set(lead.tags);
  tags.add("qualified");
  if (rating === "no-go") tags.add("no-go");
  else tags.delete("no-go");

  const cwTrusted =
    result.companywall.status === "ok" &&
    (result.companywall.confidence == null ||
      result.companywall.confidence >= 60);
  // Never overwrite a known Hunt/CRM name with a weak / mismatched Companywall hit.
  const nextCompany = (() => {
    const suggested = s.company.trim();
    if (!suggested) return lead.company;
    if (!lead.company.trim()) return suggested;
    if (cwTrusted && result.identity.confidence >= 55) return suggested;
    // Keep original if suggested looks unrelated
    const norm = (x: string) =>
      x
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const a = norm(lead.company);
    const b = norm(suggested);
    const ok =
      a.includes(b) ||
      b.includes(a) ||
      a.split(" ").some((w) => w.length > 3 && b.includes(w));
    return ok ? suggested : lead.company;
  })();

  const sloveniaValue = clampSloveniaDealValue(s.value, category);
  const qualifyScore = computeFitScore(result);

  const leads = await getLeads();
  await saveLeads(
    leads.map((l) =>
      l.id === leadId
        ? {
            ...l,
            company: nextCompany,
            website: result.website || l.website,
            contact: s.contact.trim() || l.contact,
            email: s.email.trim() || l.email,
            phone: s.phone.trim() || l.phone,
            country: s.country.trim() || l.country,
            category,
            status,
            value:
              sloveniaValue > 0
                ? sloveniaValue
                : l.value > 0
                  ? l.value
                  : sloveniaValue,
            probability:
              status === "Ready to contact"
                ? Math.max(l.probability, 30)
                : status === "Researching"
                  ? Math.max(l.probability, 15)
                  : l.probability,
            tags: [...tags],
            description: s.description.trim() || l.description,
            qualifyScore,
            qualifyRating: rating,
          }
        : l
    )
  );

  await addActivity(leadId, {
    type: "note",
    title: `Qualified in background (${rating})`,
    detail: result.website,
  });

  if (result.draft.body.trim()) {
    await addNote(leadId, {
      title: result.draft.subject.trim() || "Cold email draft",
      body: result.draft.body,
      pinned: true,
    });
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/hunt");
  revalidatePath("/");

  return { rating, status };
}
