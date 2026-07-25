"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Supabase env vars are not configured.");
  }
  return createBrowserClient(url, key);
}
