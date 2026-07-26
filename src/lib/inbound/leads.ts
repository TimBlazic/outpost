import type { Activity, Lead, Note } from "@/lib/data";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import {
  getActivities,
  getLeads,
  getNotes,
  saveActivities,
  saveLeads,
  saveNotes,
  syncLeadNoteCount,
} from "@/lib/store";

export type InboundLeadPayload = {
  name: string;
  email: string;
  /** Stable key from the site form, e.g. website | webapp | mobile | ecommerce | other */
  projectType?: string;
  /** Human label (optional, for the note body) */
  projectTypeLabel?: string;
  /** Stable key, e.g. b1…b5 */
  budget?: string;
  /** Human label (optional) */
  budgetLabel?: string;
  message: string;
  locale?: string;
  source?: string;
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  website: "Website",
  webapp: "Web app",
  mobile: "Mobile app",
  ecommerce: "Shopify store",
  other: "Other",
};

const BUDGET_LABELS: Record<string, string> = {
  b1: "up to €1,000",
  b2: "€1,000–3,000",
  b3: "€3,000–10,000",
  b4: "€10,000+",
  b5: "Not sure yet",
};

const BUDGET_VALUES: Record<string, number> = {
  b1: 1000,
  b2: 2000,
  b3: 6500,
  b4: 12000,
  b5: 0,
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapCategory(projectType: string | undefined): Lead["category"] {
  switch (projectType) {
    case "ecommerce":
      return "E-commerce";
    case "webapp":
    case "mobile":
      return "SaaS";
    case "website":
    case "other":
    default:
      return "Local business";
  }
}

function projectTypeTag(projectType: string | undefined) {
  switch (projectType) {
    case "website":
      return "website-project";
    case "webapp":
      return "web-app";
    case "mobile":
      return "mobile";
    case "ecommerce":
      return "shopify";
    default:
      return "other";
  }
}

function resolveLabel(
  key: string | undefined,
  labels: Record<string, string>,
  fallback?: string
) {
  if (!key) return fallback || "—";
  return fallback || labels[key] || key;
}

function buildNoteBody(payload: InboundLeadPayload) {
  const typeLabel = resolveLabel(
    payload.projectType,
    PROJECT_TYPE_LABELS,
    payload.projectTypeLabel
  );
  const budgetLabel = resolveLabel(
    payload.budget,
    BUDGET_LABELS,
    payload.budgetLabel
  );

  return [
    `**Type:** ${typeLabel}`,
    `**Budget:** ${budgetLabel}`,
    payload.locale ? `**Locale:** ${payload.locale}` : null,
    "",
    "**Message:**",
    payload.message.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function createInboundLead(payload: InboundLeadPayload) {
  const name = payload.name.trim();
  const email = payload.email.trim().toLowerCase();
  const message = payload.message.trim();
  if (!name || !email || !message) {
    throw new Error("name, email and message are required");
  }

  const projectType = payload.projectType?.trim() || "other";
  const budgetKey = payload.budget?.trim() || "";
  const value = BUDGET_VALUES[budgetKey] ?? 0;
  const now = today();
  const leadId = uid("l");
  const noteId = uid("n");
  const activityId = uid("a");
  const ownerId = process.env.OUTPOST_DEFAULT_OWNER_ID || "u1";

  const typeLabel = resolveLabel(
    projectType,
    PROJECT_TYPE_LABELS,
    payload.projectTypeLabel
  );
  const budgetLabel = resolveLabel(
    budgetKey,
    BUDGET_LABELS,
    payload.budgetLabel
  );

  const description = [
    "**Source:** Website inquiry (timblazic.dev)",
    `**Type:** ${typeLabel}`,
    `**Budget:** ${budgetLabel}`,
    payload.locale ? `**Locale:** ${payload.locale}` : null,
    "",
    "**Message:**",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const lead: Lead = {
    id: leadId,
    company: name,
    website: "",
    contact: name,
    email,
    phone: "",
    country: "",
    category: mapCategory(projectType),
    source: "Website",
    ownerId,
    status: "New",
    value,
    probability: 70,
    firstContact: now,
    lastContact: now,
    nextFollowUp: now,
    // from-website = channel (hottest leads); project type is separate
    tags: ["hot", "from-website", projectTypeTag(projectType)].filter(
      (t, i, arr) => arr.indexOf(t) === i
    ),
    notes: 1,
    createdBy: "website",
    description,
    qualifyScore: null,
    qualifyRating: null,
  };

  const note: Note = {
    id: noteId,
    leadId,
    title: "Website inquiry",
    body: buildNoteBody({ ...payload, projectType, budget: budgetKey }),
    pinned: true,
    date: now,
    userId: "website",
  };

  const activity: Activity = {
    id: activityId,
    leadId,
    type: "note",
    title: "Inbound inquiry from timblazic.dev",
    detail: resolveLabel(
      projectType,
      PROJECT_TYPE_LABELS,
      payload.projectTypeLabel
    ),
    date: now,
    userId: "website",
  };

  if (isSupabaseEnabled()) {
    if (!hasAdminClient()) {
      throw new Error(
        "Inbound API needs SUPABASE_SERVICE_ROLE_KEY when Supabase is enabled"
      );
    }
    const supabase = createAdminClient();
    const { error: leadErr } = await supabase.from("leads").upsert({
      id: lead.id,
      company: lead.company,
      website: lead.website,
      contact: lead.contact,
      email: lead.email,
      phone: lead.phone,
      country: lead.country,
      category: lead.category,
      source: lead.source,
      owner_id: lead.ownerId,
      status: lead.status,
      value: lead.value,
      probability: lead.probability,
      first_contact: lead.firstContact,
      last_contact: lead.lastContact,
      next_follow_up: lead.nextFollowUp,
      tags: lead.tags,
      created_by: lead.createdBy,
      description: lead.description,
    });
    if (leadErr) throw new Error(leadErr.message);

    const { error: noteErr } = await supabase.from("notes").upsert({
      id: note.id,
      lead_id: note.leadId,
      title: note.title,
      body: note.body,
      pinned: note.pinned,
      date: note.date,
      user_id: note.userId,
    });
    if (noteErr) throw new Error(noteErr.message);

    const { error: actErr } = await supabase.from("activities").upsert({
      id: activity.id,
      lead_id: activity.leadId,
      type: activity.type,
      title: activity.title,
      detail: activity.detail ?? null,
      date: activity.date,
      user_id: activity.userId,
    });
    if (actErr) throw new Error(actErr.message);
  } else {
    const leads = await getLeads();
    await saveLeads([lead, ...leads]);
    const notes = await getNotes();
    await saveNotes([note, ...notes]);
    await syncLeadNoteCount(leadId);
    const activities = await getActivities();
    await saveActivities([activity, ...activities]);
  }

  return {
    leadId,
    noteId,
    type: resolveLabel(
      projectType,
      PROJECT_TYPE_LABELS,
      payload.projectTypeLabel
    ),
    budget: resolveLabel(budgetKey, BUDGET_LABELS, payload.budgetLabel),
    value,
  };
}
