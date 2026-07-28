import Link from "next/link";
import { BarChart3, ExternalLink, Globe2, Monitor, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DashboardRangeSelect } from "@/components/dashboard-range-select";
import { RankBarChart, TrafficAreaChart } from "@/components/charts";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireStudioSession } from "@/lib/auth/session";
import {
  dashboardRangeLabels,
  parseDashboardRange,
} from "@/lib/dashboard-range";
import {
  fetchSiteAnalyticsReport,
  getWebAnalyticsConfig,
} from "@/lib/vercel/web-analytics";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("en-GB");
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireStudioSession();

  const { range: rangeParam } = await searchParams;
  const range = parseDashboardRange(rangeParam);
  const rangeLabel = dashboardRangeLabels[range];
  const config = getWebAnalyticsConfig();

  if (!config) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <PageHeader
          title="Analytics"
          description="timblazic.dev traffic from Vercel Web Analytics."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" />
              Connect Vercel Analytics
            </CardTitle>
            <CardDescription>
              Marketing site already ships{" "}
              <code className="text-xs">@vercel/analytics</code>. Add these env
              vars to Outpost (Vercel project +{" "}
              <code className="text-xs">.env.local</code>), then refresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                Create a token at{" "}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  vercel.com/account/tokens
                </a>
              </li>
              <li>
                Project Settings → General → copy{" "}
                <strong className="text-foreground">Project ID</strong> for
                timblazic.dev
              </li>
              <li>
                Team Settings → copy{" "}
                <strong className="text-foreground">Team ID</strong> (if the
                project is under a team)
              </li>
            </ol>
            <pre className="overflow-x-auto rounded-lg border border-border/70 bg-muted/40 p-4 text-xs leading-relaxed">
{`VERCEL_TOKEN=vercel_...
VERCEL_WEB_ANALYTICS_PROJECT_ID=prj_...
VERCEL_TEAM_ID=team_...          # optional for personal accounts
VERCEL_WEB_ANALYTICS_LABEL=timblazic.dev`}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  let report: Awaited<ReturnType<typeof fetchSiteAnalyticsReport>> | null =
    null;
  let error: string | null = null;
  try {
    report = await fetchSiteAnalyticsReport(config, range);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load analytics";
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Analytics"
        description={`${config.label} · ${rangeLabel.toLowerCase()} · Vercel Web Analytics`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://${config.label.replace(/^https?:\/\//, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Open site <ExternalLink className="size-3.5" />
          </a>
          <DashboardRangeSelect value={range} basePath="/analytics" />
        </div>
      </PageHeader>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Couldn’t load analytics</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Check that Web Analytics is enabled on the timblazic.dev Vercel
            project, and that the token can read that project.
          </CardContent>
        </Card>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Visitors"
              value={fmt(report.totals.visitors)}
              icon={Users}
            />
            <StatCard
              label="Pageviews"
              value={fmt(report.totals.pageviews)}
              icon={BarChart3}
            />
            <StatCard
              label="Pages tracked"
              value={fmt(report.topPages.length)}
              sub="top paths in range"
              icon={Globe2}
            />
            <StatCard
              label="Devices"
              value={fmt(report.devices.length)}
              sub="device types seen"
              icon={Monitor}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Traffic</CardTitle>
              <CardDescription>
                {report.since} → {report.until}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.series.length ? (
                <TrafficAreaChart data={report.series} />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No traffic in this range yet.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top pages</CardTitle>
                <CardDescription>By visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {report.topPages.length ? (
                  <RankBarChart
                    data={report.topPages.map((r) => ({
                      name: r.key.length > 28 ? `${r.key.slice(0, 26)}…` : r.key,
                      value: r.visitors,
                    }))}
                  />
                ) : (
                  <Empty />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Referrers</CardTitle>
                <CardDescription>By visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {report.referrers.length ? (
                  <RankBarChart
                    data={report.referrers.map((r) => ({
                      name: r.key,
                      value: r.visitors,
                    }))}
                  />
                ) : (
                  <Empty />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Countries</CardTitle>
                <CardDescription>By visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {report.countries.length ? (
                  <RankBarChart
                    data={report.countries.map((r) => ({
                      name: r.key,
                      value: r.visitors,
                    }))}
                  />
                ) : (
                  <Empty />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Devices</CardTitle>
                <CardDescription>By visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {report.devices.length ? (
                  <RankBarChart
                    data={report.devices.map((r) => ({
                      name: r.key,
                      value: r.visitors,
                    }))}
                  />
                ) : (
                  <Empty />
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Full dashboard:{" "}
                  <Link
                    href="https://vercel.com/dashboard"
                    className="underline-offset-4 hover:underline"
                    target="_blank"
                  >
                    Vercel → Analytics
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Empty() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
  );
}
