import * as cheerio from "cheerio";

import { normalizeWebsiteUrl } from "@/lib/qualify/url";

export type HuntSiteSignal = "none" | "down" | "dated" | "ok" | "modern";

export type HuntSitePreview = {
  title: string | null;
  description: string | null;
  cms: string | null;
  signal: HuntSiteSignal;
};

const TIMEOUT_MS = 4_000;
const CONCURRENCY = 6;
/** Cap so search stays responsive under Places pageSize × pages. */
const MAX_PREVIEW = 24;

function empty(signal: HuntSiteSignal, cms: string | null = null): HuntSitePreview {
  return { title: null, description: null, cms, signal };
}

function detectCms(html: string, $: ReturnType<typeof cheerio.load>): string | null {
  const generator =
    $('meta[name="generator"]').attr("content")?.trim() ||
    $('meta[name="Generator"]').attr("content")?.trim() ||
    "";
  if (/wordpress/i.test(generator) || /wp-content|wp-includes/i.test(html)) {
    return "WordPress";
  }
  if (/wix\.com|X-Wix|_wixCIDX/i.test(html) || /wix/i.test(generator)) {
    return "Wix";
  }
  if (/squarespace/i.test(html) || /squarespace/i.test(generator)) {
    return "Squarespace";
  }
  if (/webflow/i.test(html) || /webflow/i.test(generator)) {
    return "Webflow";
  }
  if (/shopify/i.test(html) || /cdn\.shopify/i.test(html)) {
    return "Shopify";
  }
  if (/__NEXT_DATA__/i.test(html) || /\/_next\//i.test(html)) {
    return "Next.js";
  }
  if (/framer\.com|framer-motion/i.test(html)) {
    return "Framer";
  }
  if (/drupal/i.test(generator) || /Drupal\.settings/i.test(html)) {
    return "Drupal";
  }
  if (/joomla/i.test(generator)) {
    return "Joomla";
  }
  if (generator) {
    return generator.slice(0, 40);
  }
  return null;
}

function scoreSignal(
  html: string,
  $: ReturnType<typeof cheerio.load>,
  cms: string | null
): HuntSiteSignal {
  let score = 50;
  const viewport = $('meta[name="viewport"]').attr("content");
  if (!viewport) score -= 28;
  else score += 8;

  const hasOg =
    Boolean($('meta[property="og:title"]').attr("content")) ||
    Boolean($('meta[property="og:image"]').attr("content"));
  if (hasOg) score += 8;

  if (/<frameset|<frame\s/i.test(html)) score -= 40;
  if (/<marquee|<blink\b/i.test(html)) score -= 35;
  if (/<font\s/i.test(html)) score -= 18;

  const tableCount = (html.match(/<table\b/gi) ?? []).length;
  if (tableCount >= 4) score -= 22;
  else if (tableCount >= 2) score -= 10;

  if (/jquery[.-]?1\.[0-7]/i.test(html)) score -= 20;
  if (/jquery[.-]?1\./i.test(html)) score -= 8;

  if (cms === "Next.js" || cms === "Webflow" || cms === "Framer") score += 28;
  if (cms === "Shopify" || cms === "Squarespace") score += 12;
  if (cms === "Wix") score += 6;
  if (cms === "WordPress") {
    score -= 4;
    // Classic dated WP footprints
    if (/twentytwelve|twentythirteen|twentyfourteen|twentyfifteen|twentysixteen/i.test(html)) {
      score -= 18;
    }
    if (/revslider|layerslider|js_composer|vc_row/i.test(html)) score -= 8;
  }
  if (cms === "Joomla" || cms === "Drupal") score -= 6;

  if (score <= 32) return "dated";
  if (score >= 72) return "modern";
  return "ok";
}

export async function fetchHuntSitePreview(
  website: string | null | undefined
): Promise<HuntSitePreview> {
  if (!website?.trim()) return empty("none");
  let target: string;
  try {
    target = normalizeWebsiteUrl(website);
  } catch {
    return empty("down");
  }

  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "OutpostHunt/1.0 (+https://timblazic.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return empty("down");
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $("title").first().text().replace(/\s+/g, " ").trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.replace(/\s+/g, " ").trim() ||
      $('meta[property="og:description"]')
        .attr("content")
        ?.replace(/\s+/g, " ")
        .trim() ||
      null;
    const cms = detectCms(html, $);
    const signal = scoreSignal(html, $, cms);
    return {
      title: title?.slice(0, 160) ?? null,
      description: description?.slice(0, 280) ?? null,
      cms,
      signal,
    };
  } catch {
    return empty("down");
  }
}

export async function fetchHuntPreviewsForWebsites(
  items: { placeId: string; website: string | null }[]
): Promise<Map<string, HuntSitePreview>> {
  const out = new Map<string, HuntSitePreview>();
  const withSite = items.filter((x) => x.website?.trim());
  const noSite = items.filter((x) => !x.website?.trim());
  for (const item of noSite) {
    out.set(item.placeId, empty("none"));
  }
  const queue = withSite.slice(0, MAX_PREVIEW);
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const idx = i;
      i += 1;
      const item = queue[idx]!;
      out.set(item.placeId, await fetchHuntSitePreview(item.website));
    }
  }
  if (queue.length) {
    const n = Math.min(CONCURRENCY, queue.length);
    await Promise.all(Array.from({ length: n }, () => worker()));
  }
  return out;
}
