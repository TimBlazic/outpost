"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

import {
  getProjects,
  saveProjects,
  getTasks,
  saveTasks,
  getPortalUpdates,
  savePortalUpdates,
  getPortalComments,
  savePortalComments,
} from "@/lib/store";
import type {
  Attachment,
  PortalComment,
  PortalUpdate,
  Task,
  Ticket,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertClientProjectAccess } from "@/lib/client-accounts/access";
import { notifyPortalChatChanged } from "@/lib/realtime/notify-chat";
import { generatePortalToken, hashPin } from "./pin";
import { assertPortalAccess } from "./session";
import {
  setPortalThemeCookie,
  type PortalTheme,
} from "./theme";
import {
  portalGetProjectByToken,
  portalGetClientTasks,
  portalSaveUpdate,
  portalSaveComment,
  portalUpdateTask,
  portalSaveAttachment,
  portalSaveTicket,
  portalGetTickets,
  portalGetTicketComments,
  portalGetTicketCommentReactions,
  portalSaveTicketComment,
  portalSaveTicketCommentReaction,
  portalGetMessages,
  portalDeleteTicketCommentReaction,
} from "./repo";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function revalidatePortal(token: string, projectId: string) {
  revalidatePath(`/portal/${token}`);
  revalidateProject(projectId);
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/tasks");
}

// ---- Studio (CRM) ---------------------------------------------------------

export async function enableProjectPortal(projectId: string, pin: string) {
  if (pin.trim().length < 4) {
    throw new Error("PIN must be at least 4 characters");
  }
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");

  const token = project.portalToken || generatePortalToken();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            portalEnabled: true,
            portalToken: token,
            portalPinHash: hashPin(pin),
          }
        : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
  return token;
}

export async function disableProjectPortal(projectId: string) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId ? { ...p, portalEnabled: false } : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function rotatePortalToken(projectId: string) {
  const projects = await getProjects();
  const token = generatePortalToken();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId ? { ...p, portalToken: token } : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
  return token;
}

export async function setPortalPin(projectId: string, pin: string) {
  if (pin.trim().length < 4) {
    throw new Error("PIN must be at least 4 characters");
  }
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId ? { ...p, portalPinHash: hashPin(pin) } : p
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function updatePortalSettings(
  projectId: string,
  input: { stagingUrl: string; portalIntro: string }
) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            stagingUrl: input.stagingUrl.trim() || null,
            portalIntro: input.portalIntro.trim() || null,
          }
        : p
    )
  );
  const project = projects.find((p) => p.id === projectId);
  if (project?.portalToken) {
    revalidatePortal(project.portalToken, projectId);
  } else {
    revalidatePath(`/projects/${projectId}`);
  }
}

export async function setTaskClientFlags(
  taskId: string,
  flags: { clientVisible?: boolean; waitingOnClient?: boolean }
) {
  const tasks = await getTasks();
  await saveTasks(
    tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            clientVisible: flags.clientVisible ?? t.clientVisible,
            waitingOnClient: flags.waitingOnClient ?? t.waitingOnClient,
          }
        : t
    )
  );
  revalidatePath("/tasks");
  const task = tasks.find((t) => t.id === taskId);
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
}

export async function postStudioPortalUpdate(
  projectId: string,
  body: string
) {
  const text = body.trim();
  if (!text) throw new Error("Update cannot be empty");
  const updates = await getPortalUpdates();
  const update: PortalUpdate = {
    id: uid("pu"),
    projectId,
    body: text,
    authorKind: "studio",
    authorName: "Studio",
    createdAt: nowIso(),
  };
  await savePortalUpdates([update, ...updates]);
  const project = (await getProjects()).find((p) => p.id === projectId);
  if (project?.portalToken) revalidatePortal(project.portalToken, projectId);
  else revalidatePath(`/projects/${projectId}`);
  return update.id;
}

export async function postStudioPortalComment(
  projectId: string,
  input: {
    targetType: "update" | "task";
    targetId: string;
    body: string;
  }
) {
  const project = (await getProjects()).find((p) => p.id === projectId);
  if (!project?.portalToken) throw new Error("Portal not enabled");
  const text = input.body.trim();
  if (!text) throw new Error("Comment cannot be empty");
  const comments = await getPortalComments();
  const comment: PortalComment = {
    id: uid("pc"),
    projectId,
    targetType: input.targetType,
    targetId: input.targetId,
    body: text,
    authorKind: "studio",
    authorName: "Studio",
    createdAt: nowIso(),
  };
  await savePortalComments([...comments, comment]);
  revalidatePortal(project.portalToken, projectId);
}

// ---- Client portal --------------------------------------------------------

export async function setPortalTheme(theme: PortalTheme) {
  if (theme !== "light" && theme !== "dark") {
    throw new Error("Invalid theme");
  }
  await setPortalThemeCookie(theme);
}

export async function postClientPortalUpdate(
  token: string,
  body: string,
  authorName: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  const text = body.trim();
  if (!text) throw new Error("Message cannot be empty");

  const update: PortalUpdate = {
    id: uid("pu"),
    projectId: project.id,
    body: text,
    authorKind: "client",
    authorName: authorName.trim() || "Client",
    createdAt: nowIso(),
  };
  await portalSaveUpdate(update);
  revalidatePortal(token, project.id);
  return update.id;
}

export async function postClientPortalComment(
  token: string,
  input: {
    targetType: "update" | "task";
    targetId: string;
    body: string;
    authorName: string;
  }
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  const text = input.body.trim();
  if (!text) throw new Error("Comment cannot be empty");

  const comment: PortalComment = {
    id: uid("pc"),
    projectId: project.id,
    targetType: input.targetType,
    targetId: input.targetId,
    body: text,
    authorKind: "client",
    authorName: input.authorName.trim() || "Client",
    createdAt: nowIso(),
  };
  await portalSaveComment(comment);
  revalidatePortal(token, project.id);
}

export async function clientCompleteWaitingTask(
  token: string,
  taskId: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");

  const tasks = await portalGetClientTasks(project.id);
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.waitingOnClient) {
    throw new Error("Task not available");
  }

  const next: Task = {
    ...task,
    status: "Done",
    waitingOnClient: false,
  };
  await portalUpdateTask(next);
  revalidatePortal(token, project.id);
}

export async function uploadPortalUpdateFile(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const updateId = String(formData.get("updateId") ?? "");
  const label = String(formData.get("label") ?? "");
  const file = formData.get("file");
  const asClient = String(formData.get("asClient") ?? "") === "1";

  if (asClient) await assertPortalAccess(token);

  const project = asClient
    ? await portalGetProjectByToken(token)
    : (await getProjects()).find((p) => p.portalToken === token) ?? null;

  if (!project) throw new Error("Portal not found");
  if (!(file instanceof File) || !file.size) throw new Error("No file");
  if (!updateId) throw new Error("Missing update");

  const id = uid("f");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());

  let url: string | null = null;
  let storagePath: string | null = null;

  if (isSupabaseEnabled()) {
    const storagePathKey = `portal_update/${updateId}/${id}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePathKey, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    storagePath = storagePathKey;
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePathKey, 60 * 60 * 24 * 7);
    url = signed?.signedUrl ?? null;
  } else {
    const rel = path.join("portal_update", updateId, `${id}-${safeName}`);
    const dest = path.join(process.cwd(), "data", "uploads", rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    url = `/api/files/${rel.split(path.sep).join("/")}`;
    storagePath = `local:${rel.split(path.sep).join("/")}`;
  }

  const attachment: Attachment = {
    id,
    parentType: "portal_update",
    parentId: updateId,
    label: label || file.name,
    kind: "file",
    url,
    storagePath,
    mime: file.type || null,
    size: file.size,
  };
  await portalSaveAttachment(attachment);
  revalidatePortal(token || project.portalToken || "", project.id);
}

export async function clientCreateTicket(
  token: string,
  input: {
    title: string;
    description: string;
    dueAt?: string | null;
  }
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  if (!project.clientCanCreateTickets) {
    throw new Error("Creating tickets is disabled for this portal");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const ticket: Ticket = {
    id: uid("tk"),
    projectId: project.id,
    title,
    description: input.description ?? "",
    status: "Todo",
    priority: "Medium",
    tags: [],
    createdAt: nowIso(),
    dueAt: input.dueAt?.trim() || null,
    assigneeKind: "studio",
    assigneeId: project.ownerId,
    createdByKind: "client",
    createdByName: project.client || "Client",
  };
  await portalSaveTicket(ticket);
  revalidatePortal(token, project.id);
  return ticket.id;
}

export async function clientCreateTicketComment(
  token: string,
  ticketId: string,
  input: { body: string; parentId?: string | null }
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  if (!project.clientCanComment) {
    throw new Error("Comments are disabled for this portal");
  }

  const tickets = await portalGetTickets(project.id);
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const body = input.body.trim();
  if (!body) throw new Error("Comment is empty");

  if (input.parentId) {
    const existing = await portalGetTicketComments([ticketId]);
    const parent = existing.find((c) => c.id === input.parentId);
    if (!parent) throw new Error("Invalid reply parent");
  }

  const comment: TicketComment = {
    id: uid("tc"),
    ticketId,
    parentId: input.parentId ?? null,
    body,
    authorKind: "client",
    authorName: project.client || "Client",
    authorId: null,
    createdAt: nowIso(),
    editedAt: null,
  };
  await portalSaveTicketComment(comment);
  revalidatePortal(token, project.id);
  return comment.id;
}

export async function clientToggleTicketCommentReaction(
  token: string,
  commentId: string,
  emoji: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  if (!project.clientCanComment) {
    throw new Error("Comments are disabled for this portal");
  }

  const tickets = await portalGetTickets(project.id);
  const ticketIds = tickets.map((t) => t.id);
  const comments = await portalGetTicketComments(ticketIds);
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("Comment not found");

  const authorName = project.client || "Client";
  const reactions = await portalGetTicketCommentReactions([commentId]);
  const existing = reactions.find(
    (r) =>
      r.commentId === commentId &&
      r.emoji === emoji &&
      r.authorKind === "client" &&
      r.authorName === authorName
  );

  if (existing) {
    await portalDeleteTicketCommentReaction(existing.id);
  } else {
    const reaction: TicketCommentReaction = {
      id: uid("tcr"),
      commentId,
      emoji,
      authorKind: "client",
      authorName,
      createdAt: nowIso(),
    };
    await portalSaveTicketCommentReaction(reaction);
  }
  revalidatePortal(token, project.id);
}

export async function clientUploadPortalFile(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const parentType = String(formData.get("parentType") ?? "") as
    | "project"
    | "ticket"
    | "ticket_comment"
    | "portal_message";
  const parentId = String(formData.get("parentId") ?? "");
  const label = String(formData.get("label") ?? "");
  const file = formData.get("file");

  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  if (!(file instanceof File) || !file.size) throw new Error("No file");
  if (
    !["project", "ticket", "ticket_comment", "portal_message"].includes(
      parentType
    ) ||
    !parentId
  ) {
    throw new Error("Invalid parent");
  }

  if (parentType === "ticket_comment") {
    if (!project.clientCanComment) {
      throw new Error("Comments are disabled for this portal");
    }
    const tickets = await portalGetTickets(project.id);
    const comments = await portalGetTicketComments(tickets.map((t) => t.id));
    if (!comments.some((c) => c.id === parentId)) {
      throw new Error("Comment not found");
    }
  } else if (parentType === "portal_message") {
    const messages = await portalGetMessages(project.id);
    if (!messages.some((m) => m.id === parentId && !m.deletedAt)) {
      throw new Error("Message not found");
    }
  } else {
    if (!project.clientCanUploadFiles) {
      throw new Error("Uploads are disabled for this portal");
    }
    if (parentType === "project" && parentId !== project.id) {
      throw new Error("Invalid project");
    }
  }

  const id = uid("f");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());

  let url: string | null = null;
  let storagePath: string | null = null;

  if (isSupabaseEnabled()) {
    const storagePathKey = `${parentType}/${parentId}/${id}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePathKey, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    storagePath = storagePathKey;
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePathKey, 60 * 60 * 24 * 7);
    url = signed?.signedUrl ?? null;
  } else {
    const rel = path.join(parentType, parentId, `${id}-${safeName}`);
    const dest = path.join(process.cwd(), "data", "uploads", rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    url = `/api/files/${rel.split(path.sep).join("/")}`;
    storagePath = `local:${rel.split(path.sep).join("/")}`;
  }

  const attachment: Attachment = {
    id,
    parentType,
    parentId,
    label: label || file.name,
    kind: "file",
    url,
    storagePath,
    mime: file.type || null,
    size: file.size,
  };
  await portalSaveAttachment(attachment);
  revalidatePortal(token, project.id);
  if (parentType === "portal_message") {
    void notifyPortalChatChanged(project.id);
  }
}

// ---- Session-based client actions (client-account auth) -------------------

export async function sessionPostClientPortalUpdate(
  projectId: string,
  body: string
) {
  const { client, project } = await assertClientProjectAccess(projectId);
  const text = body.trim();
  if (!text) throw new Error("Message cannot be empty");

  const update: PortalUpdate = {
    id: uid("pu"),
    projectId: project.id,
    body: text,
    authorKind: "client",
    authorName: client.name || "Client",
    createdAt: nowIso(),
  };
  await portalSaveUpdate(update);
  revalidateProject(project.id);
  return update.id;
}

export async function sessionPostClientPortalComment(
  projectId: string,
  input: {
    targetType: "update" | "task";
    targetId: string;
    body: string;
  }
) {
  const { client, project } = await assertClientProjectAccess(projectId);
  const text = input.body.trim();
  if (!text) throw new Error("Comment cannot be empty");

  const comment: PortalComment = {
    id: uid("pc"),
    projectId: project.id,
    targetType: input.targetType,
    targetId: input.targetId,
    body: text,
    authorKind: "client",
    authorName: client.name || "Client",
    createdAt: nowIso(),
  };
  await portalSaveComment(comment);
  revalidateProject(project.id);
}

export async function sessionClientCompleteWaitingTask(
  projectId: string,
  taskId: string
) {
  const { project } = await assertClientProjectAccess(projectId);
  const tasks = await portalGetClientTasks(project.id);
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.waitingOnClient) {
    throw new Error("Task not available");
  }
  const next: Task = { ...task, status: "Done", waitingOnClient: false };
  await portalUpdateTask(next);
  revalidateProject(project.id);
}

export async function sessionClientCreateTicket(
  projectId: string,
  input: {
    title: string;
    description: string;
    dueAt?: string | null;
  }
) {
  const { client, project } = await assertClientProjectAccess(projectId);
  if (!project.clientCanCreateTickets) {
    throw new Error("Creating tickets is disabled for this portal");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const ticket: Ticket = {
    id: uid("tk"),
    projectId: project.id,
    title,
    description: input.description ?? "",
    status: "Todo",
    priority: "Medium",
    tags: [],
    createdAt: nowIso(),
    dueAt: input.dueAt?.trim() || null,
    assigneeKind: "studio",
    assigneeId: project.ownerId,
    createdByKind: "client",
    createdByName: client.name || "Client",
  };
  await portalSaveTicket(ticket);
  revalidateProject(project.id);
  return ticket.id;
}

export async function sessionClientCreateTicketComment(
  projectId: string,
  ticketId: string,
  input: { body: string; parentId?: string | null }
) {
  const { client, project } = await assertClientProjectAccess(projectId);
  if (!project.clientCanComment) {
    throw new Error("Comments are disabled for this portal");
  }

  const tickets = await portalGetTickets(project.id);
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const body = input.body.trim();
  if (!body) throw new Error("Comment is empty");

  if (input.parentId) {
    const existing = await portalGetTicketComments([ticketId]);
    const parent = existing.find((c) => c.id === input.parentId);
    if (!parent) throw new Error("Invalid reply parent");
  }

  const comment: TicketComment = {
    id: uid("tc"),
    ticketId,
    parentId: input.parentId ?? null,
    body,
    authorKind: "client",
    authorName: client.name || "Client",
    authorId: null,
    createdAt: nowIso(),
    editedAt: null,
  };
  await portalSaveTicketComment(comment);
  revalidateProject(project.id);
  return comment.id;
}

export async function sessionClientToggleTicketCommentReaction(
  projectId: string,
  commentId: string,
  emoji: string
) {
  const { client, project } = await assertClientProjectAccess(projectId);
  if (!project.clientCanComment) {
    throw new Error("Comments are disabled for this portal");
  }

  const tickets = await portalGetTickets(project.id);
  const ticketIds = tickets.map((t) => t.id);
  const comments = await portalGetTicketComments(ticketIds);
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("Comment not found");

  const authorName = client.name || "Client";
  const reactions = await portalGetTicketCommentReactions([commentId]);
  const existing = reactions.find(
    (r) =>
      r.commentId === commentId &&
      r.emoji === emoji &&
      r.authorKind === "client" &&
      r.authorName === authorName
  );

  if (existing) {
    await portalDeleteTicketCommentReaction(existing.id);
  } else {
    const reaction: TicketCommentReaction = {
      id: uid("tcr"),
      commentId,
      emoji,
      authorKind: "client",
      authorName,
      createdAt: nowIso(),
    };
    await portalSaveTicketCommentReaction(reaction);
  }
  revalidateProject(project.id);
}

export async function sessionClientUploadPortalFile(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const parentType = String(formData.get("parentType") ?? "") as
    | "project"
    | "ticket"
    | "ticket_comment"
    | "portal_message";
  const parentId = String(formData.get("parentId") ?? "");
  const label = String(formData.get("label") ?? "");
  const file = formData.get("file");

  const { project } = await assertClientProjectAccess(projectId);
  if (!(file instanceof File) || !file.size) throw new Error("No file");
  if (
    !["project", "ticket", "ticket_comment", "portal_message"].includes(
      parentType
    ) ||
    !parentId
  ) {
    throw new Error("Invalid parent");
  }

  if (parentType === "ticket_comment") {
    if (!project.clientCanComment) {
      throw new Error("Comments are disabled for this portal");
    }
    const tickets = await portalGetTickets(project.id);
    const comments = await portalGetTicketComments(tickets.map((t) => t.id));
    if (!comments.some((c) => c.id === parentId)) {
      throw new Error("Comment not found");
    }
  } else if (parentType === "portal_message") {
    const messages = await portalGetMessages(project.id);
    if (!messages.some((m) => m.id === parentId && !m.deletedAt)) {
      throw new Error("Message not found");
    }
  } else {
    if (!project.clientCanUploadFiles) {
      throw new Error("Uploads are disabled for this portal");
    }
    if (parentType === "project" && parentId !== project.id) {
      throw new Error("Invalid project");
    }
  }

  const id = uid("f");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());

  let url: string | null = null;
  let storagePath: string | null = null;

  if (isSupabaseEnabled()) {
    const storagePathKey = `${parentType}/${parentId}/${id}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePathKey, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    storagePath = storagePathKey;
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePathKey, 60 * 60 * 24 * 7);
    url = signed?.signedUrl ?? null;
  } else {
    const rel = path.join(parentType, parentId, `${id}-${safeName}`);
    const dest = path.join(process.cwd(), "data", "uploads", rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    url = `/api/files/${rel.split(path.sep).join("/")}`;
    storagePath = `local:${rel.split(path.sep).join("/")}`;
  }

  const attachment: Attachment = {
    id,
    parentType,
    parentId,
    label: label || file.name,
    kind: "file",
    url,
    storagePath,
    mime: file.type || null,
    size: file.size,
  };
  await portalSaveAttachment(attachment);
  revalidateProject(project.id);
  if (parentType === "portal_message") {
    void notifyPortalChatChanged(project.id);
  }
}
