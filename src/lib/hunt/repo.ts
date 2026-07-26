import { createClient } from "@/lib/supabase/server";
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function upsertPooledCandidates(
  city: string,
  query: string,
  candidates: PlaceCandidate[]
): Promise<number> {
  const supabase = await createClient();
  const rows = candidates.map((c) => ({
    place_id: c.placeId,
    name: c.name,
    address: c.address,
    city,
    website: c.website,
    maps_url: c.mapsUrl,
    query,
    status: "pooled",
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return 0;
  const { error, count } = await supabase
    .from("prospects")
    .upsert(rows, {
      onConflict: "place_id",
      ignoreDuplicates: true,
      count: "exact",
    });
  throwIf(error);
  return count ?? rows.length;
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
    .order("created_at", { ascending: true });
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
