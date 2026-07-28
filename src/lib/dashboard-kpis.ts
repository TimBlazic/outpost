import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Ban,
  Binoculars,
  CalendarCheck,
  CalendarClock,
  CircleDot,
  Clock,
  Crosshair,
  FileText,
  Eye,
  Flame,
  Gauge,
  Globe,
  Handshake,
  HelpCircle,
  Inbox,
  Layers,
  Link2,
  Mail,
  MapPin,
  MessageSquareReply,
  MousePointerClick,
  Percent,
  PhoneCall,
  Radar,
  Receipt,
  Search,
  Send,
  Share2,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Target,
  Thermometer,
  ThumbsDown,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import type { Invoice, Lead, Project } from "@/lib/data";
import { isArchived } from "@/lib/data";
import type { DateBounds } from "@/lib/dashboard-range";
import { invoiceRevenueDate } from "@/lib/data";
import {
  isDateInRange,
  leadActivityDate,
  outstandingInvoiceTotal,
  paidInvoiceRevenueInRange,
} from "@/lib/dashboard-range";
import { dueState, eur } from "@/lib/format";

export const dashboardKpiIds = [
  "new_leads",
  "created_leads",
  "researching",
  "ready_to_contact",
  "qualified_go",
  "qualified_maybe",
  "qualified_nogo",
  "high_fit",
  "avg_qualify_score",
  "unscored",
  "uncontacted",
  "contacted",
  "contacted_status",
  "follow_up_needed",
  "replied",
  "reply_rate",
  "meetings",
  "meeting_rate",
  "proposals",
  "proposal_sent",
  "proposal_rate",
  "negotiating",
  "won",
  "avg_won_deal",
  "win_from_contact",
  "lost",
  "not_suitable",
  "open_leads",
  "hot_open",
  "pipeline_value",
  "weighted_pipeline",
  "avg_open_deal",
  "conversion",
  "overdue_followups",
  "due_followups",
  "no_followup",
  "stale_leads",
  "cold_email",
  "inbound",
  "hunt",
  "referral",
  "collected",
  "outstanding",
  "goal_progress",
  "paid_invoices",
  "issued_invoices",
  "active_projects",
  "project_value",
  "web_visitors",
  "web_pageviews",
  "web_pages_per_visit",
  "web_top_page",
  "web_top_referrer",
  "web_top_country",
  "web_mobile_share",
] as const;

export type DashboardKpiId = (typeof dashboardKpiIds)[number];

/** KPIs that need a Vercel Web Analytics fetch for timblazic.dev. */
export const siteAnalyticsKpiIds = [
  "web_visitors",
  "web_pageviews",
  "web_pages_per_visit",
  "web_top_page",
  "web_top_referrer",
  "web_top_country",
  "web_mobile_share",
] as const satisfies readonly DashboardKpiId[];

export function selectionNeedsSiteAnalytics(selected: DashboardKpiId[]) {
  return selected.some((id) =>
    (siteAnalyticsKpiIds as readonly string[]).includes(id)
  );
}

export type SiteAnalyticsKpiData = {
  visitors: number;
  pageviews: number;
  topPage: { path: string; visitors: number } | null;
  topReferrer: { host: string; visitors: number } | null;
  topCountry: { code: string; visitors: number } | null;
  mobileShare: number | null;
};

export type DashboardKpiMeta = {
  id: DashboardKpiId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const dashboardKpiCatalog: DashboardKpiMeta[] = [
  {
    id: "new_leads",
    label: "New leads",
    description: "Still in New / Researching / Ready to contact.",
    icon: Users,
  },
  {
    id: "created_leads",
    label: "Leads added",
    description: "Leads created in the selected range.",
    icon: UserPlus,
  },
  {
    id: "researching",
    label: "Researching",
    description: "Leads currently in Researching.",
    icon: Search,
  },
  {
    id: "ready_to_contact",
    label: "Ready to contact",
    description: "Waiting for first outreach.",
    icon: Crosshair,
  },
  {
    id: "qualified_go",
    label: "Qualified go",
    description: "AI go rating, with average deal value.",
    icon: Sparkles,
  },
  {
    id: "qualified_maybe",
    label: "Qualified maybe",
    description: "AI maybe rating in range.",
    icon: HelpCircle,
  },
  {
    id: "qualified_nogo",
    label: "Qualified no-go",
    description: "AI no-go rating in range.",
    icon: ThumbsDown,
  },
  {
    id: "high_fit",
    label: "High fit (70+)",
    description: "Leads with qualify score ≥ 70.",
    icon: Star,
  },
  {
    id: "avg_qualify_score",
    label: "Avg qualify score",
    description: "Average fit score of scored leads in range.",
    icon: Gauge,
  },
  {
    id: "unscored",
    label: "Unscored open",
    description: "Open leads never AI-qualified.",
    icon: Radar,
  },
  {
    id: "uncontacted",
    label: "Uncontacted",
    description: "Open leads with no first outreach yet.",
    icon: Snowflake,
  },
  {
    id: "contacted",
    label: "Contacted",
    description: "First outreach in range, with avg + total value.",
    icon: PhoneCall,
  },
  {
    id: "contacted_status",
    label: "Status: Contacted",
    description: "Leads currently in Contacted status.",
    icon: PhoneCall,
  },
  {
    id: "follow_up_needed",
    label: "Follow-up needed",
    description: "Marked Follow-up needed.",
    icon: CalendarClock,
  },
  {
    id: "replied",
    label: "Replied",
    description: "Leads that replied in range.",
    icon: MessageSquareReply,
  },
  {
    id: "reply_rate",
    label: "Reply rate",
    description: "Replied ÷ contacted in range.",
    icon: Percent,
  },
  {
    id: "meetings",
    label: "Meetings booked",
    description: "Leads with a meeting booked.",
    icon: CalendarCheck,
  },
  {
    id: "meeting_rate",
    label: "Meeting rate",
    description: "Meetings ÷ contacted in range.",
    icon: Percent,
  },
  {
    id: "proposals",
    label: "Proposals sent",
    description: "Proposal / negotiating / won, with avg + total.",
    icon: Send,
  },
  {
    id: "proposal_sent",
    label: "Status: Proposal",
    description: "Currently in Proposal sent.",
    icon: FileText,
  },
  {
    id: "proposal_rate",
    label: "Proposal rate",
    description: "Proposals ÷ contacted in range.",
    icon: Percent,
  },
  {
    id: "negotiating",
    label: "Negotiating",
    description: "Leads currently negotiating.",
    icon: Handshake,
  },
  {
    id: "won",
    label: "Won",
    description: "Closed-won deals, with total value.",
    icon: Trophy,
  },
  {
    id: "avg_won_deal",
    label: "Avg won deal",
    description: "Average value of won deals in range.",
    icon: Trophy,
  },
  {
    id: "win_from_contact",
    label: "Win from contact",
    description: "Won ÷ contacted in range.",
    icon: Target,
  },
  {
    id: "lost",
    label: "Lost",
    description: "Lost deals in range.",
    icon: XCircle,
  },
  {
    id: "not_suitable",
    label: "Not suitable",
    description: "Marked not suitable in range.",
    icon: Ban,
  },
  {
    id: "open_leads",
    label: "Open leads",
    description: "Current open leads.",
    icon: CircleDot,
  },
  {
    id: "hot_open",
    label: "Hot open",
    description: "Open leads with probability ≥ 50%.",
    icon: Thermometer,
  },
  {
    id: "pipeline_value",
    label: "Pipeline value",
    description: "Sum of open lead values (current).",
    icon: TrendingUp,
  },
  {
    id: "weighted_pipeline",
    label: "Weighted pipeline",
    description: "Open value × probability.",
    icon: Flame,
  },
  {
    id: "avg_open_deal",
    label: "Avg open deal",
    description: "Average value of current open leads.",
    icon: Layers,
  },
  {
    id: "conversion",
    label: "Conversion",
    description: "Won ÷ (won + lost) in range.",
    icon: Target,
  },
  {
    id: "overdue_followups",
    label: "Overdue follow-ups",
    description: "Open leads with overdue follow-up.",
    icon: AlertCircle,
  },
  {
    id: "due_followups",
    label: "Due soon",
    description: "Follow-ups due today or soon.",
    icon: CalendarClock,
  },
  {
    id: "no_followup",
    label: "No follow-up set",
    description: "Open leads without a next follow-up.",
    icon: Clock,
  },
  {
    id: "stale_leads",
    label: "Stale (14d+)",
    description: "Open leads quiet for 14+ days.",
    icon: Clock,
  },
  {
    id: "cold_email",
    label: "Cold email source",
    description: "Leads sourced from Cold email.",
    icon: Mail,
  },
  {
    id: "inbound",
    label: "Inbound / website",
    description: "Website or Inbound source.",
    icon: Globe,
  },
  {
    id: "hunt",
    label: "From Hunt",
    description: "Leads tagged from Hunt.",
    icon: Binoculars,
  },
  {
    id: "referral",
    label: "Referrals",
    description: "Leads sourced from Referral.",
    icon: Link2,
  },
  {
    id: "collected",
    label: "Collected",
    description: "Paid invoice revenue in range.",
    icon: Wallet,
  },
  {
    id: "outstanding",
    label: "Outstanding",
    description: "Issued invoices still unpaid.",
    icon: Receipt,
  },
  {
    id: "goal_progress",
    label: "Goal progress",
    description: "Collected vs yearly revenue goal.",
    icon: Gauge,
  },
  {
    id: "paid_invoices",
    label: "Paid invoices",
    description: "Count of paid invoices in range.",
    icon: Receipt,
  },
  {
    id: "issued_invoices",
    label: "Issued unpaid",
    description: "Count of issued (unpaid) invoices.",
    icon: FileText,
  },
  {
    id: "active_projects",
    label: "Active projects",
    description: "Non-archived projects.",
    icon: Layers,
  },
  {
    id: "project_value",
    label: "Project book",
    description: "Sum of active project values.",
    icon: Inbox,
  },
  {
    id: "web_visitors",
    label: "Site visitors",
    description: "timblazic.dev unique visitors (Vercel Analytics).",
    icon: Eye,
  },
  {
    id: "web_pageviews",
    label: "Site pageviews",
    description: "timblazic.dev pageviews in the selected range.",
    icon: Globe,
  },
  {
    id: "web_pages_per_visit",
    label: "Pages / visit",
    description: "Pageviews ÷ visitors on timblazic.dev.",
    icon: MousePointerClick,
  },
  {
    id: "web_top_page",
    label: "Top page",
    description: "Most-visited path on timblazic.dev.",
    icon: MousePointerClick,
  },
  {
    id: "web_top_referrer",
    label: "Top referrer",
    description: "Top traffic source hostname.",
    icon: Share2,
  },
  {
    id: "web_top_country",
    label: "Top country",
    description: "Country with the most visitors.",
    icon: MapPin,
  },
  {
    id: "web_mobile_share",
    label: "Mobile share",
    description: "% of visitors on mobile devices.",
    icon: Smartphone,
  },
];

/** Default strip — matches the previous always-on dashboard cards. */
export const defaultDashboardKpis: DashboardKpiId[] = [
  "new_leads",
  "qualified_go",
  "contacted",
  "proposals",
  "pipeline_value",
  "conversion",
];

export function isDashboardKpiId(value: string): value is DashboardKpiId {
  return (dashboardKpiIds as readonly string[]).includes(value);
}

export function normalizeDashboardKpis(value: unknown): DashboardKpiId[] {
  if (!Array.isArray(value)) return [...defaultDashboardKpis];
  const seen = new Set<DashboardKpiId>();
  const next: DashboardKpiId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isDashboardKpiId(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    next.push(item);
  }
  return next.length ? next : [...defaultDashboardKpis];
}

export type DashboardKpiStat = {
  id: DashboardKpiId;
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
};

function avgOf(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function moneySub(avg: number, total: number, pricedCount: number) {
  if (!pricedCount) return "avg — · total —";
  return `avg ${eur(avg)} · total ${eur(total)}`;
}

function statusCount(leads: Lead[], status: Lead["status"]) {
  return leads.filter((l) => l.status === status).length;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function lastTouchDay(lead: Lead) {
  return (
    daysSince(lead.lastContact) ??
    daysSince(lead.firstContact) ??
    daysSince(lead.createdAt)
  );
}

function fmtCount(n: number) {
  return n.toLocaleString("en-GB");
}

function truncatePath(path: string, max = 22) {
  if (path.length <= max) return path;
  return `${path.slice(0, max - 1)}…`;
}

export function computeDashboardKpis(input: {
  leads: Lead[];
  bounds: DateBounds;
  selected: DashboardKpiId[];
  invoices?: Invoice[];
  projects?: Project[];
  revenueGoal?: number;
  /** timblazic.dev Vercel Analytics — null = not configured / fetch failed */
  siteAnalytics?: SiteAnalyticsKpiData | null;
}): DashboardKpiStat[] {
  const {
    leads,
    bounds,
    invoices = [],
    projects = [],
    revenueGoal = 0,
    siteAnalytics = null,
  } = input;
  const selected = normalizeDashboardKpis(input.selected);
  const periodLeads = leads.filter((l) =>
    isDateInRange(leadActivityDate(l), bounds)
  );
  const createdLeads = leads.filter((l) =>
    isDateInRange(l.createdAt, bounds)
  ).length;

  const newLeads = periodLeads.filter((l) =>
    ["New", "Researching", "Ready to contact"].includes(l.status)
  ).length;

  const qualifiedGoLeads = periodLeads.filter((l) => l.qualifyRating === "go");
  const pricedGo = qualifiedGoLeads.filter((l) => l.value > 0).map((l) => l.value);
  const qualifiedMaybe = periodLeads.filter(
    (l) => l.qualifyRating === "maybe"
  ).length;
  const qualifiedNogo = periodLeads.filter(
    (l) => l.qualifyRating === "no-go"
  ).length;
  const scoredPeriod = periodLeads.filter((l) => l.qualifyScore != null);
  const highFit = scoredPeriod.filter(
    (l) => (l.qualifyScore ?? 0) >= 70
  ).length;
  const avgQualifyScore = scoredPeriod.length
    ? Math.round(
        scoredPeriod.reduce((s, l) => s + (l.qualifyScore ?? 0), 0) /
          scoredPeriod.length
      )
    : 0;

  const contactedLeads = leads.filter(
    (l) => Boolean(l.firstContact) && isDateInRange(l.firstContact, bounds)
  );
  const contactedValues = contactedLeads
    .filter((l) => l.value > 0)
    .map((l) => l.value);
  const contactedTotal = contactedLeads.reduce((s, l) => s + l.value, 0);

  const replied = statusCount(periodLeads, "Replied");
  const meetings = statusCount(periodLeads, "Meeting booked");
  const replyRate = rate(replied, contactedLeads.length);
  const meetingRate = rate(meetings, contactedLeads.length);

  const proposalLeads = periodLeads.filter((l) =>
    ["Proposal sent", "Negotiating", "Won"].includes(l.status)
  );
  const pricedProposals = proposalLeads
    .filter((l) => l.value > 0)
    .map((l) => l.value);
  const proposalTotal = proposalLeads.reduce((s, l) => s + l.value, 0);
  const proposalRate = rate(proposalLeads.length, contactedLeads.length);

  const wonLeads = periodLeads.filter((l) => l.status === "Won");
  const lostLeads = periodLeads.filter((l) => l.status === "Lost");
  const wonValues = wonLeads.filter((l) => l.value > 0).map((l) => l.value);
  const wonTotal = wonLeads.reduce((s, l) => s + l.value, 0);
  const lostTotal = lostLeads.reduce((s, l) => s + l.value, 0);
  const conversionRate = rate(
    wonLeads.length,
    wonLeads.length + lostLeads.length
  );
  const winFromContact = rate(wonLeads.length, contactedLeads.length);

  const openLeads = leads.filter(
    (l) => !["Won", "Lost", "Not suitable"].includes(l.status)
  );
  const pipelineValue = openLeads.reduce((s, l) => s + l.value, 0);
  const weightedPipeline = Math.round(
    openLeads.reduce((s, l) => s + (l.value * l.probability) / 100, 0)
  );
  const openPriced = openLeads.filter((l) => l.value > 0).map((l) => l.value);
  const hotOpen = openLeads.filter((l) => l.probability >= 50).length;
  const uncontacted = openLeads.filter((l) => !l.firstContact).length;
  const unscored = openLeads.filter((l) => l.qualifyScore == null).length;
  const noFollowup = openLeads.filter((l) => !l.nextFollowUp).length;
  const staleLeads = openLeads.filter((l) => {
    const days = lastTouchDay(l);
    return days != null && days >= 14;
  }).length;

  const overdueFollowups = openLeads.filter(
    (l) => l.nextFollowUp && dueState(l.nextFollowUp) === "overdue"
  ).length;
  const dueFollowups = openLeads.filter((l) => {
    if (!l.nextFollowUp) return false;
    const state = dueState(l.nextFollowUp);
    return state === "today" || state === "soon";
  }).length;

  const coldEmail = periodLeads.filter((l) => l.source === "Cold email").length;
  const inbound = periodLeads.filter((l) =>
    ["Website", "Inbound"].includes(l.source)
  ).length;
  const hunt = periodLeads.filter((l) =>
    (l.tags ?? []).some((t) => t.toLowerCase() === "hunt")
  ).length;
  const referral = periodLeads.filter((l) => l.source === "Referral").length;

  const collected = paidInvoiceRevenueInRange(invoices, bounds);
  const outstanding = outstandingInvoiceTotal(invoices);
  const paidInvoices = invoices.filter((i) => {
    const day = invoiceRevenueDate(i);
    return Boolean(day) && isDateInRange(day, bounds);
  }).length;
  const issuedInvoices = invoices.filter((i) => i.status === "issued").length;
  const activeProjectsList = projects.filter((p) => !isArchived(p));
  const activeProjects = activeProjectsList.length;
  const projectValue = activeProjectsList.reduce((s, p) => s + p.value, 0);
  const goalPct =
    revenueGoal > 0
      ? Math.min(100, Math.round((collected / revenueGoal) * 100))
      : 0;

  const byId: Record<DashboardKpiId, Omit<DashboardKpiStat, "id">> = {
    new_leads: {
      label: "New leads",
      value: String(newLeads),
      icon: Users,
    },
    created_leads: {
      label: "Leads added",
      value: String(createdLeads),
      icon: UserPlus,
    },
    researching: {
      label: "Researching",
      value: String(statusCount(periodLeads, "Researching")),
      icon: Search,
    },
    ready_to_contact: {
      label: "Ready to contact",
      value: String(statusCount(periodLeads, "Ready to contact")),
      icon: Crosshair,
    },
    qualified_go: {
      label: "Qualified go",
      value: String(qualifiedGoLeads.length),
      sub:
        pricedGo.length > 0
          ? `avg deal ${eur(avgOf(pricedGo))}`
          : "avg deal —",
      icon: Sparkles,
    },
    qualified_maybe: {
      label: "Qualified maybe",
      value: String(qualifiedMaybe),
      icon: HelpCircle,
    },
    qualified_nogo: {
      label: "Qualified no-go",
      value: String(qualifiedNogo),
      icon: ThumbsDown,
    },
    high_fit: {
      label: "High fit (70+)",
      value: String(highFit),
      sub: `${scoredPeriod.length} scored`,
      icon: Star,
    },
    avg_qualify_score: {
      label: "Avg qualify score",
      value: scoredPeriod.length ? String(avgQualifyScore) : "—",
      sub: scoredPeriod.length ? `${scoredPeriod.length} scored` : "no scores",
      icon: Gauge,
    },
    unscored: {
      label: "Unscored open",
      value: String(unscored),
      icon: Radar,
    },
    uncontacted: {
      label: "Uncontacted",
      value: String(uncontacted),
      icon: Snowflake,
    },
    contacted: {
      label: "Contacted",
      value: String(contactedLeads.length),
      sub: moneySub(
        avgOf(contactedValues),
        contactedTotal,
        contactedValues.length
      ),
      icon: PhoneCall,
    },
    contacted_status: {
      label: "Status: Contacted",
      value: String(statusCount(periodLeads, "Contacted")),
      icon: PhoneCall,
    },
    follow_up_needed: {
      label: "Follow-up needed",
      value: String(statusCount(periodLeads, "Follow-up needed")),
      icon: CalendarClock,
    },
    replied: {
      label: "Replied",
      value: String(replied),
      icon: MessageSquareReply,
    },
    reply_rate: {
      label: "Reply rate",
      value: `${replyRate}%`,
      sub: `${replied} replied · ${contactedLeads.length} contacted`,
      icon: Percent,
    },
    meetings: {
      label: "Meetings booked",
      value: String(meetings),
      icon: CalendarCheck,
    },
    meeting_rate: {
      label: "Meeting rate",
      value: `${meetingRate}%`,
      sub: `${meetings} meetings · ${contactedLeads.length} contacted`,
      icon: Percent,
    },
    proposals: {
      label: "Proposals sent",
      value: String(proposalLeads.length),
      sub: moneySub(
        avgOf(pricedProposals),
        proposalTotal,
        pricedProposals.length
      ),
      icon: Send,
    },
    proposal_sent: {
      label: "Status: Proposal",
      value: String(statusCount(periodLeads, "Proposal sent")),
      icon: FileText,
    },
    proposal_rate: {
      label: "Proposal rate",
      value: `${proposalRate}%`,
      sub: `${proposalLeads.length} proposals · ${contactedLeads.length} contacted`,
      icon: Percent,
    },
    negotiating: {
      label: "Negotiating",
      value: String(statusCount(periodLeads, "Negotiating")),
      icon: Handshake,
    },
    won: {
      label: "Won",
      value: String(wonLeads.length),
      sub: wonLeads.length ? `total ${eur(wonTotal)}` : "total —",
      icon: Trophy,
    },
    avg_won_deal: {
      label: "Avg won deal",
      value: wonValues.length ? eur(avgOf(wonValues)) : "—",
      sub: `${wonLeads.length} won`,
      icon: Trophy,
    },
    win_from_contact: {
      label: "Win from contact",
      value: `${winFromContact}%`,
      sub: `${wonLeads.length} won · ${contactedLeads.length} contacted`,
      icon: Target,
    },
    lost: {
      label: "Lost",
      value: String(lostLeads.length),
      sub: lostLeads.length ? `total ${eur(lostTotal)}` : "total —",
      icon: XCircle,
    },
    not_suitable: {
      label: "Not suitable",
      value: String(statusCount(periodLeads, "Not suitable")),
      icon: Ban,
    },
    open_leads: {
      label: "Open leads",
      value: String(openLeads.length),
      icon: CircleDot,
    },
    hot_open: {
      label: "Hot open",
      value: String(hotOpen),
      sub: "probability ≥ 50%",
      icon: Thermometer,
    },
    pipeline_value: {
      label: "Pipeline value",
      value: eur(pipelineValue),
      icon: TrendingUp,
    },
    weighted_pipeline: {
      label: "Weighted pipeline",
      value: eur(weightedPipeline),
      sub: "value × probability",
      icon: Flame,
    },
    avg_open_deal: {
      label: "Avg open deal",
      value: openPriced.length ? eur(avgOf(openPriced)) : "—",
      sub: `${openPriced.length} priced`,
      icon: Layers,
    },
    conversion: {
      label: "Conversion",
      value: `${conversionRate}%`,
      sub: `${wonLeads.length} won · ${lostLeads.length} lost`,
      icon: Target,
    },
    overdue_followups: {
      label: "Overdue follow-ups",
      value: String(overdueFollowups),
      icon: AlertCircle,
    },
    due_followups: {
      label: "Due soon",
      value: String(dueFollowups),
      sub: "today + next few days",
      icon: CalendarClock,
    },
    no_followup: {
      label: "No follow-up set",
      value: String(noFollowup),
      icon: Clock,
    },
    stale_leads: {
      label: "Stale (14d+)",
      value: String(staleLeads),
      sub: "no touch in 14+ days",
      icon: Clock,
    },
    cold_email: {
      label: "Cold email source",
      value: String(coldEmail),
      icon: Mail,
    },
    inbound: {
      label: "Inbound / website",
      value: String(inbound),
      icon: Globe,
    },
    hunt: {
      label: "From Hunt",
      value: String(hunt),
      icon: Binoculars,
    },
    referral: {
      label: "Referrals",
      value: String(referral),
      icon: Link2,
    },
    collected: {
      label: "Collected",
      value: eur(collected),
      sub: "paid invoices",
      icon: Wallet,
    },
    outstanding: {
      label: "Outstanding",
      value: eur(outstanding),
      sub: "issued, unpaid",
      icon: Receipt,
    },
    goal_progress: {
      label: "Goal progress",
      value: revenueGoal > 0 ? `${goalPct}%` : "—",
      sub:
        revenueGoal > 0
          ? `${eur(collected)} / ${eur(revenueGoal)}`
          : "set goal in Settings",
      icon: Gauge,
    },
    paid_invoices: {
      label: "Paid invoices",
      value: String(paidInvoices),
      icon: Receipt,
    },
    issued_invoices: {
      label: "Issued unpaid",
      value: String(issuedInvoices),
      icon: FileText,
    },
    active_projects: {
      label: "Active projects",
      value: String(activeProjects),
      icon: Layers,
    },
    project_value: {
      label: "Project book",
      value: eur(projectValue),
      sub: `${activeProjects} active`,
      icon: Inbox,
    },
    web_visitors: {
      label: "Site visitors",
      value: siteAnalytics ? fmtCount(siteAnalytics.visitors) : "—",
      sub: siteAnalytics ? "timblazic.dev" : "connect in Analytics",
      icon: Eye,
    },
    web_pageviews: {
      label: "Site pageviews",
      value: siteAnalytics ? fmtCount(siteAnalytics.pageviews) : "—",
      sub: siteAnalytics ? "timblazic.dev" : "connect in Analytics",
      icon: Globe,
    },
    web_pages_per_visit: {
      label: "Pages / visit",
      value:
        siteAnalytics && siteAnalytics.visitors > 0
          ? (siteAnalytics.pageviews / siteAnalytics.visitors).toFixed(1)
          : "—",
      sub: siteAnalytics ? "pageviews ÷ visitors" : "connect in Analytics",
      icon: MousePointerClick,
    },
    web_top_page: {
      label: "Top page",
      value: siteAnalytics?.topPage
        ? truncatePath(siteAnalytics.topPage.path)
        : "—",
      sub: siteAnalytics?.topPage
        ? `${fmtCount(siteAnalytics.topPage.visitors)} visitors`
        : siteAnalytics
          ? "no pages yet"
          : "connect in Analytics",
      icon: MousePointerClick,
    },
    web_top_referrer: {
      label: "Top referrer",
      value: siteAnalytics?.topReferrer
        ? truncatePath(siteAnalytics.topReferrer.host, 20)
        : "—",
      sub: siteAnalytics?.topReferrer
        ? `${fmtCount(siteAnalytics.topReferrer.visitors)} visitors`
        : siteAnalytics
          ? "direct / none"
          : "connect in Analytics",
      icon: Share2,
    },
    web_top_country: {
      label: "Top country",
      value: siteAnalytics?.topCountry?.code ?? "—",
      sub: siteAnalytics?.topCountry
        ? `${fmtCount(siteAnalytics.topCountry.visitors)} visitors`
        : siteAnalytics
          ? "no data"
          : "connect in Analytics",
      icon: MapPin,
    },
    web_mobile_share: {
      label: "Mobile share",
      value:
        siteAnalytics?.mobileShare != null
          ? `${siteAnalytics.mobileShare}%`
          : "—",
      sub: siteAnalytics ? "of visitors" : "connect in Analytics",
      icon: Smartphone,
    },
  };

  return selected.map((id) => ({ id, ...byId[id] }));
}

export function dashboardKpiGridClass(count: number) {
  if (count <= 2) return "grid grid-cols-2 gap-4";
  if (count === 3) return "grid grid-cols-2 gap-4 md:grid-cols-3";
  if (count === 4) return "grid grid-cols-2 gap-4 md:grid-cols-4";
  if (count === 5) return "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5";
  return "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6";
}
