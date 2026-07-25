import Anthropic from "@anthropic-ai/sdk";

import { generateLeadEmail } from "@/lib/ai/email";
import type { FirmSettings, Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import type {
  QualifyCompanywallResult,
  QualifyLighthouseResult,
  QualifyRating,
  QualifySiteResult,
} from "./types";

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function statusForRating(rating: QualifyRating): LeadStatus {
  // Always create as a normal pipeline lead — user marks Not suitable later if needed.
  if (rating === "go") return "Ready to contact";
  return "New";
}

function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in model response");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

export async function runQualifyVerdict(input: {
  website: string;
  site: QualifySiteResult;
  lighthouse: QualifyLighthouseResult;
  companywall: QualifyCompanywallResult;
}): Promise<{
  verdict: {
    rating: QualifyRating;
    reasons: string[];
    notesMarkdown: string;
  };
  suggested: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    country: string;
    category: Lead["category"];
    value: number;
    status: LeadStatus;
  };
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local for Qualify."
    );
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: modelId(),
    max_tokens: 1200,
    system: `You qualify Slovenian (and nearby) businesses for a small studio that sells website redesigns / new marketing sites.
Return ONLY valid JSON with keys:
rating ("go"|"maybe"|"no-go"),
reasons (string array, 3-5 short bullets),
notesMarkdown (short markdown),
company, contact, email, phone, country, category, value (number EUR estimate or 0).
category MUST be one of: ${leadCategories.join(", ")}.
Prefer country "Slovenia" when unclear. Use emails/phones from site data when present.
Be honest: weak finances or a strong modern site → maybe/no-go.`,
    messages: [
      {
        role: "user",
        content: [
          `Website: ${input.website}`,
          `Title: ${input.site.title ?? ""}`,
          `Meta: ${input.site.description ?? ""}`,
          `Emails: ${input.site.emails.join(", ")}`,
          `Phones: ${input.site.phones.join(", ")}`,
          `Excerpt: ${input.site.excerpt}`,
          `Lighthouse: ${JSON.stringify(input.lighthouse)}`,
          `Companywall: ${JSON.stringify(input.companywall)}`,
        ].join("\n"),
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const data = parseJsonObject(text);
  const ratingRaw = String(data.rating ?? "maybe");
  const rating: QualifyRating =
    ratingRaw === "go" || ratingRaw === "no-go" ? ratingRaw : "maybe";
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.map((r) => String(r)).filter(Boolean).slice(0, 6)
    : ["No reasons returned"];
  const categoryRaw = String(data.category ?? "Local business");
  const category = (
    leadCategories.includes(categoryRaw as Lead["category"])
      ? categoryRaw
      : "Local business"
  ) as Lead["category"];

  const cwTrusted =
    input.companywall.status === "ok" &&
    (input.companywall.confidence == null ||
      input.companywall.confidence >= 60);
  const emailFromCw = cwTrusted ? input.companywall.email ?? "" : "";
  const phoneFromCw = cwTrusted ? input.companywall.phone ?? "" : "";
  const emailFromSite = input.site.emails[0] ?? "";
  const phoneFromSite = input.site.phones[0] ?? "";
  const contactFromCw = cwTrusted ? input.companywall.owner ?? "" : "";

  return {
    verdict: {
      rating,
      reasons,
      notesMarkdown: String(data.notesMarkdown ?? ""),
    },
    suggested: {
      company:
        String(data.company ?? "").trim() ||
        (cwTrusted ? input.companywall.matchedName : undefined) ||
        input.site.companyNameHint ||
        input.site.title?.split(/[|\-–—]/)[0]?.trim() ||
        input.website,
      contact:
        String(data.contact ?? "").trim() || contactFromCw,
      email:
        String(data.email ?? "").trim() ||
        emailFromCw ||
        emailFromSite,
      phone:
        String(data.phone ?? "").trim() ||
        phoneFromCw ||
        phoneFromSite,
      country: String(data.country ?? "").trim() || "Slovenia",
      category,
      value: Number.isFinite(Number(data.value)) ? Number(data.value) : 0,
      status: statusForRating(rating),
    },
  };
}

export async function runQualifyDraft(input: {
  website: string;
  suggested: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    country: string;
    category: Lead["category"];
    value: number;
    description: string;
    status: LeadStatus;
  };
  settings: FirmSettings;
  senderName: string;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}): Promise<{ subject: string; body: string }> {
  const synthetic: Lead = {
    id: "qualify_tmp",
    company: input.suggested.company,
    website: input.website,
    contact: input.suggested.contact,
    email: input.suggested.email,
    phone: input.suggested.phone,
    country: input.suggested.country,
    category: input.suggested.category,
    source: "Cold email",
    ownerId: "qualify",
    status: input.suggested.status,
    value: input.suggested.value,
    probability: 20,
    firstContact: null,
    lastContact: null,
    nextFollowUp: null,
    tags: ["qualified"],
    notes: 0,
    createdBy: "qualify",
    description: input.suggested.description,
  };

  return generateLeadEmail({
    lead: synthetic,
    intent: "cold",
    brief: "Cold outreach after website + Companywall research.",
    activities: [],
    settings: input.settings,
    senderName: input.senderName,
    revisionNotes: input.revisionNotes,
    previousDraft: input.previousDraft,
  });
}
