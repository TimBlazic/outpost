import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  getProjectById,
  getClients,
  getTicketsForProject,
  getAttachmentsFor,
  getAttachments,
  getTicketComments,
  getTicketCommentReactions,
  getInvoices,
  getPortalMessagesForProject,
  getPortalMessageReactionsForProject,
  getPortalMessageFilesForProject,
} from "@/lib/store";
import { getCurrentProfile, getTeamMembers } from "@/lib/auth/session";
import { ProjectWorkspace } from "@/components/project-workspace";
import { PortalClientView } from "@/components/portal-client-view";
import { PortalFrame } from "@/components/portal-frame";
import {
  requireClientSession,
  tryClientPortalSession,
} from "@/lib/client-accounts/session";
import { clientPersonName } from "@/lib/format";
import { getHostRole, getRequestHostname } from "@/lib/hosts";
import { getPortalTheme } from "@/lib/portal/theme";
import { memberById } from "@/lib/data";
import {
  portalGetTickets,
  portalGetProjectFiles,
  portalGetTicketComments,
  portalGetTicketCommentReactions,
  portalGetTicketCommentFiles,
  portalGetTeamMembers,
  portalGetMessages,
  portalGetMessageReactions,
  portalGetMessageFiles,
} from "@/lib/portal/repo";
import type {
  Attachment,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reqHeaders = await headers();
  const role = getHostRole(getRequestHostname(reqHeaders.get("host")));

  if (role === "client") {
    return renderClientPortal(id);
  }

  if (role === "unified" && (await tryClientPortalSession())) {
    return renderClientPortal(id);
  }

  const project = await getProjectById(id);
  if (!project) notFound();

  const [
    tickets,
    files,
    clients,
    allAttachments,
    allComments,
    allReactions,
    members,
    me,
    allInvoices,
    messages,
    messageReactions,
    messageFiles,
  ] = await Promise.all([
    getTicketsForProject(project.id),
    getAttachmentsFor("project", project.id),
    getClients(),
    getAttachments(),
    getTicketComments(),
    getTicketCommentReactions(),
    getTeamMembers(),
    getCurrentProfile(),
    getInvoices(),
    getPortalMessagesForProject(project.id),
    getPortalMessageReactionsForProject(project.id),
    getPortalMessageFilesForProject(project.id),
  ]);
  const client =
    project.clientId != null
      ? clients.find((item) => item.id === project.clientId) ?? null
      : null;
  const clientPortalStatus =
    !client
      ? null
      : !client.authUserId
        ? "no-account"
        : !client.onboardingCompletedAt
          ? "invited"
          : "active";
  const clientProfile = client?.authUserId
    ? memberById(client.authUserId, members)
    : null;
  const clientAuthor = client
    ? {
        id: client.authUserId,
        name:
          (clientProfile?.name !== "Unknown" && clientProfile?.name) ||
          clientPersonName(client),
        avatarUrl: clientProfile?.avatarUrl ?? null,
      }
    : null;

  const invoices = allInvoices.filter((i) => i.projectId === project.id);

  const ticketIds = new Set(tickets.map((t) => t.id));
  const ticketFiles: Record<string, Attachment[]> = {};
  for (const a of allAttachments) {
    if (a.parentType !== "ticket" || !ticketIds.has(a.parentId)) continue;
    (ticketFiles[a.parentId] ??= []).push(a);
  }

  const ticketComments: Record<string, TicketComment[]> = {};
  for (const c of allComments) {
    if (!ticketIds.has(c.ticketId)) continue;
    (ticketComments[c.ticketId] ??= []).push(c);
  }
  for (const id of Object.keys(ticketComments)) {
    ticketComments[id].sort((a, b) =>
      a.createdAt > b.createdAt ? 1 : -1
    );
  }

  const commentIds = new Set(
    Object.values(ticketComments)
      .flat()
      .map((c) => c.id)
  );

  const ticketReactions: Record<string, TicketCommentReaction[]> = {};
  for (const r of allReactions) {
    if (!commentIds.has(r.commentId)) continue;
    const comment = allComments.find((c) => c.id === r.commentId);
    if (!comment) continue;
    (ticketReactions[comment.ticketId] ??= []).push(r);
  }

  const ticketCommentFiles: Record<string, Attachment[]> = {};
  for (const a of allAttachments) {
    if (a.parentType !== "ticket_comment" || !commentIds.has(a.parentId)) {
      continue;
    }
    const comment = allComments.find((c) => c.id === a.parentId);
    if (!comment) continue;
    (ticketCommentFiles[comment.ticketId] ??= []).push(a);
  }

  return (
    <ProjectWorkspace
      project={project}
      tickets={tickets}
      files={files}
      invoices={invoices}
      messages={messages}
      messageReactions={messageReactions}
      messageFiles={messageFiles}
      ticketFiles={ticketFiles}
      ticketComments={ticketComments}
      ticketReactions={ticketReactions}
      ticketCommentFiles={ticketCommentFiles}
      members={members}
      currentUserName={me.name}
      currentUserId={me.id}
      clientAuthor={clientAuthor}
      clientPortalStatus={clientPortalStatus}
      clientPortalEmail={client?.portalEmail ?? client?.email ?? null}
    />
  );
}

/** Renders the portal client view for an authenticated client account. */
async function renderClientPortal(id: string) {
  const { client } = await requireClientSession();
  if (!client.onboardingCompletedAt) redirect("/onboarding");
  const project = await getProjectById(id);
  if (!project || project.clientId !== client.id) notFound();

  const theme = await getPortalTheme();
  const me = await getCurrentProfile();

  const [tickets, files, members, messages, allInvoices] = await Promise.all([
    project.clientCanViewTickets
      ? portalGetTickets(project.id)
      : Promise.resolve([]),
    portalGetProjectFiles(project.id),
    portalGetTeamMembers(),
    portalGetMessages(project.id),
    getInvoices(),
  ]);
  const unpaidInvoices = allInvoices.filter(
    (i) =>
      i.projectId === project.id &&
      i.status === "issued" &&
      !i.paidAt
  );

  const messageIds = messages.map((m) => m.id);
  const ticketIds = tickets.map((t) => t.id);
  const comments = await portalGetTicketComments(ticketIds);
  const commentIds = comments.map((c) => c.id);
  const [reactions, commentFiles, messageReactions, messageFiles] =
    await Promise.all([
      portalGetTicketCommentReactions(commentIds),
      portalGetTicketCommentFiles(commentIds),
      portalGetMessageReactions(messageIds),
      portalGetMessageFiles(messageIds),
    ]);

  const ticketComments: Record<string, TicketComment[]> = {};
  for (const c of comments) {
    (ticketComments[c.ticketId] ??= []).push(c);
  }

  const ticketReactions: Record<string, TicketCommentReaction[]> = {};
  for (const r of reactions) {
    const comment = comments.find((c) => c.id === r.commentId);
    if (!comment) continue;
    (ticketReactions[comment.ticketId] ??= []).push(r);
  }

  const ticketCommentFilesMap: Record<string, Attachment[]> = {};
  for (const a of commentFiles) {
    const comment = comments.find((c) => c.id === a.parentId);
    if (!comment) continue;
    (ticketCommentFilesMap[comment.ticketId] ??= []).push(a);
  }

  return (
    <PortalFrame>
      <PortalClientView
        project={project}
        tickets={tickets}
        files={files}
        messages={messages}
        messageReactions={messageReactions}
        messageFiles={messageFiles}
        ticketComments={ticketComments}
        ticketReactions={ticketReactions}
        ticketCommentFiles={ticketCommentFilesMap}
        members={members}
        theme={theme}
        viewer="session"
        locale={client.portalLocale}
        unpaidInvoices={unpaidInvoices}
        clientAuthor={{
          id: me.id,
          name:
            me.name?.trim() ||
            `${client.firstName} ${client.lastName}`.trim() ||
            client.name ||
            "Client",
          avatarUrl: me.avatarUrl,
        }}
      />
    </PortalFrame>
  );
}
