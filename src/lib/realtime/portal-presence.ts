"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side: Track presence in a project's presence channel.
 * The client joins and stays tracked while mounted; studio does NOT render
 * this component — it only subscribes via `usePortalPresenceSubscribe`.
 */
export function usePortalPresenceTrack(
  projectId: string | null | undefined
): { tracking: boolean } {
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setTracking(false);
      return;
    }

    let removed = false;
    let channel: RealtimeChannel | null = null;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (removed) return;

      channel = supabase
        .channel(`portal-presence-${projectId}`, {
          config: { presence: { key: "client" } },
        })
        .subscribe(async (status) => {
          if (removed) return;
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({
              role: "client",
              online_at: new Date().toISOString(),
            });
            setTracking(true);
          }
        });
    })();

    return () => {
      removed = true;
      setTracking(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { tracking };
}

/**
 * Studio-side: Subscribe to presence channel for a project and expose whether
 * the client is currently online. Used in the chat header indicator.
 */
export function usePortalPresenceSubscribe(
  projectId: string | null | undefined
): { clientOnline: boolean } {
  const [clientOnline, setClientOnline] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setClientOnline(false);
      return;
    }

    let removed = false;
    let channel: RealtimeChannel | null = null;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (removed) return;

      channel = supabase
        .channel(`portal-presence-${projectId}`, {
          config: { presence: { key: "studio" } },
        })
        .on("presence", { event: "sync" }, () => {
          if (removed || !channel) return;
          const state = channel.presenceState();
          const hasClient = Object.keys(state).some((key) => key === "client");
          setClientOnline(hasClient);
        })
        .subscribe();
    })();

    return () => {
      removed = true;
      setClientOnline(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { clientOnline };
}
