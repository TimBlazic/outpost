import { portalChatChannelName } from "@/lib/realtime/portal-chat-channel";
import { getSupabaseEnv, isSupabaseEnabled } from "@/lib/supabase/env";

/**
 * Push a Realtime Broadcast so open chat UIs sync immediately.
 * Complements postgres_changes (which needs JWT on the socket + RLS SELECT).
 */
export async function notifyPortalChatChanged(projectId: string) {
  if (!isSupabaseEnabled() || !projectId) return;

  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: portalChatChannelName(projectId),
            event: "change",
            payload: { projectId },
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    /* best-effort — UI still has postgres_changes + own post sync */
  }
}
