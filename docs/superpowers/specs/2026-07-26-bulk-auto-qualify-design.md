# Bulk + Auto Lead Qualify — Design

**Date:** 2026-07-26  
**Status:** Implemented  
**Related:** `2026-07-26-background-qualify-design.md` (client queue / auto-apply semantics — still the apply rules; **queue durability moves server-side here**)

## Goal

1. **Auto-enqueue** research/qualify when a lead enters with a website (manual, inbound, Hunt Keep), unless already qualified.  
2. **Bulk enqueue** existing unscored leads (“all” + multi-select) so backfill does not require opening each lead.  
3. Process jobs **durably** on the server, **one at a time**, reusing the existing background auto-apply pipeline.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Architecture | Hybrid: DB job queue + `after()` flush + cron safety net |
| Auto enqueue | Any create path with website, if `qualifyScore == null` and no tag `qualified` |
| No website | Skip (no job) |
| Already scored / `qualified` | Skip auto + bulk (manual re-qualify on lead detail stays) |
| Bulk UI | “Qualify unscored” (all matching) **and** multi-select → “Qualify selected” |
| Concurrency | **1** running job at a time |
| Apply semantics | Same as background qualify (`qualifyExistingLeadAction`): status/score/tags/description/draft note |
| Interactive Qualify URL wizard | Unchanged (review gate); do **not** double-enqueue after save |
| Client queue | Thin wrapper → server enqueue (or retire tab-local pump once server is live) |

## Triggers

| Source | Enqueue? |
|--------|----------|
| `createLead` (manual form) | Yes if website + not already qualified |
| `POST /api/leads/inbound` | Yes if website present + not already qualified |
| Hunt Keep (`keepProspect` → lead) | Yes if website + not already qualified |
| Qualify URL wizard → `saveQualifiedLeadAction` | **No** (already researched at create) |
| Lead detail **Qualify lead** button | Yes (explicit; allowed even if previously failed; still skip if no website) |
| Bulk “unscored” / selected | Yes per lead matching filters |

### Unqualified predicate (bulk “all”)

```
website is non-empty
AND qualifyScore IS NULL
AND tags does not include "qualified"
```

Selected bulk: same skips per lead (no website → count as skipped in result toast, not failed).

## Architecture

```
createLead / inbound / Hunt Keep / bulk UI / Qualify button
        │
        ▼
enqueueLeadQualify(leadId)     # skip rules + dedupe pending|running
        │
        ├─ after() → flushLeadQualifyJobs()   # process at most 1
        └─ cron /api/cron/lead-qualify (~1m)
                │
                ▼
        claim pending → running
                │
                ▼
        qualifyExistingLeadAction logic (auto-apply)
                │
                ▼
        done | skipped | failed (retry ≤ 3)
```

### Table `lead_qualify_jobs`

| Column | Notes |
|--------|--------|
| `id` | uuid PK |
| `lead_id` | text FK → `leads.id` ON DELETE CASCADE |
| `status` | `pending` \| `running` \| `done` \| `skipped` \| `failed` |
| `attempts` | int, default 0 |
| `last_error` | text nullable |
| `created_at` / `updated_at` | timestamptz |

Indexes:
- claim: `(status, created_at)` where `status = 'pending'`
- dedupe: unique partial on `lead_id` where `status in ('pending','running')`

RLS: enabled, no client policies — service role / server only (same pattern as `portal_notification_events`).

### Enqueue helper

`enqueueLeadQualify(leadId: string): Promise<{ enqueued: boolean; reason?: string }>`

Reasons: `no_website`, `already_qualified`, `already_queued`, `not_found`.

On success: insert `pending`, then `scheduleLeadQualifyFlush()` via Next `after()`.

### Flush helper

`flushLeadQualifyJobs(): Promise<{ processed, done, skipped, failed }>`

- Claim **one** oldest `pending` → `running` (optimistic update).  
- Load lead; if no website → `skipped`.  
- Run shared auto-apply (extract core from `qualifyExistingLeadAction` so cron does not need a studio browser session — use service/admin path).  
- Success → `done`. Error → increment `attempts`; if `>= 3` → `failed`, else back to `pending` with short backoff.

Cron auth: `Authorization: Bearer CRON_SECRET` (reuse existing secret).  
Route: `src/app/api/cron/lead-qualify/route.ts`  
`vercel.json`: add second cron entry `* * * * *` for that path.

### Client queue migration

- `enqueueQualify(leadId)` in `src/lib/qualify/queue.ts` should call server `enqueueLeadQualifyAction` (and optionally still show local “queued” UX from server pending count).  
- Remove or no-op the in-tab sequential `pump` once server flush is reliable, so Hunt Keep does not double-run.

## UI

### `/leads` list

1. **Qualify unscored** — confirm dialog: “Enqueue N leads with a website and no qualify score?” → server action bulk enqueue.  
2. **Row checkboxes** + sticky bar **Qualify selected** (same skips).  
3. **Queue badge** — “Qualifying · N queued” when pending+running > 0 (light poll / revalidate).

### Lead detail / drawer

Keep **Qualify lead** — enqueues (or re-enqueues after failure). No change to interactive Qualify URL wizard.

## Apply rules (unchanged from background qualify)

- `description` ← research markdown  
- Fill company/contact/email/phone/country/category/value when suggested non-empty  
- Status: `go` → Ready to contact; `maybe` → Researching; `no-go` → leave status + tag `no-go`  
- Tags: ensure `qualified`  
- Activity: e.g. `Qualified in background (go)`  
- Pinned note: cold email draft  

## Out of scope (v1)

- Parallel qualify jobs  
- Hourly rate caps  
- Changing Qualify URL wizard review gate  
- Bulk re-qualify of already scored leads  
- Storing raw HTML / PSI snapshots  
- Email notify on qualify complete  

## Success criteria

1. New manual lead with website gets a job and is scored without opening Qualify UI.  
2. Inbound lead with website enqueues; without website does nothing.  
3. Hunt Keep enqueues server-side (survives tab close).  
4. “Qualify unscored” enqueues all matching leads; worker processes 1-by-1 to completion.  
5. Multi-select qualifies only selected eligible leads.  
6. Already `qualified` / scored leads are not auto-enqueued again.  
7. Wizard-created leads are not double-qualified.

## Open implementation notes

- Extract auto-apply into a session-free `applyQualifyToLead(leadId)` usable from cron.  
- Bulk enqueue should be a single server action with a reasonable cap (e.g. 200 per click) + return `{ enqueued, skipped }` counts.  
- Supersede background-qualify “no server job table” decision for durability; keep its apply mapping.  
