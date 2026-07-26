import Anthropic from "@anthropic-ai/sdk";

import { docCategories, type DocCategory } from "@/lib/data";

export type DocAiDraft = {
  title: string;
  body: string;
  tags: string[];
  category: DocCategory | null;
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

function normalizeCategory(raw: unknown): DocCategory | null {
  const s = String(raw ?? "").trim();
  if ((docCategories as readonly string[]).includes(s)) {
    return s as DocCategory;
  }
  return null;
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
}

export function parseDocDraft(text: string): DocAiDraft {
  const parsed = JSON.parse(stripFence(text)) as {
    title?: string;
    body?: string;
    tags?: string[];
    category?: string;
  };
  const title = String(parsed.title ?? "").trim();
  const body = String(parsed.body ?? "").trim();
  if (!title && !body) throw new Error("AI returned an empty doc");
  return {
    title: title || "Untitled doc",
    body,
    tags: normalizeTags(parsed.tags),
    category: normalizeCategory(parsed.category),
  };
}

export async function generateDocDraft(input: {
  notes: string;
  category: DocCategory;
  title?: string | null;
  existingBody?: string | null;
}): Promise<DocAiDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local to generate docs."
    );
  }

  const notes = input.notes.trim();
  if (!notes) {
    throw new Error("Add a few notes first so AI knows what to write.");
  }

  const client = new Anthropic({ apiKey });
  const categories = docCategories.join(", ");

  const system = `You write internal studio playbook docs for Outpost (CRM for a small web/SEO studio).
Return ONLY valid JSON:
{"title":string,"body":string,"tags":string[],"category":string|null}
Rules:
- Match the language of the notes (Slovenian or English)
- body: useful markdown (## headings, bullets, numbered steps, **bold** sparingly)
- Practical and concise — checklists, scripts, templates; not fluff
- tags: 1–4 short lowercase labels
- category: one of [${categories}] if clear, else null
- If existingBody is provided, improve/expand it using the notes (do not ignore useful existing content)
- No markdown fences outside JSON`;

  const user = JSON.stringify({
    notes,
    preferredCategory: input.category,
    titleHint: input.title?.trim() || null,
    existingBody: input.existingBody?.trim() || null,
  });

  const res = await client.messages.create({
    model: modelId(),
    max_tokens: 3500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseDocDraft(text);
}
