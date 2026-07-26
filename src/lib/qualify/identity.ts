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

/** Footer often credits the agency / CMS / builder — never treat those as the business. */
const VENDOR_OR_TOOL =
  /\b(wix|squarespace|webflow|shopify|wordpress|woocommerce|jimdo|weebly|duda|hubspot|ghost|framer|carrd|bubble|webnode|spletnik|1and1|ionos|godaddy|hostinger|vercel|netlify|github|elementor|divi)\b/i;

const AGENCY_CREDIT =
  /\b(izdelava|izdelal|izdelala|naredil|naredila|designed by|built by|powered by|created by|website by|spletno stran|web design|webagency|agencija|studio za)\b/i;

function looksLikeVendorOrTool(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (VENDOR_OR_TOOL.test(n)) return true;
  if (AGENCY_CREDIT.test(n)) return true;
  return false;
}

function heuristicIdentity(
  website: string,
  site: QualifySiteResult,
  knownCompanyName?: string | null
): QualifyIdentityResult {
  const host = websiteHost(website);
  const known = knownCompanyName?.trim() || "";
  const hint =
    site.companyNameHint && !looksLikeVendorOrTool(site.companyNameHint)
      ? site.companyNameHint
      : null;
  const titleBit = site.title?.split(/[|\-–—]/)[0]?.trim() || null;
  const titleOk =
    titleBit && !looksLikeVendorOrTool(titleBit) ? titleBit : null;
  const name = known || hint || titleOk || host;
  return {
    companyName: name,
    tradeName: hint && hint !== name ? hint : null,
    confidence: known ? 70 : hint ? 45 : 20,
    source: "heuristic",
    notes: known
      ? "Used known company name (CRM / Maps) with page heuristics."
      : "AI identity extract unavailable; used page heuristics.",
  };
}

/**
 * Ask the model for the legal / trading company name as written on the site.
 * Runs before Companywall so search uses the right query (not just the domain).
 */
export async function extractCompanyIdentity(input: {
  website: string;
  site: QualifySiteResult;
  /** Strong prior from Hunt / CRM / Google Places — verify, don't invent a different firm. */
  knownCompanyName?: string | null;
}): Promise<QualifyIdentityResult> {
  const known = input.knownCompanyName?.trim() || "";
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return heuristicIdentity(input.website, input.site, known);
  }

  try {
    const client = new Anthropic({ apiKey });
    const host = websiteHost(input.website);
    const message = await client.messages.create({
      model: modelId(),
      max_tokens: 400,
      system: `You extract the real company / business name that OWNS THIS website (the client business).
Return ONLY valid JSON:
{
  "companyName": string,   // best legal or official name (prefer "X d.o.o." / "X s.p." when shown)
  "tradeName": string|null, // brand / site name if different from legal name
  "confidence": number,    // 0-100
  "notes": string          // one short sentence on where you found it
}
Rules:
- Prefer copyright of the BUSINESS, imprint/impresum, about, JSON-LD Organization for the site owner.
- Slovenian sites often hide "d.o.o." / "s.p." in footer — use that ONLY if it is the site owner's firm.
- IGNORE website credits in the footer: agencies, freelancers, "izdelava spletne strani", "designed by",
  "powered by", "built with", Webflow/Wix/Shopify/WordPress/Elementor/theme authors, hosting brands.
  Those are vendors — NEVER use them as companyName.
- Do NOT invent a legal form if the site never shows it.
- Domain labels are weak — only use as last resort.
- If brand ≠ legal name, put brand in tradeName and legal in companyName.
- If a knownCompanyName is provided (Google Maps/CRM), treat it as a strong prior for the business.
  Confirm against the page. Only replace when the page clearly shows the SAME business under a legal name.
  NEVER return an unrelated third company (agency, tool, random d.o.o. in credits).
- If the page is thin/unclear, return knownCompanyName (or host) with lower confidence.`,
      messages: [
        {
          role: "user",
          content: [
            `Website: ${input.website}`,
            `Host: ${host}`,
            `Known company name (Maps/CRM): ${known || "(none)"}`,
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
    let companyName = String(data.companyName ?? "").trim();
    if (!companyName || looksLikeVendorOrTool(companyName)) {
      return heuristicIdentity(input.website, input.site, known);
    }

    // If AI wandered to an unrelated name while we have a strong prior, keep the prior.
    if (known) {
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .replace(/\b(d\.?\s*o\.?\s*o\.?|s\.?\s*p\.?)\b/g, " ")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const nk = norm(known);
      const nc = norm(companyName);
      const overlaps =
        nk.length >= 3 &&
        nc.length >= 3 &&
        (nk.includes(nc) ||
          nc.includes(nk) ||
          nk.split(" ").some((w) => w.length > 3 && nc.includes(w)));
      if (!overlaps) {
        companyName = known;
      }
    }

    const confidenceRaw = Number(data.confidence);
    let confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
      : 60;
    if (known && companyName === known) {
      confidence = Math.max(confidence, 72);
    }
    const tradeName = String(data.tradeName ?? "").trim() || null;

    return {
      companyName,
      tradeName: tradeName && tradeName !== companyName ? tradeName : null,
      confidence,
      source: "ai",
      notes: String(data.notes ?? "").trim() || undefined,
    };
  } catch {
    return heuristicIdentity(input.website, input.site, known);
  }
}
