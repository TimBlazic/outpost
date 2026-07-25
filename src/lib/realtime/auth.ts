"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Push the current JWT onto the Realtime socket.
 * Without this, channels often report SUBSCRIBED while RLS silently drops
 * every postgres_changes event.
 */
export async function ensureRealtimeAuth(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return false;
  await supabase.realtime.setAuth(data.session.access_token);
  return true;
}
