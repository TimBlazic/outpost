import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

import {
  EXCERPT_MAX,
  MESSAGE_DEBOUNCE_MS,
  type MessagePayload,
  type PortalNotificationType,
} from "./types";

function truncateExcerpt(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= EXCERPT_MAX) return t;
  return `${t.slice(0, EXCERPT_MAX - 1)}…`;
}

function notBeforeFromNow(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

async function insertEvent(input: {
  projectId: string;
  clientId: string;
  type: PortalNotificationType;
  payload: Record<string, unknown>;
  notBefore?: string;
}) {
  if (!hasAdminClient()) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("portal_notification_events").insert({
    project_id: input.projectId,
    client_id: input.clientId,
    type: input.type,
    payload: input.payload,
    not_before: input.notBefore ?? new Date().toISOString(),
    status: "pending",
  });
  if (error) {
    console.error("[portal-notifications] enqueue failed", error.message);
  }
}

export async function enqueueTicketsBulk(input: {
  projectId: string;
  clientId: string;
  count: number;
  titles: string[];
  ticketIds: string[];
}): Promise<void> {
  await insertEvent({
    projectId: input.projectId,
    clientId: input.clientId,
    type: "tickets_bulk",
    payload: {
      count: input.count,
      titles: input.titles.slice(0, 5),
      ticketIds: input.ticketIds,
    },
  });
}

export async function enqueueTicketWaiting(input: {
  projectId: string;
  clientId: string;
  ticketId: string;
  ticketTitle: string;
}): Promise<void> {
  await insertEvent({
    projectId: input.projectId,
    clientId: input.clientId,
    type: "ticket_waiting",
    payload: {
      ticketId: input.ticketId,
      ticketTitle: input.ticketTitle,
    },
  });
}

export async function enqueueTicketComment(input: {
  projectId: string;
  clientId: string;
  ticketId: string;
  ticketTitle: string;
  commentId: string;
  excerpt: string;
}): Promise<void> {
  await insertEvent({
    projectId: input.projectId,
    clientId: input.clientId,
    type: "ticket_comment",
    payload: {
      ticketId: input.ticketId,
      ticketTitle: input.ticketTitle,
      commentId: input.commentId,
      excerpt: truncateExcerpt(input.excerpt),
    },
  });
}

export async function enqueueStudioMessage(input: {
  projectId: string;
  clientId: string;
  messageId: string;
  excerpt: string;
}): Promise<void> {
  if (!hasAdminClient()) return;
  const supabase = createAdminClient();
  const excerpt = truncateExcerpt(input.excerpt);
  const notBefore = notBeforeFromNow(MESSAGE_DEBOUNCE_MS);

  const { data: existing, error: selErr } = await supabase
    .from("portal_notification_events")
    .select("id, payload")
    .eq("project_id", input.projectId)
    .eq("type", "message")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    console.error("[portal-notifications] message select failed", selErr.message);
    return;
  }

  if (!existing) {
    await insertEvent({
      projectId: input.projectId,
      clientId: input.clientId,
      type: "message",
      payload: {
        messageIds: [input.messageId],
        excerpts: [excerpt],
      },
      notBefore,
    });
    return;
  }

  const prev = (existing.payload ?? {}) as Partial<MessagePayload>;
  const messageIds = [...(prev.messageIds ?? []), input.messageId];
  const excerpts = [...(prev.excerpts ?? []), excerpt];
  const { error } = await supabase
    .from("portal_notification_events")
    .update({
      payload: { messageIds, excerpts },
      not_before: notBefore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("status", "pending");

  if (error) {
    console.error("[portal-notifications] message coalesce failed", error.message);
  }
}
