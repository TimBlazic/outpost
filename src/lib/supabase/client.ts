"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

/** Shared browser client — required for reliable Realtime channel reuse. */
export function createClient() {
  if (browserClient) return browserClient;
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Supabase env vars are not configured.");
  }
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
