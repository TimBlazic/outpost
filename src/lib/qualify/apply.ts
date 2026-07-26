import { revalidatePath } from "next/cache";

import { addActivity, addNote } from "@/lib/actions";
import type { Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import { getLeadById, getLeads, saveLeads } from "@/lib/store";
import { qualifyLead } from "./orchestrate";
import { computeFitScore } from "./score";
import type { QualifyRating } from "./types";

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

/** Session-free auto-apply — safe for cron / after(). */
export async function applyQualifyToLead(leadId: string): Promise<{
  rating: QualifyRating;
  status: LeadStatus;
}> {
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
