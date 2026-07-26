import {
  leadSources,
  leadStatuses,
  type Lead,
  type LeadStatus,
} from "@/lib/data";

export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = [
  "Won",
  "Lost",
  "Not suitable",
];

export type LeadSortKey =
  | "company"
  | "status"
  | "value"
  | "probability"
  | "followUp"
  | "score";

export type LeadSortDir = "asc" | "desc";

/** `open` = pipeline open; `all` = no status filter; else exact statuses. */
export type LeadStatusFilter = "open" | "all" | LeadStatus[];

export type LeadListQuery = {
  status: LeadStatusFilter;
  sources: string[];
  q: string;
  sort: LeadSortKey;
  dir: LeadSortDir;
};

const SORT_KEYS: readonly LeadSortKey[] = [
  "company",
  "status",
  "value",
  "probability",
  "followUp",
  "score",
];

const STATUS_INDEX = new Map(
  leadStatuses.map((s, i) => [s, i] as const)
);

export function parseLeadListQuery(
  params: URLSearchParams | { get(name: string): string | null }
): LeadListQuery {
  return {
    status: parseStatus(params.get("status")),
    sources: parseSources(params.get("source")),
    q: (params.get("q") ?? "").trim(),
    sort: parseSort(params.get("sort")),
    dir: parseDir(params.get("dir")),
  };
}

function parseStatus(raw: string | null): LeadStatusFilter {
  if (raw == null || raw === "" || raw === "open") return "open";
  if (raw === "all") return "all";
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = parts.filter((s): s is LeadStatus =>
    (leadStatuses as readonly string[]).includes(s)
  );
  return valid.length ? valid : "open";
}

function parseSources(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  const allowed = new Set<string>(leadSources);
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allowed.has(s))
    ),
  ];
}

function parseSort(raw: string | null): LeadSortKey {
  if (raw && (SORT_KEYS as readonly string[]).includes(raw)) {
    return raw as LeadSortKey;
  }
  return "followUp";
}

function parseDir(raw: string | null): LeadSortDir {
  return raw === "desc" ? "desc" : "asc";
}

/** Build params to write; omits defaults where helpful. */
export function leadListQueryToSearchParams(
  query: LeadListQuery,
  base?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? "");
  // Preserve unrelated keys (e.g. qualify dialog) then set ours.
  next.delete("status");
  next.delete("source");
  next.delete("q");
  next.delete("sort");
  next.delete("dir");

  if (query.status === "all") {
    next.set("status", "all");
  } else if (query.status === "open") {
    // Default — omit for cleaner URL, or set open explicitly when clearing from all
    next.set("status", "open");
  } else {
    next.set("status", query.status.join(","));
  }

  if (query.sources.length) {
    next.set("source", query.sources.join(","));
  }
  if (query.q) next.set("q", query.q);

  if (query.sort !== "followUp") next.set("sort", query.sort);
  else next.set("sort", "followUp");
  next.set("dir", query.dir);

  return next;
}

export function filterLeads(leads: Lead[], query: LeadListQuery): Lead[] {
  const q = query.q.toLowerCase();
  return leads.filter((l) => {
    if (query.status === "open") {
      if (CLOSED_LEAD_STATUSES.includes(l.status)) return false;
    } else if (query.status !== "all") {
      if (!query.status.includes(l.status)) return false;
    }
    if (query.sources.length && !query.sources.includes(l.source)) {
      return false;
    }
    if (!q) return true;
    return (
      l.company.toLowerCase().includes(q) ||
      l.contact.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  });
}

/** Nulls last for followUp/score even when dir=desc. */
export function sortLeadsWithNullsLast(
  leads: Lead[],
  sort: LeadSortKey,
  dir: LeadSortDir
): Lead[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...leads].sort((a, b) => {
    if (sort === "followUp" || sort === "score") {
      const aOk =
        sort === "followUp" ? Boolean(a.nextFollowUp) : a.qualifyScore != null;
      const bOk =
        sort === "followUp" ? Boolean(b.nextFollowUp) : b.qualifyScore != null;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (!aOk) return a.company.localeCompare(b.company);
    }

    let cmp = 0;
    switch (sort) {
      case "company":
        cmp = a.company.localeCompare(b.company);
        break;
      case "status":
        cmp =
          (STATUS_INDEX.get(a.status) ?? 0) - (STATUS_INDEX.get(b.status) ?? 0);
        break;
      case "value":
        cmp = a.value - b.value;
        break;
      case "probability":
        cmp = a.probability - b.probability;
        break;
      case "followUp":
        cmp = (a.nextFollowUp ?? "").localeCompare(b.nextFollowUp ?? "");
        break;
      case "score":
        cmp = (a.qualifyScore ?? 0) - (b.qualifyScore ?? 0);
        break;
    }
    if (cmp !== 0) return cmp * mult;
    return a.company.localeCompare(b.company);
  });
}

export function isOpenStatusFilter(status: LeadStatusFilter): boolean {
  return status === "open";
}

export function toggleStatusInFilter(
  current: LeadStatusFilter,
  status: LeadStatus
): LeadStatusFilter {
  const set = new Set(
    current === "open" || current === "all" ? [] : current
  );
  if (set.has(status)) set.delete(status);
  else set.add(status);
  if (set.size === 0) return "all";
  return leadStatuses.filter((s) => set.has(s));
}

export function toggleSourceInFilter(
  current: string[],
  source: string
): string[] {
  const set = new Set(current);
  if (set.has(source)) set.delete(source);
  else set.add(source);
  return leadSources.filter((s) => set.has(s));
}
