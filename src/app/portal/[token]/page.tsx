import { notFound } from "next/navigation";

import {
  PortalClientView,
  PortalPinGate,
} from "@/components/portal-client-view";
import { getPortalSessionToken } from "@/lib/portal/session";
import { getPortalTheme } from "@/lib/portal/theme";
import { normalizePortalLocale } from "@/lib/portal/i18n";
import {
  portalGetProjectByToken,
  portalGetTickets,
  portalGetProjectFiles,
  portalGetTicketComments,
  portalGetTicketCommentReactions,
  portalGetTicketCommentFiles,
  portalGetTeamMembers,
} from "@/lib/portal/repo";
import type {
  Attachment,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const theme = await getPortalTheme();

  let project;
  try {
    project = await portalGetProjectByToken(token);
  } catch (e) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="portal-display text-2xl italic">Portal unavailable</h1>
          <p className="mt-3 text-sm text-[var(--portal-muted)]">
            {e instanceof Error
              ? e.message
              : "Could not load this portal. If you use Supabase, add SUPABASE_SERVICE_ROLE_KEY."}
          </p>
        </div>
      </div>
    );
  }

  if (!project) notFound();

  const locale = normalizePortalLocale(project.portalLocale);
  const session = await getPortalSessionToken();
  if (session !== token) {
    return <PortalPinGate token={token} theme={theme} locale={locale} />;
  }

  const [tickets, files, members] = await Promise.all([
    project.clientCanViewTickets
      ? portalGetTickets(project.id)
      : Promise.resolve([]),
    portalGetProjectFiles(project.id),
    portalGetTeamMembers(),
  ]);

  const ticketIds = tickets.map((t) => t.id);
  const comments = await portalGetTicketComments(ticketIds);
  const commentIds = comments.map((c) => c.id);
  const [reactions, commentFiles] = await Promise.all([
    portalGetTicketCommentReactions(commentIds),
    portalGetTicketCommentFiles(commentIds),
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

  const ticketCommentFiles: Record<string, Attachment[]> = {};
  for (const a of commentFiles) {
    const comment = comments.find((c) => c.id === a.parentId);
    if (!comment) continue;
    (ticketCommentFiles[comment.ticketId] ??= []).push(a);
  }

  return (
    <PortalClientView
      token={token}
      project={project}
      tickets={tickets}
      files={files}
      ticketComments={ticketComments}
      ticketReactions={ticketReactions}
      ticketCommentFiles={ticketCommentFiles}
      members={members}
      theme={theme}
    />
  );
}
