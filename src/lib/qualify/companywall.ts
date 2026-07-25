import * as cheerio from "cheerio";

import type { QualifyCompanywallResult } from "./types";

const TIMEOUT_MS = 15_000;
const UA = "OutpostQualify/1.0 (+https://timblazic.dev)";
const CW_ORIGIN = "https://www.companywall.si";
/** Below this we refuse to auto-pick (wrong company is worse than no data). */
const MIN_ACCEPT_SCORE = 55;
/** If top two are this close, treat as ambiguous unless top is very strong. */
const AMBIGUITY_GAP = 18;
const STRONG_SCORE = 85;

type Candidate = {
  url: string;
  slug: string;
  name: string;
  score: number;
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Normalize company / slug text for comparison. */
export function normalizeCompanyText(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/\b(d\.?\s*o\.?\s*o\.?|s\.?\s*p\.?|d\.?\s*n\.?\s*o\.?|k\.?\s*d\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(s: string): string {
  return s.replace(/\s+/g, "");
}

function domainLabel(host: string): string {
  const h = host.replace(/^www\./i, "").toLowerCase();
  return h.split(".")[0] || h;
}

function slugFromPath(pathname: string): string {
  const m = pathname.match(/\/podjetje\/([^/]+)/i);
  return m?.[1] ?? "";
}

function absoluteCwUrl(href: string): string {
  return href.startsWith("http") ? href : new URL(href, CW_ORIGIN).toString();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? diag : Math.min(diag, prev[j], prev[j - 1]) + 1;
      diag = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

/** Score how well a Companywall candidate matches site company + domain. */
export function scoreCandidate(input: {
  slug: string;
  name: string;
  companyName: string;
  domain: string;
}): number {
  const domain = domainLabel(input.domain);
  const domainN = normalizeCompanyText(domain);
  const domainC = compact(domainN);
  const nameN = normalizeCompanyText(input.name);
  const nameC = compact(nameN);
  const companyN = normalizeCompanyText(input.companyName);
  const companyC = compact(companyN);
  const slugN = normalizeCompanyText(input.slug.replace(/-/g, " "));
  const slugC = compact(slugN);

  if (!domainC && !companyC) return 0;

  let score = 0;

  // Domain ↔ slug (most reliable for SI company pages)
  if (domainC && slugC) {
    if (slugC === domainC) score += 100;
    else if (
      (slugC.startsWith(domainC) || domainC.startsWith(slugC)) &&
      Math.min(slugC.length, domainC.length) >= 4 &&
      // avoid kbiro ↔ biro / mbiro prefix tricks
      Math.abs(slugC.length - domainC.length) <= 3
    ) {
      score += 78;
    } else if (nearMatch(slugC, domainC)) {
      score += 88;
    }
  }

  // Domain ↔ display name
  if (domainC && nameC) {
    if (nameC === domainC) score = Math.max(score, 92);
    else if (
      (nameC.includes(domainC) || domainC.includes(nameC)) &&
      Math.min(nameC.length, domainC.length) >= 4 &&
      Math.abs(nameC.length - domainC.length) <= 4
    ) {
      score = Math.max(score, 70);
    }
  }

  // Hint company name ↔ display name / slug
  if (companyC.length >= 3) {
    if (nameC === companyC) score = Math.max(score, 96);
    else if (slugC === companyC) score = Math.max(score, 94);
    else if (
      (nameC.includes(companyC) || companyC.includes(nameC)) &&
      Math.min(nameC.length, companyC.length) >= 4 &&
      Math.abs(nameC.length - companyC.length) <= 4
    ) {
      score = Math.max(score, 72);
    } else if (nearMatch(nameC, companyC)) {
      score = Math.max(score, 80);
    }

    // Token overlap — require a distinctive token (len ≥ 4), not just "biro"
    const stop = new Set(["si", "com", "www", "biro", "doo", "ltd", "gmbh"]);
    const cTokens = companyN
      .split(" ")
      .filter((t) => t.length >= 4 && !stop.has(t));
    const nTokens = new Set(nameN.split(" ").filter((t) => t.length >= 2));
    if (cTokens.length) {
      const hit = cTokens.filter((t) => nTokens.has(t) || nameC.includes(t)).length;
      score += Math.min(24, hit * 10);
    }
  }

  // Shared generic suffix only (m-biro vs kbiro) is not a match
  if (domainC.length >= 4 && slugC.length >= 4 && slugC !== domainC) {
    const shared = longestCommonSubstring(domainC, slugC);
    if (
      shared.length >= 3 &&
      shared.length < domainC.length &&
      !nameC.includes(domainC) &&
      slugC !== domainC
    ) {
      if (score < STRONG_SCORE) score = Math.min(score, 30);
    }
  }

  return Math.min(100, score);
}

/** Typo tolerance only for longer brands — "mbiro" vs "kbiro" must not match. */
function nearMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 6) return false;
  return editDistance(a, b) <= 1;
}

function longestCommonSubstring(a: string, b: string): string {
  let best = "";
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 3; j <= a.length; j++) {
      const sub = a.slice(i, j);
      if (sub.length > best.length && b.includes(sub)) best = sub;
    }
  }
  return best;
}

function searchQueries(companyName: string, domain: string): string[] {
  const label = domainLabel(domain);
  const name = companyName.trim();
  const nameClean = name
    .replace(/\s*[|\-–—].*$/, "")
    .replace(/\b(d\.?o\.?o\.?|s\.?p\.?)\b/gi, "")
    .trim();

  const queries: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t.length >= 2 && !queries.some((x) => x.toLowerCase() === t.toLowerCase())) {
      queries.push(t);
    }
  };

  // Brand-like names (k.biro) beat bare domain labels that match many *-biro-* firms
  push(nameClean);
  push(name);
  if (label.length >= 3) {
    push(label);
    // kbiro → k.biro (Companywall search ranks brand punctuation well)
    if (/^[a-z]{3,10}$/i.test(label)) {
      push(`${label[0]}.${label.slice(1)}`);
    }
    push(`${label} d.o.o.`);
  }

  return queries.slice(0, 6);
}

function extractCandidatesFromSearch(html: string): Omit<Candidate, "score">[] {
  const $ = cheerio.load(html);
  const out: Omit<Candidate, "score">[] = [];
  const seen = new Set<string>();

  $('a[href*="/podjetje/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || /\/podjetje\/?$/i.test(href)) return;
    const url = absoluteCwUrl(href.split("?")[0]!);
    let pathname = "";
    try {
      pathname = new URL(url).pathname;
    } catch {
      return;
    }
    const slug = slugFromPath(pathname);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    const linkText = $(el).text().replace(/\s+/g, " ").trim();
    const parentText = $(el)
      .closest("tr, li, article, .row, .card, div")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const name =
      linkText ||
      parentText.split(/(?:d\.o\.o\.|s\.p\.|d\.n\.o\.)/i)[0]?.trim() ||
      slug.replace(/-/g, " ");

    out.push({ url, slug, name: name.slice(0, 120) });
  });

  return out;
}

async function searchCandidates(
  companyName: string,
  domain: string
): Promise<Candidate[]> {
  const bySlug = new Map<string, Candidate>();
  const pages = await Promise.all(
    searchQueries(companyName, domain).map(async (q) => {
      const searchUrl = `${CW_ORIGIN}/iskanje?n=${encodeURIComponent(q)}`;
      try {
        return await fetchHtml(searchUrl);
      } catch {
        return "";
      }
    })
  );

  for (const html of pages) {
    if (!html) continue;
    for (const c of extractCandidatesFromSearch(html)) {
      const score = scoreCandidate({
        slug: c.slug,
        name: c.name,
        companyName,
        domain,
      });
      const prev = bySlug.get(c.slug);
      if (!prev || score > prev.score) {
        bySlug.set(c.slug, { ...c, score });
      }
    }
  }

  return [...bySlug.values()].sort((a, b) => b.score - a.score);
}

function pickBest(candidates: Candidate[]): {
  best: Candidate | null;
  reason?: string;
} {
  if (!candidates.length) return { best: null, reason: "No Companywall match" };
  const [best, second] = candidates;
  if (best.score < MIN_ACCEPT_SCORE) {
    return {
      best: null,
      reason: `No confident match (best: ${best.name} @ ${best.score}). Paste the Companywall URL.`,
    };
  }
  if (
    second &&
    best.score < STRONG_SCORE &&
    best.score - second.score < AMBIGUITY_GAP
  ) {
    return {
      best: null,
      reason: `Ambiguous match between “${best.name}” and “${second.name}”. Paste the Companywall URL.`,
    };
  }
  return { best };
}

function parseFaqMoney(answer: string): number | undefined {
  const m = answer.match(/(-?[\d]+(?:[.,]\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseLdJsonBlocks(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"], script[type="application/ld&#x2B;json"]').each(
    (_, el) => {
      const raw = $(el).html()?.trim();
      if (!raw) return;
      try {
        blocks.push(JSON.parse(raw));
      } catch {
        // Dataset sometimes has control chars — ignore
      }
    }
  );
  return blocks;
}

function scrapeCompanyHtml(
  html: string,
  pageUrl: string,
  confidence: number,
  matchMethod: string
): QualifyCompanywallResult {
  const $ = cheerio.load(html);
  const ld = parseLdJsonBlocks(html);

  let matchedName: string | undefined;
  let phone: string | undefined;
  let email: string | undefined;
  let address: string | undefined;
  let revenue: string | undefined;
  let profit: string | undefined;
  let year: string | undefined;
  let owner: string | undefined;

  for (const block of ld) {
    if (!block || typeof block !== "object") continue;
    const o = block as Record<string, unknown>;
    const type = o["@type"];

    if (type === "LocalBusiness" || type === "Organization") {
      if (typeof o.name === "string" && o.name.trim()) matchedName = o.name.trim();
      if (typeof o.telephone === "string" && o.telephone.trim()) {
        phone = o.telephone.trim();
      }
      if (typeof o.email === "string" && o.email.trim()) email = o.email.trim();
      const addr = o.address;
      if (addr && typeof addr === "object") {
        const a = addr as Record<string, unknown>;
        const street =
          typeof a.streetAddress === "string" ? a.streetAddress.trim() : "";
        // Companywall often puts the full address in streetAddress already
        if (street && (street.includes(",") || /\d{4}/.test(street))) {
          address = street.replace(/\s+/g, " ");
        } else {
          const parts = [street, a.postalCode, a.addressLocality]
            .filter((x) => typeof x === "string" && String(x).trim())
            .map((x) => String(x).trim());
          if (parts.length) address = parts.join(", ");
        }
      } else if (typeof o.address === "string") {
        address = o.address.trim();
      }
    }

    if (type === "FAQPage" && Array.isArray(o.mainEntity)) {
      for (const q of o.mainEntity) {
        if (!q || typeof q !== "object") continue;
        const faq = q as Record<string, unknown>;
        const question = String(faq.name ?? "");
        const answer = String(
          (faq.acceptedAnswer as { text?: string } | undefined)?.text ?? ""
        );
        if (/prihodek|dohodek|revenue/i.test(question) && !revenue) {
          const n = parseFaqMoney(answer);
          if (n != null) revenue = formatEur(n);
        }
        if (/dobiček|dobicek|profit|izguba/i.test(question) && !profit) {
          const n = parseFaqMoney(answer);
          if (n != null) profit = formatEur(n);
        }
        if (/lastnik|owner/i.test(question) && !owner) {
          const m = answer.match(/:\s*(.+)$/);
          owner = (m?.[1] ?? answer).trim();
        }
        if (/naslov|address/i.test(question) && !address) {
          const m = answer.match(/:\s*(.+)$/);
          address = (m?.[1] ?? answer).trim();
        }
      }
    }
  }

  if (!matchedName) {
    matchedName =
      $("h1").first().text().trim() ||
      $("title").first().text().split("|")[0]?.trim() ||
      undefined;
  }

  if (!email) {
    const emails = [
      ...new Set(
        html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
      ),
    ].filter(
      (e) =>
        !/companywall|example\.|sentry|wixpress/i.test(e) &&
        !/\.(png|jpg|gif|svg|webp)$/i.test(e)
    );
    email = emails[0];
  }

  if (!phone) {
    const bodyText = $.root().text();
    const m = bodyText.match(
      /(?:Kontaktni telefon je|tel\.?|telefon)\s*([+0]\d[\d\s/-]{5,}\d)/i
    );
    if (m?.[1]) phone = m[1].replace(/\s+/g, " ").trim();
  }

  const text = $("body").text().replace(/\s+/g, " ");
  if (!year) {
    const yearMatch =
      text.match(/(?:poslovno leto|leto|year)\s*(20\d{2})/i) ||
      text.match(/\b(20(?:2[0-9]|1[5-9]))\b/);
    year = yearMatch?.[1];
  }

  if (!revenue && !profit && !matchedName && !phone && !email) {
    return {
      status: "fail",
      url: pageUrl,
      confidence,
      matchMethod,
      error: "Could not parse company fields",
    };
  }

  return {
    status: "ok",
    url: pageUrl,
    matchedName,
    revenue,
    profit,
    year,
    email,
    phone,
    address,
    owner,
    confidence,
    matchMethod,
  };
}

function verifyPageMatch(
  scraped: QualifyCompanywallResult,
  companyName: string,
  domain: string
): number {
  if (!scraped.matchedName && !scraped.url) return scraped.confidence ?? 0;
  let slug = "";
  try {
    slug = slugFromPath(new URL(scraped.url!).pathname);
  } catch {
    slug = "";
  }
  return scoreCandidate({
    slug,
    name: scraped.matchedName || slug,
    companyName,
    domain,
  });
}

export async function lookupCompanywall(input: {
  companyName: string;
  domain: string;
  companywallUrl?: string | null;
}): Promise<QualifyCompanywallResult> {
  try {
    let pageUrl = input.companywallUrl?.trim() || "";
    let confidence = 100;
    let matchMethod = "manual-url";

    if (pageUrl) {
      if (!/companywall\.si/i.test(pageUrl)) {
        return {
          status: "fail",
          error: "Companywall URL must be on companywall.si",
        };
      }
      if (!/^https?:\/\//i.test(pageUrl)) {
        pageUrl = `https://${pageUrl}`;
      }
    } else {
      const candidates = await searchCandidates(input.companyName, input.domain);
      const { best, reason } = pickBest(candidates);
      if (!best) {
        const top = candidates
          .slice(0, 3)
          .map((c) => `${c.name} (${c.score})`)
          .join("; ");
        return {
          status: "fail",
          error: reason || "No Companywall match",
          candidates: candidates.slice(0, 5).map((c) => ({
            name: c.name,
            url: c.url,
            score: c.score,
          })),
          ...(top ? { matchMethod: `candidates: ${top}` } : {}),
        };
      }
      pageUrl = best.url;
      confidence = best.score;
      matchMethod = `search score ${best.score}`;
    }

    const html = await fetchHtml(pageUrl);
    const scraped = scrapeCompanyHtml(html, pageUrl, confidence, matchMethod);

    if (scraped.status !== "ok") return scraped;

    // Re-verify page title/slug against domain when auto-matched
    if (matchMethod !== "manual-url") {
      const verified = verifyPageMatch(scraped, input.companyName, input.domain);
      if (verified < MIN_ACCEPT_SCORE) {
        return {
          status: "fail",
          url: pageUrl,
          matchedName: scraped.matchedName,
          confidence: verified,
          matchMethod,
          error: `Page “${scraped.matchedName ?? "unknown"}” does not match ${domainLabel(input.domain)}. Paste the correct Companywall URL.`,
        };
      }
      scraped.confidence = Math.min(confidence, verified);
      scraped.matchMethod = `${matchMethod}; verified ${verified}`;
    }

    return scraped;
  } catch (e) {
    return {
      status: "fail",
      error: e instanceof Error ? e.message : "Companywall lookup failed",
    };
  }
}
