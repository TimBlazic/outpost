"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Calendar,
  CircleUser,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";

import {
  memberById,
  members as seedMembers,
  ticketStatuses,
  type Attachment,
  type Member,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
  type TicketParty,
  type TicketStatus,
} from "@/lib/data";
import {
  createTicket,
  deleteTicket,
  updateTicket,
} from "@/lib/actions";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { mentionHandle } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { TicketComments } from "@/components/ticket-comments";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  TicketStatusBadge,
  ticketShortId,
  ticketStatusMeta,
} from "@/components/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-xs font-medium transition-colors hover:border-border hover:bg-card";

/** @deprecated use TicketStatusBadge */
export const ticketStatusColor: Record<TicketStatus, string> = {
  Todo: "bg-slate-100 text-slate-700",
  "In progress": "bg-blue-100 text-blue-700",
  "Waiting on client": "bg-amber-100 text-amber-800",
  Done: "bg-emerald-100 text-emerald-700",
};

export function TicketDetail({
  projectId,
  ticket,
  files = [],
  comments = [],
  reactions = [],
  commentFiles = [],
  members = seedMembers,
  clientName = "Client",
  currentUserName,
  mode = "page",
  onClose,
  onCreated,
}: {
  projectId: string;
  ticket?: Ticket;
  files?: Attachment[];
  comments?: TicketComment[];
  reactions?: TicketCommentReaction[];
  commentFiles?: Attachment[];
  members?: Member[];
  clientName?: string;
  currentUserName?: string;
  mode?: "page" | "drawer" | "create";
  onClose?: () => void;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const creating = mode === "create" || !ticket;
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "Todo");
  const [dueAt, setDueAt] = useState(ticket?.dueAt ?? "");
  const [assigneeKind, setAssigneeKind] = useState<TicketParty>(
    ticket?.assigneeKind ?? "studio"
  );
  const [assigneeId, setAssigneeId] = useState(ticket?.assigneeId ?? "");

  useEffect(() => {
    if (!ticket) return;
    setTitle(ticket.title);
    setDescription(ticket.description ?? "");
    setStatus(ticket.status);
    setDueAt(ticket.dueAt ?? "");
    setAssigneeKind(ticket.assigneeKind);
    setAssigneeId(ticket.assigneeId ?? "");
    setDescriptionDirty(false);
  }, [ticket]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const assigneeLabel =
    assigneeKind === "client"
      ? "Client"
      : assigneeId
        ? memberById(assigneeId, members).name
        : "Unassigned";

  function persist(patch?: {
    title?: string;
    description?: string;
    status?: TicketStatus;
    dueAt?: string | null;
    assigneeKind?: TicketParty;
    assigneeId?: string | null;
  }) {
    if (creating) return;
    if (!ticket) return;
    const input = {
      title: (patch?.title ?? title).trim(),
      description: patch?.description ?? description,
      status: patch?.status ?? status,
      dueAt: (patch?.dueAt !== undefined ? patch.dueAt : dueAt) || null,
      assigneeKind: patch?.assigneeKind ?? assigneeKind,
      assigneeId:
        (patch?.assigneeKind ?? assigneeKind) === "studio"
          ? (patch?.assigneeId !== undefined
              ? patch.assigneeId
              : assigneeId) || null
          : null,
    };
    if (!input.title) return;
    startTransition(async () => {
      await updateTicket(ticket.id, input);
      router.refresh();
    });
  }

  function create() {
    if (!title.trim()) return;
    startTransition(async () => {
      const id = await createTicket(projectId, {
        title: title.trim(),
        description,
        status,
        dueAt: dueAt || null,
        assigneeKind,
        assigneeId: assigneeKind === "studio" ? assigneeId || null : null,
      });
      onCreated?.(id);
      router.refresh();
      if (mode === "page") {
        router.push(`/projects/${projectId}/tickets/${id}`);
      } else {
        onClose?.();
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          {ticket ? (
            <span className="shrink-0 rounded bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {ticketShortId(ticket.id)}
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              New ticket
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!creating && ticket && mode === "drawer" && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Open full page"
              className="size-8"
            >
              <Link href={`/projects/${projectId}/tickets/${ticket.id}`}>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          )}
          {!creating && ticket && (
            <ConfirmDelete
              title="Delete ticket?"
              description="This removes the ticket and its attachments."
              onConfirm={() => deleteTicket(ticket.id)}
              trigger={
                <button
                  type="button"
                  title="Delete"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="size-3.5" />
                </button>
              }
            />
          )}
          {mode === "drawer" && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title="Close"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {(() => {
        const ticketBody = (
          <>
            <div className="space-y-4 px-5 pt-6 pb-5">
              <div className="space-y-1">
                <textarea
                  ref={titleRef}
                  value={title}
                  rows={1}
                  placeholder="Ticket title"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                    }
                  }}
                  onBlur={() => {
                    if (
                      !creating &&
                      ticket &&
                      title.trim() &&
                      title !== ticket.title
                    ) {
                      persist({ title });
                    }
                  }}
                  className="w-full resize-none overflow-hidden border-none bg-transparent text-xl font-semibold leading-tight text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                {!creating && ticket && (
                  <p className="text-[11px] text-muted-foreground">
                    Opened by{" "}
                    <span className="font-medium text-foreground">
                      {ticket.createdByName || ticket.createdByKind}
                    </span>{" "}
                    · {fmtDateLong(ticket.createdAt)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={PILL}>
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          backgroundColor: ticketStatusMeta[status].color,
                        }}
                      />
                      {status}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ticketStatuses.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => {
                          setStatus(s);
                          if (!creating) persist({ status: s });
                        }}
                      >
                        <TicketStatusBadge status={s} size="xs" />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(PILL, "text-muted-foreground")}
                    >
                      {assigneeKind === "studio" && assigneeId ? (
                        <UserAvatar
                          member={memberById(assigneeId, members)}
                          className="size-4"
                          fallbackClassName="bg-muted text-[8px] text-foreground"
                        />
                      ) : (
                        <CircleUser className="size-3.5" />
                      )}
                      {assigneeLabel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-44">
                    <DropdownMenuItem
                      onClick={() => {
                        setAssigneeKind("client");
                        setAssigneeId("");
                        if (!creating)
                          persist({ assigneeKind: "client", assigneeId: null });
                      }}
                    >
                      Client
                    </DropdownMenuItem>
                    {members.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => {
                          setAssigneeKind("studio");
                          setAssigneeId(m.id);
                          if (!creating)
                            persist({
                              assigneeKind: "studio",
                              assigneeId: m.id,
                            });
                        }}
                      >
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <label
                  className={cn(PILL, "cursor-pointer text-muted-foreground")}
                >
                  <Calendar className="size-3.5" />
                  {dueAt ? fmtDate(dueAt) : "Due date"}
                  <input
                    type="date"
                    value={dueAt}
                    className="sr-only"
                    onChange={(e) => {
                      const v = e.target.value;
                      setDueAt(v);
                      if (!creating) persist({ dueAt: v || null });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="px-5 pb-5">
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionDirty(true);
                }}
                placeholder="Write a description… Markdown supported."
                rows={creating ? 8 : 6}
                className="min-h-[100px] resize-y border-border/60 bg-muted/20 text-sm"
              />
              {creating ? null : descriptionDirty ? (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      persist({ description });
                      setDescriptionDirty(false);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDescription(ticket?.description ?? "");
                      setDescriptionDirty(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : description.trim() ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  <Markdown source={description} />
                </div>
              ) : null}
            </div>

            {!creating && ticket && (
              <div className="border-t border-border/60 px-5 pt-5 pb-4">
                <AttachmentsPanel
                  parentType="ticket"
                  parentId={ticket.id}
                  items={files}
                  variant="inline"
                />
              </div>
            )}
          </>
        );

        if (!creating && ticket) {
          return (
            <TicketComments
              ticketId={ticket.id}
              comments={comments}
              reactions={reactions}
              files={commentFiles}
              members={members}
              mentionExtras={[
                {
                  label: clientName,
                  insert: mentionHandle(clientName),
                },
                { label: "Client", insert: "@Client" },
              ]}
              canComment
              canDelete
              currentAuthorKind="studio"
              currentAuthorName={
                currentUserName || members[0]?.name || "Studio"
              }
              stickyFooter={mode === "drawer"}
              above={ticketBody}
            />
          );
        }

        return (
          <div className="flex-1 overflow-y-auto">
            {ticketBody}
            <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                disabled={pending || !title.trim()}
                onClick={create}
              >
                Create ticket
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
