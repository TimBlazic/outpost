import Anthropic from "@anthropic-ai/sdk";

import type { Lead, QuoteLineItem } from "@/lib/data";
import { stripQuoteMarkdown } from "@/lib/quotes/text";

export type QuoteAiDraft = {
  intro: string;
  scope: string;
  notes: string;
  lineItems: QuoteLineItem[];
  validUntil: string | null;
};

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseDraft(text: string, locale: "sl" | "en"): QuoteAiDraft {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as {
    intro?: string;
    scope?: string;
    notes?: string;
    line_items?: Array<{ description?: string; amount?: number }>;
    lineItems?: Array<{ description?: string; amount?: number }>;
    valid_until?: string | null;
    validUntil?: string | null;
  };
  const rawItems = parsed.line_items ?? parsed.lineItems ?? [];
  const lineItems = rawItems
    .map((i) => ({
      description: stripQuoteMarkdown(String(i.description ?? "").trim()),
      amount: Number(i.amount),
    }))
    .filter((i) => i.description && Number.isFinite(i.amount) && i.amount >= 0);

  const scope = stripQuoteMarkdown(String(parsed.scope ?? "").trim());
  if (!scope) {
    throw new Error("AI draft missing scope");
  }

  const validRaw = parsed.valid_until ?? parsed.validUntil;
  let validUntil: string | null = null;
  if (typeof validRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(validRaw)) {
    validUntil = validRaw;
  } else {
    validUntil = plusDays(14);
  }

  if (!lineItems.length) {
    lineItems.push({
      description:
        locale === "sl" ? "Izdelava spletne strani" : "Website build",
      amount: 1200,
    });
  }

  ensureFreeSupportLine(lineItems, locale);

  return {
    intro: "",
    scope,
    notes: stripQuoteMarkdown(String(parsed.notes ?? "").trim()),
    lineItems,
    validUntil,
  };
}

function freeSupportDescription(locale: "sl" | "en") {
  return locale === "sl"
    ? "1 mesec podpore (napake in manjše popravke)"
    : "1 month support (bugs and minor fixes)";
}

function ensureFreeSupportLine(
  lineItems: QuoteLineItem[],
  locale: "sl" | "en"
) {
  const idx = lineItems.findIndex((i) =>
    /podpor|support/i.test(i.description)
  );
  if (idx >= 0) {
    lineItems[idx] = {
      description: freeSupportDescription(locale),
      amount: 0,
    };
    return;
  }
  lineItems.push({
    description: freeSupportDescription(locale),
    amount: 0,
  });
}

export async function generateQuoteDraft(input: {
  lead: Lead | null;
  discoveryNotes: string;
  locale: "sl" | "en";
  lineHints?: QuoteLineItem[];
}): Promise<QuoteAiDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local to generate quotes."
    );
  }

  const localeLabel = input.locale === "sl" ? "Slovenian" : "English";
  const lead = input.lead;
  const hints =
    input.lineHints?.filter((l) => l.description.trim()).map((l) => ({
      description: l.description.trim(),
      amount: l.amount,
    })) ?? [];

  const user = [
    `Write a short personalized project quote in ${localeLabel} only.`,
    "Issuer: Tim Blažič (timblazic.dev) — websites, SEO, light admin/CRM for Slovenian local businesses (salons, shops, services).",
    "Tone: clear, warm, professional. Not salesy. Not an invoice.",
    "",
    "Lead context (already in Outpost — use this; do not ask Tim to retype it):",
    lead
      ? [
          `- Company: ${lead.company}`,
          `- Contact: ${lead.contact || "(unknown)"}`,
          `- Category: ${lead.category}`,
          `- Country: ${lead.country}`,
          `- Website: ${lead.website || "(none)"}`,
          `- Pipeline value hint (€): ${lead.value || "(none)"}`,
          `- Description / research:`,
          lead.description?.trim() || "(none)",
        ].join("\n")
      : "(no lead linked)",
    "",
    "Tim's dump / extra notes (WhatsApp replies, call notes, scope outside the CRM — treat as source of truth for what they asked):",
    input.discoveryNotes.trim() || "(none)",
    "",
    "LINE ITEMS (important):",
    "Break the investment into a clear small list (2–5 paid rows), only what fits this job. Typical buckets:",
    "- Website / redesign / migration",
    "- SEO (on-page, Google Business, basics)",
    "- Admin / booking / content setup",
    "- CRM / forms / automations (only if needed)",
    "- Hosting / care plan (only if mentioned)",
    "Always end with a FREE row amount 0:",
    input.locale === "sl"
      ? '- "1 mesec podpore (napake in manjše popravke)" amount 0 — included after launch; covers bugs and small tweaks, not new features / larger changes.'
      : '- "1 month support (bugs and minor fixes)" amount 0 — included after launch; covers bugs and small tweaks, not new features / larger changes.',
    "Use realistic Slovenia-friendly fixed prices (e.g. simple site ~€800–2500, SEO add-on ~€200–600, admin/CRM modest).",
    "All amounts are VAT-inclusive (z DDV). Do not add a separate VAT line; prices already include VAT.",
    "If Tim named a total budget, split it sensibly across paid rows that sum near that total (ignore the free support row).",
    hints.length
      ? `Tim already sketched these rows — refine labels, keep amounts unless clearly wrong:\n${JSON.stringify(hints)}`
      : "Invent the breakdown from lead + dump; do not output a single lump sum if a breakdown makes sense.",
    "",
    "Also write:",
    "- scope: what's included (phases or short bullets). Plain text only — no markdown (**bold**, headings, backticks). You may briefly mention the included month of support.",
    "- notes: short, plain text only. Include validity (~14 days). Mention that 1 month of free support covers bugs and minor fixes only (not larger new work).",
    "  Next step (adapt to locale, do NOT suggest a call): if everything looks good, they confirm; then I send the first invoice installment; after payment they get portal access to follow progress and project phases.",
    "  Write in first person as Tim (pošljem / I'll send) — never third person ('Tim pošlje' / 'Tim will send').",
    "Do not invent or mention project duration / timeline length — Tim fills that separately if needed.",
    "Do not write a separate intro/cover letter.",
    "",
    "Return JSON only:",
    `{
  "scope": "...",
  "notes": "...",
  "line_items": [{"description":"Izdelava spletne strani","amount":1200},{"description":"Osnovni SEO","amount":300},{"description":"1 mesec podpore (napake in manjše popravke)","amount":0}],
  "valid_until": "YYYY-MM-DD"
}`,
    "Amounts are EUR numbers. Do not invent fake audits. Ground claims in lead + dump.",
  ].join("\n");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: modelId(),
    max_tokens: 2500,
    messages: [{ role: "user", content: user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  try {
    return parseDraft(text, input.locale);
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `Could not parse AI quote: ${e.message}`
        : "Could not parse AI quote"
    );
  }
}
