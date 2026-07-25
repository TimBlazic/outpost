import { notFound } from "next/navigation";

import {
  getProjectById,
  getTicketsForProject,
  getAttachmentsFor,
  getAttachments,
  getTicketComments,
  getTicketCommentReactions,
} from "@/lib/store";
import { getCurrentProfile, getTeamMembers } from "@/lib/auth/session";
import { ProjectWorkspace } from "@/components/project-workspace";
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
  const project = await getProjectById(id);
  if (!project) notFound();

  const [
    tickets,
    files,
    allAttachments,
    allComments,
    allReactions,
    members,
    me,
  ] = await Promise.all([
    getTicketsForProject(project.id),
    getAttachmentsFor("project", project.id),
    getAttachments(),
    getTicketComments(),
    getTicketCommentReactions(),
    getTeamMembers(),
    getCurrentProfile(),
  ]);

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
      ticketFiles={ticketFiles}
      ticketComments={ticketComments}
      ticketReactions={ticketReactions}
      ticketCommentFiles={ticketCommentFiles}
      members={members}
      currentUserName={me.name}
    />
  );
}
