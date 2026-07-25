"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  Link2,
  CalendarDays,
} from "lucide-react";

import {
  type Project,
  type Lead,
  type Task,
  type Attachment,
  type ProjectStatus,
  type PortalUpdate,
  type PortalComment,
  projectStatuses,
} from "@/lib/data";
import { ProjectPortalPanel } from "@/components/project-portal-panel";
import { setProjectStatus, deleteProject } from "@/lib/actions";
import {
  eur,
  fmtDate,
  fmtDateLong,
  projectStatusColor,
  priorityColor,
  dueState,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { PaymentSchedule } from "@/components/payment-schedule";
import { AttachmentsPanel } from "@/components/attachments-panel";
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

export function ProjectDetail({
  project,
  lead,
  tasks,
  files,
  portalUpdates,
  portalComments,
  paid,
  profit,
  margin,
}: {
  project: Project;
  lead?: Lead;
  tasks: Task[];
  files: Attachment[];
  portalUpdates: PortalUpdate[];
  portalComments: PortalComment[];
  paid: number;
  profit: number;
  margin: number;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openTasks = tasks.filter((t) => t.status !== "Done").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Change status"
                className={cn(
                  "h-8 w-[180px] border-0 font-medium shadow-none",
                  projectStatusColor[project.status]
                )}
                value={project.status}
                disabled={pending}
                onChange={(e) =>
                  startTransition(() =>
                    setProjectStatus(
                      project.id,
                      e.target.value as ProjectStatus
                    )
                  )
                }
              >
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Badge variant="secondary" className="font-normal">
                {project.type}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-muted-foreground">
              {project.client}
              {project.source ? ` · via ${project.source}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {lead && (
                  <DropdownMenuItem asChild>
                    <Link href={`/leads/${lead.id}`}>View originating lead</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/tasks?new=1&projectId=${project.id}`}>
                    New task
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Financial strip */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          <Fact label="Project value" value={eur(project.value)} emphasis />
          <Fact
            label="Collected"
            value={eur(paid)}
            tone={paid >= project.value && project.value > 0 ? "ok" : undefined}
          />
          <Fact label="Cost" value={eur(project.cost)} />
          <Fact
            label="Profit so far"
            value={eur(profit)}
            sub={paid > 0 ? `${margin}% margin` : undefined}
            tone={profit < 0 ? "danger" : profit > 0 ? "ok" : undefined}
          />
        </div>

        {/* Timeline + lead meta */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {fmtDate(project.start)} → {fmtDate(project.estimatedEnd)}
            {project.actualEnd ? ` · ended ${fmtDate(project.actualEnd)}` : ""}
          </span>
          {lead && (
            <Link
              href={`/leads/${lead.id}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Link2 className="size-3.5" />
              From {lead.company}
            </Link>
          )}
        </div>
      </header>

      <Tabs defaultValue="payments" className="gap-5">
        <TabsList>
          <TabsTrigger value="payments">
            Payments ({project.payments.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks ({tasks.length}
            {openTasks > 0 ? ` · ${openTasks} open` : ""})
          </TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="portal">
            Portal
            {project.portalEnabled ? " · on" : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentSchedule
            projectId={project.id}
            value={project.value}
            payments={project.payments}
            variant="plain"
          />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksPanel tasks={tasks} projectId={project.id} />
        </TabsContent>

        <TabsContent value="files">
          <AttachmentsPanel
            parentType="project"
            parentId={project.id}
            items={files}
            title="Attachments"
          />
        </TabsContent>

        <TabsContent value="portal">
          <ProjectPortalPanel
            project={project}
            tasks={tasks}
            updates={portalUpdates}
            comments={portalComments}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              Delete &quot;{project.name}&quot; and its payment schedule? This
              cannot be undone.
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
                  await deleteProject(project.id);
                })
              }
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fact({
  label,
  value,
  sub,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  tone?: "danger" | "ok";
}) {
  return (
    <div className="bg-background px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight",
          emphasis && "text-lg",
          tone === "danger" && "text-rose-600",
          tone === "ok" && "text-emerald-600"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TasksPanel({
  tasks,
  projectId,
}: {
  tasks: Task[];
  projectId: string;
}) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (a.status !== "Done" && b.status === "Done") return -1;
    return a.due < b.due ? -1 : 1;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tasks linked to this project
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/tasks?new=1&projectId=${projectId}`}>New task</Link>
        </Button>
      </div>

      <div className="divide-y rounded-xl border">
        {sorted.map((t) => {
          const state = dueState(t.due);
          const done = t.status === "Done";
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    done && "text-muted-foreground line-through"
                  )}
                >
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">{t.status}</p>
              </div>
              <StatusPill
                label={t.priority}
                className={priorityColor[t.priority]}
              />
              <span
                className={cn(
                  "w-16 text-right text-xs",
                  !done && state === "overdue" && "font-medium text-rose-600",
                  !done && state === "today" && "font-medium text-amber-600",
                  (done || (state !== "overdue" && state !== "today")) &&
                    "text-muted-foreground"
                )}
              >
                {fmtDate(t.due)}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No tasks linked yet. Create one from Tasks and link this project.
          </p>
        )}
      </div>
    </div>
  );
}
