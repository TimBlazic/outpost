import { isArchived, type PortalMessage } from "@/lib/data";
import { assertClientProjectAccess } from "@/lib/client-accounts/access";
import {
  getPortalMessageFilesForProject,
  getPortalMessageReactionsForProject,
  getPortalMessages,
  getPortalMessagesForProject,
  getProjectById,
  saveProjects,
  getProjects,
} from "@/lib/store";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  portalGetMessageFiles,
  portalGetMessageReactions,
  portalGetMessages,
  portalGetProjectByToken,
} from "@/lib/portal/repo";
import {
  chatRevision,
  countUnreadMessages,
  isClientOnline,
  type ChatSyncPayload,
  type ChatViewer,
} from "@/lib/portal/chat-sync-shared";

export type { ChatSyncPayload, ChatViewer } from "@/lib/portal/chat-sync-shared";
export {
  CHAT_POLL_MS,
  CLIENT_ONLINE_MS,
  UNREAD_POLL_MS,
  chatRevision,
  countUnreadMessages,
  isClientOnline,
} from "@/lib/portal/chat-sync-shared";

export async function loadStudioChatSnapshot(
  projectId: string,
  opts?: { markRead?: boolean }
): Promise<ChatSyncPayload> {
  if (opts?.markRead) {
    await markProjectChatRead(projectId, "studio");
  }

  const [project, messages, reactions, files] = await Promise.all([
    getProjectById(projectId),
    getPortalMessagesForProject(projectId),
    getPortalMessageReactionsForProject(projectId),
    getPortalMessageFilesForProject(projectId),
  ]);
  if (!project) throw new Error("Project not found");

  return {
    revision: chatRevision(messages, reactions, files),
    messages,
    reactions,
    files,
    clientOnline: isClientOnline(project.portalClientLastSeenAt),
    unreadCount: opts?.markRead
      ? 0
      : countUnreadMessages(
          messages,
          "studio",
          project.portalStudioLastReadAt
        ),
  };
}

export async function loadPortalChatSnapshot(
  token: string,
  opts?: { touchPresence?: boolean; markRead?: boolean }
): Promise<ChatSyncPayload> {
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");

  if (opts?.touchPresence !== false) {
    await touchPortalClientPresence(project.id);
  }
  if (opts?.markRead) {
    await markProjectChatRead(project.id, "client");
  }

  const messages = await portalGetMessages(project.id);
  const messageIds = messages.map((m) => m.id);
  const [reactions, files] = await Promise.all([
    portalGetMessageReactions(messageIds),
    portalGetMessageFiles(messageIds),
  ]);

  // Re-fetch project for fresh last-read after mark
  const fresh = opts?.markRead
    ? ((await portalGetProjectByToken(token)) ?? project)
    : project;

  return {
    revision: chatRevision(messages, reactions, files),
    messages,
    reactions,
    files,
    unreadCount: opts?.markRead
      ? 0
      : countUnreadMessages(
          messages,
          "client",
          fresh.portalClientLastReadAt
        ),
  };
}

export async function loadSessionChatSnapshot(
  projectId: string,
  opts?: { touchPresence?: boolean; markRead?: boolean }
): Promise<ChatSyncPayload> {
  const { project } = await assertClientProjectAccess(projectId);

  if (opts?.touchPresence !== false) {
    await touchPortalClientPresence(project.id);
  }
  if (opts?.markRead) {
    await markProjectChatRead(project.id, "client");
  }

  const messages = await portalGetMessages(project.id);
  const messageIds = messages.map((m) => m.id);
  const [reactions, files] = await Promise.all([
    portalGetMessageReactions(messageIds),
    portalGetMessageFiles(messageIds),
  ]);

  const fresh = opts?.markRead
    ? await getProjectById(project.id)
    : project;

  return {
    revision: chatRevision(messages, reactions, files),
    messages,
    reactions,
    files,
    unreadCount: opts?.markRead
      ? 0
      : countUnreadMessages(
          messages,
          "client",
          fresh?.portalClientLastReadAt
        ),
  };
}

export async function touchPortalClientPresence(projectId: string) {
  const now = new Date().toISOString();
  if (!isSupabaseEnabled()) {
    const projects = await getProjects();
    await saveProjects(
      projects.map((p) =>
        p.id === projectId ? { ...p, portalClientLastSeenAt: now } : p
      )
    );
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .update({ portal_client_last_seen_at: now })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

export async function markProjectChatRead(
  projectId: string,
  viewer: ChatViewer
) {
  const now = new Date().toISOString();
  const column =
    viewer === "studio"
      ? "portal_studio_last_read_at"
      : "portal_client_last_read_at";

  if (!isSupabaseEnabled()) {
    const projects = await getProjects();
    await saveProjects(
      projects.map((p) =>
        p.id === projectId
          ? viewer === "studio"
            ? { ...p, portalStudioLastReadAt: now }
            : { ...p, portalClientLastReadAt: now }
          : p
      )
    );
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .update({ [column]: now })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

export type StudioUnreadSnapshot = {
  total: number;
  byProject: Record<string, number>;
  lastByProject: Record<string, PortalMessage | null>;
};

export async function getStudioUnreadSnapshot(): Promise<StudioUnreadSnapshot> {
  const [projects, messages] = await Promise.all([
    getProjects(),
    getPortalMessages(),
  ]);
  const byProject = new Map<string, PortalMessage[]>();
  const lastByProject: Record<string, PortalMessage | null> = {};
  for (const m of messages) {
    const list = byProject.get(m.projectId) ?? [];
    list.push(m);
    byProject.set(m.projectId, list);
    const prev = lastByProject[m.projectId];
    if (!prev || prev.createdAt < m.createdAt) lastByProject[m.projectId] = m;
  }

  const byUnread: Record<string, number> = {};
  let total = 0;
  for (const p of projects) {
    if (isArchived(p)) continue;
    if (!p.portalEnabled && !byProject.has(p.id)) continue;
    const count = countUnreadMessages(
      byProject.get(p.id) ?? [],
      "studio",
      p.portalStudioLastReadAt
    );
    byUnread[p.id] = count;
    total += count;
    if (!(p.id in lastByProject)) lastByProject[p.id] = null;
  }
  return { total, byProject: byUnread, lastByProject };
}

export async function getStudioUnreadTotal() {
  return (await getStudioUnreadSnapshot()).total;
}
