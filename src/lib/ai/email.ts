import Anthropic from "@anthropic-ai/sdk";

import { DEFAULT_AI_EMAIL_SYSTEM_PROMPT } from "@/lib/ai/default-email-prompt";
import type { Activity, FirmSettings, Lead } from "@/lib/data";

export type EmailIntent = "cold" | "follow_up" | "custom";

export type GeneratedEmail = {
  subject: string;
  body: string;
};

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
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
  const recent = [...activities]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8)
    .map((a) => `- ${a.date} · ${a.type}: ${a.title}${a.detail ? ` — ${a.detail}` : ""}`)
    .join("\n");

  const parts = [
    `Intent: ${intent}`,
    `Sender name: ${senderName}`,
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
    `- Description / research:`,
    lead.description?.trim() || "(none)",
    "",
    "Recent activity:",
    recent || "(none)",
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
    "Writing constraints for this draft:",
    "- Do not open with \"after reviewing/looking at your site/company\" (or Slovenian \"Po pregledu/ogledu…\").",
    "- Do not paste company name or website URL into the body unless the brief asks for it; prefer \"your site\" / \"vaša stran\".",
    "- If company/website looks odd or misspelled, never echo it — use first name + \"you\" / \"your team\".",
    "",
    'Respond with JSON only: {"subject":"...","body":"..."}'
  );

  return parts.join("\n");
}

/** Strip em/en dashes models love to sneak in. */
function stripDashes(s: string) {
  return s.replace(/[\u2013\u2014]/g, ", ");
}

function parseEmailJson(text: string): GeneratedEmail {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
    if (parsed.subject && parsed.body) {
      return {
        subject: stripDashes(String(parsed.subject).trim()),
        body: stripDashes(String(parsed.body).trim()),
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
    };
  }
  return { subject: "Quick idea", body: stripDashes(cleaned) };
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
    max_tokens: 800,
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

  return parseEmailJson(text);
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
