# Bulk + Auto Lead Qualify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durably auto-qualify new leads with a website and bulk-enqueue existing unscored leads, processing one job at a time on the server.

**Architecture:** `lead_qualify_jobs` table + enqueue helper + flush (1 job) via `after()` and cron. Extract session-free `applyQualifyToLead` from today’s `qualifyExistingLeadAction`. Wire create/inbound/Hunt + Leads list bulk UI. Client `enqueueQualify` becomes a thin server call.

**Tech Stack:** Next.js App Router (`after`), Supabase service role, existing `qualifyLead` / background apply, Vercel cron + `CRON_SECRET`.

**Spec:** `docs/superpowers/specs/2026-07-26-bulk-auto-qualify-design.md`

## Global Constraints

- Auto enqueue only when website non-empty AND `qualifyScore == null` AND tags lack `qualified`
- Max **1** running job at a time
- Apply semantics unchanged from background qualify (`go` / `maybe` / `no-go` mapping)
- Qualify URL wizard save must **not** double-enqueue
- Unique pending|running job per lead
- Bulk “all” cap 200 per click; return enqueued/skipped counts
- Do not commit unless the user explicitly asks
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` before using `after()`

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260726210000_lead_qualify_jobs.sql` | Jobs table + indexes + RLS |
| `src/lib/qualify/jobs.ts` | Types, eligibility, enqueue, flush, schedule |
| `src/lib/qualify/apply.ts` | Session-free `applyQualifyToLead(leadId)` (extracted apply body) |
| `src/lib/qualify/actions.ts` | Studio wrappers: enqueue action, bulk actions, thin `qualifyExistingLeadAction` |
| `src/app/api/cron/lead-qualify/route.ts` | Cron flush |
| `vercel.json` | Add cron path |
| `src/lib/actions.ts` | `createLead` → enqueue when eligible |
| `src/lib/inbound/leads.ts` | Optional `website`; enqueue after create |
| `src/lib/hunt/actions.ts` | Enqueue after Keep (new + existing) |
| `src/lib/qualify/queue.ts` | Client → server enqueue; poll count optional |
| `src/components/leads-bulk-qualify.tsx` | Unscored button + selected bar + queue badge |
| `src/components/leads-view.tsx` | Checkboxes + wire bulk UI |
| `src/app/leads/page.tsx` | Mount bulk controls / pass initial queue count |
| `docs/SETUP-SUPABASE.md` | Migration + cron note |

---

### Task 1: Migration + eligibility helpers

**Files:**
- Create: `supabase/migrations/20260726210000_lead_qualify_jobs.sql`
- Create: `src/lib/qualify/jobs.ts` (types + `isLeadQualifyEligible` first; enqueue/flush in Task 2–3)

**Interfaces:**
```ts
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
  qualifyScore?: number | null;
  tags?: string[];
}): boolean;
```

- [ ] **Step 1: Migration**

```sql
create table if not exists public.lead_qualify_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads (id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'done', 'skipped', 'failed'
  )),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_qualify_jobs_pending_idx
  on public.lead_qualify_jobs (created_at)
  where status = 'pending';

create unique index if not exists lead_qualify_jobs_active_lead_uidx
  on public.lead_qualify_jobs (lead_id)
  where status in ('pending', 'running');

alter table public.lead_qualify_jobs enable row level security;
```

- [ ] **Step 2: Eligibility**

```ts
export function isLeadQualifyEligible(lead: {
  website?: string | null;
  qualifyScore?: number | null;
  tags?: string[];
}) {
  if (!(lead.website ?? "").trim()) return false;
  if (lead.qualifyScore != null) return false;
  if ((lead.tags ?? []).includes("qualified")) return false;
  return true;
}
```

- [ ] **Step 3: Apply migration** in Supabase SQL Editor (CLI may be unlinked).

---

### Task 2: Extract `applyQualifyToLead` (session-free)

**Files:**
- Create: `src/lib/qualify/apply.ts`
- Modify: `src/lib/qualify/actions.ts`

**Interfaces:**
```ts
export async function applyQualifyToLead(leadId: string): Promise<{
  rating: QualifyRating;
  status: LeadStatus;
}>;
```

- [ ] **Step 1: Move body** of `qualifyExistingLeadAction` (from lead load through save/activity/note/revalidate) into `applyQualifyToLead` **without** `requireStudioSession`.

- [ ] **Step 2: Thin wrapper**

```ts
export async function qualifyExistingLeadAction(leadId: string) {
  await requireStudioSession();
  return applyQualifyToLead(leadId);
}
```

- [ ] **Step 3: Manual check** — lead detail Qualify still works via old button path once Task 5 rewires queue.

---

### Task 3: Enqueue + flush + cron

**Files:**
- Expand: `src/lib/qualify/jobs.ts`
- Create: `src/app/api/cron/lead-qualify/route.ts`
- Modify: `vercel.json`
- Modify: `docs/SETUP-SUPABASE.md`

**Interfaces:**
```ts
export async function enqueueLeadQualify(
  leadId: string,
  opts?: { force?: boolean } // force=true for explicit button (skip already_qualified? NO — force only bypasses "already scored" for re-run after failure; still need website. Spec: button allowed after failure; skip if no website. For already scored, button may re-run — use force to allow re-qualify from button only.
): Promise<{ enqueued: boolean; reason?: string }>;

export async function flushLeadQualifyJobs(): Promise<{
  processed: number;
  done: number;
  skipped: number;
  failed: number;
}>;

export function scheduleLeadQualifyFlush(): void;

export async function countActiveQualifyJobs(): Promise<number>;
```

**Force rule (lock):**
- Auto/bulk: `force: false` → use `isLeadQualifyEligible`
- Explicit Qualify button: `force: true` → enqueue if website present even if scored (re-run); still dedupe pending|running

- [ ] **Step 1: `enqueueLeadQualify`**
  - `hasAdminClient()` else no-op `{ enqueued: false, reason: "no_admin" }`
  - Load lead; apply eligibility (unless force + website)
  - Insert pending; on unique violation → `{ enqueued: false, reason: "already_queued" }`
  - `scheduleLeadQualifyFlush()`

- [ ] **Step 2: `flushLeadQualifyJobs`**
  - If any `running` exists → return zeros (strict 1-at-a-time)
  - Claim oldest pending → running
  - Call `applyQualifyToLead`
  - Mark done / skipped / failed with retry like portal notifications

- [ ] **Step 3: `scheduleLeadQualifyFlush`** — same `after()` pattern as `src/lib/portal/notifications/schedule.ts`

- [ ] **Step 4: Cron route** — mirror `portal-notifications` with `CRON_SECRET`

- [ ] **Step 5: `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/portal-notifications", "schedule": "* * * * *" },
    { "path": "/api/cron/lead-qualify", "schedule": "* * * * *" }
  ]
}
```

- [ ] **Step 6: Document** migration in SETUP-SUPABASE.md

---

### Task 4: Wire create / inbound / Hunt

**Files:**
- Modify: `src/lib/actions.ts` — end of `createLead`
- Modify: `src/lib/inbound/leads.ts` — optional website + enqueue
- Modify: `src/lib/hunt/actions.ts` — enqueue after Keep
- Modify: `src/lib/qualify/actions.ts` — `saveQualifiedLeadAction` must leave score set (already does) so createLead auto-skip works; **do not** call enqueue there

**Important:** `createLead` is shared. Wizard save passes `qualifyScore` → ineligible → no job. Hunt/manual without score → job.

- [ ] **Step 1: `createLead`** after `saveLeads`:

```ts
if (isLeadQualifyEligible(lead)) {
  const { enqueueLeadQualify, scheduleLeadQualifyFlush } = await import(
    "@/lib/qualify/jobs"
  );
  await enqueueLeadQualify(lead.id);
  // enqueue already schedules flush
}
```

Prefer static imports if `"use server"` file allows (jobs must not pull client modules).

- [ ] **Step 2: Inbound** — add optional `website?: string` to `InboundLeadPayload`; set `lead.website` from it; after persist call `enqueueLeadQualify(leadId)`.

- [ ] **Step 3: `keepProspect`** — after create **or** `alreadyExisted` return, call `enqueueLeadQualify(leadId)` (force false). Remove reliance on client-only queue for durability (Task 5).

- [ ] **Step 4: Verify** — create lead with website → row in `lead_qualify_jobs`; wizard save with score → no new job.

---

### Task 5: Client queue → server + studio actions

**Files:**
- Modify: `src/lib/qualify/queue.ts`
- Modify: `src/lib/qualify/actions.ts` — add `enqueueLeadQualifyAction`, `bulkEnqueueUnscoredLeadsAction`, `bulkEnqueueSelectedLeadsAction`, `getQualifyJobCountsAction`
- Modify: `src/components/qualify-lead-button.tsx`
- Modify: `src/components/hunt-board.tsx` — keep calling `enqueueQualify` (now server-backed)

**Interfaces:**
```ts
// actions.ts
export async function enqueueLeadQualifyAction(
  leadId: string,
  opts?: { force?: boolean }
): Promise<{ enqueued: boolean; reason?: string }>;

export async function bulkEnqueueUnscoredLeadsAction(): Promise<{
  enqueued: number;
  skipped: number;
}>;

export async function bulkEnqueueSelectedLeadsAction(
  leadIds: string[]
): Promise<{ enqueued: number; skipped: number }>;

export async function getQualifyJobCountsAction(): Promise<{
  pending: number;
  running: number;
}>;
```

- [ ] **Step 1: Server actions** with `requireStudioSession` for bulk/UI enqueue; cron uses jobs.flush directly.

- [ ] **Step 2: Rewrite `enqueueQualify`**

```ts
"use client";
import { enqueueLeadQualifyAction } from "./actions";
// keep subscribe API for badge: poll getQualifyJobCountsAction every few seconds
export function enqueueQualify(leadId: string, force = false) {
  void enqueueLeadQualifyAction(leadId, { force }).then(() => notifyFromServer());
}
```

Remove in-tab `pump` / `qualifyExistingLeadAction` from client queue (no double apply).

- [ ] **Step 3: Qualify button** — `enqueueQualify(leadId, true)` (force re-run).

- [ ] **Step 4: Hunt** — keep `enqueueQualify(result.leadId)` after Keep (server dedupes with createLead enqueue).

---

### Task 6: Leads list bulk UI

**Files:**
- Create: `src/components/leads-bulk-qualify.tsx`
- Modify: `src/components/leads-view.tsx`
- Modify: `src/app/leads/page.tsx` (optional header slot)

**UI:**
1. Header control **Qualify unscored** → confirm → `bulkEnqueueUnscoredLeadsAction` → toast/inline “Enqueued N (skipped M)”
2. Checkbox column on table rows; when selection non-empty, bar with **Qualify selected**
3. Badge when `pending + running > 0`: “Qualifying · N”

- [ ] **Step 1: Implement bulk component** (client) using existing Button/Dialog patterns from the app.

- [ ] **Step 2: Wire selection state** in `LeadsView` (or lift into bulk wrapper). Match existing table styles — no new design system.

- [ ] **Step 3: Poll counts** every 5s while N > 0, else every 30s / on mount.

- [ ] **Step 4: Manual QA**
  1. Unscored leads with websites → Qualify unscored → jobs appear → scores fill over time  
  2. Select 2 → Qualify selected  
  3. Lead without website skipped  
  4. Close browser mid-queue → cron continues  
  5. Wizard qualify URL → no duplicate job  

---

### Task 7: Spec polish

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-bulk-auto-qualify-design.md` → Status `Implemented`
- Modify: `docs/superpowers/specs/2026-07-26-background-qualify-design.md` — note queue superseded by server jobs; apply rules still valid

- [ ] **Step 1: Update statuses** after smoke.  
- [ ] **Step 2: Stop** — ask user before commit.

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| Auto on create with website | 4 |
| Inbound with optional website | 4 |
| Hunt Keep durable | 4 + 5 |
| Bulk all + selected | 5–6 |
| 1-at-a-time worker | 3 |
| Skip scored / qualified | 1 eligibility |
| No double wizard qualify | 4 (score set) |
| Cron + after | 3 |
| Apply semantics unchanged | 2 |

## Self-review notes

- Inbound today always empty website — Task 4 adds optional field so auto path is real.  
- `force` on detail button allows re-qualify; bulk/auto never force.  
- No vitest in repo — manual QA.  
