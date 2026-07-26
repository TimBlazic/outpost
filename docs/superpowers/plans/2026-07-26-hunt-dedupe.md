# Hunt Dedupe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude from Hunt Search and daily queue any prospect already skipped/kept, or matching an existing lead by website host or normalized name+city.

**Architecture:** Pure matcher in `src/lib/hunt/known.ts` builds lookaside sets from leads + terminal place ids. `searchAndPool` and `ensureTodayQueue` call it before import/queue; queued-today items that become known are auto-resolved (`kept`/`skipped`) and the queue refilled.

**Tech Stack:** Existing Hunt + Qualify helpers (`normalizeCompanyText`, `websiteHost`), Supabase prospects, Next.js server actions.

**Spec:** `docs/superpowers/specs/2026-07-26-hunt-dedupe-design.md`

## Global Constraints

- Soft match requires **both** normalized name and city; no name-only soft match
- Lead without city signal → soft match off (website / place_id only)
- All lead statuses count (Lost, Not suitable, `no-go` included)
- No new tables / migrations
- No new UI screens (optional status copy only)
- Do not commit unless the user explicitly asks
- Verify with `npx tsc --noEmit` (no unit test runner in repo)

## File map

| Path | Responsibility |
|------|----------------|
| `src/lib/hunt/known.ts` | Build known index + `isKnownCandidate` / resolve matches |
| `src/lib/hunt/actions.ts` | Wire filter into search, queue, queued cleanup |
| `src/lib/qualify/companywall.ts` | Reuse `normalizeCompanyText` (import only) |
| `src/lib/qualify/url.ts` | Reuse `websiteHost` (import only) |

---

### Task 1: Known matcher helpers

**Files:**
- Create: `src/lib/hunt/known.ts`

**Interfaces:**
- Consumes: `Lead` from `@/lib/data`; `normalizeCompanyText` from `@/lib/qualify/companywall`; `websiteHost` from `@/lib/qualify/url`
- Produces:
  - `extractLeadCitySignal(lead: Lead): string | null`
  - `type HuntKnownIndex = { terminalPlaceIds: Set<string>; hosts: Map<string, string>; nameCity: Map<string, string> }`
  - `buildHuntKnownIndex(leads: Lead[], terminalPlaceIds: string[]): HuntKnownIndex`
  - `type HuntMatchInput = { placeId: string; name: string; city: string | null; website: string | null }`
  - `matchKnown(index: HuntKnownIndex, input: HuntMatchInput): { kind: "place" } | { kind: "website"; leadId: string } | { kind: "name_city"; leadId: string } | null`

- [x] **Step 1: Add `src/lib/hunt/known.ts`**

```ts
import type { Lead } from "@/lib/data";
import { normalizeCompanyText } from "@/lib/qualify/companywall";
import { websiteHost } from "@/lib/qualify/url";

export type HuntKnownIndex = {
  terminalPlaceIds: Set<string>;
  /** host → lead id */
  hosts: Map<string, string>;
  /** `${normName}|${normCity}` → lead id */
  nameCity: Map<string, string>;
};

export type HuntMatchInput = {
  placeId: string;
  name: string;
  city: string | null;
  website: string | null;
};

export type HuntKnownMatch =
  | { kind: "place" }
  | { kind: "website"; leadId: string }
  | { kind: "name_city"; leadId: string };

/** City from Address: line in description, else null. */
export function extractLeadCitySignal(lead: Lead): string | null {
  const desc = lead.description ?? "";
  const m = desc.match(/^\s*Address:\s*(.+)$/im);
  if (!m) return null;
  const address = m[1].trim();
  // Prefer last comma-separated segment (often "Street, City" or "…, 2000 Maribor")
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const tail = parts[parts.length - 1] ?? "";
  // Drop leading postal code if present
  const cityish = tail.replace(/^\d{3,5}\s+/, "").trim();
  const norm = normalizeCompanyText(cityish);
  return norm || null;
}

export function buildHuntKnownIndex(
  leads: Lead[],
  terminalPlaceIds: string[]
): HuntKnownIndex {
  const hosts = new Map<string, string>();
  const nameCity = new Map<string, string>();
  for (const lead of leads) {
    if (lead.website?.trim()) {
      try {
        const host = websiteHost(lead.website);
        if (host && !hosts.has(host)) hosts.set(host, lead.id);
      } catch {
        /* ignore bad urls */
      }
    }
    const city = extractLeadCitySignal(lead);
    if (!city) continue;
    const name = normalizeCompanyText(lead.company);
    if (!name) continue;
    const key = `${name}|${city}`;
    if (!nameCity.has(key)) nameCity.set(key, lead.id);
  }
  return {
    terminalPlaceIds: new Set(terminalPlaceIds),
    hosts,
    nameCity,
  };
}

export function matchKnown(
  index: HuntKnownIndex,
  input: HuntMatchInput
): HuntKnownMatch | null {
  if (index.terminalPlaceIds.has(input.placeId)) {
    return { kind: "place" };
  }
  if (input.website?.trim()) {
    try {
      const host = websiteHost(input.website);
      const leadId = index.hosts.get(host);
      if (leadId) return { kind: "website", leadId };
    } catch {
      /* ignore */
    }
  }
  const cityNorm = input.city ? normalizeCompanyText(input.city) : "";
  const nameNorm = normalizeCompanyText(input.name);
  if (cityNorm && nameNorm) {
    const leadId = index.nameCity.get(`${nameNorm}|${cityNorm}`);
    if (leadId) return { kind: "name_city", leadId };
  }
  return null;
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (or only pre-existing unrelated errors). Confirm `known.ts` has no errors.

---

### Task 2: Wire into Hunt actions

**Files:**
- Modify: `src/lib/hunt/actions.ts`

**Interfaces:**
- Consumes: `buildHuntKnownIndex`, `matchKnown` from `./known`; existing `repo`, `getLeads`
- Produces: same exported actions; broader exclusion behavior

- [x] **Step 1: Update `searchAndPool` filter**

Replace the ad-hoc `terminal` + website-only filter with known index:

```ts
import { buildHuntKnownIndex, matchKnown } from "./known";

// inside searchAndPool, after candidates:
const leads = await getLeads();
const index = buildHuntKnownIndex(leads, await repo.listTerminalPlaceIds());
let skippedKnown = 0;
const filtered = candidates.filter((cand) => {
  const hit = matchKnown(index, {
    placeId: cand.placeId,
    name: cand.name,
    city: c, // search city
    website: cand.website,
  });
  if (hit) {
    skippedKnown += 1;
    return false;
  }
  return true;
});
```

Keep return shape `{ imported, skippedKnown, fetched }`.

- [x] **Step 2: Add queued-today cleanup + pool filter in `ensureTodayQueue`**

```ts
async function resolveKnownQueued(
  queued: Prospect[],
  index: ReturnType<typeof buildHuntKnownIndex>
): Promise<void> {
  for (const p of queued) {
    const hit = matchKnown(index, {
      placeId: p.placeId,
      name: p.name,
      city: p.city,
      website: p.website,
    });
    if (!hit) continue;
    if (hit.kind === "website") {
      await repo.markKept(p.id, hit.leadId);
    } else if (hit.kind === "name_city") {
      await repo.markKept(p.id, hit.leadId);
    } else {
      await repo.markSkipped(p.id);
    }
  }
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
      if (hit.kind === "website" || hit.kind === "name_city") {
        await repo.markKept(p.id, hit.leadId);
      } else {
        await repo.markSkipped(p.id);
      }
      continue;
    }
    pick.push(p.id);
  }
  await repo.queueProspects(pick, today);
  return repo.listQueuedOn(today);
}
```

Notes:
- Rebuild terminal set is not required mid-loop for correctness if we mark rows immediately; next Search uses fresh terminal list.
- `name_city` → `markKept` with lead id (same as website) so they leave the pool as terminal `kept`.

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS for hunt modules.

- [ ] **Step 4: Manual smoke (dev)**

1. Skip a Hunt card → refresh / re-Search same query+city → that place does not return.
2. Keep (or existing lead with same website) → Search does not re-import.
3. Lead with `Address: …, Maribor` and company matching a Places name → Search in Maribor skips it (`skippedKnown` increases).
4. Lead with same name but no Address city → still may appear until Skip (expected).

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Skip/kept place_id | Task 1 + 2 (terminal set) |
| Website vs all leads | Task 1 + 2 |
| Soft name+city both required | Task 1 |
| Lead without city → no soft | Task 1 (`extractLeadCitySignal`) |
| Filter on Search | Task 2 Step 1 |
| Filter on daily queue | Task 2 Step 2 |
| Cleanup queued-today ghosts | Task 2 Step 2 |
| No new migration / UI | N/A (none) |

## Placeholder / consistency check

- Match kinds: `place` | `website` | `name_city` used consistently.
- `markKept` / `markSkipped` already exist on repo.
- City signal limited to `Address:` line from Hunt Keep descriptions — consistent with how Hunt writes leads today.
