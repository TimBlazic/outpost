import { MessagesWorkspace } from "@/components/messages-workspace";
import { isArchived, memberById } from "@/lib/data";
import { getTeamMembers } from "@/lib/auth/session";
import { clientPersonName } from "@/lib/format";
import { countUnreadMessages } from "@/lib/portal/chat-sync-shared";
import { getClients, getPortalMessages, getProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const [projects, messages, clients, members] = await Promise.all([
    getProjects(),
    getPortalMessages(),
    getClients(),
    getTeamMembers(),
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

  const byProject = new Map<string, (typeof messages)[number]>();
  const allByProject = new Map<string, typeof messages>();
  for (const m of messages) {
    const prev = byProject.get(m.projectId);
    if (!prev || prev.createdAt < m.createdAt) byProject.set(m.projectId, m);
    const list = allByProject.get(m.projectId) ?? [];
    list.push(m);
    allByProject.set(m.projectId, list);
  }

  const threads = projects
    .filter((p) => !isArchived(p) && (p.portalEnabled || byProject.has(p.id)))
    .map((project) => ({
      project,
      lastMessage: byProject.get(project.id) ?? null,
      unreadCount: countUnreadMessages(
        allByProject.get(project.id) ?? [],
        "studio",
        project.portalStudioLastReadAt
      ),
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? "";
      const bt = b.lastMessage?.createdAt ?? "";
      if (at === bt) return a.project.name.localeCompare(b.project.name);
      return at < bt ? 1 : -1;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MessagesWorkspace threads={threads} clientAuthors={clientAuthors} />
    </div>
  );
}
