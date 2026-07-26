# Background Qualify (auto-apply) — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

## Goal

After Hunt **Keep** (and from lead detail), run the existing Qualify research pipeline and **auto-apply** results onto the lead — queued, one at a time, without blocking the UI.

## Decisions

| Topic | Choice |
|--------|--------|
| Apply mode | Auto-apply (no review gate) |
| Queue | Client-side sequential queue |
| No website | Skip qualify; Keep still works |
| Verdict → status | go → Ready to contact; maybe → Researching; no-go → leave status, add tag `no-go` |
| Draft | Save as pinned note |
| Manual entry | **Qualify lead** on lead detail page + drawer |

## Apply fields

- `description` ← research markdown  
- `company`, `contact`, `email`, `phone`, `country`, `category`, `value` from suggested when non-empty  
- `status` per mapping above  
- tags: ensure `qualified` (and `no-go` if applicable); keep `hunt` if present  
- activity: “Qualified in background”  
- note: cold email draft (subject as title)

## Out of scope

- Server job table / cron  
- Progress UI beyond queue count on Hunt  
- Changing the interactive Qualify URL wizard review gate  
