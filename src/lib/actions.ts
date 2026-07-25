"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";

import {
  getLeads,
  saveLeads,
  getTasks,
  saveTasks,
  getProjects,
  saveProjects,
  getClients,
  saveClients,
  getTickets,
  saveTickets,
  getTicketComments,
  saveTicketComments,
  getTicketCommentReactions,
  saveTicketCommentReactions,
  getNotes,
  saveNotes,
  getActivities,
  saveActivities,
  getAttachments,
  saveAttachments,
  getDocs,
  saveDocs,
  saveFirmSettings,
  syncLeadNoteCount,
} from "./store";
import type {
  Lead,
  LeadStatus,
  Payment,
  Task,
  TaskPriority,
  TaskStatus,
  Project,
  ProjectType,
  ProjectStatus,
  Note,
  Activity,
  ActivityType,
  FileLink,
  Attachment,
  AttachmentParent,
  AttachmentKind,
  Doc,
  DocCategory,
  FirmSettings,
  Client,
  Ticket,
  TicketStatus,
  TicketParty,
  TicketComment,
  TicketCommentReaction,
} from "./data";
import { isArchived, memberById, members as seedMembers } from "./data";
import { getCurrentProfile, getCurrentUserId } from "./auth/session";
import { isSupabaseEnabled } from "./supabase/env";
import { createClient as createSupabaseServerClient } from "./supabase/server";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function revalidateLead(id: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

// ---- Leads ----------------------------------------------------------------

export type LeadInput = {
  company: string;
  website: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  category: Lead["category"];
  source: Lead["source"];
  ownerId: string;
  status: LeadStatus;
  value: number;
  probability: number;
  nextFollowUp: string | null;
  tags: string[];
  description?: string;
};

export async function createLead(input: LeadInput) {
  const leads = await getLeads();
  const lead: Lead = {
    id: uid("l"),
    ...input,
    description: input.description ?? "",
    firstContact: null,
    lastContact: null,
    notes: 0,
    createdBy: input.ownerId,
  };
  await saveLeads([lead, ...leads]);
  revalidateLead(lead.id);
  return lead.id;
}

export async function updateLead(id: string, input: LeadInput) {
  const leads = await getLeads();
  await saveLeads(leads.map((l) => (l.id === id ? { ...l, ...input } : l)));
  revalidateLead(id);
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const leads = await getLeads();
  const current = leads.find((l) => l.id === id);
  if (!current || current.status === status) return;

  const now = today();
  const me = await getCurrentUserId();
  await saveLeads(
    leads.map((l) =>
      l.id === id
        ? {
            ...l,
            status,
            lastContact: now,
            firstContact: l.firstContact ?? now,
          }
        : l
    )
  );

  const activities = await getActivities();
  const activity: Activity = {
    id: uid("a"),
    leadId: id,
    type: "status",
    title: `Status changed to ${status}`,
    date: now,
    userId: me,
  };
  await saveActivities([activity, ...activities]);
  revalidateLead(id);
}

export async function setFollowUp(leadId: string, date: string | null) {
  const leads = await getLeads();
  await saveLeads(
    leads.map((l) =>
      l.id === leadId ? { ...l, nextFollowUp: date } : l
    )
  );
  revalidateLead(leadId);
}

export async function snoozeFollowUp(leadId: string, days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  await setFollowUp(leadId, d.toISOString().slice(0, 10));
}

/** Log a touch + optionally bump last contact / follow-up / status. */
export async function quickTouch(
  leadId: string,
  input: {
    type: ActivityType;
    title: string;
    detail?: string;
    followUpInDays?: number | null;
    status?: LeadStatus;
  }
) {
  const now = today();
  const me = await getCurrentUserId();
  const leads = await getLeads();
  const current = leads.find((l) => l.id === leadId);
  if (!current) return;

  let nextFollowUp = current.nextFollowUp;
  if (input.followUpInDays === null) {
    nextFollowUp = null;
  } else if (typeof input.followUpInDays === "number") {
    const d = new Date();
    d.setDate(d.getDate() + input.followUpInDays);
    nextFollowUp = d.toISOString().slice(0, 10);
  }

  const status = input.status ?? current.status;

  await saveLeads(
    leads.map((l) =>
      l.id === leadId
        ? {
            ...l,
            status,
            lastContact: now,
            firstContact: l.firstContact ?? now,
            nextFollowUp,
          }
        : l
    )
  );

  const activities = await getActivities();
  const nextActivities: Activity[] = [
    {
      id: uid("a"),
      leadId,
      type: input.type,
      title: input.title,
      detail: input.detail,
      date: now,
      userId: me,
    },
  ];
  if (status !== current.status) {
    nextActivities.unshift({
      id: uid("a"),
      leadId,
      type: "status",
      title: `Status changed to ${status}`,
      date: now,
      userId: me,
    });
  }
  await saveActivities([...nextActivities, ...activities]);

  revalidateLead(leadId);
}

export async function searchAll(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 1) {
    return {
      leads: [],
      clients: [],
      projects: [],
      docs: [],
      tasks: [],
    };
  }

  const [leads, clients, projects, docs, tasks] = await Promise.all([
    getLeads(),
    getClients(),
    getProjects(),
    getDocs(),
    getTasks(),
  ]);

  return {
    leads: leads
      .filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((l) => ({
        id: l.id,
        title: l.company,
        subtitle: `${l.contact} · ${l.status}`,
        href: `/leads/${l.id}`,
      })),
    clients: clients
      .filter(
        (c) =>
          !isArchived(c) &&
          (c.name.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.country.toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: [c.email, c.country].filter(Boolean).join(" · ") || "Client",
        href: `/clients/${c.id}`,
      })),
    projects: projects
      .filter(
        (p) =>
          !isArchived(p) &&
          (p.name.toLowerCase().includes(q) ||
            p.client.toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.client} · ${p.status}`,
        href: `/projects/${p.id}`,
      })),
    docs: docs
      .filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.excerpt.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: d.category,
        href: `/docs/${d.id}`,
      })),
    tasks: tasks
      .filter((t) => t.title.toLowerCase().includes(q) && t.status !== "Done")
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `${t.priority} · due ${t.due}`,
        href: `/tasks?task=${t.id}`,
      })),
  };
}

export async function deleteLead(id: string) {
  const leads = await getLeads();
  await saveLeads(leads.filter((l) => l.id !== id));

  const notes = await getNotes();
  await saveNotes(notes.filter((n) => n.leadId !== id));

  const activities = await getActivities();
  await saveActivities(activities.filter((a) => a.leadId !== id));

  const tasks = await getTasks();
  await saveTasks(tasks.filter((t) => t.leadId !== id));

  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) => a.parentType === "lead" && a.parentId === id
  );
  await saveAttachments(
    attachments.filter((a) => !(a.parentType === "lead" && a.parentId === id))
  );
  await cleanupAttachmentFiles(removed);

  const projects = await getProjects();
  await saveProjects(
    projects.map((p) => (p.leadId === id ? { ...p, leadId: undefined } : p))
  );

  revalidatePath("/leads");
  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/leads");
}

// ---- Notes ----------------------------------------------------------------

export async function addNote(
  leadId: string,
  input: { title: string; body: string; pinned: boolean }
) {
  const me = await getCurrentUserId();
  const notes = await getNotes();
  const note: Note = {
    id: uid("n"),
    leadId,
    title: input.title || "Untitled note",
    body: input.body,
    pinned: input.pinned,
    date: today(),
    userId: me,
  };
  await saveNotes([note, ...notes]);
  await syncLeadNoteCount(leadId);
  revalidateLead(leadId);
}

export async function updateNote(
  noteId: string,
  leadId: string,
  input: { title: string; body: string }
) {
  const notes = await getNotes();
  await saveNotes(
    notes.map((n) =>
      n.id === noteId
        ? {
            ...n,
            title: input.title || "Untitled note",
            body: input.body,
            date: today(),
          }
        : n
    )
  );
  revalidateLead(leadId);
}

export async function toggleNotePin(noteId: string, leadId: string) {
  const notes = await getNotes();
  await saveNotes(
    notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
  );
  revalidateLead(leadId);
}

export async function deleteNote(noteId: string, leadId: string) {
  const notes = await getNotes();
  await saveNotes(notes.filter((n) => n.id !== noteId));
  await syncLeadNoteCount(leadId);
  revalidateLead(leadId);
}

// ---- Activity -------------------------------------------------------------

export async function addActivity(
  leadId: string,
  input: { type: ActivityType; title: string; detail: string }
) {
  const me = await getCurrentUserId();
  const activities = await getActivities();
  const activity: Activity = {
    id: uid("a"),
    leadId,
    type: input.type,
    title: input.title,
    detail: input.detail || undefined,
    date: today(),
    userId: me,
  };
  await saveActivities([activity, ...activities]);
  revalidateLead(leadId);
}

// ---- Attachments / files --------------------------------------------------

export async function addFileLink(
  leadId: string,
  input: { label: string; kind: FileLink["kind"]; url: string }
) {
  return addAttachment({
    parentType: "lead",
    parentId: leadId,
    label: input.label || input.url,
    kind: input.kind,
    url: input.url,
  });
}

export async function deleteFileLink(id: string, leadId: string) {
  return deleteAttachment(id, "lead", leadId);
}

export async function addAttachment(input: {
  parentType: AttachmentParent;
  parentId: string;
  label: string;
  kind: AttachmentKind;
  url?: string | null;
  storagePath?: string | null;
  mime?: string | null;
  size?: number | null;
}) {
  const items = await getAttachments();
  const attachment: Attachment = {
    id: uid("f"),
    parentType: input.parentType,
    parentId: input.parentId,
    label: input.label || input.url || "Attachment",
    kind: input.kind,
    url: input.url ?? null,
    storagePath: input.storagePath ?? null,
    mime: input.mime ?? null,
    size: input.size ?? null,
  };
  await saveAttachments([attachment, ...items]);
  revalidateAttachmentParent(input.parentType, input.parentId);
  return attachment.id;
}

export async function deleteAttachment(
  id: string,
  parentType: AttachmentParent,
  parentId: string
) {
  const items = await getAttachments();
  const removed = items.filter((a) => a.id === id);
  await saveAttachments(items.filter((a) => a.id !== id));
  await cleanupAttachmentFiles(removed);
  revalidateAttachmentParent(parentType, parentId);
}

async function revalidateAttachmentParent(
  parentType: AttachmentParent,
  parentId: string
) {
  if (parentType === "lead") revalidateLead(parentId);
  if (parentType === "project") {
    revalidatePath("/projects");
    revalidatePath(`/projects/${parentId}`);
  }
  if (parentType === "doc") {
    revalidatePath("/docs");
    revalidatePath(`/docs/${parentId}`);
  }
  if (parentType === "portal_update") {
    revalidatePath("/projects");
  }
  if (parentType === "ticket") {
    const tickets = await getTickets();
    const ticket = tickets.find((t) => t.id === parentId);
    if (ticket) {
      revalidatePath(`/projects/${ticket.projectId}`);
      revalidatePath(`/projects/${ticket.projectId}/tickets/${parentId}`);
    }
  }
  if (parentType === "ticket_comment") {
    const comments = await getTicketComments();
    const comment = comments.find((c) => c.id === parentId);
    if (comment) {
      const tickets = await getTickets();
      const ticket = tickets.find((t) => t.id === comment.ticketId);
      if (ticket) {
        revalidatePath(`/projects/${ticket.projectId}`);
        revalidatePath(
          `/projects/${ticket.projectId}/tickets/${ticket.id}`
        );
      }
    }
  }
  if (parentType === "task") {
    revalidatePath("/tasks");
    revalidatePath("/");
  }
}

async function cleanupAttachmentFiles(items: Attachment[]) {
  const storagePaths: string[] = [];
  for (const item of items) {
    if (!item.storagePath) continue;
    if (item.storagePath.startsWith("local:")) {
      const rel = item.storagePath.slice("local:".length);
      const filePath = path.join(process.cwd(), "data", "uploads", rel);
      await fs.unlink(filePath).catch(() => undefined);
    } else {
      storagePaths.push(item.storagePath);
    }
  }
  if (storagePaths.length && isSupabaseEnabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.storage.from("attachments").remove(storagePaths);
  }
}

export async function uploadAttachment(formData: FormData) {
  const parentType = String(formData.get("parentType")) as AttachmentParent;
  const parentId = String(formData.get("parentId"));
  const label = String(formData.get("label") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    throw new Error("No file provided");
  }
  if (
    ![
      "lead",
      "project",
      "doc",
      "portal_update",
      "ticket",
      "ticket_comment",
      "task",
    ].includes(parentType) ||
    !parentId
  ) {
    throw new Error("Invalid parent");
  }

  const id = uid("f");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isSupabaseEnabled()) {
    const storagePath = `${parentType}/${parentId}/${id}-${safeName}`;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);

    await addAttachment({
      parentType,
      parentId,
      label: label || file.name,
      kind: "file",
      url: null,
      storagePath,
      mime: file.type || null,
      size: file.size,
    });
    return;
  }

  const rel = path.join(parentType, parentId, `${id}-${safeName}`);
  const dest = path.join(process.cwd(), "data", "uploads", rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);

  await addAttachment({
    parentType,
    parentId,
    label: label || file.name,
    kind: "file",
    url: `/api/files/${rel.split(path.sep).join("/")}`,
    storagePath: `local:${rel.split(path.sep).join("/")}`,
    mime: file.type || null,
    size: file.size,
  });
}

// ---- Tasks ----------------------------------------------------------------

export type TaskInput = {
  title: string;
  description?: string;
  leadId?: string;
  projectId?: string;
  assignedTo: string;
  due: string;
  priority: TaskPriority;
  status: TaskStatus;
  reminder: boolean;
  clientVisible?: boolean;
  waitingOnClient?: boolean;
};

export async function createTask(input: TaskInput) {
  const tasks = await getTasks();
  const task: Task = {
    id: uid("t"),
    ...input,
    description: input.description ?? "",
    clientVisible: input.clientVisible ?? false,
    waitingOnClient: input.waitingOnClient ?? false,
  };
  await saveTasks([...tasks, task]);
  revalidatePath("/tasks");
  revalidatePath("/");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return task.id;
}

export async function updateTask(id: string, input: TaskInput) {
  const tasks = await getTasks();
  await saveTasks(
    tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            ...input,
            description: input.description ?? t.description,
            clientVisible: input.clientVisible ?? t.clientVisible,
            waitingOnClient: input.waitingOnClient ?? t.waitingOnClient,
          }
        : t
    )
  );
  revalidatePath("/tasks");
  revalidatePath("/");
  const task = tasks.find((t) => t.id === id);
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
}

export async function deleteTask(id: string) {
  const tasks = await getTasks();
  await saveTasks(tasks.filter((t) => t.id !== id));
  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) => a.parentType === "task" && a.parentId === id
  );
  await saveAttachments(
    attachments.filter((a) => !(a.parentType === "task" && a.parentId === id))
  );
  await cleanupAttachmentFiles(removed);
  revalidatePath("/tasks");
  revalidatePath("/");
  const task = tasks.find((t) => t.id === id);
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
}

export async function toggleTaskDone(id: string) {
  const tasks = await getTasks();
  await saveTasks(
    tasks.map((t) =>
      t.id === id
        ? { ...t, status: t.status === "Done" ? "Todo" : "Done" }
        : t
    )
  );
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const tasks = await getTasks();
  const current = tasks.find((t) => t.id === id);
  if (!current || current.status === status) return;
  await saveTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  revalidatePath("/tasks");
  revalidatePath("/");
}

// ---- Projects -------------------------------------------------------------

export type ProjectInput = {
  name: string;
  client: string;
  clientId?: string | null;
  description?: string;
  phase?: string;
  type: ProjectType;
  value: number;
  status: ProjectStatus;
  start: string;
  estimatedEnd: string;
  actualEnd: string | null;
  ownerId: string;
  cost: number;
  source: Lead["source"];
  leadId?: string;
};

async function ensureClientForProject(input: {
  client: string;
  clientId?: string | null;
  leadId?: string;
}): Promise<Client> {
  const clients = await getClients();
  if (input.clientId) {
    const existing = clients.find((c) => c.id === input.clientId);
    if (existing) return existing;
  }

  const name = input.client.trim();
  const byName = clients.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (byName) return byName;

  let lead: Lead | undefined;
  if (input.leadId) {
    lead = (await getLeads()).find((l) => l.id === input.leadId);
  }

  const client: Client = {
    id: uid("c"),
    name: name || lead?.company || "Client",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    company: lead?.company || name || "Client",
    website: lead?.website ?? "",
    country: lead?.country ?? "",
    notes: "",
    leadId: lead?.id,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    billingAddress: "",
    taxNumber: "",
    vatId: "",
    registrationNumber: "",
    paymentTermsDays: null,
  };
  await saveClients([client, ...clients]);
  return client;
}

export async function createProject(input: ProjectInput) {
  const client = await ensureClientForProject(input);
  const projects = await getProjects();
  const project: Project = {
    id: uid("p"),
    name: input.name,
    client: client.name,
    clientId: client.id,
    description: input.description ?? "",
    phase: input.phase ?? "Discovery",
    type: input.type,
    value: input.value,
    status: input.status,
    start: input.start,
    estimatedEnd: input.estimatedEnd,
    actualEnd: input.actualEnd,
    ownerId: input.ownerId,
    cost: input.cost,
    source: input.source,
    leadId: input.leadId,
    payments: [],
    portalEnabled: false,
    portalToken: null,
    portalPinHash: null,
    stagingUrl: null,
    portalIntro: null,
    figmaUrl: null,
    repoUrl: null,
    briefUrl: null,
    clientCanViewTickets: true,
    clientCanCreateTickets: true,
    clientCanUploadFiles: true,
    clientCanComment: true,
    portalLocale: "en",
    archivedAt: null,
  };
  await saveProjects([project, ...projects]);

  // Converting a lead → mark it Won
  if (input.leadId) {
    const leads = await getLeads();
    const lead = leads.find((l) => l.id === input.leadId);
    if (lead && lead.status !== "Won") {
      const now = today();
      const me = await getCurrentUserId();
      await saveLeads(
        leads.map((l) =>
          l.id === input.leadId
            ? {
                ...l,
                status: "Won" as LeadStatus,
                lastContact: now,
                firstContact: l.firstContact ?? now,
                nextFollowUp: null,
              }
            : l
        )
      );
      const activities = await getActivities();
      await saveActivities([
        {
          id: uid("a"),
          leadId: input.leadId,
          type: "status",
          title: "Status changed to Won",
          detail: `Converted to project: ${project.name}`,
          date: now,
          userId: me,
        },
        ...activities,
      ]);
      revalidatePath("/leads");
      revalidatePath(`/leads/${input.leadId}`);
    }
  }

  revalidatePath("/projects");
  revalidatePath("/clients");
  if (client.id) revalidatePath(`/clients/${client.id}`);
  revalidatePath("/");
  return project.id;
}

export async function updateProject(id: string, input: ProjectInput) {
  const client = await ensureClientForProject(input);
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === id
        ? {
            ...p,
            ...input,
            client: client.name,
            clientId: client.id,
            description: input.description ?? p.description,
            phase: input.phase ?? p.phase,
          }
        : p
    )
  );
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/clients");
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/");
}

export async function setProjectStatus(id: string, status: ProjectStatus) {
  const projects = await getProjects();
  const current = projects.find((p) => p.id === id);
  if (!current || current.status === status) return;

  const now = today();
  await saveProjects(
    projects.map((p) =>
      p.id === id
        ? {
            ...p,
            status,
            actualEnd:
              status === "Completed" || status === "Cancelled"
                ? (p.actualEnd ?? now)
                : p.actualEnd,
          }
        : p
    )
  );
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function deleteProject(id: string) {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id);
  await saveProjects(projects.filter((p) => p.id !== id));

  const tasks = await getTasks();
  await saveTasks(tasks.filter((t) => t.projectId !== id));

  const tickets = await getTickets();
  const ticketIds = new Set(
    tickets.filter((t) => t.projectId === id).map((t) => t.id)
  );
  await saveTickets(tickets.filter((t) => t.projectId !== id));

  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) =>
      (a.parentType === "project" && a.parentId === id) ||
      (a.parentType === "ticket" && ticketIds.has(a.parentId))
  );
  await saveAttachments(
    attachments.filter(
      (a) =>
        !(
          (a.parentType === "project" && a.parentId === id) ||
          (a.parentType === "ticket" && ticketIds.has(a.parentId))
        )
    )
  );
  await cleanupAttachmentFiles(removed);

  revalidatePath("/projects");
  revalidatePath("/clients");
  if (project?.clientId) revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect("/projects");
}

// ---- Project payments -----------------------------------------------------

export async function togglePaymentPaid(projectId: string, paymentId: string) {
  const projects = await getProjects();
  const now = today();
  const next = projects.map((p) =>
    p.id === projectId
      ? {
          ...p,
          payments: p.payments.map((pay) =>
            pay.id === paymentId
              ? { ...pay, paid: !pay.paid, paidOn: !pay.paid ? now : null }
              : pay
          ),
        }
      : p
  );
  await saveProjects(next);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function addPayment(
  projectId: string,
  input: { label: string; percent: number; dueOn: string | null }
) {
  const projects = await getProjects();
  const payment: Payment = {
    id: uid("pay"),
    label: input.label || "Installment",
    percent: input.percent,
    dueOn: input.dueOn,
    paid: false,
    paidOn: null,
  };
  await saveProjects(
    projects.map((p) =>
      p.id === projectId ? { ...p, payments: [...p.payments, payment] } : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function updatePayment(
  projectId: string,
  paymentId: string,
  input: { label: string; percent: number; dueOn: string | null }
) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            payments: p.payments.map((pay) =>
              pay.id === paymentId
                ? {
                    ...pay,
                    label: input.label || pay.label,
                    percent: input.percent,
                    dueOn: input.dueOn,
                  }
                : pay
            ),
          }
        : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function removePayment(projectId: string, paymentId: string) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? { ...p, payments: p.payments.filter((pay) => pay.id !== paymentId) }
        : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

// ---- Docs -----------------------------------------------------------------

export type DocInput = {
  title: string;
  category: DocCategory;
  excerpt: string;
  body: string;
  tags: string[];
  favorite: boolean;
};

export async function createDoc(input: DocInput) {
  const me = await getCurrentUserId();
  const docs = await getDocs();
  const doc: Doc = {
    id: uid("d"),
    title: input.title,
    category: input.category,
    excerpt: input.excerpt || input.body.slice(0, 120),
    authorId: me,
    lastEdited: today(),
    tags: input.tags,
    favorite: input.favorite,
    body: input.body,
  };
  await saveDocs([doc, ...docs]);
  revalidatePath("/docs");
  return doc.id;
}

export async function updateDoc(id: string, input: DocInput) {
  const docs = await getDocs();
  await saveDocs(
    docs.map((d) =>
      d.id === id
        ? {
            ...d,
            title: input.title,
            category: input.category,
            excerpt: input.excerpt || input.body.slice(0, 120),
            tags: input.tags,
            favorite: input.favorite,
            body: input.body,
            lastEdited: today(),
          }
        : d
    )
  );
  revalidatePath("/docs");
  revalidatePath(`/docs/${id}`);
}

export async function deleteDoc(id: string) {
  const docs = await getDocs();
  await saveDocs(docs.filter((d) => d.id !== id));

  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) => a.parentType === "doc" && a.parentId === id
  );
  await saveAttachments(
    attachments.filter((a) => !(a.parentType === "doc" && a.parentId === id))
  );
  await cleanupAttachmentFiles(removed);

  revalidatePath("/docs");
  redirect("/docs");
}

export async function toggleDocFavorite(id: string) {
  const docs = await getDocs();
  await saveDocs(
    docs.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d))
  );
  revalidatePath("/docs");
  revalidatePath(`/docs/${id}`);
}

// ---- Firm settings --------------------------------------------------------

export async function updateFirmSettings(settings: FirmSettings) {
  await saveFirmSettings({
    ...settings,
    // Goal always tracks the calendar year — no manual year field.
    goalYear: new Date().getFullYear(),
  });
  revalidatePath("/");
  revalidatePath("/settings");
}

// ---- Clients --------------------------------------------------------------

export type ClientInput = {
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  country: string;
  notes: string;
  leadId?: string;
  billingAddress?: string;
  taxNumber?: string;
  vatId?: string;
  registrationNumber?: string;
  paymentTermsDays?: number | null;
};

export async function createClient(input: ClientInput) {
  const clients = await getClients();
  const client: Client = {
    id: uid("c"),
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    website: input.website,
    country: input.country,
    notes: input.notes,
    leadId: input.leadId,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    billingAddress: input.billingAddress ?? "",
    taxNumber: input.taxNumber ?? "",
    vatId: input.vatId ?? "",
    registrationNumber: input.registrationNumber ?? "",
    paymentTermsDays: input.paymentTermsDays ?? null,
  };
  await saveClients([client, ...clients]);
  revalidatePath("/clients");
  return client.id;
}

export async function archiveClient(id: string) {
  const clients = await getClients();
  await saveClients(
    clients.map((c) =>
      c.id === id ? { ...c, archivedAt: new Date().toISOString() } : c
    )
  );
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function restoreClient(id: string) {
  const clients = await getClients();
  await saveClients(
    clients.map((c) => (c.id === id ? { ...c, archivedAt: null } : c))
  );
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function archiveProject(id: string) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === id ? { ...p, archivedAt: new Date().toISOString() } : p
    )
  );
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  const project = projects.find((p) => p.id === id);
  if (project?.clientId) revalidatePath(`/clients/${project.clientId}`);
}

export async function restoreProject(id: string) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) => (p.id === id ? { ...p, archivedAt: null } : p))
  );
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  const project = projects.find((p) => p.id === id);
  if (project?.clientId) revalidatePath(`/clients/${project.clientId}`);
}

export async function updateClient(id: string, input: ClientInput) {
  const clients = await getClients();
  await saveClients(
    clients.map((c) =>
      c.id === id
        ? {
            ...c,
            name: input.name,
            email: input.email,
            phone: input.phone,
            company: input.company,
            website: input.website,
            country: input.country,
            notes: input.notes,
            leadId: input.leadId ?? c.leadId,
            billingAddress: input.billingAddress ?? c.billingAddress ?? "",
            taxNumber: input.taxNumber ?? c.taxNumber ?? "",
            vatId: input.vatId ?? c.vatId ?? "",
            registrationNumber:
              input.registrationNumber ?? c.registrationNumber ?? "",
            paymentTermsDays:
              input.paymentTermsDays !== undefined
                ? input.paymentTermsDays
                : c.paymentTermsDays,
          }
        : c
    )
  );
  // Keep denormalized project.client in sync
  const projects = await getProjects();
  const name = input.name.trim();
  await saveProjects(
    projects.map((p) => (p.clientId === id ? { ...p, client: name } : p))
  );
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/projects");
}

export async function deleteClient(id: string) {
  const projects = await getProjects();
  if (projects.some((p) => p.clientId === id)) {
    throw new Error("Remove or reassign this client’s projects first.");
  }
  const clients = await getClients();
  await saveClients(clients.filter((c) => c.id !== id));
  revalidatePath("/clients");
  redirect("/clients");
}

// ---- Tickets --------------------------------------------------------------

export type TicketInput = {
  title: string;
  description: string;
  status: TicketStatus;
  dueAt: string | null;
  assigneeKind: TicketParty;
  assigneeId: string | null;
};

export async function createTicket(projectId: string, input: TicketInput) {
  const author = await getCurrentProfile();
  const tickets = await getTickets();
  const ticket: Ticket = {
    id: uid("tk"),
    projectId,
    title: input.title.trim(),
    description: input.description,
    status: input.status,
    createdAt: new Date().toISOString(),
    dueAt: input.dueAt,
    assigneeKind: input.assigneeKind,
    assigneeId: input.assigneeId,
    createdByKind: "studio",
    createdByName: author.name,
  };
  await saveTickets([ticket, ...tickets]);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tickets/${ticket.id}`);
  return ticket.id;
}

export async function updateTicket(id: string, input: TicketInput) {
  const tickets = await getTickets();
  const current = tickets.find((t) => t.id === id);
  if (!current) throw new Error("Ticket not found");
  await saveTickets(
    tickets.map((t) =>
      t.id === id
        ? {
            ...t,
            title: input.title.trim(),
            description: input.description,
            status: input.status,
            dueAt: input.dueAt,
            assigneeKind: input.assigneeKind,
            assigneeId: input.assigneeId,
          }
        : t
    )
  );
  revalidatePath(`/projects/${current.projectId}`);
  revalidatePath(`/projects/${current.projectId}/tickets/${id}`);
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  const tickets = await getTickets();
  const current = tickets.find((t) => t.id === id);
  if (!current || current.status === status) return;
  await saveTickets(
    tickets.map((t) => (t.id === id ? { ...t, status } : t))
  );
  revalidatePath(`/projects/${current.projectId}`);
  revalidatePath(`/projects/${current.projectId}/tickets/${id}`);
}

export async function deleteTicket(id: string) {
  const tickets = await getTickets();
  const current = tickets.find((t) => t.id === id);
  if (!current) return;
  await saveTickets(tickets.filter((t) => t.id !== id));

  const comments = await getTicketComments();
  const commentIds = new Set(
    comments.filter((c) => c.ticketId === id).map((c) => c.id)
  );
  await saveTicketComments(comments.filter((c) => c.ticketId !== id));
  const reactions = await getTicketCommentReactions();
  await saveTicketCommentReactions(
    reactions.filter((r) => !commentIds.has(r.commentId))
  );

  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) =>
      (a.parentType === "ticket" && a.parentId === id) ||
      (a.parentType === "ticket_comment" && commentIds.has(a.parentId))
  );
  await saveAttachments(
    attachments.filter(
      (a) =>
        !(
          (a.parentType === "ticket" && a.parentId === id) ||
          (a.parentType === "ticket_comment" && commentIds.has(a.parentId))
        )
    )
  );
  await cleanupAttachmentFiles(removed);
  revalidatePath(`/projects/${current.projectId}`);
  redirect(`/projects/${current.projectId}`);
}

export async function createTicketComment(
  ticketId: string,
  input: { body: string; parentId?: string | null }
) {
  const tickets = await getTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const body = input.body.trim();
  if (!body) throw new Error("Comment is empty");

  const comments = await getTicketComments();
  if (input.parentId) {
    const parent = comments.find((c) => c.id === input.parentId);
    if (!parent || parent.ticketId !== ticketId) {
      throw new Error("Invalid reply parent");
    }
  }

  const author = await getCurrentProfile();
  const comment: TicketComment = {
    id: uid("tc"),
    ticketId,
    parentId: input.parentId ?? null,
    body,
    authorKind: "studio",
    authorName: author.name,
    authorId: author.id,
    createdAt: new Date().toISOString(),
    editedAt: null,
  };
  await saveTicketComments([...comments, comment]);
  revalidatePath(`/projects/${ticket.projectId}`);
  revalidatePath(`/projects/${ticket.projectId}/tickets/${ticketId}`);
  return comment.id;
}

export async function deleteTicketComment(commentId: string) {
  const comments = await getTicketComments();
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) return;
  const tickets = await getTickets();
  const ticket = tickets.find((t) => t.id === comment.ticketId);

  const removeIds = new Set(
    comments
      .filter((c) => c.id === commentId || c.parentId === commentId)
      .map((c) => c.id)
  );
  await saveTicketComments(comments.filter((c) => !removeIds.has(c.id)));

  const reactions = await getTicketCommentReactions();
  await saveTicketCommentReactions(
    reactions.filter((r) => !removeIds.has(r.commentId))
  );

  const attachments = await getAttachments();
  const removed = attachments.filter(
    (a) => a.parentType === "ticket_comment" && removeIds.has(a.parentId)
  );
  await saveAttachments(
    attachments.filter(
      (a) =>
        !(a.parentType === "ticket_comment" && removeIds.has(a.parentId))
    )
  );
  await cleanupAttachmentFiles(removed);

  if (ticket) {
    revalidatePath(`/projects/${ticket.projectId}`);
    revalidatePath(`/projects/${ticket.projectId}/tickets/${ticket.id}`);
  }
}

export async function toggleTicketCommentReaction(
  commentId: string,
  emoji: string
) {
  const comments = await getTicketComments();
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("Comment not found");

  const author = await getCurrentProfile();
  const reactions = await getTicketCommentReactions();
  const existing = reactions.find(
    (r) =>
      r.commentId === commentId &&
      r.emoji === emoji &&
      r.authorKind === "studio" &&
      r.authorName === author.name
  );

  if (existing) {
    await saveTicketCommentReactions(
      reactions.filter((r) => r.id !== existing.id)
    );
  } else {
    const reaction: TicketCommentReaction = {
      id: uid("tcr"),
      commentId,
      emoji,
      authorKind: "studio",
      authorName: author.name,
      createdAt: new Date().toISOString(),
    };
    await saveTicketCommentReactions([...reactions, reaction]);
  }

  const tickets = await getTickets();
  const ticket = tickets.find((t) => t.id === comment.ticketId);
  if (ticket) {
    revalidatePath(`/projects/${ticket.projectId}`);
    revalidatePath(`/projects/${ticket.projectId}/tickets/${ticket.id}`);
  }
}

export async function updateProjectMeta(
  id: string,
  input: Partial<{
    phase: string;
    description: string;
    status: ProjectStatus;
    value: number;
    cost: number;
    clientCanViewTickets: boolean;
    clientCanCreateTickets: boolean;
    clientCanUploadFiles: boolean;
    clientCanComment: boolean;
    stagingUrl: string | null;
    portalIntro: string | null;
    portalLocale: "en" | "sl";
  }>
) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) => (p.id === id ? { ...p, ...input } : p))
  );
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}
