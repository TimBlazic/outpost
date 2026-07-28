import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  AlertCircle,
  CalendarClock,
  CheckSquare,
  Flame,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DashboardRangeSelect } from "@/components/dashboard-range-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/status-pill";
import { StatCard } from "@/components/stat-card";
import { RevenueAreaChart } from "@/components/charts";
import { FollowUpRowActions } from "@/components/follow-up-row-actions";
import { isArchived } from "@/lib/data";
import {
  requireClientSession,
  tryClientPortalSession,
} from "@/lib/client-accounts/session";
import {
  computeDashboardKpis,
  dashboardKpiGridClass,
  normalizeDashboardKpis,
  selectionNeedsSiteAnalytics,
  type SiteAnalyticsKpiData,
} from "@/lib/dashboard-kpis";
import {
  dashboardRangeLabels,
  isDateInRange,
  monthlyInvoiceRevenueInRange,
  monthsSpanned,
  outstandingInvoiceTotal,
  paidInvoiceRevenueInRange,
  parseDashboardRange,
  rangeBounds,
  revenueChartTitle,
  revenueGranularity,
} from "@/lib/dashboard-range";
import {
  getFirmSettings,
  getInvoices,
  getLeads,
  getProjects,
  getTasks,
} from "@/lib/store";
import { eur, fmtDate, dueState, leadStatusColor } from "@/lib/format";
import { getHostRole, getRequestHostname } from "@/lib/hosts";
import { cn } from "@/lib/utils";
import {
  fetchSiteAnalyticsSummary,
  getWebAnalyticsConfig,
} from "@/lib/vercel/web-analytics";

export const dynamic = "force-dynamic";

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const reqHeaders = await headers();
  const role = getHostRole(getRequestHostname(reqHeaders.get("host")));
  if (role === "client") {
    const { client } = await requireClientSession();
    if (!client.onboardingCompletedAt) {
      redirect("/onboarding");
    }
    redirect("/projects");
  }

  // localhost / unified: linked client accounts use the portal, not studio home
  if (role === "unified") {
    const session = await tryClientPortalSession();
    if (session) {
      if (!session.client.onboardingCompletedAt) {
        redirect("/onboarding");
      }
      redirect("/projects");
    }
  }

  const { range: rangeParam } = await searchParams;
  const range = parseDashboardRange(rangeParam);
  const bounds = rangeBounds(range);
  const rangeLabel = dashboardRangeLabels[range];

  const [leads, projects, tasks, settings, invoices] = await Promise.all([
    getLeads(),
    getProjects(),
    getTasks(),
    getFirmSettings(),
    getInvoices(),
  ]);
  const { revenueGoal, firmName } = settings;
  const goalYear = new Date().getFullYear();
  const selectedKpis = normalizeDashboardKpis(settings.dashboardKpis);

  let siteAnalytics: SiteAnalyticsKpiData | null = null;
  if (selectionNeedsSiteAnalytics(selectedKpis)) {
    const analyticsConfig = getWebAnalyticsConfig();
    if (analyticsConfig) {
      try {
        siteAnalytics = await fetchSiteAnalyticsSummary(
          analyticsConfig,
          range
        );
      } catch {
        siteAnalytics = null;
      }
    }
  }

  const chartGranularity = revenueGranularity(bounds);
  const monthlyRevenue = monthlyInvoiceRevenueInRange(invoices, bounds);
  const kpiStats = computeDashboardKpis({
    leads,
    bounds,
    invoices,
    projects,
    revenueGoal: settings.revenueGoal,
    selected: selectedKpis,
    siteAnalytics,
  });

  const actualRevenue = paidInvoiceRevenueInRange(invoices, bounds);
  const outstanding = outstandingInvoiceTotal(invoices);
  const pricedProjects = projects.filter(
    (p) =>
      !isArchived(p) &&
      p.value > 0 &&
      isDateInRange(p.start, bounds)
  );
  const avgProjectValue = pricedProjects.length
    ? Math.round(
        pricedProjects.reduce((s, p) => s + p.value, 0) / pricedProjects.length
      )
    : 0;

  const overdueFollowUps = leads
    .filter(
      (l) =>
        l.nextFollowUp &&
        dueState(l.nextFollowUp) === "overdue" &&
        !["Won", "Lost", "Not suitable"].includes(l.status)
    )
    .sort((a, b) => (a.nextFollowUp! < b.nextFollowUp! ? -1 : 1));

  const dueSoon = leads
    .filter((l) => {
      if (!l.nextFollowUp) return false;
      if (["Won", "Lost", "Not suitable"].includes(l.status)) return false;
      const state = dueState(l.nextFollowUp);
      return state === "today" || state === "soon";
    })
    .sort((a, b) => (a.nextFollowUp! < b.nextFollowUp! ? -1 : 1))
    .slice(0, 8);

  const upcomingFollowUps = leads
    .filter((l) => {
      if (!l.nextFollowUp) return false;
      if (["Won", "Lost", "Not suitable"].includes(l.status)) return false;
      return dueState(l.nextFollowUp) === "later";
    })
    .sort((a, b) => (a.nextFollowUp! < b.nextFollowUp! ? -1 : 1))
    .slice(0, 4);

  const hotLeads = [...leads]
    .filter((l) => !["Won", "Lost", "Not suitable"].includes(l.status))
    .sort((a, b) => b.value * b.probability - a.value * a.probability)
    .slice(0, 5);

  const openTasks = tasks
    .filter((t) => t.status !== "Done")
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 6);

  const overdueTasks = openTasks.filter((t) => dueState(t.due) === "overdue");

  const showGoal = range === "this_year" || range === "all";
  const goalTarget =
    range === "this_year" || range === "all" ? revenueGoal : actualRevenue;
  const goalPct = showGoal
    ? Math.min(100, Math.round((actualRevenue / (revenueGoal || 1)) * 100))
    : 100;
  const projectsToGo =
    showGoal && avgProjectValue > 0
      ? Math.max(
          0,
          Math.ceil((revenueGoal - actualRevenue) / avgProjectValue)
        )
      : 0;

  const monthlyPace = Math.round(
    actualRevenue / Math.max(1, monthsSpanned(bounds))
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Dashboard"
        description={`${firmName} · ${rangeLabel.toLowerCase()} · what needs attention and how revenue is tracking.`}
      >
        <DashboardRangeSelect value={range} />
      </PageHeader>

      {kpiStats.length > 0 ? (
        <div className={dashboardKpiGridClass(kpiStats.length)}>
          {kpiStats.map((kpi) => (
            <StatCard
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              sub={kpi.sub}
              icon={kpi.icon}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{revenueChartTitle(chartGranularity)}</CardTitle>
            <CardDescription>
              Paid invoices · {rangeLabel.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueAreaChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {showGoal ? `${goalYear} revenue goal` : "Collected"}
            </CardTitle>
            <CardDescription>
              {showGoal ? (
                <Link href="/settings" className="hover:text-foreground">
                  {firmName} · edit in Settings
                </Link>
              ) : (
                rangeLabel
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
                Collected
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="app-display text-3xl italic tracking-tight">
                  {eur(actualRevenue)}
                </span>
                {showGoal ? (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    / {eur(goalTarget)}
                  </span>
                ) : null}
              </div>
              {showGoal ? (
                <>
                  <Progress
                    value={goalPct}
                    className="mt-4 h-1.5 bg-[color:var(--chart-1)]/15"
                    indicatorClassName="bg-[color:var(--chart-1)]"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {goalPct}% reached ·{" "}
                    {eur(Math.max(0, revenueGoal - actualRevenue))} to go
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  In selected period
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
              <div>
                <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
                  Outstanding
                </p>
                <p className="app-display mt-1 text-xl italic tracking-tight">
                  {eur(outstanding)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Issued, unpaid
                </p>
              </div>
              <div>
                <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
                  Monthly pace
                </p>
                <p className="app-display mt-1 text-xl italic tracking-tight">
                  {eur(monthlyPace)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
                  Projects to go
                </p>
                <p className="app-display mt-1 text-xl italic tracking-tight">
                  {showGoal && avgProjectValue > 0 ? `~${projectsToGo}` : "—"}
                </p>
                {showGoal && avgProjectValue > 0 ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    avg {eur(avgProjectValue)}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action board */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <AlertCircle className="size-3.5" />
                </span>
                Needs a follow-up
              </CardTitle>
              <CardDescription>
                Overdue first, then the next 7 days — then anything further out
              </CardDescription>
            </div>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              All leads <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {overdueFollowUps.length === 0 &&
            dueSoon.length === 0 &&
            upcomingFollowUps.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <CalendarClock className="size-5" />
                </span>
                <p className="text-sm font-medium">No follow-ups queued</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  When you send outreach, a follow-up date is set automatically —
                  or add one on a lead.
                </p>
                <Link
                  href="/leads"
                  className="mt-4 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Browse leads
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {overdueFollowUps.map((l) => {
                  const days = Math.abs(daysUntil(l.nextFollowUp!));
                  return (
                    <li key={l.id}>
                      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-rose-50/60 dark:hover:bg-rose-950/20 sm:gap-4 sm:px-6 sm:py-3.5">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
                        >
                          <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            <span className="text-sm font-semibold leading-none">
                              {days}
                            </span>
                            <span className="text-[10px] leading-tight">
                              {days === 1 ? "day" : "days"}
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {l.company}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Overdue · {l.contact || "—"}
                            </p>
                          </div>
                          <StatusPill
                            label={l.status}
                            className={cn(
                              "hidden sm:inline-flex",
                              leadStatusColor[l.status]
                            )}
                          />
                        </Link>
                        <FollowUpRowActions leadId={l.id} />
                      </div>
                    </li>
                  );
                })}
                {dueSoon.map((l) => {
                  const days = daysUntil(l.nextFollowUp!);
                  const isToday = days === 0;
                  return (
                    <li key={`soon-${l.id}`}>
                      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-6 sm:py-3.5">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg",
                              isToday
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isToday ? (
                              <CalendarClock className="size-4" />
                            ) : (
                              <>
                                <span className="text-sm font-semibold leading-none">
                                  {days}
                                </span>
                                <span className="text-[10px] leading-tight">
                                  {days === 1 ? "day" : "days"}
                                </span>
                              </>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {l.company}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {isToday ? "Today" : fmtDate(l.nextFollowUp)} ·{" "}
                              {l.contact || "—"}
                            </p>
                          </div>
                        </Link>
                        <FollowUpRowActions leadId={l.id} />
                      </div>
                    </li>
                  );
                })}
                {upcomingFollowUps.map((l) => {
                  const days = daysUntil(l.nextFollowUp!);
                  return (
                    <li key={`later-${l.id}`}>
                      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-6 sm:py-3.5">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
                        >
                          <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                            <span className="text-sm font-semibold leading-none">
                              {days}
                            </span>
                            <span className="text-[10px] leading-tight">d</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {l.company}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {fmtDate(l.nextFollowUp)} · {l.contact || "—"}
                            </p>
                          </div>
                        </Link>
                        <FollowUpRowActions leadId={l.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Flame className="size-3.5" />
                </span>
                Hottest deals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2 pt-0">
              {hotLeads.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <span className="w-4 text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.probability}% · {l.status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{eur(l.value)}</span>
                </Link>
              ))}
              {hotLeads.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No open deals yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CheckSquare className="size-3.5" />
                </span>
                Open tasks
                {overdueTasks.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                    {overdueTasks.length} overdue
                  </span>
                )}
              </CardTitle>
              <Link
                href="/tasks"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-1 p-2 pt-0">
              {openTasks.map((t) => {
                const state = dueState(t.due);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.priority}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        state === "overdue" && "font-medium text-rose-600",
                        state === "today" && "font-medium text-amber-600",
                        state !== "overdue" &&
                          state !== "today" &&
                          "text-muted-foreground"
                      )}
                    >
                      {fmtDate(t.due)}
                    </span>
                  </div>
                );
              })}
              {openTasks.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No open tasks.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="flex justify-center px-2 pt-14 pb-6 sm:pt-20 sm:pb-10">
        <p className="app-display text-center text-4xl italic leading-none tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Unseen reps
        </p>
      </footer>
    </div>
  );
}
