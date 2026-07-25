import Anthropic from "@anthropic-ai/sdk";

import type { QualifyIdentityResult, QualifySiteResult } from "./types";
import { websiteHost } from "./url";

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in model response");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function heuristicIdentity(
  website: string,
  site: QualifySiteResult
): QualifyIdentityResult {
  const host = websiteHost(website);
  const name =
    site.companyNameHint ||
    site.title?.split(/[|\-–—]/)[0]?.trim() ||
    host;
  return {
    companyName: name,
    tradeName: site.companyNameHint,
    confidence: site.companyNameHint ? 45 : 20,
    source: "heuristic",
    notes: "AI identity extract unavailable; used page heuristics.",
  };
}

/**
 * Ask the model for the legal / trading company name as written on the site.
 * Runs before Companywall so search uses the right query (not just the domain).
 */
export async function extractCompanyIdentity(input: {
  website: string;
  site: QualifySiteResult;
}): Promise<QualifyIdentityResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return heuristicIdentity(input.website, input.site);
  }

  try {
    const client = new Anthropic({ apiKey });
    const host = websiteHost(input.website);
    const message = await client.messages.create({
      model: modelId(),
      max_tokens: 400,
      system: `You extract the real company / business name from a website.
Return ONLY valid JSON:
{
  "companyName": string,   // best legal or official name as on the site (prefer "X d.o.o." / "X s.p." when shown)
  "tradeName": string|null, // brand / site name if different from legal name
  "confidence": number,    // 0-100
  "notes": string          // one short sentence on where you found it
}
Rules:
- Prefer footer, copyright, imprint, about, JSON-LD Organization, invoice/legal mentions.
- Do NOT invent a legal form if the site never shows it.
- Domain labels (e.g. kbiro.si) are weak — only use as last resort.
- If brand ≠ legal name, put brand in tradeName and legal in companyName.
- Slovenian sites often hide "d.o.o." in the footer — look there.`,
      messages: [
        {
          role: "user",
          content: [
            `Website: ${input.website}`,
            `Host: ${host}`,
            `Title: ${input.site.title ?? ""}`,
            `Meta: ${input.site.description ?? ""}`,
            `Heuristic hint: ${input.site.companyNameHint ?? ""}`,
            `Identity snippets: ${input.site.identitySnippets.join(" | ") || "(none)"}`,
            `Emails: ${input.site.emails.join(", ")}`,
            `Excerpt: ${input.site.excerpt}`,
          ].join("\n"),
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const data = parseJsonObject(text);
    const companyName = String(data.companyName ?? "").trim();
    if (!companyName) {
      return heuristicIdentity(input.website, input.site);
    }

    const confidenceRaw = Number(data.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
      : 60;
    const tradeName = String(data.tradeName ?? "").trim() || null;

    return {
      companyName,
      tradeName,
      confidence,
      source: "ai",
      notes: String(data.notes ?? "").trim() || undefined,
    };
  } catch {
    return heuristicIdentity(input.website, input.site);
  }
}
