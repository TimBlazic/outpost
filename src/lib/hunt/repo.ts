import { createClient } from "@/lib/supabase/server";
import type { HuntSitePreview } from "./preview";
import type { PlaceCandidate, Prospect, ProspectStatus } from "./types";

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapRow(row: Record<string, unknown>): Prospect {
  return {
    id: row.id as string,
    placeId: row.place_id as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    website: (row.website as string) ?? null,
    mapsUrl: (row.maps_url as string) ?? null,
    query: (row.query as string) ?? "",
    status: row.status as ProspectStatus,
    queuedOn: row.queued_on ? String(row.queued_on) : null,
    leadId: (row.lead_id as string) ?? null,
    siteTitle: (row.site_title as string) ?? null,
    siteDescription: (row.site_description as string) ?? null,
    siteCms: (row.site_cms as string) ?? null,
    siteSignal: (row.site_signal as Prospect["siteSignal"]) ?? null,
    sitePreviewedAt: row.site_previewed_at
      ? String(row.site_previewed_at)
      : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Insert new prospects already queued for review; promote any leftover pooled matches. */
export async function upsertQueuedCandidates(
  city: string,
  query: string,
  candidates: PlaceCandidate[],
  queuedOn: string
): Promise<number> {
  const supabase = await createClient();
  if (!candidates.length) return 0;
  const now = new Date().toISOString();
  const rows = candidates.map((c) => ({
    place_id: c.placeId,
    name: c.name,
    address: c.address,
    city,
    website: c.website,
    maps_url: c.mapsUrl,
    query,
    status: "queued_today",
    queued_on: queuedOn,
    updated_at: now,
  }));
  const { error, count } = await supabase.from("prospects").upsert(rows, {
    onConflict: "place_id",
    ignoreDuplicates: true,
    count: "exact",
  });
  throwIf(error);

  // Existing rows are ignored by upsert — promote pooled + bump already-queued to top.
  const placeIds = candidates.map((c) => c.placeId);
  const { error: promoteError } = await supabase
    .from("prospects")
    .update({
      status: "queued_today",
      queued_on: queuedOn,
      query,
      city,
      updated_at: now,
    })
    .in("place_id", placeIds)
    .in("status", ["pooled", "queued_today"]);
  throwIf(promoteError);

  return count ?? rows.length;
}

export async function updateSitePreviews(
  previews: Map<string, HuntSitePreview>
): Promise<void> {
  if (!previews.size) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  await Promise.all(
    [...previews.entries()].map(async ([placeId, preview]) => {
      const { error } = await supabase
        .from("prospects")
        .update({
          site_title: preview.title,
          site_description: preview.description,
          site_cms: preview.cms,
          site_signal: preview.signal,
          site_previewed_at: now,
          updated_at: now,
        })
        .eq("place_id", placeId)
        .in("status", ["pooled", "queued_today"]);
      throwIf(error);
    })
  );
}

/** Skip everything currently in the review list (pooled + queued). */
export async function clearActiveReview(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    })
    .in("status", ["pooled", "queued_today"])
    .select("id");
  throwIf(error);
  return data?.length ?? 0;
}

export async function listByStatus(status: ProspectStatus): Promise<Prospect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });
  throwIf(error);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function listQueuedOn(date: string): Promise<Prospect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("queued_on", date)
    .eq("status", "queued_today")
    .order("updated_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** All prospects waiting for Keep/Skip (queued + any legacy pooled). Newest first. */
export async function listActiveReview(): Promise<Prospect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .in("status", ["queued_today", "pooled"])
    .order("updated_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function queueProspects(ids: string[], date: string): Promise<void> {
  if (!ids.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({
      status: "queued_today",
      queued_on: date,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  throwIf(error);
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIf(error);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function markKept(id: string, leadId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({
      status: "kept",
      lead_id: leadId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  throwIf(error);
}

export async function markSkipped(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  throwIf(error);
}

export async function listTerminalPlaceIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("place_id")
    .in("status", ["kept", "skipped"]);
  throwIf(error);
  return (data ?? []).map((r) => r.place_id as string);
}
