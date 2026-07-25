"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Check,
} from "lucide-react";

import type {
  Project,
  Lead,
  Task,
  Attachment,
  ProjectPhase,
  PortalApproval,
  ProjectStatus,
  PortalUpdate,
  PortalComment,
} from "@/lib/data";
import { projectStatuses, projectProgress } from "@/lib/data";
import { setProjectStatus, deleteProject } from "@/lib/actions";
import {
  advanceProjectPhase,
  setActivePhase,
  toggleChecklistItem,
  updateRunbook,
} from "@/lib/delivery/actions";
import { eur, fmtDate, projectStatusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PaymentSchedule } from "@/components/payment-schedule";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ProjectPortalPanel } from "@/components/project-portal-panel";
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

export function ProjectDeliveryHub({
  project,
  lead,
  tasks,
  files,
  phases,
  approvals,
  portalUpdates,
  portalComments,
  paid,
}: {
  project: Project;
  lead?: Lead;
  tasks: Task[];
  files: Attachment[];
  phases: ProjectPhase[];
  approvals: PortalApproval[];
  portalUpdates: PortalUpdate[];
  portalComments: PortalComment[];
  paid: number;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editRunbook, setEditRunbook] = useState(false);
  const progress = projectProgress(phases);
  const active = phases.find((p) => p.status === "active") ?? phases[0];

  const now = tasks.filter((t) => t.status === "In progress");
  const next = tasks.filter((t) => t.status === "Todo" && !t.waitingOnClient);
  const waiting = tasks.filter(
    (t) => t.waitingOnClient && t.status !== "Done"
  );
  const done = tasks.filter((t) => t.status === "Done");

  return (
    <div className="w-full space-y-10 p-4 lg:p-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      {/* Header */}
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Change status"
                className={cn(
                  "h-8 w-[170px] border-0 font-medium shadow-none",
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
              <span className="text-sm text-muted-foreground">
                {project.type}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {project.client}
              {lead && (
                <>
                  {" · "}
                  <Link
                    href={`/leads/${lead.id}`}
                    className="hover:text-foreground hover:underline"
                  >
                    lead
                  </Link>
                </>
              )}
              {" · "}
              {fmtDate(project.start)} → {fmtDate(project.estimatedEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/tasks?new=1&projectId=${project.id}`}>
                    New task
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Phase </span>
              <span className="font-medium">{active?.label ?? "—"}</span>
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {progress}%
            </p>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Runbook — plain links */}
      <section className="space-y-3 border-t pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Runbook</h2>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditRunbook((v) => !v)}
          >
            {editRunbook ? "Cancel" : "Edit"}
          </button>
        </div>
        {editRunbook ? (
          <RunbookEditor
            project={project}
            onDone={() => setEditRunbook(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <RunbookLink label="Staging" href={project.stagingUrl} />
            <RunbookLink label="Figma" href={project.figmaUrl} />
            <RunbookLink label="Repo" href={project.repoUrl} />
            <RunbookLink label="Brief" href={project.briefUrl} />
          </div>
        )}
        {project.portalIntro && !editRunbook && (
          <p className="max-w-xl text-sm text-muted-foreground">
            {project.portalIntro}
          </p>
        )}
      </section>

      {/* Phases — simple stepper */}
      <section className="space-y-4 border-t pt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Phases</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !active}
            onClick={() =>
              startTransition(() => advanceProjectPhase(project.id))
            }
          >
            Advance
          </Button>
        </div>
        <ol className="flex flex-wrap gap-x-1 gap-y-2">
          {phases.map((ph, i) => (
            <li key={ph.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  startTransition(() => setActivePhase(project.id, ph.id))
                }
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm transition-colors",
                  ph.status === "active" &&
                    "bg-foreground text-background",
                  ph.status === "done" &&
                    "text-muted-foreground line-through decoration-muted-foreground/40",
                  ph.status === "upcoming" &&
                    "text-muted-foreground hover:text-foreground"
                )}
              >
                {ph.label}
              </button>
              {i < phases.length - 1 && (
                <span className="text-muted-foreground/40">→</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Checklist */}
      {active && (
        <section className="space-y-3 border-t pt-8">
          <h2 className="text-sm font-semibold">
            {active.label}{" "}
            <span className="font-normal text-muted-foreground">
              checklist
            </span>
          </h2>
          <ul className="divide-y">
            {active.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-2.5">
                <Checkbox
                  checked={item.done}
                  className="mt-0.5"
                  onCheckedChange={(v) =>
                    startTransition(() =>
                      toggleChecklistItem(project.id, item.id, Boolean(v))
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm",
                      item.done && "text-muted-foreground line-through"
                    )}
                  >
                    {item.title}
                  </p>
                  {(item.clientVisible || item.waitingOnClient) &&
                    !item.done && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          item.clientVisible && "Visible to client",
                          item.waitingOnClient && "Waiting on client",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Board — quiet columns */}
      <section className="space-y-4 border-t pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Board</h2>
          <Link
            href={`/tasks?new=1&projectId=${project.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            + Task
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <BoardList title="Now" items={now} />
          <BoardList title="Next" items={next} />
          <BoardList title="Waiting on client" items={waiting} />
          <BoardList title="Done" items={done.slice(0, 6)} />
        </div>
      </section>

      {approvals.length > 0 && (
        <section className="space-y-3 border-t pt-8">
          <h2 className="text-sm font-semibold">Approvals</h2>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-3.5 text-foreground" />
                <span className="capitalize text-foreground">{a.kind}</span>
                <span>
                  · {a.approvedByName} ·{" "}
                  {new Date(a.approvedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Secondary */}
      <section className="border-t pt-8">
        <Tabs defaultValue="portal" className="gap-4">
          <TabsList>
            <TabsTrigger value="portal">Portal</TabsTrigger>
            <TabsTrigger value="payments">
              Payments · {eur(paid)}
            </TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>
          <TabsContent value="portal">
            <ProjectPortalPanel
              project={project}
              tasks={tasks}
              updates={portalUpdates}
              comments={portalComments}
              compact
            />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentSchedule
              projectId={project.id}
              value={project.value}
              payments={project.payments}
              variant="plain"
            />
          </TabsContent>
          <TabsContent value="files">
            <AttachmentsPanel
              parentType="project"
              parentId={project.id}
              items={files}
              title="Attachments"
            />
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              Permanently deletes {project.name} and related delivery data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunbookLink({
  label,
  href,
}: {
  label: string;
  href: string | null;
}) {
  if (!href) {
    return (
      <span className="text-muted-foreground">
        {label} <span className="text-muted-foreground/50">—</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium hover:underline"
    >
      {label}
      <ExternalLink className="size-3 opacity-50" />
    </a>
  );
}

function RunbookEditor({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [stagingUrl, setStagingUrl] = useState(project.stagingUrl ?? "");
  const [figmaUrl, setFigmaUrl] = useState(project.figmaUrl ?? "");
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? "");
  const [briefUrl, setBriefUrl] = useState(project.briefUrl ?? "");
  const [intro, setIntro] = useState(project.portalIntro ?? "");

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1.5 text-xs">Note for client</Label>
        <Textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Staging", stagingUrl, setStagingUrl],
            ["Figma", figmaUrl, setFigmaUrl],
            ["Repo", repoUrl, setRepoUrl],
            ["Brief", briefUrl, setBriefUrl],
          ] as const
        ).map(([label, value, set]) => (
          <div key={label}>
            <Label className="mb-1.5 text-xs">{label}</Label>
            <Input
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder="https://…"
              className="h-9"
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateRunbook(project.id, {
              stagingUrl,
              figmaUrl,
              repoUrl,
              briefUrl,
              portalIntro: intro,
            });
            onDone();
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

function BoardList({ title, items }: { title: string; items: Task[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}{" "}
        <span className="normal-case text-muted-foreground/70">
          ({items.length})
        </span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/60">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id} className="text-sm">
              <span className="font-medium">{t.title}</span>
              {t.clientVisible && (
                <span className="ml-2 text-xs text-muted-foreground">
                  client
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
