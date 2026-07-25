"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { portalChatChannelName } from "@/lib/realtime/portal-chat-channel";
import { createClient } from "@/lib/supabase/client";

/**
 * Live chat updates via:
 * 1) Realtime Broadcast (server push after every write)
 * 2) postgres_changes (DB replication; needs JWT via ensureRealtimeAuth)
 *
 * No polling — `onChange` triggers an immediate sync fetch.
 */
export function usePortalChatRealtime(
  projectId: string | null | undefined,
  onChange: () => void
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;

    let removed = false;
    let channel: RealtimeChannel | null = null;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const bump = () => {
      if (!removed) onChangeRef.current();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          void supabase.realtime.setAuth(session.access_token);
        }
      }
    );

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (removed) return;

      channel = supabase
        .channel(portalChatChannelName(projectId))
        .on("broadcast", { event: "change" }, bump)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "portal_messages",
            filter: `project_id=eq.${projectId}`,
          },
          bump
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "portal_message_reactions",
          },
          bump
        )
        .subscribe();
    })();

    return () => {
      removed = true;
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId]);
}
