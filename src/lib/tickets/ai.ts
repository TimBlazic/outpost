import Anthropic from "@anthropic-ai/sdk";

import {
  ticketPriorities,
  type TicketPriority,
} from "@/lib/data";

export type TicketAiDraft = {
  title: string;
  description: string;
  priority: TicketPriority;
  tags: string[];
};

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function stripFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizePriority(raw: unknown): TicketPriority {
  const s = String(raw ?? "").trim();
  if (ticketPriorities.includes(s as TicketPriority)) {
    return s as TicketPriority;
  }
  const lower = s.toLowerCase();
  if (lower === "high" || lower === "visoka") return "High";
  if (lower === "low" || lower === "nizka") return "Low";
  return "Medium";
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

export function parseTicketDrafts(text: string): TicketAiDraft[] {
  const parsed = JSON.parse(stripFence(text)) as {
    tickets?: Array<{
      title?: string;
      description?: string;
      priority?: string;
      tags?: string[];
    }>;
  };
  const tickets = (parsed.tickets ?? [])
    .map((t) => ({
      title: String(t.title ?? "").trim(),
      description: String(t.description ?? "").trim(),
      priority: normalizePriority(t.priority),
      tags: normalizeTags(t.tags),
    }))
    .filter((t) => t.title.length > 0);
  if (!tickets.length) throw new Error("AI returned no tickets");
  return tickets.slice(0, 20);
}

export async function generateTicketDrafts(input: {
  project: {
    name: string;
    type: string;
    description: string;
    phase: string;
    status: string;
    client: string;
  };
  existingTitles: string[];
  instruction?: string | null;
  phaseHints?: string[];
  locale: "en" | "sl";
}): Promise<TicketAiDraft[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local to generate tickets."
    );
  }

  const client = new Anthropic({ apiKey });
  const existing = input.existingTitles.filter(Boolean);
  const hints = input.phaseHints?.filter(Boolean) ?? [];
  const instruction = input.instruction?.trim() || "";
  const localeLabel = input.locale === "sl" ? "Slovenian" : "English";

  const system = `You help a small studio plan project tickets.
Return ONLY valid JSON:
{"tickets":[{"title":string,"description":string,"priority":"Low"|"Medium"|"High","tags":string[]}]}
Rules:
- Write EVERY title and description in ${localeLabel} only
- 6–12 tickets when board is empty; fewer (3–8) when filling gaps
- Concrete, actionable titles; short descriptions (1–3 sentences)
- priority: Low | Medium | High (English enum keys only)
- tags: 0–3 short lowercase labels (same language as titles), e.g. design, seo, client
- Do NOT duplicate or rephrase existingTitles
- Prefer studio delivery work over fluff meetings
- No markdown fences outside JSON`;

  const user = JSON.stringify({
    project: input.project,
    existingTitles: existing,
    phaseHints: hints,
    instruction: instruction || null,
    locale: input.locale,
    mode: instruction
      ? "refine_or_extend_based_on_instruction"
      : existing.length
        ? "fill_gaps"
        : "kickoff",
  });

  const res = await client.messages.create({
    model: modelId(),
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseTicketDrafts(text);
}
