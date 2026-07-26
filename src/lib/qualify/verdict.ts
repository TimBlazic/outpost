import Anthropic from "@anthropic-ai/sdk";

import { generateLeadEmail } from "@/lib/ai/email";
import type { FirmSettings, Lead, LeadStatus } from "@/lib/data";
import { leadCategories } from "@/lib/data";
import type {
  QualifyCompanywallResult,
  QualifyIdentityResult,
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
  identity: QualifyIdentityResult;
  lighthouse: QualifyLighthouseResult;
  companywall: QualifyCompanywallResult;
  leadContext?: string | null;
  hasWebsite?: boolean;
}): Promise<{
  verdict: {
    rating: QualifyRating;
    reasons: string[];
    notesMarkdown: string;
    businessSummary: string;
    offerIdeas: string[];
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

  const hasWebsite = input.hasWebsite ?? Boolean(input.website?.trim());
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: modelId(),
    max_tokens: 1600,
    system: `You qualify Slovenian (and nearby) businesses for a one-person studio that sells website redesigns / new marketing sites, plus related services (custom admin, newsletter, booking, etc.) in Slovenia.
Return ONLY valid JSON with keys:
rating ("go"|"maybe"|"no-go"),
reasons (string array, 3-5 short bullets — why this rating),
notesMarkdown (1-3 short sentences of sales judgment; no headings),
businessSummary (2-4 sentences: what this company does, who they serve${hasWebsite ? ", what the site is for" : ""} — write in English, concrete, from available evidence),
offerIdeas (string array, 3-6 concrete pitches tailored to THIS business — pick from / mix: website redesign, new marketing site, custom admin panel, newsletter / email marketing setup, booking system, SEO / performance fix, e-commerce improvements, landing pages, content refresh. Each item one short line like "Redesign: replace dated WordPress with a fast marketing site"),
company, contact, email, phone, country, category, value (number EUR estimate or 0).
category MUST be one of: ${leadCategories.join(", ")}.
Prefer country "Slovenia" when unclear. Use emails/phones from site / Companywall when present.
For "company", prefer the resolved identity name${hasWebsite ? " that matches THIS website" : ""}. If Companywall looks like a different firm, ignore it for the company field and say so in reasons.
${
  hasWebsite
    ? "When a website exists: judge site quality + finances. Strong modern site → maybe/no-go."
    : `NO WEBSITE on this lead — that is often a strong opportunity (new marketing site), not an automatic no-go.
Use company name + Companywall + any CRM context. Infer industry/services best-effort.
offerIdeas MUST lean into: new marketing website, Google Business / presence, booking, newsletter, simple admin — not "redesign an existing site" unless evidence they have one.
Still no-go if finances look dead, company looks dissolved, or it's clearly not a fit.`
}
Pricing (value) MUST be Slovenia-realistic for a solo studio — NOT US/EU agency rates:
- Local business / restaurant / salon / clinic: typically 1200–3500 EUR (redesign or new marketing site)
- Small SaaS / e-commerce / agency: typically 2500–6000 EUR
- Never suggest above 8000 EUR unless clearly a multi-page web app (still cap mental model at ~8k)
- Prefer round numbers like 1800, 2500, 3200
Always set a realistic value when rating is go or maybe (not 0).
Be honest: weak finances or a strong modern site → maybe/no-go.`,
    messages: [
      {
        role: "user",
        content: [
          hasWebsite
            ? `Website: ${input.website}`
            : "Website: (none — qualify from company name + Companywall)",
          `Resolved identity: ${JSON.stringify(input.identity)}`,
          `Title: ${input.site.title ?? ""}`,
          `Meta: ${input.site.description ?? ""}`,
          `Emails: ${input.site.emails.join(", ")}`,
          `Phones: ${input.site.phones.join(", ")}`,
          `Excerpt: ${input.site.excerpt}`,
          `Lighthouse: ${JSON.stringify(input.lighthouse)}`,
          `Companywall: ${JSON.stringify(input.companywall)}`,
          input.leadContext?.trim()
            ? `CRM context:\n${input.leadContext.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
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

  const offerIdeas = Array.isArray(data.offerIdeas)
    ? data.offerIdeas.map((r) => String(r).trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    verdict: {
      rating,
      reasons,
      notesMarkdown: String(data.notesMarkdown ?? ""),
      businessSummary: String(data.businessSummary ?? "").trim(),
      offerIdeas,
    },
    suggested: {
      company:
        String(data.company ?? "").trim() ||
        (cwTrusted ? input.companywall.matchedName : undefined) ||
        input.identity.companyName ||
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
      value: clampSlValue(
        Number.isFinite(Number(data.value)) ? Number(data.value) : 0,
        category
      ),
      status: statusForRating(rating),
    },
  };
}

function clampSlValue(value: number, category: Lead["category"]): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const localish = [
    "Local business",
    "Restaurant",
    "Healthcare",
    "Real estate",
  ].includes(category);
  const max = localish ? 4500 : 8000;
  return Math.round(Math.min(max, Math.max(800, value)));
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
    createdAt: new Date().toISOString(),
    description: input.suggested.description,
    qualifyScore: null,
    qualifyRating: null,
  };

  return generateLeadEmail({
    lead: synthetic,
    intent: "cold",
    brief: input.website.trim()
      ? "Cold outreach after website + Companywall research."
      : "Cold outreach after company / Companywall research (no website yet — pitch a new site if it fits).",
    activities: [],
    settings: input.settings,
    senderName: input.senderName,
    revisionNotes: input.revisionNotes,
    previousDraft: input.previousDraft,
  });
}
