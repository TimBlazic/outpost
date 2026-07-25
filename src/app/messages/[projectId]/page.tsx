import { notFound } from "next/navigation";

import { MessagesWorkspace } from "@/components/messages-workspace";
import { isArchived, memberById } from "@/lib/data";
import { getCurrentProfile, getTeamMembers } from "@/lib/auth/session";
import { clientPersonName } from "@/lib/format";
import { countUnreadMessages } from "@/lib/portal/chat-sync-shared";
import {
  getClients,
  getPortalMessageFilesForProject,
  getPortalMessageReactionsForProject,
  getPortalMessages,
  getPortalMessagesForProject,
  getProjectById,
  getProjects,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const [
    projects,
    allMessages,
    messages,
    reactions,
    files,
    members,
    me,
    clients,
  ] = await Promise.all([
    getProjects(),
    getPortalMessages(),
    getPortalMessagesForProject(projectId),
    getPortalMessageReactionsForProject(projectId),
    getPortalMessageFilesForProject(projectId),
    getTeamMembers(),
    getCurrentProfile(),
    getClients(),
  ]);

  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const clientAuthors: Record<
    string,
    { id: string | null; name: string; avatarUrl: string | null }
  > = {};
  for (const p of projects) {
    if (!p.clientId) continue;
    const client = clientsById.get(p.clientId);
    if (!client) continue;
    const profile = client.authUserId
      ? memberById(client.authUserId, members)
      : null;
    clientAuthors[p.id] = {
      id: client.authUserId,
      name:
        (profile?.name !== "Unknown" && profile?.name) ||
        clientPersonName(client),
      avatarUrl: profile?.avatarUrl ?? null,
    };
  }
  if (project.clientId && !clientAuthors[project.id]) {
    const client = clientsById.get(project.clientId);
    if (client) {
      const profile = client.authUserId
        ? memberById(client.authUserId, members)
        : null;
      clientAuthors[project.id] = {
        id: client.authUserId,
        name:
          (profile?.name !== "Unknown" && profile?.name) ||
          clientPersonName(client),
        avatarUrl: profile?.avatarUrl ?? null,
      };
    }
  }

  const byProject = new Map<string, (typeof allMessages)[number]>();
  const allByProject = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const prev = byProject.get(m.projectId);
    if (!prev || prev.createdAt < m.createdAt) byProject.set(m.projectId, m);
    const list = allByProject.get(m.projectId) ?? [];
    list.push(m);
    allByProject.set(m.projectId, list);
  }

  const threads = projects
    .filter((p) => !isArchived(p) && (p.portalEnabled || byProject.has(p.id)))
    .map((p) => ({
      project: p,
      lastMessage: byProject.get(p.id) ?? null,
      unreadCount: countUnreadMessages(
        allByProject.get(p.id) ?? [],
        "studio",
        p.portalStudioLastReadAt
      ),
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? "";
      const bt = b.lastMessage?.createdAt ?? "";
      if (at === bt) return a.project.name.localeCompare(b.project.name);
      return at < bt ? 1 : -1;
    });

  if (!threads.some((t) => t.project.id === project.id)) {
    threads.unshift({
      project,
      lastMessage: byProject.get(project.id) ?? null,
      unreadCount: countUnreadMessages(
        allByProject.get(project.id) ?? [],
        "studio",
        project.portalStudioLastReadAt
      ),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MessagesWorkspace
        threads={threads}
        activeProjectId={project.id}
        activeProject={project}
        activeMessages={messages}
        activeReactions={reactions}
        activeFiles={files}
        members={members}
        currentAuthorName={me.name}
        currentAuthorId={me.id}
        clientAuthors={clientAuthors}
      />
    </div>
  );
}
