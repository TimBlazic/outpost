import {
  invoiceRevenueDate,
  paymentAmount,
  type Invoice,
  type MonthlyRevenuePoint,
  type Project,
} from "@/lib/data";

export const dashboardRanges = [
  "all",
  "last_year",
  "this_year",
  "last_6_months",
  "last_3_months",
  "this_month",
  "last_7_days",
] as const;

export type DashboardRange = (typeof dashboardRanges)[number];

export const dashboardRangeLabels: Record<DashboardRange, string> = {
  all: "All time",
  last_year: "Last year",
  this_year: "This year",
  last_6_months: "Last 6 months",
  last_3_months: "Last 3 months",
  this_month: "This month",
  last_7_days: "Last 7 days",
};

export function parseDashboardRange(
  value: string | undefined | null
): DashboardRange {
  if (value && (dashboardRanges as readonly string[]).includes(value)) {
    return value as DashboardRange;
  }
  return "this_year";
}

export type DateBounds = {
  start: Date | null;
  end: Date;
};

export function rangeBounds(
  range: DashboardRange,
  now = new Date()
): DateBounds {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  switch (range) {
    case "all":
      return { start: null, end };
    case "this_year":
      return { start: new Date(now.getFullYear(), 0, 1), end };
    case "last_year": {
      const y = now.getFullYear() - 1;
      return {
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case "last_7_days": {
      const s = startOfDay(now);
      s.setDate(s.getDate() - 6);
      return { start: s, end };
    }
    case "last_3_months": {
      const s = startOfDay(now);
      s.setMonth(s.getMonth() - 3);
      return { start: s, end };
    }
    case "last_6_months": {
      const s = startOfDay(now);
      s.setMonth(s.getMonth() - 6);
      return { start: s, end };
    }
  }
}

function parseDay(iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Inclusive range check for YYYY-MM-DD or ISO timestamps. */
export function isDateInRange(
  iso: string | null | undefined,
  bounds: DateBounds
): boolean {
  if (!iso) return bounds.start === null;
  const d = parseDay(iso);
  if (!d) return false;
  if (bounds.start && d < bounds.start) return false;
  if (d > bounds.end) return false;
  return true;
}

/** Best available activity date for a lead in period stats. */
export function leadActivityDate(lead: {
  firstContact: string | null;
  lastContact: string | null;
}): string | null {
  return lead.firstContact ?? lead.lastContact;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Paid revenue inside bounds (uses payment `paidOn`). */
export function paidRevenueInRange(projects: Project[], bounds: DateBounds) {
  let total = 0;
  for (const project of projects) {
    for (const pay of project.payments) {
      if (!pay.paid || !pay.paidOn) continue;
      if (!isDateInRange(pay.paidOn, bounds)) continue;
      total += paymentAmount(project.value, pay.percent);
    }
  }
  return total;
}

/** Collected revenue from paid invoices in range (`paidAt`, else issue date). */
export function paidInvoiceRevenueInRange(
  invoices: Invoice[],
  bounds: DateBounds
) {
  let total = 0;
  for (const inv of invoices) {
    const day = invoiceRevenueDate(inv);
    if (!day || !isDateInRange(day, bounds)) continue;
    total += inv.total;
  }
  return total;
}

/** Issued but not yet paid — outstanding AR. */
export function outstandingInvoiceTotal(invoices: Invoice[]) {
  return invoices
    .filter((i) => i.status === "issued")
    .reduce((s, i) => s + i.total, 0);
}

export type RevenueGranularity = "day" | "week" | "month";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function earliestPaidMonth(projects: Project[], now: Date) {
  let earliest: Date | null = null;
  for (const project of projects) {
    for (const pay of project.payments) {
      if (!pay.paid || !pay.paidOn) continue;
      const d = parseDay(pay.paidOn);
      if (!d) continue;
      if (!earliest || d < earliest) earliest = d;
    }
  }
  return earliest
    ? new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);
}

function earliestInvoicePaidMonth(invoices: Invoice[], now: Date) {
  let earliest: Date | null = null;
  for (const inv of invoices) {
    const day = invoiceRevenueDate(inv);
    if (!day) continue;
    const d = parseDay(day);
    if (!d) continue;
    if (!earliest || d < earliest) earliest = d;
  }
  return earliest
    ? new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);
}

/** Pick chart bucket size from the selected window. */
export function revenueGranularity(bounds: DateBounds): RevenueGranularity {
  if (!bounds.start) return "month";
  const days =
    (startOfDay(bounds.end).getTime() - startOfDay(bounds.start).getTime()) /
      86400000 +
    1;
  if (days <= 40) return "day"; // last 7 days / this month
  if (days <= 120) return "week"; // ~3 months
  return "month";
}

export function revenueChartTitle(granularity: RevenueGranularity) {
  if (granularity === "day") return "Revenue by day";
  if (granularity === "week") return "Revenue by week";
  return "Revenue by month";
}

function formatDayLabel(d: Date) {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function formatWeekLabel(d: Date) {
  return formatDayLabel(d);
}

/**
 * Revenue chart series for the selected range.
 * Short windows use daily/weekly buckets so you get a real line, not one point.
 */
export function monthlyRevenueInRange(
  projects: Project[],
  bounds: DateBounds,
  now = new Date()
): MonthlyRevenuePoint[] {
  const granularity = revenueGranularity(bounds);
  const buckets: { key: string; label: string; revenue: number }[] = [];

  if (granularity === "day") {
    const start = startOfDay(bounds.start ?? earliestPaidMonth(projects, now));
    const end = startOfDay(bounds.end);
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      buckets.push({
        key: dayKey(cursor),
        label: formatDayLabel(cursor),
        revenue: 0,
      });
    }
  } else if (granularity === "week") {
    const start = startOfDay(bounds.start ?? earliestPaidMonth(projects, now));
    const end = startOfDay(bounds.end);
    // Align to Monday of the start week for stable buckets
    const cursor = new Date(start);
    const day = cursor.getDay(); // 0 Sun
    const toMon = day === 0 ? -6 : 1 - day;
    cursor.setDate(cursor.getDate() + toMon);
    while (cursor <= end) {
      buckets.push({
        key: dayKey(cursor),
        label: formatWeekLabel(cursor),
        revenue: 0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const start = bounds.start
      ? new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1)
      : earliestPaidMonth(projects, now);
    const endMonth = new Date(
      bounds.end.getFullYear(),
      bounds.end.getMonth(),
      1
    );
    const multiYear =
      start.getFullYear() !== bounds.end.getFullYear() ||
      bounds.start === null;
    const cursor = new Date(start);
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const label = multiYear
        ? `${SHORT_MONTHS[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`
        : SHORT_MONTHS[cursor.getMonth()];
      buckets.push({ key, label, revenue: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const project of projects) {
    for (const pay of project.payments) {
      if (!pay.paid || !pay.paidOn) continue;
      if (!isDateInRange(pay.paidOn, bounds)) continue;
      const d = parseDay(pay.paidOn);
      if (!d) continue;

      let key: string;
      if (granularity === "day") {
        key = dayKey(d);
      } else if (granularity === "week") {
        const weekStart = startOfDay(d);
        const day = weekStart.getDay();
        const toMon = day === 0 ? -6 : 1 - day;
        weekStart.setDate(weekStart.getDate() + toMon);
        key = dayKey(weekStart);
      } else {
        key = `${d.getFullYear()}-${d.getMonth()}`;
      }

      const i = index.get(key);
      if (i === undefined) continue;
      buckets[i].revenue += paymentAmount(project.value, pay.percent);
    }
  }

  if (buckets.length === 0) {
    return [{ month: SHORT_MONTHS[now.getMonth()], revenue: 0 }];
  }

  return buckets.map((b) => ({ month: b.label, revenue: b.revenue }));
}

/**
 * Revenue chart from paid invoices (paidAt / issue date).
 * Same bucket sizing as project installment chart.
 */
export function monthlyInvoiceRevenueInRange(
  invoices: Invoice[],
  bounds: DateBounds,
  now = new Date()
): MonthlyRevenuePoint[] {
  const granularity = revenueGranularity(bounds);
  const buckets: { key: string; label: string; revenue: number }[] = [];

  if (granularity === "day") {
    const start = startOfDay(
      bounds.start ?? earliestInvoicePaidMonth(invoices, now)
    );
    const end = startOfDay(bounds.end);
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      buckets.push({
        key: dayKey(cursor),
        label: formatDayLabel(cursor),
        revenue: 0,
      });
    }
  } else if (granularity === "week") {
    const start = startOfDay(
      bounds.start ?? earliestInvoicePaidMonth(invoices, now)
    );
    const end = startOfDay(bounds.end);
    const cursor = new Date(start);
    const day = cursor.getDay();
    const toMon = day === 0 ? -6 : 1 - day;
    cursor.setDate(cursor.getDate() + toMon);
    while (cursor <= end) {
      buckets.push({
        key: dayKey(cursor),
        label: formatWeekLabel(cursor),
        revenue: 0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const start = bounds.start
      ? new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1)
      : earliestInvoicePaidMonth(invoices, now);
    const endMonth = new Date(
      bounds.end.getFullYear(),
      bounds.end.getMonth(),
      1
    );
    const multiYear =
      start.getFullYear() !== bounds.end.getFullYear() ||
      bounds.start === null;
    const cursor = new Date(start);
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const label = multiYear
        ? `${SHORT_MONTHS[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`
        : SHORT_MONTHS[cursor.getMonth()];
      buckets.push({ key, label, revenue: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const inv of invoices) {
    const day = invoiceRevenueDate(inv);
    if (!day || !isDateInRange(day, bounds)) continue;
    const d = parseDay(day);
    if (!d) continue;

    let key: string;
    if (granularity === "day") {
      key = dayKey(d);
    } else if (granularity === "week") {
      const weekStart = startOfDay(d);
      const wd = weekStart.getDay();
      const toMon = wd === 0 ? -6 : 1 - wd;
      weekStart.setDate(weekStart.getDate() + toMon);
      key = dayKey(weekStart);
    } else {
      key = `${d.getFullYear()}-${d.getMonth()}`;
    }

    const i = index.get(key);
    if (i === undefined) continue;
    buckets[i].revenue += inv.total;
  }

  if (buckets.length === 0) {
    return [{ month: SHORT_MONTHS[now.getMonth()], revenue: 0 }];
  }

  return buckets.map((b) => ({ month: b.label, revenue: b.revenue }));
}

/** Calendar months spanned by bounds (for “monthly pace”). */
export function monthsSpanned(bounds: DateBounds, now = new Date()) {
  if (!bounds.start) {
    const start = new Date(now.getFullYear(), 0, 1);
    return (
      (bounds.end.getFullYear() - start.getFullYear()) * 12 +
      (bounds.end.getMonth() - start.getMonth()) +
      1
    );
  }
  return Math.max(
    1,
    (bounds.end.getFullYear() - bounds.start.getFullYear()) * 12 +
      (bounds.end.getMonth() - bounds.start.getMonth()) +
      1
  );
}
