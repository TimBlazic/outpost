import type { Client, LeadStatus, ProjectStatus, TaskPriority } from "./data";

/** Person name for portal chat (first + last), not company / project label. */
export function clientPersonName(
  client: Pick<Client, "firstName" | "lastName" | "name">
) {
  const n = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  return n || client.name || "Client";
}

export function eur(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(d));
}

export function fmtDateLong(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

export function dueState(d: string): "overdue" | "today" | "soon" | "later" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local calendar day (YYYY-MM-DD) to avoid UTC off-by-one.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T00:00:00`)
    : new Date(d);
  date.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "later";
}

// Tailwind classes for colored status pills.
export const leadStatusColor: Record<LeadStatus, string> = {
  New: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Researching:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "Ready to contact":
    "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  Contacted: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "Follow-up needed":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Replied:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "Meeting booked":
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "Proposal sent":
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Negotiating:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  Won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Lost: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "Not suitable":
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

export const projectStatusColor: Record<ProjectStatus, string> = {
  Discovery: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "Proposal accepted":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "In progress":
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Client review":
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "On hold":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export const priorityColor: Record<TaskPriority, string> = {
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  High: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};
