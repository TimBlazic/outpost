import { revalidatePath } from "next/cache";

import { addActivity, addNote } from "@/lib/actions";
import type { Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import { hasAdminClient } from "@/lib/supabase/admin";
import { getLeadById, getLeads, saveLeads } from "@/lib/store";
import {
  adminGetLeadById,
  adminInsertActivity,
  adminInsertNote,
  adminUpsertLead,
} from "./admin-db";
import { qualifyLead } from "./orchestrate";
import { computeFitScore } from "./score";
import type { QualifyRating } from "./types";
import { clampSloveniaDealValue } from "./value";

function statusForRating(
  rating: QualifyRating,
  current: LeadStatus
): LeadStatus {
  if (rating === "go") return "Ready to contact";
  if (rating === "maybe") return "Researching";
  return current;
}

async function loadLead(leadId: string): Promise<Lead | undefined> {
  if (hasAdminClient()) {
    return (await adminGetLeadById(leadId)) ?? undefined;
  }
  return getLeadById(leadId);
}

/** Session-free auto-apply — safe for cron / after(). */
export async function applyQualifyToLead(leadId: string): Promise<{
  rating: QualifyRating;
  status: LeadStatus;
}> {
  const lead = await loadLead(leadId);
  if (!lead) throw new Error("Lead not found");
  if (!lead.website?.trim() && !lead.company?.trim()) {
    throw new Error("Lead needs a company name or website to qualify");
  }

  const result = await qualifyLead({
    websiteUrl: lead.website?.trim() || null,
    knownCompanyName: lead.company,
    leadContext: [
      lead.category ? `Category: ${lead.category}` : null,
      lead.country ? `Country: ${lead.country}` : null,
      lead.contact ? `Contact: ${lead.contact}` : null,
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Phone: ${lead.phone}` : null,
      lead.description?.trim()
        ? `Existing notes:\n${lead.description.trim().slice(0, 1200)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    // Background jobs already know the lead — skip all-leads duplicate scan.
    skipDuplicateScan: true,
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
  const nextCompany = (() => {
    const suggested = s.company.trim();
    if (!suggested) return lead.company;
    if (!lead.company.trim()) return suggested;
    if (cwTrusted && result.identity.confidence >= 55) return suggested;
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

  const nextLead: Lead = {
    ...lead,
    company: nextCompany,
    website: result.website.trim() || lead.website,
    contact: s.contact.trim() || lead.contact,
    email: s.email.trim() || lead.email,
    phone: s.phone.trim() || lead.phone,
    country: s.country.trim() || lead.country,
    category,
    status,
    value:
      sloveniaValue > 0
        ? sloveniaValue
        : lead.value > 0
          ? lead.value
          : sloveniaValue,
    probability:
      status === "Ready to contact"
        ? Math.max(lead.probability, 30)
        : status === "Researching"
          ? Math.max(lead.probability, 15)
          : lead.probability,
    tags: [...tags],
    description: s.description.trim() || lead.description,
    qualifyScore,
    qualifyRating: rating,
  };

  const actorId = lead.ownerId || lead.createdBy || "u1";

  if (hasAdminClient()) {
    await adminUpsertLead(nextLead);
    await adminInsertActivity(
      leadId,
      {
        type: "note",
        title: `Qualified in background (${rating})`,
        detail: result.website.trim() || lead.company,
      },
      actorId
    );
    if (result.draft.body.trim()) {
      await adminInsertNote(
        leadId,
        {
          title: result.draft.subject.trim() || "Cold email draft",
          body: result.draft.body,
          pinned: true,
        },
        actorId
      );
    }
  } else {
    const leads = await getLeads();
    await saveLeads(leads.map((l) => (l.id === leadId ? nextLead : l)));
    await addActivity(leadId, {
      type: "note",
      title: `Qualified in background (${rating})`,
      detail: result.website.trim() || lead.company,
    });
    if (result.draft.body.trim()) {
      await addNote(leadId, {
        title: result.draft.subject.trim() || "Cold email draft",
        body: result.draft.body,
        pinned: true,
      });
    }
  }

  try {
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/hunt");
    revalidatePath("/");
  } catch {
    // Cron / scripts may run outside a full Next render context.
  }

  return { rating, status };
}
