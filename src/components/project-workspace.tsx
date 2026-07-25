"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  deliveryPhaseOptions,
  isArchived,
  paidAmount,
  projectStatuses,
  type Attachment,
  type Member,
  type Project,
  type ProjectStatus,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
} from "@/lib/data";
import {
  deleteProject,
  updateProjectMeta,
} from "@/lib/actions";
import { ArchiveToggle } from "@/components/archive-toggle";
import {
  disableProjectPortal,
  enableProjectPortal,
  rotatePortalToken,
  setPortalPin,
} from "@/lib/portal/actions";
import { portalUrlForToken } from "@/lib/portal/url";
import { eur, projectStatusColor } from "@/lib/format";
import { TicketsPanel } from "@/components/tickets-panel";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { PaymentSchedule } from "@/components/payment-schedule";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function ProjectWorkspace({
  project,
  tickets,
  files,
  ticketFiles = {},
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members,
  currentUserName,
}: {
  project: Project;
  tickets: Ticket[];
  files: Attachment[];
  ticketFiles?: Record<string, Attachment[]>;
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members: Member[];
  currentUserName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [description, setDescription] = useState(project.description ?? "");
  const [pin, setPin] = useState("");
  const [copied, setCopied] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [perms, setPerms] = useState({
    clientCanViewTickets: project.clientCanViewTickets,
    clientCanCreateTickets: project.clientCanCreateTickets,
    clientCanUploadFiles: project.clientCanUploadFiles,
    clientCanComment: project.clientCanComment,
  });

  const portalUrl = useMemo(
    () => portalUrlForToken(project.portalToken),
    [project.portalToken]
  );

  function patchMeta(
    input: Parameters<typeof updateProjectMeta>[1]
  ) {
    startTransition(async () => {
      await updateProjectMeta(project.id, input);
    });
  }

  function copyLink() {
    if (!portalUrl) return;
    void navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="w-full space-y-8 p-4 lg:p-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={project.status}
                className={projectStatusColor[project.status]}
              />
              {isArchived(project) ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Archived
                </span>
              ) : null}
              <Select
                aria-label="Phase"
                className="h-8 w-[160px]"
                defaultValue={project.phase}
                disabled={pending}
                onChange={(e) => patchMeta({ phase: e.target.value })}
              >
                {deliveryPhaseOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {project.clientId ? (
                <Link
                  href={`/clients/${project.clientId}`}
                  className="hover:text-foreground hover:underline"
                >
                  {project.client}
                </Link>
              ) : (
                project.client
              )}
              <span className="mx-1.5 text-border">·</span>
              {project.type}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Status"
              className="h-9 w-[180px]"
              defaultValue={project.status}
              disabled={pending}
              onChange={(e) =>
                patchMeta({ status: e.target.value as ProjectStatus })
              }
            >
              {projectStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <ArchiveToggle
              kind="project"
              id={project.id}
              archived={isArchived(project)}
            />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${project.id}/edit`}>Edit details</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Budget</p>
            <p className="mt-0.5 font-medium">{eur(project.value)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cost</p>
            <p className="mt-0.5 font-medium">{eur(project.cost)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Margin</p>
            <p className="mt-0.5 font-medium">
              {eur(project.value - project.cost)}
            </p>
          </div>
        </div>

        <div className="max-w-3xl space-y-1.5">
          <Label htmlFor="project-description" className="text-xs text-muted-foreground">
            Description
          </Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (project.description ?? "")) {
                patchMeta({ description });
              }
            }}
            placeholder="Scope, goals, notes for the team…"
            rows={3}
            className="resize-y"
          />
        </div>
      </header>

      <Tabs defaultValue="tickets" className="gap-4">
        <TabsList>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            {project.payments.length > 0
              ? ` · ${eur(paidAmount(project))}`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <TicketsPanel
            projectId={project.id}
            tickets={tickets}
            ticketFiles={ticketFiles}
            ticketComments={ticketComments}
            ticketReactions={ticketReactions}
            ticketCommentFiles={ticketCommentFiles}
            members={members}
            clientName={project.client}
            currentUserName={currentUserName}
          />
        </TabsContent>

        <TabsContent value="files">
          <AttachmentsPanel
            parentType="project"
            parentId={project.id}
            items={files}
            title="Project files"
          />
        </TabsContent>

        <TabsContent value="payments" className="max-w-2xl">
          <PaymentSchedule
            projectId={project.id}
            value={project.value}
            payments={project.payments}
            variant="plain"
          />
        </TabsContent>

        <TabsContent value="settings" className="max-w-2xl space-y-10">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Client portal</h3>
              <span className="text-xs text-muted-foreground">
                {project.portalEnabled ? "On" : "Off"}
              </span>
            </div>

            {!project.portalEnabled ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Share a link and PIN so the client can view tickets and files.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="mb-1.5 text-xs">PIN</Label>
                    <Input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Min. 4 chars"
                      className="h-9 w-40"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={pending || pin.trim().length < 4}
                    onClick={() => {
                      setPortalError(null);
                      startTransition(async () => {
                        try {
                          await enableProjectPortal(project.id, pin);
                          setPin("");
                        } catch (e) {
                          setPortalError(
                            e instanceof Error ? e.message : "Failed"
                          );
                        }
                      });
                    }}
                  >
                    Enable
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    readOnly
                    value={portalUrl}
                    className="h-9 min-w-0 flex-1 font-mono text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={portalUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="mb-1.5 text-xs">Reset PIN</Label>
                    <Input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="h-9 w-36"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || pin.trim().length < 4}
                    onClick={() =>
                      startTransition(async () => {
                        await setPortalPin(project.id, pin);
                        setPin("");
                      })
                    }
                  >
                    Save PIN
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await rotatePortalToken(project.id);
                      })
                    }
                  >
                    Rotate link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => disableProjectPortal(project.id))
                    }
                  >
                    Disable
                  </Button>
                </div>
              </div>
            )}
            {portalError && (
              <p className="text-sm text-rose-600">{portalError}</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Portal language</h3>
            <p className="text-sm text-muted-foreground">
              Language the client sees in their portal.
            </p>
            <Select
              className="h-9 w-48"
              defaultValue={project.portalLocale ?? "en"}
              disabled={pending}
              onChange={(e) =>
                patchMeta({
                  portalLocale: e.target.value === "sl" ? "sl" : "en",
                })
              }
            >
              <option value="en">English</option>
              <option value="sl">Slovenščina</option>
            </Select>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Client permissions</h3>
            <p className="text-sm text-muted-foreground">
              What the client can do in the portal for this project.
            </p>
            <ul className="space-y-2.5">
              {(
                [
                  ["clientCanViewTickets", "View tickets"],
                  ["clientCanCreateTickets", "Create tickets"],
                  ["clientCanUploadFiles", "Upload files"],
                  ["clientCanComment", "Comment"],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={perms[key]}
                      disabled={pending}
                      onCheckedChange={(v) => {
                        const next = { ...perms, [key]: Boolean(v) };
                        setPerms(next);
                        patchMeta(next);
                      }}
                    />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This removes the project, its tickets, and related attachments.
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
