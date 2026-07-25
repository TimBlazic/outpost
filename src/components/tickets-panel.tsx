"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanSquare, ListTodo, Plus } from "lucide-react";

import {
  members as seedMembers,
  ticketStatuses,
  type Attachment,
  type Member,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
  type TicketStatus,
} from "@/lib/data";
import { memberById } from "@/lib/data";
import { setTicketStatus } from "@/lib/actions";
import { fmtDate, dueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TicketDetail } from "@/components/ticket-detail";
import {
  TicketStatusBadge,
  ticketShortId,
} from "@/components/ticket-status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function relativeFromIso(iso: string) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "—";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function TicketCard({
  ticket,
  members,
  dragging,
}: {
  ticket: Ticket;
  members: Member[];
  dragging?: boolean;
}) {
  const assignee =
    ticket.assigneeKind === "client"
      ? "Client"
      : ticket.assigneeId
        ? memberById(ticket.assigneeId, members).name
        : null;

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/30",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">
        {ticket.title}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{ticketShortId(ticket.id)}</span>
        {assignee && <span className="ml-auto truncate">{assignee}</span>}
        {ticket.dueAt && (
          <span
            className={cn(
              dueState(ticket.dueAt) === "overdue" && "font-medium text-rose-600"
            )}
          >
            {fmtDate(ticket.dueAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function SortableTicketCard({
  ticket,
  members,
  onOpen,
}: {
  ticket: Ticket;
  members: Member[];
  onOpen: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(ticket.id)}
    >
      <TicketCard ticket={ticket} members={members} />
    </div>
  );
}

function KanbanColumn({
  status,
  tickets,
  members,
  onOpen,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  members: Member[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-40 min-w-[240px] flex-1 flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-2",
        isOver && "ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center justify-between px-1 py-1.5">
        <TicketStatusBadge status={status} size="xs" />
        <span className="text-xs text-muted-foreground">{tickets.length}</span>
      </div>
      <SortableContext
        items={tickets.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {tickets.map((t) => (
            <SortableTicketCard
              key={t.id}
              ticket={t}
              members={members}
              onOpen={onOpen}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function TicketSidePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

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

  if (!open) return null;

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
          "relative z-10 m-3 flex h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function TicketsPanel({
  projectId,
  tickets,
  ticketFiles = {},
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members = seedMembers,
  clientName = "Client",
  currentUserName,
}: {
  projectId: string;
  tickets: Ticket[];
  ticketFiles?: Record<string, Attachment[]>;
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members?: Member[];
  clientName?: string;
  currentUserName?: string;
}) {
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [local, setLocal] = useState(tickets);

  useEffect(() => {
    setLocal(tickets);
  }, [tickets]);

  const selected = useMemo(
    () => local.find((t) => t.id === selectedId),
    [local, selectedId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      ticketStatuses.map((s) => [s, [] as Ticket[]])
    ) as Record<TicketStatus, Ticket[]>;
    for (const t of local) map[t.status].push(t);
    return map;
  }, [local]);

  function openTicket(id: string) {
    setCreating(false);
    setSelectedId(id);
  }

  function closePanel() {
    setSelectedId(null);
    setCreating(false);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const ticketId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;

    let nextStatus: TicketStatus | null = null;
    if (ticketStatuses.includes(overId as TicketStatus)) {
      nextStatus = overId as TicketStatus;
    } else {
      const overTicket = local.find((t) => t.id === String(overId));
      if (overTicket) nextStatus = overTicket.status;
    }
    if (!nextStatus) return;

    const current = local.find((t) => t.id === ticketId);
    if (!current || current.status === nextStatus) return;

    setLocal((rows) =>
      rows.map((t) => (t.id === ticketId ? { ...t, status: nextStatus! } : t))
    );
    startTransition(() => {
      void setTicketStatus(ticketId, nextStatus!);
    });
  }

  const activeTicket = activeId
    ? local.find((t) => t.id === activeId)
    : undefined;

  const panelOpen = creating || Boolean(selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {local.length} ticket{local.length === 1 ? "" : "s"}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        >
          <Plus className="size-3.5" />
          New ticket
        </Button>
      </div>

      {local.length === 0 && !creating ? (
        <EmptyState
          icon={ListTodo}
          title="No tickets yet"
          description="Create your first ticket to get started."
        />
      ) : (
        <Tabs defaultValue="list" className="gap-4">
          <TabsList>
            <TabsTrigger value="list">
              <ListTodo className="size-4" /> List
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <KanbanSquare className="size-4" /> Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <DataTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Created
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {local.map((t) => {
                    const assigneeLabel =
                      t.assigneeKind === "client"
                        ? "Client"
                        : t.assigneeId
                          ? memberById(t.assigneeId, members).name
                          : "—";
                    const state = t.dueAt ? dueState(t.dueAt) : null;
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer"
                        onClick={() => openTicket(t.id)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ticketShortId(t.id)}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="truncate font-medium">
                            {t.title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <TicketStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {assigneeLabel}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            state === "overdue" && "font-medium text-rose-600"
                          )}
                        >
                          {fmtDate(t.dueAt)}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {relativeFromIso(t.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTable>
          </TabsContent>

          <TabsContent value="kanban">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <div className="flex gap-3 overflow-x-auto pb-2">
                {ticketStatuses.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    tickets={byStatus[status]}
                    members={members}
                    onOpen={openTicket}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTicket ? (
                  <TicketCard
                    ticket={activeTicket}
                    members={members}
                    dragging
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>
        </Tabs>
      )}

      <TicketSidePanel open={panelOpen} onClose={closePanel}>
        {creating ? (
          <TicketDetail
            projectId={projectId}
            mode="create"
            members={members}
            onClose={closePanel}
            onCreated={() => closePanel()}
          />
        ) : selected ? (
          <TicketDetail
            projectId={projectId}
            ticket={selected}
            files={ticketFiles[selected.id] ?? []}
            comments={ticketComments[selected.id] ?? []}
            reactions={ticketReactions[selected.id] ?? []}
            commentFiles={ticketCommentFiles[selected.id] ?? []}
            members={members}
            clientName={clientName}
            currentUserName={currentUserName}
            mode="drawer"
            onClose={closePanel}
          />
        ) : null}
      </TicketSidePanel>
    </div>
  );
}
