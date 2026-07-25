"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bell, Calendar, Link2, Search, Trash2, X } from "lucide-react";

import {
  isArchived,
  members as seedMembers,
  taskPriorities,
  taskStatuses,
  type Attachment,
  type Lead,
  type Member,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/data";
import {
  addAttachment,
  createTask,
  deleteTask,
  updateTask,
  uploadAttachment,
} from "@/lib/actions";
import { fmtDate, priorityColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import {
  AttachmentsPanel,
  type StagedAttachmentFile,
  type StagedAttachmentLink,
} from "@/components/attachments-panel";
import { ConfirmDelete } from "@/components/confirm-delete";
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

function linkValue(
  task?: Task,
  defaultLeadId?: string,
  defaultProjectId?: string
) {
  if (task?.leadId) return `lead:${task.leadId}`;
  if (task?.projectId) return `project:${task.projectId}`;
  if (defaultLeadId) return `lead:${defaultLeadId}`;
  if (defaultProjectId) return `project:${defaultProjectId}`;
  return "";
}

function parseLink(link: string) {
  const [kind, id] = link.split(":");
  return {
    leadId: kind === "lead" ? id : undefined,
    projectId: kind === "project" ? id : undefined,
  };
}

function LinkPicker({
  link,
  leads,
  projects,
  onChange,
}: {
  link: string;
  leads: Lead[];
  projects: Project[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const label = link
    ? link.startsWith("lead:")
      ? (leads.find((l) => l.id === link.slice(5))?.company ?? "Lead")
      : (projects.find((p) => p.id === link.slice(8))?.name ?? "Project")
    : "Link";

  const query = q.trim().toLowerCase();
  const filteredLeads = useMemo(
    () =>
      leads.filter((l) => {
        if (!query) return true;
        return (
          l.company.toLowerCase().includes(query) ||
          l.contact.toLowerCase().includes(query) ||
          l.email.toLowerCase().includes(query)
        );
      }),
    [leads, query]
  );
  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        const linked = link === `project:${p.id}`;
        if (isArchived(p) && !linked) return false;
        if (!query) return true;
        return (
          p.name.toLowerCase().includes(query) ||
          p.client.toLowerCase().includes(query)
        );
      }),
    [projects, query, link]
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(PILL, "text-muted-foreground")}
        onClick={() => setOpen((v) => !v)}
      >
        <Link2 className="size-3.5" />
        <span className="max-w-40 truncate">{label}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads & projects…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              className="flex w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50"
              onClick={() => pick("")}
            >
              Nothing
            </button>
            {filteredLeads.length > 0 && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Leads
              </div>
            )}
            {filteredLeads.map((l) => (
              <button
                key={l.id}
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-1.5 text-left hover:bg-muted/50",
                  link === `lead:${l.id}` && "bg-muted/40"
                )}
                onClick={() => pick(`lead:${l.id}`)}
              >
                <span className="truncate text-sm font-medium">{l.company}</span>
                {l.contact ? (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {l.contact}
                  </span>
                ) : null}
              </button>
            ))}
            {filteredProjects.length > 0 && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Projects
              </div>
            )}
            {filteredProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-1.5 text-left hover:bg-muted/50",
                  link === `project:${p.id}` && "bg-muted/40"
                )}
                onClick={() => pick(`project:${p.id}`)}
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {p.client}
                </span>
              </button>
            ))}
            {filteredLeads.length === 0 && filteredProjects.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskDetail({
  task,
  files = [],
  leads,
  projects,
  members = seedMembers,
  mode = "drawer",
  defaultLeadId,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  task?: Task;
  files?: Attachment[];
  leads: Lead[];
  projects: Project[];
  members?: Member[];
  mode?: "drawer" | "create";
  defaultLeadId?: string;
  defaultProjectId?: string;
  onClose?: () => void;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const creating = mode === "create" || !task;
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  const defaultAssignee =
    task?.assignedTo ?? members[0]?.id ?? seedMembers[0].id;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "Todo");
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "Medium"
  );
  const [assignedTo] = useState(defaultAssignee);
  const [due, setDue] = useState(
    task?.due ?? new Date().toISOString().slice(0, 10)
  );
  const [link, setLink] = useState(
    linkValue(task, defaultLeadId, defaultProjectId)
  );
  const [reminder, setReminder] = useState(task?.reminder ?? false);
  const [clientVisible, setClientVisible] = useState(
    task?.clientVisible ?? false
  );
  const [waitingOnClient, setWaitingOnClient] = useState(
    task?.waitingOnClient ?? false
  );
  const [stagedFiles, setStagedFiles] = useState<StagedAttachmentFile[]>([]);
  const [stagedLinks, setStagedLinks] = useState<StagedAttachmentLink[]>([]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setDue(task.due);
    setLink(linkValue(task));
    setReminder(task.reminder);
    setClientVisible(task.clientVisible);
    setWaitingOnClient(task.waitingOnClient);
    setDescriptionDirty(false);
  }, [task]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const linkedProject = link.startsWith("project:");

  function buildInput(
    patch?: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      due: string;
      link: string;
      reminder: boolean;
      clientVisible: boolean;
      waitingOnClient: boolean;
    }>
  ) {
    const nextLink = patch?.link ?? link;
    const { leadId, projectId } = parseLink(nextLink);
    const visible = patch?.clientVisible ?? clientVisible;
    const waiting = patch?.waitingOnClient ?? waitingOnClient;
    return {
      title: (patch?.title ?? title).trim(),
      description: patch?.description ?? description,
      leadId,
      projectId,
      assignedTo: task?.assignedTo ?? assignedTo,
      due: patch?.due ?? due,
      priority: patch?.priority ?? priority,
      status: patch?.status ?? status,
      reminder: patch?.reminder ?? reminder,
      clientVisible: Boolean(projectId) && visible,
      waitingOnClient: Boolean(projectId) && visible && waiting,
    };
  }

  function persist(patch?: Parameters<typeof buildInput>[0]) {
    if (creating || !task) return;
    const input = buildInput(patch);
    if (!input.title) return;
    startTransition(async () => {
      await updateTask(task.id, input);
      router.refresh();
    });
  }

  function create() {
    const input = buildInput();
    if (!input.title) return;
    startTransition(async () => {
      const id = await createTask(input);
      for (const staged of stagedFiles) {
        const fd = new FormData();
        fd.set("parentType", "task");
        fd.set("parentId", id);
        fd.set("label", staged.file.name);
        fd.set("file", staged.file);
        await uploadAttachment(fd);
      }
      for (const staged of stagedLinks) {
        await addAttachment({
          parentType: "task",
          parentId: id,
          label: staged.label,
          kind: staged.kind,
          url: staged.url,
        });
      }
      setStagedFiles([]);
      setStagedLinks([]);
      router.refresh();
      onCreated?.(id);
    });
  }

  function openDuePicker() {
    const el = dueRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const body = (
    <>
      <div className="space-y-4 px-5 pt-6 pb-5">
        <div className="space-y-1">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            placeholder="Task title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            onBlur={() => {
              if (!creating && task && title.trim() && title !== task.title) {
                persist({ title });
              }
            }}
            className="w-full resize-none overflow-hidden border-none bg-transparent text-xl font-semibold leading-tight text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={PILL}>
                {status}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {taskStatuses.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => {
                    setStatus(s);
                    if (!creating) persist({ status: s });
                  }}
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(PILL, "border-transparent", priorityColor[priority])}
              >
                {priority}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {taskPriorities.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => {
                    setPriority(p);
                    if (!creating) persist({ priority: p });
                  }}
                >
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      priorityColor[p]
                    )}
                  >
                    {p}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            className={cn(PILL, "text-muted-foreground")}
            onClick={openDuePicker}
          >
            <Calendar className="size-3.5" />
            {due ? fmtDate(due) : "Due date"}
          </button>
          <input
            ref={dueRef}
            type="date"
            value={due}
            tabIndex={-1}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            onChange={(e) => {
              const v = e.target.value;
              setDue(v);
              if (!creating) persist({ due: v });
            }}
          />

          <LinkPicker
            link={link}
            leads={leads}
            projects={projects}
            onChange={(next) => {
              setLink(next);
              if (next.startsWith("lead:") || !next) {
                setClientVisible(false);
                setWaitingOnClient(false);
              }
              if (!creating) {
                persist({
                  link: next,
                  clientVisible:
                    next.startsWith("project:") && clientVisible,
                  waitingOnClient:
                    next.startsWith("project:") &&
                    clientVisible &&
                    waitingOnClient,
                });
              }
            }}
          />

          <button
            type="button"
            className={cn(
              PILL,
              reminder ? "text-foreground" : "text-muted-foreground"
            )}
            onClick={() => {
              const next = !reminder;
              setReminder(next);
              if (!creating) persist({ reminder: next });
            }}
          >
            <Bell className="size-3.5" />
            {reminder ? "Reminder on" : "Reminder"}
          </button>

          {linkedProject && (
            <>
              <button
                type="button"
                className={cn(
                  PILL,
                  clientVisible ? "text-foreground" : "text-muted-foreground"
                )}
                onClick={() => {
                  const next = !clientVisible;
                  setClientVisible(next);
                  if (!next) setWaitingOnClient(false);
                  if (!creating)
                    persist({
                      clientVisible: next,
                      waitingOnClient: next ? waitingOnClient : false,
                    });
                }}
              >
                {clientVisible ? "Client visible" : "Hidden from client"}
              </button>
              {clientVisible && (
                <button
                  type="button"
                  className={cn(
                    PILL,
                    waitingOnClient
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() => {
                    const next = !waitingOnClient;
                    setWaitingOnClient(next);
                    if (!creating) persist({ waitingOnClient: next });
                  }}
                >
                  {waitingOnClient ? "Waiting on client" : "Not waiting"}
                </button>
              )}
            </>
          )}
        </div>

        {!creating && task && link && (
          <div className="text-xs text-muted-foreground">
            {task.leadId ? (
              <Link
                href={`/leads/${task.leadId}`}
                className="hover:text-foreground hover:underline"
              >
                Open linked lead
              </Link>
            ) : task.projectId ? (
              <Link
                href={`/projects/${task.projectId}`}
                className="hover:text-foreground hover:underline"
              >
                Open linked project
              </Link>
            ) : null}
          </div>
        )}
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
          className="min-h-25 resize-y border-border/60 bg-muted/20 text-sm"
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
                setDescription(task?.description ?? "");
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

      <div className="border-t border-border/60 px-5 pt-5 pb-4">
        <AttachmentsPanel
          parentType="task"
          parentId={task?.id ?? ""}
          items={creating ? [] : files}
          variant="inline"
          staging={creating}
          stagedFiles={stagedFiles}
          stagedLinks={stagedLinks}
          onStagedFilesChange={setStagedFiles}
          onStagedLinksChange={setStagedLinks}
        />
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {creating ? "New task" : "Task"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!creating && task && (
            <ConfirmDelete
              title="Delete task?"
              description="This removes the task and its attachments."
              onConfirm={async () => {
                await deleteTask(task.id);
                onClose?.();
                router.refresh();
              }}
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
          {onClose && (
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

      <div className="flex-1 overflow-y-auto">
        {body}
        {creating && (
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
              Create task
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
