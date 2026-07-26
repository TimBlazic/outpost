"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { KanbanSquare, ListTodo, Plus, X } from "lucide-react";

import {
  ticketStatuses,
  type Attachment,
  type Member,
  type Project,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
  type TicketStatus,
} from "@/lib/data";
import {
  clientCreateTicket,
  sessionClientCreateTicket,
} from "@/lib/portal/actions";
import {
  portalStatusLabel,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import { mentionHandle } from "@/lib/mentions";
import { ticketShortId, ticketStatusMeta } from "@/components/ticket-status-badge";
import { Markdown } from "@/components/markdown";
import { TicketComments } from "@/components/ticket-comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "list";

function PortalTicketCard({
  ticket,
  locale,
  onOpen,
}: {
  ticket: Ticket;
  locale: PortalLocale;
  onOpen: (id: string) => void;
}) {
  const t = portalT(locale);
  const assignee =
    ticket.assigneeKind === "client" ? t.assigneeClient : t.assigneeStudio;

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      className="w-full rounded-lg border border-[var(--portal-line)] bg-[var(--portal-surface)] p-3 text-left transition-colors hover:border-[var(--portal-fg)]/25"
    >
      <p className="text-sm font-medium leading-snug text-[var(--portal-fg)]">
        {ticket.title}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--portal-muted)]">
        <span className="font-mono">{ticketShortId(ticket.id)}</span>
        <span className="ml-auto">{assignee}</span>
        {ticket.dueAt && <span>{fmtDate(ticket.dueAt)}</span>}
      </div>
    </button>
  );
}

function PortalTicketDrawer({
  ticket,
  locale,
  open,
  onClose,
  token,
  project,
  comments = [],
  reactions = [],
  commentFiles = [],
  members = [],
  viewer = "token",
}: {
  ticket: Ticket | null;
  locale: PortalLocale;
  open: boolean;
  onClose: () => void;
  token: string;
  project: Project;
  comments?: TicketComment[];
  reactions?: TicketCommentReaction[];
  commentFiles?: Attachment[];
  members?: Member[];
  viewer?: "token" | "session";
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = portalT(locale);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !open || !ticket) return null;

  const meta = ticketStatusMeta[ticket.status];
  const statusLabel = portalStatusLabel(locale, ticket.status);
  const assignee =
    ticket.assigneeKind === "client" ? t.assigneeClient : t.assigneeStudio;
  const theme =
    document.querySelector(".portal-skin")?.getAttribute("data-theme") ||
    "dark";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Keep backdrop translucent — do NOT put portal-skin (solid bg) on this layer. */}
      <div
        className={cn(
          "absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "portal-skin relative z-10 m-3 flex h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--portal-line)] shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
        data-theme={theme}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--portal-line)] px-5 py-3">
          <span className="rounded bg-[var(--portal-surface)] px-2 py-0.5 font-mono text-xs text-[var(--portal-muted)]">
            {ticketShortId(ticket.id)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--portal-muted)] transition-colors hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <TicketComments
          ticketId={ticket.id}
          comments={comments}
          reactions={reactions}
          files={commentFiles}
          members={members}
          mentionExtras={[
            {
              label: project.client || "Client",
              insert: mentionHandle(project.client || "Client"),
            },
          ]}
          canComment={project.clientCanComment}
          currentAuthorKind="client"
          currentAuthorName={project.client || "Client"}
          variant="portal"
          portalToken={token}
          sessionProjectId={viewer === "session" ? project.id : undefined}
          stickyFooter
          labels={{
            comments: t.comments,
            write: t.writeComment,
            reply: t.reply,
            comment: t.comment,
            empty: t.noComments,
            attach: t.attach,
          }}
          above={
            <div className="space-y-4 px-5 py-6">
              <div>
                <h3 className="portal-display text-3xl italic leading-tight">
                  {ticket.title}
                </h3>
                <p className="mt-2 text-xs text-[var(--portal-muted)]">
                  {t.opened} {fmtDate(ticket.createdAt.slice(0, 10))} {t.by}{" "}
                  {ticket.createdByName || ticket.createdByKind}
                  {ticket.dueAt ? ` · ${t.due} ${fmtDate(ticket.dueAt)}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${meta.color}22`,
                    color: meta.color,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {statusLabel}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--portal-line)] px-2.5 py-1 text-xs text-[var(--portal-muted)]">
                  {assignee}
                </span>
              </div>

              <div className="border-t border-[var(--portal-line)] pt-5 text-sm leading-relaxed text-[var(--portal-muted)] [&_*]:text-inherit">
                {ticket.description ? (
                  <Markdown source={ticket.description} />
                ) : (
                  <p>{t.noTicketDescription}</p>
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>,
    document.body
  );
}

export function PortalTickets({
  token,
  project,
  tickets,
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members = [],
  locale,
  initialSelectedId = null,
  viewer = "token",
}: {
  token: string;
  project: Project;

  tickets: Ticket[];
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members?: Member[];
  locale: PortalLocale;
  initialSelectedId?: string | null;
  viewer?: "token" | "session";
}) {
  const t = portalT(locale);
  const [view, setView] = useState<ViewMode>("board");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId
  );
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  const selected = useMemo(
    () => tickets.find((tk) => tk.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      ticketStatuses.map((s) => [s, [] as Ticket[]])
    ) as Record<TicketStatus, Ticket[]>;
    for (const tk of tickets) map[tk.status].push(tk);
    return map;
  }, [tickets]);

  function openTicket(id: string) {
    setCreating(false);
    setSelectedId(id);
  }

  function createTicket() {
    setError(null);
    startTransition(async () => {
      try {
        const id =
          viewer === "session"
            ? await sessionClientCreateTicket(project.id, {
                title,
                description,
              })
            : await clientCreateTicket(token, { title, description });
        setTitle("");
        setDescription("");
        setCreating(false);
        setSelectedId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.failed);
      }
    });
  }

  if (!project.clientCanViewTickets) {
    return <p className="text-[var(--portal-muted)]">{t.ticketViewOff}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="portal-display text-2xl italic">{t.tickets}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[var(--portal-line)] p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                view === "board"
                  ? "bg-[var(--portal-accent)] text-[var(--portal-bg)]"
                  : "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
              )}
            >
              <KanbanSquare className="size-3.5" />
              {t.board}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                view === "list"
                  ? "bg-[var(--portal-accent)] text-[var(--portal-bg)]"
                  : "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
              )}
            >
              <ListTodo className="size-3.5" />
              {t.list}
            </button>
          </div>
          {project.clientCanCreateTickets && (
            <Button
              size="sm"
              className="bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
              onClick={() => {
                setSelectedId(null);
                setCreating((v) => !v);
              }}
            >
              <Plus className="size-3.5" />
              {t.newTicket}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {creating && (
        <div className="space-y-3 border border-[var(--portal-line)] p-5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.whatsNeeded}
            className="border-[var(--portal-line)] bg-transparent text-[var(--portal-fg)]"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.detailsMarkdown}
            rows={4}
            className="border-[var(--portal-line)] bg-transparent text-[var(--portal-fg)]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !title.trim()}
              className="bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
              onClick={createTicket}
            >
              {t.create}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
              onClick={() => setCreating(false)}
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      )}

      {tickets.length === 0 ? (
        <p className="py-8 text-sm text-[var(--portal-muted)]">{t.noTickets}</p>
      ) : view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ticketStatuses.map((status) => (
            <div
              key={status}
              className="flex min-h-40 min-w-[220px] flex-1 flex-col gap-2 rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)]/40 p-2"
            >
              <div className="flex items-center justify-between px-1 py-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${ticketStatusMeta[status].color}18`,
                    color: ticketStatusMeta[status].color,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: ticketStatusMeta[status].color,
                    }}
                  />
                  {portalStatusLabel(locale, status)}
                </span>
                <span className="text-xs text-[var(--portal-muted)]">
                  {byStatus[status].length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {byStatus[status].map((tk) => (
                  <PortalTicketCard
                    key={tk.id}
                    ticket={tk}
                    locale={locale}
                    onOpen={openTicket}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--portal-line)] border-y border-[var(--portal-line)]">
          {tickets.map((tk) => (
            <li key={tk.id}>
              <button
                type="button"
                onClick={() => openTicket(tk.id)}
                className="flex w-full items-start justify-between gap-4 py-4 text-left transition-colors hover:text-[var(--portal-fg)]"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] text-[var(--portal-muted)]">
                    {ticketShortId(tk.id)}
                  </span>
                  <span className="mt-0.5 block text-sm text-[var(--portal-fg)]">
                    {tk.title}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--portal-muted)]">
                    {tk.dueAt
                      ? `${t.due} ${fmtDate(tk.dueAt)}`
                      : t.noDueDate}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${ticketStatusMeta[tk.status].color}18`,
                    color: ticketStatusMeta[tk.status].color,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: ticketStatusMeta[tk.status].color,
                    }}
                  />
                  {portalStatusLabel(locale, tk.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PortalTicketDrawer
        ticket={selected}
        locale={locale}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        token={token}
        project={project}
        comments={selected ? ticketComments[selected.id] ?? [] : []}
        reactions={selected ? ticketReactions[selected.id] ?? [] : []}
        commentFiles={selected ? ticketCommentFiles[selected.id] ?? [] : []}
        members={members}
        viewer={viewer}
      />
    </div>
  );
}
