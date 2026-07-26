import * as cheerio from "cheerio";

import type { QualifySiteResult } from "./types";
import { normalizeWebsiteUrl } from "./url";

const TIMEOUT_MS = 15_000;

function emptySite(error: string): QualifySiteResult {
  return {
    title: null,
    description: null,
    companyNameHint: null,
    identitySnippets: [],
    excerpt: "",
    emails: [],
    phones: [],
    error,
  };
}

function companyNameHintFrom(
  $: ReturnType<typeof cheerio.load>,
  title: string | null,
  html: string
): string | null {
  const ogSite =
    $('meta[property="og:site_name"]').attr("content")?.trim() || null;
  const appName =
    $('meta[name="application-name"]').attr("content")?.trim() || null;

  for (const block of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const data = JSON.parse(block[1]!) as Record<string, unknown> | unknown[];
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        const t = String(o["@type"] ?? "");
        if (
          /Organization|LocalBusiness|Corporation/i.test(t) &&
          typeof o.name === "string"
        ) {
          const n = o.name.trim();
          if (n) return n;
        }
      }
    } catch {
      // ignore
    }
  }

  const fromTitle = title?.split(/[|\-–—]/)[0]?.trim() || null;
  return ogSite || appName || fromTitle;
}

const VENDOR_CREDIT =
  /\b(izdelava|izdelal|izdelala|naredil|designed by|built by|powered by|created by|website by|spletno stran|webflow|wix|shopify|wordpress|elementor|hostinger|spletnik)\b/i;

/** Pull lines that often contain the legal company name. */
function identitySnippetsFrom(
  $: ReturnType<typeof cheerio.load>,
  text: string
): string[] {
  const snippets: string[] = [];
  const push = (raw: string, creditHint = false) => {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s.length < 4 || s.length > 220) return;
    const tagged =
      creditHint || VENDOR_CREDIT.test(s) ? `[site-credit] ${s}` : s;
    if (snippets.some((x) => x.toLowerCase() === tagged.toLowerCase())) return;
    snippets.push(tagged);
  };

  $("footer, [role='contentinfo'], .footer, #footer, .site-footer").each(
    (_, el) => {
      const t = $(el).text();
      // Whole footer is noisy — still include, but mark likely credits.
      push(t, VENDOR_CREDIT.test(t));
    }
  );

  const patterns = [
    /©[^.]{0,160}/gi,
    /\b(?:d\.?\s*o\.?\s*o\.?|s\.?\s*p\.?|d\.?\s*n\.?\s*o\.?)[^.]{0,120}/gi,
    /(?:podjetje|company|impresum|imprint|o nas|about us)[:\s][^.]{0,140}/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      push(m[0]!);
      if (snippets.length >= 12) break;
    }
    if (snippets.length >= 12) break;
  }

  return snippets.slice(0, 12);
}

export async function fetchSite(url: string): Promise<QualifySiteResult> {
  const target = normalizeWebsiteUrl(url);
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "OutpostQualify/1.0 (+https://timblazic.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return emptySite(`Fetch failed (${res.status})`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    // Keep a copy of footer text before stripping scripts for JSON-LD pass
    const companyNameHint = companyNameHintFrom($, null, html);
    $("script, style, noscript").remove();
    const title = $("title").first().text().trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;
    const hint =
      companyNameHint ||
      companyNameHintFrom($, title, "") ||
      $('meta[property="og:site_name"]').attr("content")?.trim() ||
      null;
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const identitySnippets = identitySnippetsFrom($, text);
    const excerpt = text.slice(0, 1800);
    const emails = [
      ...new Set(
        html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
      ),
    ]
      .filter((e) => !/\.(png|jpg|gif|svg|webp)$/i.test(e))
      .slice(0, 8);
    const phones = [
      ...new Set(text.match(/(?:\+|0)\d[\d\s/-]{6,}\d/g) ?? []),
    ]
      .map((p) => p.replace(/\s+/g, " ").trim())
      .slice(0, 6);
    return {
      title,
      description,
      companyNameHint: hint,
      identitySnippets,
      excerpt,
      emails,
      phones,
    };
  } catch (e) {
    return emptySite(e instanceof Error ? e.message : "Fetch failed");
  }
}
