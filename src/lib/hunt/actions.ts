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
import { fetchHuntPreviewsForWebsites } from "./preview";
import * as repo from "./repo";
import type { Prospect } from "./types";

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

async function resolveKnownActive(
  active: Prospect[],
  index: HuntKnownIndex
): Promise<void> {
  for (const p of active) {
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

/** Search Places and put results straight into the review list (not a waiting pool). */
export async function searchAndPool(query: string, city: string) {
  await requireStudioSession();
  assertHuntReady();
  const q = query.trim();
  const c = city.trim();
  if (!q || !c) throw new Error("Query and city are required");

  const today = huntToday();
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

  const imported = await repo.upsertQueuedCandidates(c, q, filtered, today);

  const previews = await fetchHuntPreviewsForWebsites(
    filtered.map((f) => ({ placeId: f.placeId, website: f.website }))
  );
  await repo.updateSitePreviews(previews);

  revalidatePath("/hunt");
  return {
    imported,
    skippedKnown,
    fetched: candidates.length,
    previewed: previews.size,
  };
}

export async function clearHuntReview() {
  await requireStudioSession();
  assertHuntReady();
  const cleared = await repo.clearActiveReview();
  revalidatePath("/hunt");
  return { cleared };
}

/** Clean known hits from the active review list; return what remains. */
export async function ensureTodayQueue(): Promise<Prospect[]> {
  await requireStudioSession();
  assertHuntReady();
  const leads = await getLeads();
  const index = buildHuntKnownIndex(leads, await repo.listTerminalPlaceIds());

  let active = await repo.listActiveReview();
  await resolveKnownActive(active, index);
  return repo.listActiveReview();
}

export async function getHuntPageData() {
  await requireStudioSession();
  if (!isSupabaseEnabled()) {
    return {
      enabled: false as const,
      today: [] as Prospect[],
      reviewCount: 0,
    };
  }
  const today = await ensureTodayQueue();
  return {
    enabled: true as const,
    today,
    reviewCount: today.length,
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
    source: "Cold email",
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
