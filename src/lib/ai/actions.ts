"use server";

import {
  generateLeadEmail,
  type EmailIntent,
  type GeneratedEmail,
} from "@/lib/ai/email";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  getActivitiesForLead,
  getFirmSettings,
  getLeadById,
} from "@/lib/store";

export async function generateLeadEmailAction(input: {
  leadId: string;
  intent: EmailIntent;
  brief?: string;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}): Promise<GeneratedEmail> {
  const lead = await getLeadById(input.leadId);
  if (!lead) throw new Error("Lead not found");

  const [settings, activities, profile] = await Promise.all([
    getFirmSettings(),
    getActivitiesForLead(lead.id),
    getCurrentProfile(),
  ]);

  return generateLeadEmail({
    lead,
    intent: input.intent,
    brief: input.brief ?? "",
    activities,
    settings,
    senderName: profile.name?.split(" ")[0] || settings.firmName || "Tim",
    revisionNotes: input.revisionNotes,
    previousDraft: input.previousDraft,
  });
}
