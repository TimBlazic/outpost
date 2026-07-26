"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  type FirmSettings,
  type Invoice,
  type Member,
  type PortalMessage,
  type PortalMessageReaction,
  type Project,
  type ProjectStatus,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
} from "@/lib/data";
import type { ChatClientAuthor } from "@/components/portal-chat";
import {
  deleteProject,
  updateProjectMeta,
} from "@/lib/actions";
import { getInvoiceDetailAction } from "@/lib/invoices/actions";
import { ArchiveToggle } from "@/components/archive-toggle";
import { InvoiceDetail } from "@/components/invoice-detail";
import { ProjectChatDock } from "@/components/project-chat-dock";
import { portalUrlForToken } from "@/lib/portal/url";
import { eur, fmtDate, projectStatusColor } from "@/lib/format";
import { TicketsPanel } from "@/components/tickets-panel";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { PaymentSchedule } from "@/components/payment-schedule";
import { SidePanel } from "@/components/side-panel";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const sectionNav = [
  { id: "tickets", label: "Tickets" },
  { id: "files", label: "Files" },
  { id: "payments", label: "Payments" },
  { id: "settings", label: "Settings" },
] as const;

const invoiceStatusColor: Record<Invoice["status"], string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  issued: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  void: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function ProjectWorkspace({
  project,
  tickets,
  files,
  invoices = [],
  messages = [],
  messageReactions = [],
  messageFiles = [],
  ticketFiles = {},
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members,
  currentUserName,
  currentUserId,
  clientAuthor,
  clientPortalStatus,
  clientPortalEmail,
}: {
  project: Project;
  tickets: Ticket[];
  files: Attachment[];
  invoices?: Invoice[];
  messages?: PortalMessage[];
  messageReactions?: PortalMessageReaction[];
  messageFiles?: Attachment[];
  ticketFiles?: Record<string, Attachment[]>;
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members: Member[];
  currentUserName?: string;
  currentUserId?: string | null;
  clientAuthor?: ChatClientAuthor | null;
  clientPortalStatus?: "no-account" | "invited" | "active" | null;
  clientPortalEmail?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [description, setDescription] = useState(project.description ?? "");
  const [copied, setCopied] = useState(false);
  const [perms, setPerms] = useState({
    clientCanViewTickets: project.clientCanViewTickets,
    clientCanCreateTickets: project.clientCanCreateTickets,
    clientCanUploadFiles: project.clientCanUploadFiles,
    clientCanComment: project.clientCanComment,
  });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [activeSection, setActiveSection] =
    useState<(typeof sectionNav)[number]["id"]>("tickets");
  const [invoiceBundle, setInvoiceBundle] = useState<{
    invoice: Invoice;
    settings: FirmSettings;
    projectName: string | null;
  } | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const loadInvoice = useCallback(async (id: string) => {
    setInvoiceLoading(true);
    try {
      const data = await getInvoiceDetailAction(id);
      if (!data) {
        setInvoiceBundle(null);
        setSelectedInvoiceId(null);
        return;
      }
      setInvoiceBundle(data);
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceBundle(null);
      return;
    }
    void loadInvoice(selectedInvoiceId);
  }, [selectedInvoiceId, loadInvoice]);

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
    <>
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
              <h1 className="app-display text-3xl italic leading-tight tracking-tight sm:text-4xl">
                {project.name}
              </h1>
              {isArchived(project) ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Archived
                </span>
              ) : null}
            </div>
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
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Select
                aria-label="Status"
                value={status}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.value as ProjectStatus;
                  setStatus(next);
                  patchMeta({ status: next });
                }}
                className={cn(
                  "h-7 w-auto min-w-[7.5rem] rounded-full border-transparent px-2.5 py-0 pr-7 text-xs font-medium shadow-none",
                  projectStatusColor[status]
                )}
              >
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Phase"
                className="h-7 w-auto min-w-[6.5rem] rounded-full border-border/70 px-2.5 py-0 pr-7 text-xs font-medium shadow-none"
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

      <div className="space-y-5 pb-24">
        <nav
          aria-label="Project sections"
          className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 border-b border-border/70 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          {sectionNav.map((s) => {
            const meta =
              s.id === "payments"
                ? invoices.length > 0
                  ? `${invoices.length} inv`
                  : project.payments.length > 0
                    ? eur(paidAmount(project))
                    : null
                : s.id === "files" && files.length > 0
                  ? String(files.length)
                  : s.id === "tickets" && tickets.length > 0
                    ? String(tickets.length)
                    : null;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  activeSection === s.id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {s.label}
                {meta ? (
                  <span className="ml-1.5 text-muted-foreground">{meta}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {activeSection === "tickets" ? (
          <section className="space-y-3">
            <TicketsPanel
              projectId={project.id}
              projectName={project.name}
              tickets={tickets}
              ticketFiles={ticketFiles}
              ticketComments={ticketComments}
              ticketReactions={ticketReactions}
              ticketCommentFiles={ticketCommentFiles}
              members={members}
              clientName={project.client}
              currentUserName={currentUserName}
            />
          </section>
        ) : null}

        {activeSection === "files" ? (
          <section>
            <AttachmentsPanel
              parentType="project"
              parentId={project.id}
              items={files}
              title="Project files"
            />
          </section>
        ) : null}

        {activeSection === "payments" ? (
          <section className="max-w-2xl space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Invoices</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={
                      project.clientId
                        ? `/invoices/new?clientId=${project.clientId}&projectId=${project.id}`
                        : `/invoices/new?projectId=${project.id}`
                    }
                  >
                    New invoice
                  </Link>
                </Button>
              </div>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invoices linked yet. Assign one when you create or edit an
                  invoice — paid ones count toward dashboard revenue.
                </p>
              ) : (
                <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
                  {invoices.map((inv) => (
                    <li key={inv.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-medium">
                            {inv.invoiceNumber || "Draft"}
                          </span>
                          <StatusPill
                            label={inv.status}
                            className={cn(
                              "capitalize",
                              invoiceStatusColor[inv.status]
                            )}
                          />
                        </span>
                        <span className="text-muted-foreground">
                          {eur(inv.total)} · {fmtDate(inv.issueDate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Installment schedule</h2>
              <PaymentSchedule
                projectId={project.id}
                value={project.value}
                payments={project.payments}
                invoices={invoices}
                variant="plain"
                onOpenInvoice={setSelectedInvoiceId}
              />
            </div>
          </section>
        ) : null}

        {activeSection === "settings" ? (
          <section className="max-w-2xl space-y-10">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Client portal</h2>
                <span className="text-xs text-muted-foreground">
                  {project.portalEnabled ? "On" : "Off"}
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Client access uses a portal login URL (no project PIN).
                </p>
                <p className="text-sm text-muted-foreground">
                  Client account status:{" "}
                  <span className="font-medium text-foreground">
                    {clientPortalStatus === "active"
                      ? "Active"
                      : clientPortalStatus === "invited"
                        ? "Invited"
                        : clientPortalStatus === "no-account"
                          ? "No account"
                          : "Unknown"}
                  </span>
                  {clientPortalEmail ? ` · ${clientPortalEmail}` : ""}
                </p>
                {project.clientId ? (
                  <p className="text-sm text-muted-foreground">
                    Manage account status on the{" "}
                    <Link
                      href={`/clients/${project.clientId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      client profile
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">
                    Link this project to a client to manage account access.
                  </p>
                )}
                {project.portalEnabled && portalUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Legacy link support (temporary)
                    </p>
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
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Client permissions</h2>
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
            </div>
          </section>
        ) : null}
      </div>

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

    <SidePanel
      open={Boolean(selectedInvoiceId)}
      onClose={() => setSelectedInvoiceId(null)}
      className="max-w-4xl"
    >
      {invoiceBundle ? (
        <InvoiceDetail
          invoice={invoiceBundle.invoice}
          settings={invoiceBundle.settings}
          projectName={invoiceBundle.projectName}
          mode="drawer"
          onClose={() => setSelectedInvoiceId(null)}
          onChanged={() => {
            if (selectedInvoiceId) void loadInvoice(selectedInvoiceId);
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {invoiceLoading || selectedInvoiceId ? "Loading invoice…" : null}
        </div>
      )}
    </SidePanel>

    <ProjectChatDock
      project={project}
      messages={messages}
      messageReactions={messageReactions}
      messageFiles={messageFiles}
      members={members}
      currentUserName={currentUserName}
      currentUserId={currentUserId}
      clientAuthor={clientAuthor}
    />
    </>
  );
}
