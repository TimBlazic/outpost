import { after } from "next/server";

import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getLeadById, getLeads } from "@/lib/store";
import { applyQualifyToLead } from "./apply";

export type LeadQualifyJobStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export const MAX_QUALIFY_ATTEMPTS = 3;
export const BULK_QUALIFY_CAP = 200;

export function isLeadQualifyEligible(lead: {
  website?: string | null;
  company?: string | null;
  qualifyScore?: number | null;
  tags?: string[];
}) {
  const hasHandle =
    Boolean((lead.website ?? "").trim()) || Boolean((lead.company ?? "").trim());
  if (!hasHandle) return false;
  if (lead.qualifyScore != null) return false;
  if ((lead.tags ?? []).includes("qualified")) return false;
  return true;
}

export function scheduleLeadQualifyFlush(): void {
  try {
    after(async () => {
      try {
        await flushLeadQualifyJobs();
      } catch (err) {
        console.error("[lead-qualify] after flush failed", err);
      }
    });
  } catch {
    void flushLeadQualifyJobs().catch((err) => {
      console.error("[lead-qualify] flush failed", err);
    });
  }
}

export async function enqueueLeadQualify(
  leadId: string,
  opts?: { force?: boolean }
): Promise<{ enqueued: boolean; reason?: string }> {
  if (!hasAdminClient()) {
    return { enqueued: false, reason: "no_admin" };
  }

  const lead = await getLeadById(leadId);
  if (!lead) return { enqueued: false, reason: "not_found" };

  const force = Boolean(opts?.force);
  const hasHandle =
    Boolean(lead.website?.trim()) || Boolean(lead.company?.trim());
  if (force) {
    if (!hasHandle) {
      return { enqueued: false, reason: "no_company_or_website" };
    }
  } else if (!isLeadQualifyEligible(lead)) {
    if (!hasHandle) {
      return { enqueued: false, reason: "no_company_or_website" };
    }
    return { enqueued: false, reason: "already_qualified" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("lead_qualify_jobs").insert({
    lead_id: leadId,
    status: "pending",
  });

  if (error) {
    if (
      error.code === "23505" ||
      /duplicate|unique/i.test(error.message ?? "")
    ) {
      return { enqueued: false, reason: "already_queued" };
    }
    console.error("[lead-qualify] enqueue failed", error.message);
    return { enqueued: false, reason: "error" };
  }

  scheduleLeadQualifyFlush();
  return { enqueued: true };
}

export async function countActiveQualifyJobs(): Promise<{
  pending: number;
  running: number;
}> {
  if (!hasAdminClient()) return { pending: 0, running: 0 };
  const supabase = createAdminClient();
  const [pendingRes, runningRes] = await Promise.all([
    supabase
      .from("lead_qualify_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("lead_qualify_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
  ]);
  return {
    pending: pendingRes.count ?? 0,
    running: runningRes.count ?? 0,
  };
}

export async function isLeadQualifyQueued(leadId: string): Promise<boolean> {
  if (!hasAdminClient()) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lead_qualify_jobs")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["pending", "running"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function flushLeadQualifyJobs(): Promise<{
  processed: number;
  done: number;
  skipped: number;
  failed: number;
}> {
  const result = { processed: 0, done: 0, skipped: 0, failed: 0 };
  if (!hasAdminClient()) return result;

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: running } = await supabase
    .from("lead_qualify_jobs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (running) return result;

  const { data: next } = await supabase
    .from("lead_qualify_jobs")
    .select("id, lead_id, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) return result;

  const { data: claimed } = await supabase
    .from("lead_qualify_jobs")
    .update({ status: "running", updated_at: now })
    .eq("id", next.id)
    .eq("status", "pending")
    .select("id, lead_id, attempts")
    .maybeSingle();

  if (!claimed) return result;
  result.processed = 1;

  try {
    const lead = await getLeadById(claimed.lead_id as string);
    if (!lead?.website?.trim() && !lead?.company?.trim()) {
      await supabase
        .from("lead_qualify_jobs")
        .update({
          status: "skipped",
          last_error: "no_company_or_website",
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      result.skipped = 1;
      scheduleLeadQualifyFlush();
      return result;
    }

    await applyQualifyToLead(claimed.lead_id as string);
    await supabase
      .from("lead_qualify_jobs")
      .update({
        status: "done",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    result.done = 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "qualify failed";
    const attempts = (claimed.attempts ?? 0) + 1;
    if (attempts >= MAX_QUALIFY_ATTEMPTS) {
      await supabase
        .from("lead_qualify_jobs")
        .update({
          status: "failed",
          attempts,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      result.failed = 1;
    } else {
      await supabase
        .from("lead_qualify_jobs")
        .update({
          status: "pending",
          attempts,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      result.failed = 1;
    }
  }

  // Chain next pending job after this request finishes.
  scheduleLeadQualifyFlush();
  return result;
}

export async function bulkEnqueueUnscoredLeads(): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const leads = await getLeads();
  const eligible = leads
    .filter(isLeadQualifyEligible)
    .slice(0, BULK_QUALIFY_CAP);
  let enqueued = 0;
  let skipped = 0;
  for (const lead of eligible) {
    const res = await enqueueLeadQualify(lead.id);
    if (res.enqueued) enqueued += 1;
    else skipped += 1;
  }
  const remainder = leads.filter(isLeadQualifyEligible).length - eligible.length;
  skipped += Math.max(0, remainder);
  return { enqueued, skipped };
}

export async function bulkEnqueueSelectedLeads(leadIds: string[]): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const unique = [...new Set(leadIds.filter(Boolean))].slice(
    0,
    BULK_QUALIFY_CAP
  );
  let enqueued = 0;
  let skipped = 0;
  for (const id of unique) {
    const res = await enqueueLeadQualify(id);
    if (res.enqueued) enqueued += 1;
    else skipped += 1;
  }
  return { enqueued, skipped };
}
