/**
 * Supabase client key: prefer the new publishable key, fall back to legacy anon JWT.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

/** True when Supabase is configured and file-store override is off. */
export function isSupabaseEnabled() {
  if (
    process.env.OUTPOST_USE_FILE_STORE === "1" ||
    process.env.LEADFLOW_USE_FILE_STORE === "1"
  ) {
    return false;
  }
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}
