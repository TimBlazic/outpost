import { isClientOnline } from "@/lib/portal/chat-sync-shared";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getClientById, getProjectById } from "@/lib/store";

import { buildPortalNotificationCtaUrl, nextPathForNotification } from "./links";
import { sendPortalNotificationEmail } from "./send";
import { renderPortalNotificationEmail } from "./template";
import {
  MAX_SEND_ATTEMPTS,
  type PortalNotificationPayload,
  type PortalNotificationType,
} from "./types";

type DbRow = {
  id: string;
  project_id: string;
  client_id: string;
  type: PortalNotificationType;
  payload: PortalNotificationPayload;
  attempts: number;
};

export async function flushPortalNotifications(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const result = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  if (!hasAdminClient()) return result;

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: ready, error } = await supabase
    .from("portal_notification_events")
    .select("id, project_id, client_id, type, payload, attempts")
    .eq("status", "pending")
    .lte("not_before", now)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[portal-notifications] claim select failed", error.message);
    return result;
  }

  for (const row of (ready ?? []) as DbRow[]) {
    const { data: claimed, error: claimErr } = await supabase
      .from("portal_notification_events")
      .update({ status: "sending", updated_at: now })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id, project_id, client_id, type, payload, attempts")
      .maybeSingle();

    if (claimErr || !claimed) continue;

    result.processed += 1;
    const outcome = await processClaimed(claimed as DbRow);

    if (outcome === "sent") result.sent += 1;
    else if (outcome === "skipped") result.skipped += 1;
    else result.failed += 1;
  }

  return result;
}

async function mark(
  id: string,
  patch: {
    status: "sent" | "skipped" | "failed" | "pending";
    last_error?: string | null;
    attempts?: number;
    not_before?: string;
  }
) {
  if (!hasAdminClient()) return;
  const supabase = createAdminClient();
  await supabase
    .from("portal_notification_events")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function processClaimed(
  row: DbRow
): Promise<"sent" | "skipped" | "failed"> {
  try {
    const [project, client] = await Promise.all([
      getProjectById(row.project_id),
      getClientById(row.client_id),
    ]);

    const portalEmail = (client?.portalEmail ?? "").trim().toLowerCase();
    if (!portalEmail) {
      await mark(row.id, {
        status: "skipped",
        last_error: "no_portal_email",
      });
      return "skipped";
    }

    const skipOnline =
      row.type === "message" || row.type === "ticket_comment";
    if (
      skipOnline &&
      isClientOnline(project?.portalClientLastSeenAt ?? null)
    ) {
      await mark(row.id, {
        status: "skipped",
        last_error: "client_online",
      });
      return "skipped";
    }

    const locale = client?.portalLocale === "sl" ? "sl" : "en";
    const projectName = project?.name ?? "Project";
    const nextPath = nextPathForNotification(
      row.type,
      row.project_id,
      row.payload ?? ({} as PortalNotificationPayload)
    );
    const ctaUrl = buildPortalNotificationCtaUrl({ nextPath });
    const rendered = renderPortalNotificationEmail({
      locale,
      projectName,
      type: row.type,
      payload: row.payload ?? ({} as PortalNotificationPayload),
      ctaUrl,
    });

    await sendPortalNotificationEmail({
      to: portalEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await mark(row.id, { status: "sent", last_error: null });
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    const attempts = (row.attempts ?? 0) + 1;
    if (attempts >= MAX_SEND_ATTEMPTS) {
      await mark(row.id, {
        status: "failed",
        attempts,
        last_error: message,
      });
      return "failed";
    }
    await mark(row.id, {
      status: "pending",
      attempts,
      last_error: message,
      not_before: new Date(Date.now() + 60_000).toISOString(),
    });
    return "failed";
  }
}
