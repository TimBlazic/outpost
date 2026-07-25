"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  ListTodo,
  KanbanSquare,
  CheckSquare,
} from "lucide-react";

import {
  memberById,
  members as seedMembers,
  type Attachment,
  type Task,
  type Lead,
  type Project,
  type Member,
} from "@/lib/data";
import { toggleTaskDone } from "@/lib/actions";
import { fmtDate, dueState, priorityColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/user-avatar";
import { StatusPill } from "@/components/status-pill";
import { TaskDetail } from "@/components/task-detail";
import { TasksKanban } from "@/components/tasks-kanban";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Group = { key: string; label: string; accent: string };

const groups: Group[] = [
  { key: "overdue", label: "Overdue", accent: "text-rose-600" },
  { key: "today", label: "Today", accent: "text-amber-600" },
  { key: "soon", label: "This week", accent: "text-foreground" },
  { key: "later", label: "Later", accent: "text-muted-foreground" },
];

function TaskSidePanel({
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

export function TasksWorkspace({
  tasks,
  leads,
  projects,
  members = seedMembers,
  taskFiles = {},
  openCount,
  overdueCount,
  defaultOpenCreate = false,
  defaultOpenTaskId,
  defaultLeadId,
  defaultProjectId,
}: {
  tasks: Task[];
  leads: Lead[];
  projects: Project[];
  members?: Member[];
  taskFiles?: Record<string, Attachment[]>;
  openCount: number;
  overdueCount: number;
  defaultOpenCreate?: boolean;
  defaultOpenTaskId?: string;
  defaultLeadId?: string;
  defaultProjectId?: string;
}) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(tasks.map((t) => [t.id, t.status === "Done"]))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDone(Object.fromEntries(tasks.map((t) => [t.id, t.status === "Done"])));
  }, [tasks]);

  useEffect(() => {
    if (!defaultOpenCreate) return;
    setCreating(true);
    setSelectedId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("new")) {
      url.searchParams.delete("new");
      const next =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [defaultOpenCreate]);

  useEffect(() => {
    if (!defaultOpenTaskId) return;
    if (!tasks.some((t) => t.id === defaultOpenTaskId)) return;
    setCreating(false);
    setSelectedId(defaultOpenTaskId);
    const url = new URL(window.location.href);
    if (url.searchParams.has("task")) {
      url.searchParams.delete("task");
      const next =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [defaultOpenTaskId, tasks]);

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId]
  );
  const panelOpen = creating || Boolean(selectedId);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
  }

  function openTask(id: string) {
    setCreating(false);
    setSelectedId(id);
  }

  function closePanel() {
    setCreating(false);
    setSelectedId(null);
  }

  const toggle = (id: string) => {
    setDone((d) => ({ ...d, [id]: !d[id] }));
    startTransition(() => {
      toggleTaskDone(id);
    });
  };

  function linkFor(t: Task) {
    if (t.leadId) {
      const l = leads.find((x) => x.id === t.leadId);
      return l ? { href: `/leads/${l.id}`, label: l.company } : null;
    }
    if (t.projectId) {
      const p = projects.find((x) => x.id === t.projectId);
      return p ? { href: `/projects/${p.id}`, label: p.client } : null;
    }
    return null;
  }

  const panel = (
    <TaskSidePanel open={panelOpen} onClose={closePanel}>
      {creating ? (
        <TaskDetail
          mode="create"
          leads={leads}
          projects={projects}
          members={members}
          defaultLeadId={defaultLeadId}
          defaultProjectId={defaultProjectId}
          onClose={closePanel}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      ) : selected ? (
        <TaskDetail
          task={selected}
          files={taskFiles[selected.id] ?? []}
          leads={leads}
          projects={projects}
          members={members}
          mode="drawer"
          onClose={closePanel}
        />
      ) : selectedId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading task…
        </div>
      ) : null}
    </TaskSidePanel>
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Tasks & follow-ups"
        description={`${openCount} open · ${overdueCount} overdue`}
      >
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New task
        </Button>
      </PageHeader>

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Track follow-ups and delivery work here. Create a task and link it to a lead or project."
          actionLabel="New task"
          actionHref="/tasks?new=1"
        />
      ) : (
        <Tabs defaultValue="list" className="gap-4">
          <TabsList>
            <TabsTrigger value="list">
              <ListTodo className="size-4" /> List
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <KanbanSquare className="size-4" /> Kanban
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {groups.map((g) => {
              const items = tasks.filter(
                (t) => dueState(t.due) === g.key && !done[t.id]
              );
              if (items.length === 0 && g.key === "later") return null;
              return (
                <section key={g.key} className="space-y-2">
                  <h2 className={cn("text-sm font-semibold", g.accent)}>
                    {g.label}{" "}
                    <span className="text-muted-foreground">
                      ({items.length})
                    </span>
                  </h2>
                  <DataTable>
                    {items.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nothing in this bucket.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>Task</TableHead>
                            <TableHead>Linked</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Assignee</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((t) => {
                            const rel = linkFor(t);
                            return (
                              <TableRow
                                key={t.id}
                                className="cursor-pointer"
                                onClick={() => openTask(t.id)}
                              >
                                <TableCell
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={done[t.id]}
                                    onCheckedChange={() => toggle(t.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {t.title}
                                    </span>
                                    {t.reminder && (
                                      <Bell className="size-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {rel ? (
                                    <Link
                                      href={rel.href}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                                    >
                                      {rel.label}
                                    </Link>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <StatusPill
                                    label={t.priority}
                                    className={priorityColor[t.priority]}
                                  />
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-sm",
                                    g.key === "overdue" &&
                                      "font-medium text-rose-600"
                                  )}
                                >
                                  {fmtDate(t.due)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      member={memberById(
                                        t.assignedTo,
                                        members
                                      )}
                                      className="size-6"
                                      fallbackClassName="bg-muted text-[10px] text-foreground"
                                    />
                                    <span className="text-sm">
                                      {
                                        memberById(t.assignedTo, members)
                                          .name
                                      }
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                </section>
              );
            })}
          </TabsContent>

          <TabsContent value="kanban">
            <p className="mb-3 text-xs text-muted-foreground">
              Drag a card into another column to update its status. Click to
              open.
            </p>
            <TasksKanban
              tasks={tasks}
              leads={leads}
              projects={projects}
              onOpen={openTask}
            />
          </TabsContent>
        </Tabs>
      )}

      {panel}
    </div>
  );
}
