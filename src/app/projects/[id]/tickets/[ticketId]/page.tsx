import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  getProjectById,
  getTicketById,
  getAttachmentsFor,
  getCommentsForTicket,
  getReactionsForTicketComments,
  getAttachments,
} from "@/lib/store";
import { getCurrentProfile, getTeamMembers } from "@/lib/auth/session";
import { TicketDetail } from "@/components/ticket-detail";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string; ticketId: string }>;
}) {
  const { id, ticketId } = await params;
  const [project, ticket, members, me] = await Promise.all([
    getProjectById(id),
    getTicketById(ticketId),
    getTeamMembers(),
    getCurrentProfile(),
  ]);
  if (!project || !ticket || ticket.projectId !== project.id) notFound();

  const comments = await getCommentsForTicket(ticket.id);
  const [files, reactions, allAttachments] = await Promise.all([
    getAttachmentsFor("ticket", ticket.id),
    getReactionsForTicketComments(comments.map((c) => c.id)),
    getAttachments(),
  ]);
  const commentIds = new Set(comments.map((c) => c.id));
  const commentFiles = allAttachments.filter(
    (a) => a.parentType === "ticket_comment" && commentIds.has(a.parentId)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {project.name}
      </Link>
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <TicketDetail
          projectId={project.id}
          ticket={ticket}
          files={files}
          comments={comments}
          reactions={reactions}
          commentFiles={commentFiles}
          members={members}
          clientName={project.client}
          currentUserName={me.name}
          mode="page"
        />
      </div>
    </div>
  );
}
