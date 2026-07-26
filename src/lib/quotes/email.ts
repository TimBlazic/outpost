import Anthropic from "@anthropic-ai/sdk";

import type { Lead, Quote } from "@/lib/data";
import { stripQuoteMarkdown } from "@/lib/quotes/text";

export type QuoteEmailDraft = {
  subject: string;
  body: string;
};

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function parseDraft(text: string): QuoteEmailDraft {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as {
    subject?: string;
    body?: string;
  };
  const subject = stripQuoteMarkdown(String(parsed.subject ?? "").trim());
  const body = stripPricesFromEmail(
    stripQuoteMarkdown(String(parsed.body ?? "").trim())
  );
  if (!subject || !body) {
    throw new Error("AI email missing subject or body");
  }
  return { subject: stripPricesFromEmail(subject), body };
}

/** Drop accidental price mentions — amounts belong in the PDF only. */
function stripPricesFromEmail(raw: string): string {
  return raw
    .replace(/(?:€|EUR|eur)\s*[\d.,]+/g, "")
    .replace(/[\d.,]+\s*(?:€|EUR|eur)/g, "")
    .replace(
      /(?:skupaj|total|cena|znesek|price|amount)\s*[:\-]?\s*[\d.,]+\s*(?:€|EUR)?/gi,
      ""
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackDraft(quote: Quote): QuoteEmailDraft {
  const sl = quote.locale === "sl";
  const name = quote.clientName.trim().split(/\s+/)[0] || "";
  const number = quote.number || "";
  if (sl) {
    return {
      subject: number
        ? `Ponudba ${number}`
        : "Ponudba za spletni projekt",
      body: [
        name ? `Pozdravljeni ${name},` : "Pozdravljeni,",
        "",
        "v prilogi vam pošiljam ponudbo za dogovorjeni projekt.",
        "Če je vse v redu, mi prosim potrdite — nato vam pošljem prvi del računa.",
        "",
        "Lep pozdrav",
      ].join("\n"),
    };
  }
  return {
    subject: number ? `Quote ${number}` : "Project quote",
    body: [
      name ? `Hi ${name},` : "Hi,",
      "",
      "Please find the project quote attached.",
      "If everything looks good, reply to confirm — I'll then send the first invoice installment.",
      "",
      "Best regards",
    ].join("\n"),
  };
}

export async function generateQuoteEmail(input: {
  quote: Quote;
  lead: Lead | null;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}): Promise<QuoteEmailDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return fallbackDraft(input.quote);
  }

  const quote = input.quote;
  const sl = quote.locale === "sl";
  const localeLabel = sl ? "Slovenian" : "English";
  const lead = input.lead;

  const user = [
    `Write a short email in ${localeLabel} that sends a project quote PDF.`,
    "Sender: Tim Blažič (first person: pošiljam / I'm sending). Never third person.",
    "Tone: clear, warm, professional. Not salesy. Short — a few short paragraphs.",
    "Mention the PDF is attached. Do not paste the full quote body or line items.",
    "IMPORTANT: Do NOT mention any price, amount, total, EUR, €, or cost in subject or body — pricing is only in the attached PDF.",
    "CTA: if it looks good, confirm; then I'll send the first invoice installment; after payment they get portal access.",
    "Do not invent a call. Do not use markdown.",
    "",
    "Quote (context only — do not put prices in the email):",
    `- Number: ${quote.number || "(draft)"}`,
    `- Client name: ${quote.clientName || "(none)"}`,
    `- Company: ${quote.clientCompany || "(none)"}`,
    `- Duration estimate: ${quote.projectDuration.trim() || "(not set — do not invent)"}`,
    `- Scope summary (for tone only; keep email short):`,
    quote.scope.trim().slice(0, 400) || "(none)",
    "",
    "Lead context:",
    lead
      ? [
          `- Company: ${lead.company}`,
          `- Contact: ${lead.contact || "(unknown)"}`,
          `- Email: ${lead.email || "(none)"}`,
        ].join("\n")
      : "(no lead linked)",
    "",
    input.previousDraft
      ? [
          "Previous draft to revise:",
          `Subject: ${input.previousDraft.subject}`,
          "Body:",
          input.previousDraft.body,
          "",
          `Revision notes: ${input.revisionNotes?.trim() || "(make it tighter)"}`,
        ].join("\n")
      : input.revisionNotes?.trim()
        ? `Extra instructions: ${input.revisionNotes.trim()}`
        : "",
    "",
    "Return JSON only:",
    `{ "subject": "...", "body": "..." }`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: modelId(),
    max_tokens: 900,
    messages: [{ role: "user", content: user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  try {
    return parseDraft(text);
  } catch {
    return fallbackDraft(quote);
  }
}
