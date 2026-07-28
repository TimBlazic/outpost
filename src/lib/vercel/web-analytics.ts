import {
  type DashboardRange,
  type DateBounds,
  rangeBounds,
} from "@/lib/dashboard-range";

const API_BASE = "https://api.vercel.com/v1/query/web-analytics";

export type WebAnalyticsConfig = {
  token: string;
  projectId: string;
  teamId: string | null;
  label: string;
};

export function getWebAnalyticsConfig(): WebAnalyticsConfig | null {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_WEB_ANALYTICS_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return {
    token,
    projectId,
    teamId: process.env.VERCEL_TEAM_ID?.trim() || null,
    label:
      process.env.VERCEL_WEB_ANALYTICS_LABEL?.trim() || "timblazic.dev",
  };
}

export type VisitTotals = {
  pageviews: number;
  visitors: number;
};

export type VisitTimePoint = {
  timestamp: string;
  label: string;
  pageviews: number;
  visitors: number;
};

export type VisitBreakdownRow = {
  key: string;
  pageviews: number;
  visitors: number;
};

export type SiteAnalyticsReport = {
  totals: VisitTotals;
  series: VisitTimePoint[];
  topPages: VisitBreakdownRow[];
  referrers: VisitBreakdownRow[];
  countries: VisitBreakdownRow[];
  devices: VisitBreakdownRow[];
  since: string;
  until: string;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Map dashboard range → API window (aggregate needs a bounded window). */
export function analyticsWindow(
  range: DashboardRange,
  now = new Date()
): { since: string; until: string; bounds: DateBounds; timeBy: "day" | "week" | "month" } {
  const bounds = rangeBounds(range, now);
  const until = ymd(bounds.end);
  let sinceDate = bounds.start;
  if (!sinceDate) {
    // "all" → last 90 days (Hobby reporting window is limited anyway)
    sinceDate = new Date(now);
    sinceDate.setDate(sinceDate.getDate() - 89);
    sinceDate.setHours(0, 0, 0, 0);
  }
  const since = ymd(sinceDate);
  const days =
    (bounds.end.getTime() - sinceDate.getTime()) / 86400000 + 1;
  const timeBy: "day" | "week" | "month" =
    days <= 40 ? "day" : days <= 120 ? "week" : "month";
  return { since, until, bounds, timeBy };
}

async function queryJson<T>(
  config: WebAnalyticsConfig,
  path: "visits/count" | "visits/aggregate",
  params: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("projectId", config.projectId);
  if (config.teamId) url.searchParams.set("teamId", config.teamId);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
    next: { revalidate: 300 },
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    message?: string;
    data?: unknown;
  };

  if (!res.ok) {
    const msg =
      body.error?.message ||
      body.message ||
      `Vercel Analytics ${res.status}`;
    throw new Error(msg);
  }

  return body as T;
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatSeriesLabel(timestamp: string, by: "day" | "week" | "month") {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return timestamp.slice(0, 10);
  if (by === "month") {
    return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function mapBreakdown(
  rows: Record<string, unknown>[],
  keyField: string
): VisitBreakdownRow[] {
  return rows
    .map((row) => {
      const raw = row[keyField] ?? row.key ?? "Unknown";
      const key =
        raw == null || raw === ""
          ? "Direct / unknown"
          : String(raw);
      return {
        key: key === "null" || key === "Others" ? key : key,
        pageviews: num(row.pageviews),
        visitors: num(row.visitors),
      };
    })
    .filter((r) => r.pageviews > 0 || r.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews);
}

export async function fetchSiteAnalyticsReport(
  config: WebAnalyticsConfig,
  range: DashboardRange
): Promise<SiteAnalyticsReport> {
  const { since, until, timeBy } = analyticsWindow(range);

  const [totalsRes, seriesRes, pagesRes, refsRes, countriesRes, devicesRes] =
    await Promise.all([
      // One bucket for the window → true unique visitors / pageviews.
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "environment", limit: 5 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: timeBy }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "requestPath", limit: 12 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "referrerHostname", limit: 10 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "country", limit: 10 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "deviceType", limit: 6 }
      ),
    ]);

  const seriesRows = Array.isArray(seriesRes.data) ? seriesRes.data : [];
  const series: VisitTimePoint[] = seriesRows.map((row) => {
    const timestamp = String(row.timestamp ?? "");
    return {
      timestamp,
      label: formatSeriesLabel(timestamp, timeBy),
      pageviews: num(row.pageviews),
      visitors: num(row.visitors),
    };
  });

  const envRows = Array.isArray(totalsRes.data) ? totalsRes.data : [];
  const prod =
    envRows.find((r) => String(r.environment ?? "") === "production") ??
    envRows[0];
  const totals: VisitTotals = prod
    ? { pageviews: num(prod.pageviews), visitors: num(prod.visitors) }
    : series.reduce(
        (acc, row) => ({
          pageviews: acc.pageviews + row.pageviews,
          visitors: acc.visitors + row.visitors,
        }),
        { pageviews: 0, visitors: 0 }
      );

  return {
    totals,
    series,
    topPages: mapBreakdown(
      Array.isArray(pagesRes.data) ? pagesRes.data : [],
      "requestPath"
    ),
    referrers: mapBreakdown(
      Array.isArray(refsRes.data) ? refsRes.data : [],
      "referrerHostname"
    ),
    countries: mapBreakdown(
      Array.isArray(countriesRes.data) ? countriesRes.data : [],
      "country"
    ),
    devices: mapBreakdown(
      Array.isArray(devicesRes.data) ? devicesRes.data : [],
      "deviceType"
    ),
    since,
    until,
  };
}

/** Lean payload for dashboard KPI cards (fewer API calls than the full report). */
export type SiteAnalyticsSummary = {
  visitors: number;
  pageviews: number;
  topPage: { path: string; visitors: number } | null;
  topReferrer: { host: string; visitors: number } | null;
  topCountry: { code: string; visitors: number } | null;
  mobileShare: number | null;
};

export async function fetchSiteAnalyticsSummary(
  config: WebAnalyticsConfig,
  range: DashboardRange
): Promise<SiteAnalyticsSummary> {
  const { since, until } = analyticsWindow(range);

  const [totalsRes, pagesRes, refsRes, countriesRes, devicesRes] =
    await Promise.all([
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "environment", limit: 5 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "requestPath", limit: 3 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "referrerHostname", limit: 3 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "country", limit: 3 }
      ),
      queryJson<{ data?: Record<string, unknown>[] }>(
        config,
        "visits/aggregate",
        { since, until, by: "deviceType", limit: 6 }
      ),
    ]);

  const envRows = Array.isArray(totalsRes.data) ? totalsRes.data : [];
  const prod =
    envRows.find((r) => String(r.environment ?? "") === "production") ??
    envRows[0];
  const visitors = num(prod?.visitors);
  const pageviews = num(prod?.pageviews);

  const pages = mapBreakdown(
    Array.isArray(pagesRes.data) ? pagesRes.data : [],
    "requestPath"
  );
  const refs = mapBreakdown(
    Array.isArray(refsRes.data) ? refsRes.data : [],
    "referrerHostname"
  );
  const countries = mapBreakdown(
    Array.isArray(countriesRes.data) ? countriesRes.data : [],
    "country"
  );
  const devices = mapBreakdown(
    Array.isArray(devicesRes.data) ? devicesRes.data : [],
    "deviceType"
  );

  const deviceTotal = devices.reduce((s, d) => s + d.visitors, 0);
  const mobile = devices.find((d) => /mobile/i.test(d.key));
  const mobileShare =
    deviceTotal > 0 && mobile
      ? Math.round((mobile.visitors / deviceTotal) * 100)
      : deviceTotal > 0
        ? 0
        : null;

  return {
    visitors,
    pageviews,
    topPage: pages[0]
      ? { path: pages[0].key, visitors: pages[0].visitors }
      : null,
    topReferrer: refs[0]
      ? { host: refs[0].key, visitors: refs[0].visitors }
      : null,
    topCountry: countries[0]
      ? { code: countries[0].key, visitors: countries[0].visitors }
      : null,
    mobileShare,
  };
}
