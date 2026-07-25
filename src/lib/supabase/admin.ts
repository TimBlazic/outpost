import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

/**
 * Service-role client for portal routes (no end-user Auth session).
 * Requires SUPABASE_SERVICE_ROLE_KEY in server env.
 */
export function createAdminClient() {
  const { url, key } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Portal needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Settings → API → service_role)."
    );
  }
  // Prefer service role; fall back unused — key from getSupabaseEnv is publishable.
  void key;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminClient() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
