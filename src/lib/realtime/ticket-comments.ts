"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to realtime changes on ticket_comments and ticket_comment_reactions.
 * Calls `onChange` whenever a relevant INSERT/UPDATE/DELETE arrives.
 */
export function useTicketCommentsRealtime(
  ticketId: string | null | undefined,
  onChange: () => void
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ticketId) return;

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
        .channel(`ticket-comments-${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ticket_comments",
            filter: `ticket_id=eq.${ticketId}`,
          },
          bump
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ticket_comment_reactions",
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
  }, [ticketId]);
}
