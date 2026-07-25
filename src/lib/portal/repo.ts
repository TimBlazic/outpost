/**
 * Portal data access. Uses file store, or Supabase service role for
 * unauthenticated client portal requests.
 */

import type {
  Attachment,
  Member,
  Payment,
  PortalComment,
  PortalUpdate,
  Project,
  Task,
  Ticket,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";
import {
  members as seedMembers,
  normalizeMember,
  normalizeProject,
  normalizeTask,
  normalizeTicket,
} from "@/lib/data";
import { getTeamMembers } from "@/lib/auth/session";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAttachments,
  getPortalComments,
  getPortalUpdates,
  getProjectByPortalToken as storeProjectByToken,
  getTasks,
  getTickets,
  getTicketComments,
  getTicketCommentReactions,
  saveAttachments,
  savePortalComments,
  savePortalUpdates,
  saveProjects,
  saveTasks,
  saveTickets,
  saveTicketComments,
  saveTicketCommentReactions,
  getProjects,
} from "@/lib/store";

function mapProjectRow(
  row: Record<string, unknown>,
  payments: Payment[] = []
): Project {
  return normalizeProject({
    id: row.id as string,
    name: row.name as string,
    client: row.client as string,
    clientId: (row.client_id as string) ?? null,
    description: (row.description as string) ?? "",
    phase: (row.phase as string) ?? "Discovery",
    type: row.type as Project["type"],
    value: Number(row.value),
    status: row.status as Project["status"],
    start: row.start_date as string,
    estimatedEnd: row.estimated_end as string,
    actualEnd: (row.actual_end as string) ?? null,
    ownerId: row.owner_id as string,
    cost: Number(row.cost),
    source: row.source as Project["source"],
    leadId: (row.lead_id as string) || undefined,
    payments,
    portalEnabled: Boolean(row.portal_enabled),
    portalToken: (row.portal_token as string) ?? null,
    portalPinHash: (row.portal_pin_hash as string) ?? null,
    stagingUrl: (row.staging_url as string) ?? null,
    portalIntro: (row.portal_intro as string) ?? null,
    figmaUrl: (row.figma_url as string) ?? null,
    repoUrl: (row.repo_url as string) ?? null,
    briefUrl: (row.brief_url as string) ?? null,
    clientCanViewTickets: row.client_can_view_tickets !== false,
    clientCanCreateTickets: row.client_can_create_tickets !== false,
    clientCanUploadFiles: row.client_can_upload_files !== false,
    clientCanComment: row.client_can_comment !== false,
    portalLocale: row.portal_locale === "sl" ? "sl" : "en",
    archivedAt: (row.archived_at as string) ?? null,
  });
}

function mapTaskRow(row: Record<string, unknown>): Task {
  return normalizeTask({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    leadId: (row.lead_id as string) || undefined,
    projectId: (row.project_id as string) || undefined,
    assignedTo: row.assigned_to as string,
    due: row.due as string,
    priority: row.priority as Task["priority"],
    status: row.status as Task["status"],
    reminder: Boolean(row.reminder),
    clientVisible: Boolean(row.client_visible),
    waitingOnClient: Boolean(row.waiting_on_client),
  });
}

export async function portalGetProjectByToken(token: string) {
  if (!isSupabaseEnabled()) {
    return storeProjectByToken(token);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("portal_token", token)
    .eq("portal_enabled", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProjectRow(data);
}

export async function portalGetClientTasks(projectId: string) {
  if (!isSupabaseEnabled()) {
    return (await getTasks()).filter(
      (t) => t.projectId === projectId && t.clientVisible
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("client_visible", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTaskRow);
}

export async function portalGetUpdates(projectId: string) {
  if (!isSupabaseEnabled()) {
    return (await getPortalUpdates())
      .filter((u) => u.projectId === projectId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("portal_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): PortalUpdate => ({
      id: row.id as string,
      projectId: row.project_id as string,
      body: row.body as string,
      authorKind: row.author_kind as PortalUpdate["authorKind"],
      authorName: (row.author_name as string) ?? "",
      createdAt: row.created_at as string,
    })
  );
}

export async function portalGetComments(projectId: string) {
  if (!isSupabaseEnabled()) {
    return (await getPortalComments()).filter((c) => c.projectId === projectId);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("portal_comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): PortalComment => ({
      id: row.id as string,
      projectId: row.project_id as string,
      targetType: row.target_type as PortalComment["targetType"],
      targetId: row.target_id as string,
      body: row.body as string,
      authorKind: row.author_kind as PortalComment["authorKind"],
      authorName: (row.author_name as string) ?? "",
      createdAt: row.created_at as string,
    })
  );
}

export async function portalGetUpdateFiles(updateIds: string[]) {
  if (!updateIds.length) return [] as Attachment[];
  if (!isSupabaseEnabled()) {
    return (await getAttachments()).filter(
      (a) =>
        a.parentType === "portal_update" && updateIds.includes(a.parentId)
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("parent_type", "portal_update")
    .in("parent_id", updateIds);
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(
    (row): Attachment => ({
      id: row.id as string,
      parentType: "portal_update",
      parentId: row.parent_id as string,
      label: row.label as string,
      kind: row.kind as Attachment["kind"],
      url: (row.url as string) ?? null,
      storagePath: (row.storage_path as string) ?? null,
      mime: (row.mime as string) ?? null,
      size: row.size == null ? null : Number(row.size),
    })
  );
  return Promise.all(
    items.map(async (a) => {
      if (a.url || !a.storagePath || a.storagePath.startsWith("local:")) {
        return a;
      }
      const { data: signed } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storagePath, 60 * 60);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );
}

export async function portalSaveUpdate(update: PortalUpdate) {
  if (!isSupabaseEnabled()) {
    const updates = await getPortalUpdates();
    await savePortalUpdates([update, ...updates]);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("portal_updates").upsert({
    id: update.id,
    project_id: update.projectId,
    body: update.body,
    author_kind: update.authorKind,
    author_name: update.authorName,
    created_at: update.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function portalSaveComment(comment: PortalComment) {
  if (!isSupabaseEnabled()) {
    const comments = await getPortalComments();
    await savePortalComments([...comments, comment]);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("portal_comments").upsert({
    id: comment.id,
    project_id: comment.projectId,
    target_type: comment.targetType,
    target_id: comment.targetId,
    body: comment.body,
    author_kind: comment.authorKind,
    author_name: comment.authorName,
    created_at: comment.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function portalUpdateTask(task: Task) {
  if (!isSupabaseEnabled()) {
    const tasks = await getTasks();
    await saveTasks(tasks.map((t) => (t.id === task.id ? task : t)));
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("tasks").upsert({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    lead_id: task.leadId ?? null,
    project_id: task.projectId ?? null,
    assigned_to: task.assignedTo,
    due: task.due,
    priority: task.priority,
    status: task.status,
    reminder: task.reminder,
    client_visible: task.clientVisible,
    waiting_on_client: task.waitingOnClient,
  });
  if (error) throw new Error(error.message);
}

export async function portalSaveAttachment(attachment: Attachment) {
  if (!isSupabaseEnabled()) {
    const items = await getAttachments();
    await saveAttachments([attachment, ...items]);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("attachments").upsert({
    id: attachment.id,
    parent_type: attachment.parentType,
    parent_id: attachment.parentId,
    label: attachment.label,
    kind: attachment.kind,
    url: attachment.url,
    storage_path: attachment.storagePath,
    mime: attachment.mime,
    size: attachment.size,
  });
  if (error) throw new Error(error.message);
}

function mapTicketRow(row: Record<string, unknown>): Ticket {
  return normalizeTicket({
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    status: row.status as Ticket["status"],
    createdAt: row.created_at as string,
    dueAt: (row.due_at as string) ?? null,
    assigneeKind: row.assignee_kind as Ticket["assigneeKind"],
    assigneeId: (row.assignee_id as string) ?? null,
    createdByKind: row.created_by_kind as Ticket["createdByKind"],
    createdByName: (row.created_by_name as string) ?? "",
  });
}

export async function portalGetTickets(projectId: string) {
  if (!isSupabaseEnabled()) {
    return (await getTickets())
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTicketRow);
}

export async function portalSaveTicket(ticket: Ticket) {
  if (!isSupabaseEnabled()) {
    const tickets = await getTickets();
    const exists = tickets.some((t) => t.id === ticket.id);
    await saveTickets(
      exists
        ? tickets.map((t) => (t.id === ticket.id ? ticket : t))
        : [ticket, ...tickets]
    );
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("tickets").upsert({
    id: ticket.id,
    project_id: ticket.projectId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    created_at: ticket.createdAt,
    due_at: ticket.dueAt,
    assignee_kind: ticket.assigneeKind,
    assignee_id: ticket.assigneeId,
    created_by_kind: ticket.createdByKind,
    created_by_name: ticket.createdByName,
  });
  if (error) throw new Error(error.message);
}

async function signAttachments(items: Attachment[]): Promise<Attachment[]> {
  if (!isSupabaseEnabled()) return items;
  const supabase = createAdminClient();
  return Promise.all(
    items.map(async (a) => {
      if (a.url || !a.storagePath || a.storagePath.startsWith("local:")) {
        return a;
      }
      const { data: signed } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storagePath, 60 * 60);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );
}

function mapAttachmentRow(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as string,
    parentType: row.parent_type as Attachment["parentType"],
    parentId: row.parent_id as string,
    label: row.label as string,
    kind: row.kind as Attachment["kind"],
    url: (row.url as string) ?? null,
    storagePath: (row.storage_path as string) ?? null,
    mime: (row.mime as string) ?? null,
    size: row.size == null ? null : Number(row.size),
  };
}

export async function portalGetProjectFiles(projectId: string) {
  if (!isSupabaseEnabled()) {
    return (await getAttachments()).filter(
      (a) => a.parentType === "project" && a.parentId === projectId
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("parent_type", "project")
    .eq("parent_id", projectId);
  if (error) throw new Error(error.message);
  return signAttachments((data ?? []).map(mapAttachmentRow));
}

export async function portalGetTicketFiles(ticketIds: string[]) {
  if (!ticketIds.length) return [] as Attachment[];
  if (!isSupabaseEnabled()) {
    return (await getAttachments()).filter(
      (a) => a.parentType === "ticket" && ticketIds.includes(a.parentId)
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("parent_type", "ticket")
    .in("parent_id", ticketIds);
  if (error) throw new Error(error.message);
  return signAttachments((data ?? []).map(mapAttachmentRow));
}

function mapTicketCommentRow(row: Record<string, unknown>): TicketComment {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    parentId: (row.parent_id as string) ?? null,
    body: (row.body as string) ?? "",
    authorKind: row.author_kind as TicketComment["authorKind"],
    authorName: (row.author_name as string) ?? "",
    authorId: (row.author_id as string) ?? null,
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string) ?? null,
  };
}

function mapTicketCommentReactionRow(
  row: Record<string, unknown>
): TicketCommentReaction {
  return {
    id: row.id as string,
    commentId: row.comment_id as string,
    emoji: row.emoji as string,
    authorKind: row.author_kind as TicketCommentReaction["authorKind"],
    authorName: (row.author_name as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function portalGetTicketComments(ticketIds: string[]) {
  if (!ticketIds.length) return [] as TicketComment[];
  if (!isSupabaseEnabled()) {
    return (await getTicketComments())
      .filter((c) => ticketIds.includes(c.ticketId))
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ticket_comments")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTicketCommentRow);
}

export async function portalGetTicketCommentReactions(commentIds: string[]) {
  if (!commentIds.length) return [] as TicketCommentReaction[];
  if (!isSupabaseEnabled()) {
    return (await getTicketCommentReactions()).filter((r) =>
      commentIds.includes(r.commentId)
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ticket_comment_reactions")
    .select("*")
    .in("comment_id", commentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTicketCommentReactionRow);
}

export async function portalGetTicketCommentFiles(commentIds: string[]) {
  if (!commentIds.length) return [] as Attachment[];
  if (!isSupabaseEnabled()) {
    return (await getAttachments()).filter(
      (a) =>
        a.parentType === "ticket_comment" && commentIds.includes(a.parentId)
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("parent_type", "ticket_comment")
    .in("parent_id", commentIds);
  if (error) throw new Error(error.message);
  return signAttachments((data ?? []).map(mapAttachmentRow));
}

export async function portalSaveTicketComment(comment: TicketComment) {
  if (!isSupabaseEnabled()) {
    const comments = await getTicketComments();
    const exists = comments.some((c) => c.id === comment.id);
    await saveTicketComments(
      exists
        ? comments.map((c) => (c.id === comment.id ? comment : c))
        : [...comments, comment]
    );
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("ticket_comments").upsert({
    id: comment.id,
    ticket_id: comment.ticketId,
    parent_id: comment.parentId,
    body: comment.body,
    author_kind: comment.authorKind,
    author_name: comment.authorName,
    author_id: comment.authorId,
    created_at: comment.createdAt,
    edited_at: comment.editedAt,
  });
  if (error) throw new Error(error.message);
}

export async function portalSaveTicketCommentReaction(
  reaction: TicketCommentReaction
) {
  if (!isSupabaseEnabled()) {
    const reactions = await getTicketCommentReactions();
    const exists = reactions.some((r) => r.id === reaction.id);
    await saveTicketCommentReactions(
      exists
        ? reactions.map((r) => (r.id === reaction.id ? reaction : r))
        : [...reactions, reaction]
    );
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("ticket_comment_reactions").upsert({
    id: reaction.id,
    comment_id: reaction.commentId,
    emoji: reaction.emoji,
    author_kind: reaction.authorKind,
    author_name: reaction.authorName,
    created_at: reaction.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function portalDeleteTicketCommentReaction(reactionId: string) {
  if (!isSupabaseEnabled()) {
    const reactions = await getTicketCommentReactions();
    await saveTicketCommentReactions(
      reactions.filter((r) => r.id !== reactionId)
    );
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ticket_comment_reactions")
    .delete()
    .eq("id", reactionId);
  if (error) throw new Error(error.message);
}

/** Studio members for portal avatars / @mentions (admin when Supabase). */
export async function portalGetTeamMembers(): Promise<Member[]> {
  if (!isSupabaseEnabled()) {
    return getTeamMembers();
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role, avatar_url")
    .order("name");
  if (error || !data?.length) {
    return seedMembers.map(normalizeMember);
  }
  return data.map((row) =>
    normalizeMember({
      id: row.id as string,
      name: (row.name as string) ?? "User",
      initials: (row.initials as string) ?? "?",
      role: row.role === "Admin" ? "Admin" : "Member",
      avatarUrl: (row.avatar_url as string) ?? null,
    })
  );
}

/** Studio path still uses normal store. */
export { getProjects, saveProjects, getTasks, saveTasks };
