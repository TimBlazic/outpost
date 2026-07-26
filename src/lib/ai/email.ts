import Anthropic from "@anthropic-ai/sdk";

import { DEFAULT_AI_EMAIL_SYSTEM_PROMPT } from "@/lib/ai/default-email-prompt";
import { parseActivityDetail } from "@/lib/activity-detail";
import type { Activity, FirmSettings, Lead } from "@/lib/data";

export type EmailIntent = "auto" | "cold" | "follow_up" | "custom";

export type EmailApproach = "cold" | "follow_up" | "check_in" | "custom";

export type GeneratedEmail = {
  subject: string;
  body: string;
  /** What the model decided to write (especially when intent is auto). */
  approach: EmailApproach;
};

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function formatActivitiesForPrompt(activities: Activity[]): string {
  const sorted = [...activities].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );

  const blocks: string[] = [];
  let emailCount = 0;

  for (const a of sorted) {
    if (blocks.length >= 20) break;
    const parsed = parseActivityDetail(a.detail);

    if (a.type === "email" && parsed?.kind === "email") {
      emailCount += 1;
      if (emailCount > 5) continue; // keep last 5 full outbound emails
      blocks.push(
        [
          `### Prior email (${a.date})`,
          `To: ${parsed.to || "(unknown)"}`,
          `Subject: ${parsed.subject || a.title}`,
          parsed.followUpOn ? `Follow-up set: ${parsed.followUpOn}` : null,
          "Body:",
          parsed.body || "(empty)",
        ]
          .filter(Boolean)
          .join("\n")
      );
      continue;
    }

    const preview =
      parsed?.kind === "text"
        ? parsed.text.slice(0, 280)
        : a.detail?.startsWith("{")
          ? ""
          : (a.detail ?? "").slice(0, 280);
    blocks.push(
      `- ${a.date} · ${a.type}: ${a.title}${preview ? ` — ${preview}` : ""}`
    );
  }

  return blocks.join("\n\n") || "(none)";
}

function buildUserMessage(input: {
  lead: Lead;
  intent: EmailIntent;
  brief: string;
  activities: Activity[];
  senderName: string;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}) {
  const {
    lead,
    intent,
    brief,
    activities,
    senderName,
    revisionNotes,
    previousDraft,
  } = input;

  const sentEmails = activities.filter((a) => a.type === "email").length;

  const parts = [
    `Intent mode: ${intent}`,
    intent === "auto"
      ? "Choose the right approach from the research + prior emails (see rules below)."
      : `Write as: ${intent}.`,
    `Sender name: ${senderName}`,
    `Prior outbound emails on this lead: ${sentEmails}`,
    "",
    "Lead:",
    `- Company: ${lead.company}`,
    `- Contact: ${lead.contact || "(unknown)"}`,
    `- Email: ${lead.email || "(none)"}`,
    `- Website: ${lead.website || "(none)"}`,
    `- Country: ${lead.country || "(none)"}`,
    `- Category: ${lead.category || "(none)"}`,
    `- Source: ${lead.source || "(none)"}`,
    `- Status: ${lead.status}`,
    `- Est. value: €${lead.value}`,
    `- Tags: ${lead.tags?.length ? lead.tags.join(", ") : "(none)"}`,
    `- Last contact: ${lead.lastContact || "(none)"}`,
    `- Next follow-up: ${lead.nextFollowUp || "(none)"}`,
    "",
    "Full description / research notes (use this — site, Lighthouse, Companywall, AI notes):",
    lead.description?.trim() || "(none)",
    "",
    "Activity history (newest first). Prior emails include full subject + body:",
    formatActivitiesForPrompt(activities),
    "",
    "User brief (optional angle — may be empty):",
    brief.trim() || "(none)",
  ];

  if (previousDraft?.subject || previousDraft?.body) {
    parts.push(
      "",
      "Previous draft to revise:",
      `Subject: ${previousDraft.subject || "(empty)"}`,
      "Body:",
      previousDraft.body || "(empty)"
    );
  }

  if (revisionNotes?.trim()) {
    parts.push(
      "",
      "Revision instructions (apply these to the new draft):",
      revisionNotes.trim()
    );
  }

  parts.push(
    "",
    "Approach selection (required in JSON as \"approach\"):",
    '- "cold" — no prior outbound email, or only research/status noise; first real outreach.',
    '- "follow_up" — we already sent at least one email; bump or continue the thread without re-pitching from zero.',
    '- "check_in" — soft re-open after a longer gap or after a maybe/no reply situation.',
    '- "custom" — only when intent mode is custom or the brief demands a totally different angle.',
    "When intent mode is auto: pick cold / follow_up / check_in from the evidence above. Do not invent prior emails.",
    "When intent mode is cold|follow_up|custom: honor that mode (map custom → approach custom).",
    "",
    "Writing constraints for this draft:",
    "- Ground claims in the research notes and prior emails. Do not invent audits or metrics.",
    "- If prior emails exist, do not restart as a cold first touch; reference the thread lightly.",
    "- Do not open with \"after reviewing/looking at your site/company\" (or Slovenian \"Po pregledu/ogledu…\").",
    "- Do not paste company name or website URL into the body unless the brief asks for it; prefer \"your site\" / \"vaša stran\".",
    "- If company/website looks odd or misspelled, never echo it — use first name + \"you\" / \"your team\".",
    "",
    'Respond with JSON only: {"subject":"...","body":"...","approach":"cold"|"follow_up"|"check_in"|"custom"}'
  );

  return parts.join("\n");
}

/** Strip em/en dashes models love to sneak in. */
function stripDashes(s: string) {
  return s.replace(/[\u2013\u2014]/g, ", ");
}

function normalizeApproach(
  raw: unknown,
  intent: EmailIntent
): EmailApproach {
  const v = String(raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (v === "cold" || v === "follow_up" || v === "check_in" || v === "custom") {
    return v;
  }
  if (intent === "follow_up") return "follow_up";
  if (intent === "custom") return "custom";
  if (intent === "cold") return "cold";
  return "cold";
}

function parseEmailJson(text: string, intent: EmailIntent): GeneratedEmail {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      subject?: string;
      body?: string;
      approach?: string;
    };
    if (parsed.subject && parsed.body) {
      return {
        subject: stripDashes(String(parsed.subject).trim()),
        body: stripDashes(String(parsed.body).trim()),
        approach: normalizeApproach(parsed.approach, intent),
      };
    }
  } catch {
    /* fall through */
  }
  // Fallback: treat whole response as body
  const lines = cleaned.split("\n");
  const subjectLine = lines.find((l) => /^subject\s*:/i.test(l));
  if (subjectLine) {
    const subject = subjectLine.replace(/^subject\s*:/i, "").trim();
    const body = lines
      .filter((l) => l !== subjectLine)
      .join("\n")
      .replace(/^body\s*:/i, "")
      .trim();
    return {
      subject: stripDashes(subject || "Quick idea"),
      body: stripDashes(body || cleaned),
      approach: normalizeApproach(undefined, intent),
    };
  }
  return {
    subject: "Quick idea",
    body: stripDashes(cleaned),
    approach: normalizeApproach(undefined, intent),
  };
}

export async function generateLeadEmail(input: {
  lead: Lead;
  intent: EmailIntent;
  brief: string;
  activities: Activity[];
  settings: FirmSettings;
  senderName: string;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local to generate emails."
    );
  }

  const system =
    input.settings.aiEmailSystemPrompt?.trim() ||
    DEFAULT_AI_EMAIL_SYSTEM_PROMPT;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: modelId(),
    max_tokens: 1200,
    system,
    messages: [
      {
        role: "user",
        content: buildUserMessage(input),
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  if (!text.trim()) {
    throw new Error("Model returned an empty response");
  }

  return parseEmailJson(text, input.intent);
}

export function mailtoHref(
  to: string,
  subject: string,
  body: string
): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return to ? `mailto:${encodeURIComponent(to)}?${qs}` : `mailto:?${qs}`;
}
