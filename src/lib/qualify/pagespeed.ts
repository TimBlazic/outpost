import type { QualifyLighthouseResult } from "./types";

export async function runPageSpeed(
  url: string
): Promise<QualifyLighthouseResult> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) {
    return { status: "skipped", error: "PAGESPEED_API_KEY not set" };
  }
  try {
    const endpoint = new URL(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    );
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "mobile");
    endpoint.searchParams.set("key", key);
    for (const cat of [
      "performance",
      "seo",
      "accessibility",
      "best-practices",
    ]) {
      endpoint.searchParams.append("category", cat);
    }
    const res = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "fail", error: `PSI HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
      };
    };
    const cats = data.lighthouseResult?.categories ?? {};
    const score = (id: string) => {
      const s = cats[id]?.score;
      return typeof s === "number" ? Math.round(s * 100) : undefined;
    };
    return {
      status: "ok",
      performance: score("performance"),
      seo: score("seo"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
    };
  } catch (e) {
    return {
      status: "fail",
      error: e instanceof Error ? e.message : "PSI failed",
    };
  }
}
