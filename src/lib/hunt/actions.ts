"use server";

import { revalidatePath } from "next/cache";

import { createLead } from "@/lib/actions";
import { requireStudioSession } from "@/lib/auth/session";
import {
  findLeadIdByWebsiteHost,
  websiteHost,
} from "@/lib/qualify/url";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { getLeads } from "@/lib/store";
import { huntToday } from "./date";
import {
  buildHuntKnownIndex,
  matchKnown,
  type HuntKnownIndex,
} from "./known";
import { searchPlaces } from "./places";
import * as repo from "./repo";
import type { Prospect } from "./types";

const DAILY = 5;

function assertHuntReady() {
  if (!isSupabaseEnabled()) {
    throw new Error(
      "Hunt requires Supabase. Configure env and run migrations."
    );
  }
}

async function resolveKnownHit(
  prospectId: string,
  hit: NonNullable<ReturnType<typeof matchKnown>>
) {
  if (hit.kind === "website" || hit.kind === "name_city") {
    await repo.markKept(prospectId, hit.leadId);
  } else {
    await repo.markSkipped(prospectId);
  }
}

async function resolveKnownQueued(
  queued: Prospect[],
  index: HuntKnownIndex
): Promise<void> {
  for (const p of queued) {
    const hit = matchKnown(index, {
      placeId: p.placeId,
      name: p.name,
      city: p.city,
      website: p.website,
    });
    if (!hit) continue;
    await resolveKnownHit(p.id, hit);
  }
}

export async function searchAndPool(query: string, city: string) {
  await requireStudioSession();
  assertHuntReady();
  const q = query.trim();
  const c = city.trim();
  if (!q || !c) throw new Error("Query and city are required");

  const candidates = await searchPlaces(q, c);
  const leads = await getLeads();
  const index = buildHuntKnownIndex(leads, await repo.listTerminalPlaceIds());
  let skippedKnown = 0;
  const filtered = candidates.filter((cand) => {
    const hit = matchKnown(index, {
      placeId: cand.placeId,
      name: cand.name,
      city: c,
      website: cand.website,
    });
    if (hit) {
      skippedKnown += 1;
      return false;
    }
    return true;
  });

  const imported = await repo.upsertPooledCandidates(c, q, filtered);
  await ensureTodayQueue();
  revalidatePath("/hunt");
  return { imported, skippedKnown, fetched: candidates.length };
}

export async function ensureTodayQueue(): Promise<Prospect[]> {
  await requireStudioSession();
  assertHuntReady();
  const today = huntToday();
  const leads = await getLeads();
  const index = buildHuntKnownIndex(leads, await repo.listTerminalPlaceIds());

  let queued = await repo.listQueuedOn(today);
  await resolveKnownQueued(queued, index);
  queued = await repo.listQueuedOn(today);

  if (queued.length >= DAILY) return queued;

  const need = DAILY - queued.length;
  const pooled = await repo.listByStatus("pooled");
  const pick: string[] = [];
  for (const p of pooled) {
    if (pick.length >= need) break;
    const hit = matchKnown(index, {
      placeId: p.placeId,
      name: p.name,
      city: p.city,
      website: p.website,
    });
    if (hit) {
      await resolveKnownHit(p.id, hit);
      continue;
    }
    pick.push(p.id);
  }
  await repo.queueProspects(pick, today);
  return repo.listQueuedOn(today);
}

export async function getHuntPageData() {
  await requireStudioSession();
  if (!isSupabaseEnabled()) {
    return {
      enabled: false as const,
      today: [] as Prospect[],
      pooledCount: 0,
    };
  }
  const today = await ensureTodayQueue();
  const pooled = await repo.listByStatus("pooled");
  return {
    enabled: true as const,
    today,
    pooledCount: pooled.length,
  };
}

export async function keepProspect(id: string) {
  const me = await requireStudioSession();
  assertHuntReady();
  const p = await repo.getProspect(id);
  if (!p || p.status === "kept" || p.status === "skipped") {
    throw new Error("Prospect not available");
  }
  if (p.website) {
    try {
      const host = websiteHost(p.website);
      const existing = findLeadIdByWebsiteHost(await getLeads(), host);
      if (existing) {
        await repo.markKept(id, existing);
        try {
          const { enqueueLeadQualify } = await import("@/lib/qualify/jobs");
          await enqueueLeadQualify(existing);
        } catch {
          /* ignore */
        }
        revalidatePath("/hunt");
        revalidatePath("/leads");
        return { leadId: existing, alreadyExisted: true as const };
      }
    } catch {
      /* continue */
    }
  }

  const website = p.website?.trim() ?? "";
  const leadId = await createLead({
    company: p.name,
    website,
    contact: "",
    email: "",
    phone: "",
    country: "Slovenia",
    category: "Local business",
    source: "Website",
    ownerId: me.id,
    status: "New",
    value: 0,
    probability: 10,
    nextFollowUp: null,
    tags: ["hunt"],
    description: [
      p.address ? `Address: ${p.address}` : null,
      p.mapsUrl ? `Maps: ${p.mapsUrl}` : null,
      p.query
        ? `Found via Hunt: ${p.query}${p.city ? ` in ${p.city}` : ""}`
        : "Found via Hunt",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  await repo.markKept(id, leadId);
  revalidatePath("/hunt");
  revalidatePath("/leads");
  return { leadId, alreadyExisted: false as const };
}

export async function skipProspect(id: string) {
  await requireStudioSession();
  assertHuntReady();
  const p = await repo.getProspect(id);
  if (!p) throw new Error("Prospect not found");
  await repo.markSkipped(id);
  revalidatePath("/hunt");
}
