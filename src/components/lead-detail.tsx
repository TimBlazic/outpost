"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  Pin,
  PinOff,
  Plus,
  Trash2,
  FileText,
  CircleDot,
  Send,
  MessageCircle,
  CalendarCheck,
  StickyNote,
  PhoneCall,
  Pencil,
  MoreHorizontal,
  ExternalLink,
  CalendarClock,
  Copy,
  Check,
  X,
} from "lucide-react";

import {
  type Lead,
  type Activity,
  type Note,
  type Attachment,
  type Quote,
  type LeadStatus,
  type ActivityType,
  leadStatuses,
} from "@/lib/data";
import {
  setLeadStatus,
  deleteLead,
  addNote,
  updateNote,
  toggleNotePin,
  deleteNote,
  addActivity,
} from "@/lib/actions";
import {
  activityDetailPreview,
  parseActivityDetail,
} from "@/lib/activity-detail";
import { eur, fmtDate, fmtDateLong, leadStatusColor, dueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { LeadQuickActions } from "@/components/lead-quick-actions";
import { GenerateEmailButton } from "@/components/generate-email-button";
import { QualifyLeadButton } from "@/components/qualify-lead-button";
import { QualifyScoreDonut } from "@/components/qualify-score-donut";
import { Markdown } from "@/components/markdown";
import { StatusPill } from "@/components/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const activityIcon: Record<ActivityType, React.ElementType> = {
  status: CircleDot,
  email: Send,
  reply: MessageCircle,
  meeting: CalendarCheck,
  proposal: FileText,
  note: StickyNote,
  call: PhoneCall,
};

const activityOptions: ActivityType[] = [
  "email",
  "reply",
  "call",
  "meeting",
  "proposal",
  "note",
];

function websiteHref(site: string) {
  if (!site) return null;
  return site.startsWith("http") ? site : `https://${site}`;
}

/** Plain-text brief for pasting into ChatGPT / email drafts. */
export function formatLeadBrief(lead: Lead) {
  const site = websiteHref(lead.website);
  const lines: string[] = [
    `Company: ${lead.company}`,
    lead.contact ? `Contact: ${lead.contact}` : "",
    lead.email ? `Email: ${lead.email}` : "",
    lead.phone ? `Phone: ${lead.phone}` : "",
    site ? `Website: ${site}` : "",
    lead.country ? `Country: ${lead.country}` : "",
    lead.category ? `Category: ${lead.category}` : "",
    lead.value > 0 ? `Estimated budget / value: ${eur(lead.value)}` : "",
    lead.tags.length ? `Tags: ${lead.tags.join(", ")}` : "",
  ].filter(Boolean);

  if (lead.description?.trim()) {
    lines.push("", "Notes / research:", lead.description.trim());
  }

  return lines.join("\n");
}

function CopyLeadBriefButton({ lead }: { lead: Lead }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = formatLeadBrief(lead);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" variant="outline" onClick={copy}>
      {copied ? (
        <>
          <Check className="size-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="size-4" /> Copy for AI
        </>
      )}
    </Button>
  );
}

const quoteStatusTone: Record<Quote["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  accepted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function LeadDetail({
  lead,
  activities,
  notes: rawNotes,
  files,
  quotes = [],
  mode = "page",
  onClose,
  onChanged,
}: {
  lead: Lead;
  activities: Activity[];
  notes: Note[];
  files: Attachment[];
  quotes?: Quote[];
  mode?: "page" | "drawer";
  onClose?: () => void;
  /** Reload activities/notes/files after a mutation (drawer). */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const notes = [...rawNotes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );
  const followUpState = lead.nextFollowUp
    ? dueState(lead.nextFollowUp)
    : null;
  const site = websiteHref(lead.website);
  const drawer = mode === "drawer";

  function afterMutation() {
    router.refresh();
    onChanged?.();
  }

  const body = (
    <>
      {!drawer ? (
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Leads
        </Link>
      ) : null}

      {/* Header */}
      <header className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                aria-label="Change status"
                className={cn(
                  "h-8 w-[180px] border-0 font-medium shadow-none",
                  leadStatusColor[lead.status]
                )}
                value={lead.status}
                disabled={pending}
                onChange={(e) =>
                  startTransition(async () => {
                    await setLeadStatus(
                      lead.id,
                      e.target.value as LeadStatus
                    );
                    afterMutation();
                  })
                }
              >
                {leadStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              {lead.tags.map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyLeadBriefButton lead={lead} />
              <Button variant="outline" asChild>
                <Link href={`/leads/${lead.id}/edit`}>
                  <Pencil className="size-4" /> Edit
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/quotes/new?leadId=${lead.id}`}>New quote</Link>
              </Button>
              <Button asChild>
                <Link href={`/projects/new?leadId=${lead.id}`}>
                  Convert to project
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {lead.email && (
                    <DropdownMenuItem asChild>
                      <a href={`mailto:${lead.email}`}>Send email</a>
                    </DropdownMenuItem>
                  )}
                  {site && (
                    <DropdownMenuItem asChild>
                      <a href={site} target="_blank" rel="noreferrer">
                        Open website
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/tasks?new=1&leadId=${lead.id}`}>
                      New task
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" /> Delete lead
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-3 sm:gap-4">
            {lead.qualifyScore != null ? (
              <QualifyScoreDonut
                score={lead.qualifyScore}
                size={drawer ? 56 : 64}
                compact
                className="shrink-0"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h1
                className={cn(
                  "font-semibold tracking-tight text-pretty",
                  drawer ? "text-2xl" : "text-3xl"
                )}
              >
                {lead.company}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {lead.contact}
                {lead.category ? ` · ${lead.category}` : ""}
                {lead.country ? ` · ${lead.country}` : ""}
                {lead.source ? ` · via ${lead.source}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Quick facts strip — not cards */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          <Fact
            label="Deal value"
            value={eur(lead.value)}
            emphasis
          />
          <Fact label="Win prob." value={`${lead.probability}%`} />
          <Fact
            label="Next follow-up"
            value={lead.nextFollowUp ? fmtDate(lead.nextFollowUp) : "—"}
            tone={
              followUpState === "overdue"
                ? "danger"
                : followUpState === "today"
                  ? "warn"
                  : undefined
            }
            icon={CalendarClock}
          />
          <Fact
            label="Last contact"
            value={lead.lastContact ? fmtDate(lead.lastContact) : "—"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QualifyLeadButton
            leadId={lead.id}
            website={lead.website}
            company={lead.company}
            onDone={afterMutation}
          />
          <GenerateEmailButton leadId={lead.id} leadEmail={lead.email} />
          <LeadQuickActions leadId={lead.id} />
        </div>

        {/* Contact row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {site && (
            <a
              href={site}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Globe className="size-3.5" />
              {lead.website}
              <ExternalLink className="size-3 opacity-50" />
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-3.5" />
              {lead.email}
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" />
              {lead.phone}
            </a>
          )}
        </div>

        {lead.description?.trim() ? (
          <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <p className="mb-2 text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Description
            </p>
            <Markdown source={lead.description} />
          </div>
        ) : null}
      </header>

      <LeadQuotesSection leadId={lead.id} quotes={quotes} />

      {/* Main workspace */}
      <Tabs defaultValue="timeline" className="gap-5">
        <TabsList>
          <TabsTrigger value="timeline">
            Activity ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <ActivityPanel
            leadId={lead.id}
            activities={activities}
            onChanged={afterMutation}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <NotesPanel
            leadId={lead.id}
            notes={notes}
            onChanged={afterMutation}
          />
        </TabsContent>

        <TabsContent value="files">
          <AttachmentsPanel
            parentType="lead"
            parentId={lead.id}
            items={files}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead?</DialogTitle>
            <DialogDescription>
              Delete &quot;{lead.company}&quot; and related notes, activities,
              and files? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  // Close drawer first — deleteLead redirects and never returns.
                  onClose?.();
                  await deleteLead(lead.id);
                })
              }
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (drawer) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{lead.company}</p>
            <p className="truncate text-xs text-muted-foreground">
              {lead.contact || "Lead"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Open full page"
              className="size-8"
            >
              <Link href={`/leads/${lead.id}`}>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                title="Close"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">{body}</div>
  );
}

function LeadQuotesSection({
  leadId,
  quotes,
}: {
  leadId: string;
  quotes: Quote[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Quotes{" "}
          <span className="font-normal text-muted-foreground">
            ({quotes.length})
          </span>
        </h2>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/quotes/new?leadId=${leadId}`}>
            <Plus className="size-3.5" />
            New quote
          </Link>
        </Button>
      </div>
      {quotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
          No quotes yet for this lead.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/80">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/quotes/${q.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {q.number || "Draft quote"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(q.updatedAt.slice(0, 10))}
                    {q.validUntil ? ` · Valid ${fmtDate(q.validUntil)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={q.status}
                    className={cn("capitalize", quoteStatusTone[q.status])}
                  />
                  <span className="text-sm font-semibold tabular-nums">
                    {eur(q.total)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fact({
  label,
  value,
  emphasis,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "danger" | "warn";
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-background px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 font-semibold tracking-tight",
          emphasis && "text-lg",
          tone === "danger" && "text-rose-600",
          tone === "warn" && "text-amber-600"
        )}
      >
        {Icon && <Icon className="size-3.5 opacity-70" />}
        {value}
      </p>
    </div>
  );
}

// ---- Activity --------------------------------------------------------------

function ActivityDetailDrawer({
  activity,
  onClose,
}: {
  activity: Activity | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const open = Boolean(activity);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!activity) return null;

  const Icon = activityIcon[activity.type];
  const parsed = parseActivityDetail(activity.detail);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 m-3 flex h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                {activity.type}
              </p>
            </div>
            <h2 className="mt-2 text-base font-semibold leading-snug">
              {activity.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmtDateLong(activity.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 pb-10">
          {parsed?.kind === "email" ? (
            <>
              <div className="grid gap-3 text-sm">
                <div>
                  <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                    To
                  </p>
                  <p className="mt-0.5 font-medium">{parsed.to || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                    Subject
                  </p>
                  <p className="mt-0.5 font-medium">
                    {parsed.subject || "—"}
                  </p>
                </div>
                {parsed.followUpOn ? (
                  <div>
                    <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Follow-up set
                    </p>
                    <p className="mt-0.5 font-medium">
                      {fmtDate(parsed.followUpOn)}
                    </p>
                  </div>
                ) : null}
              </div>
              <div>
                <p className="mb-2 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  Body
                </p>
                <pre className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground">
                  {parsed.body || "—"}
                </pre>
              </div>
            </>
          ) : parsed?.kind === "text" ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {parsed.text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No extra details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityPanel({
  leadId,
  activities,
  onChanged,
}: {
  leadId: string;
  activities: Activity[];
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("email");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [selected, setSelected] = useState<Activity | null>(null);

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await addActivity(leadId, { type, title: title.trim(), detail });
      setTitle("");
      setDetail("");
      setOpen(false);
      onChanged?.();
    });
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Everything that happened with this lead. Click an item for details.
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" /> Log activity
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="h-9"
            >
              {activityOptions.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </Select>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sent proposal v2"
              className="h-9"
            />
          </div>
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Optional details…"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={pending}>
              Add
            </Button>
          </div>
        </div>
      )}

      <ol className="relative space-y-0 border-l border-border/80 pb-8 pl-6">
        {activities.map((a) => {
          const Icon = activityIcon[a.type];
          const preview = activityDetailPreview(a.detail);
          return (
            <li key={a.id} className="relative pb-6 last:pb-2">
              <button
                type="button"
                onClick={() => setSelected(a)}
                className="group -ml-1 w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/40"
              >
                <span className="absolute -left-[31px] flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground group-hover:border-foreground/30">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium group-hover:underline">
                    {a.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDateLong(a.date)}
                  </span>
                </div>
                {preview ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {preview}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
        {activities.length === 0 && (
          <li className="pb-4 text-sm text-muted-foreground">
            No activity logged yet. Log emails, calls, and meetings as you go.
          </li>
        )}
      </ol>

      <ActivityDetailDrawer
        activity={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ---- Notes -----------------------------------------------------------------

function NotesPanel({
  leadId,
  notes,
  onChanged,
}: {
  leadId: string;
  notes: Note[];
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  function submit() {
    if (!title.trim() && !body.trim()) return;
    startTransition(async () => {
      await addNote(leadId, { title: title.trim(), body: body.trim(), pinned });
      setTitle("");
      setBody("");
      setPinned(false);
      setOpen(false);
      onChanged?.();
    });
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditBody(n.body);
  }

  function saveEdit() {
    if (!editingId) return;
    if (!editTitle.trim() && !editBody.trim()) return;
    startTransition(async () => {
      await updateNote(editingId, leadId, {
        title: editTitle.trim(),
        body: editBody.trim(),
      });
      setEditingId(null);
      onChanged?.();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Scratchpad for research, scope, and call notes
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" /> New note
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your note…"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pin this note
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={pending}>
                Add note
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y rounded-xl border">
        {notes.map((n) => (
          <div
            key={n.id}
            className={cn(
              "space-y-2 p-4",
              n.pinned && "bg-amber-50/40 dark:bg-amber-400/10"
            )}
          >
            {editingId === n.id ? (
              <>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Note title"
                />
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Write your note…"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={pending}>
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    {n.pinned && (
                      <Pin className="size-3.5 fill-amber-400 text-amber-500" />
                    )}
                    {n.title}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">
                      {fmtDateLong(n.date)}
                    </span>
                    <button
                      aria-label="Edit note"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => startEdit(n)}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      aria-label={n.pinned ? "Unpin" : "Pin"}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        startTransition(async () => {
                          await toggleNotePin(n.id, leadId);
                          onChanged?.();
                        })
                      }
                    >
                      {n.pinned ? (
                        <PinOff className="size-3.5" />
                      ) : (
                        <Pin className="size-3.5" />
                      )}
                    </button>
                    <button
                      aria-label="Delete note"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteNote(n.id, leadId);
                          onChanged?.();
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.body}
                </p>
              </>
            )}
          </div>
        ))}
        {notes.length === 0 && !open && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No notes yet.
          </p>
        )}
      </div>
    </>
  );
}
