# Hunt dedupe (broader exclusion) — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Parent:** [Lead Hunt design](./2026-07-26-lead-hunt-design.md)

**Approach:** B — hard IDs (place_id + website) + soft name+city against all leads

## Goal

Hunt must not re-recommend businesses the studio has already skipped, kept, contacted, locked in, lost, or marked no-go / not suitable. Skip stays durable in DB; exclusion also covers every existing lead.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Scope | Skip/Keep terminal prospects + **all** leads (any status, including Lost / Not suitable / tag `no-go`) |
| Hard match | `place_id` in `kept` \| `skipped`; website host vs any lead |
| Soft match | Normalized company name **and** city both required |
| Lead without city signal | Soft match **off** — only website / place_id |
| Fuzzy / partial names | Out of scope |
| Manual blocklist UI | Out of scope |
| Clients / projects | Out of scope (leads only) |

## Exclusion rules

A Place candidate or pooled prospect is **known** (exclude) if any of:

1. Prospect `status` is `skipped` or `kept` (same `place_id`)
2. Candidate/prospect website host matches any lead website host
3. Soft: `normalizeCompanyText(name)` equals a lead’s normalized company **and** prospect city is present **and** that city appears as a signal on the lead

### Soft name+city details

- Reuse `normalizeCompanyText` from Qualify/Companywall helpers (strip diacritics, drop d.o.o./s.p., lowercase, collapse non-alnum).
- Prospect city: Hunt search `city` (and/or prospect.city).
- Lead city signal: city string found in lead fields used for location today — prefer structured fields if present; otherwise substring match of normalized city against lead `description` / address-like text. If no city signal on the lead → do **not** soft-match (website/place_id only).
- Both name and city must match; no name-only soft match.

## When filtering runs

1. **Search import** (`searchAndPool`): filter candidates before upsert; count toward `skippedKnown`.
2. **Daily queue** (`ensureTodayQueue`): when picking from `pooled`, skip known against current leads (covers leads created outside Hunt since import).
3. **Already queued today**: on Hunt load / ensure queue, if a `queued_today` item is now known:
   - website match → mark `kept` with that `lead_id` when possible
   - else → mark `skipped`
   - refill queue toward daily 5 from remaining pooled

Skip action unchanged: `status = skipped`, never return via place_id.

## UI

- No new screens.
- Search feedback may continue to report how many were already known (`skippedKnown`).
- Optional copy tweak only if existing status line is unclear — not required for v1.

## Data model

No new tables or migrations. Uses existing `prospects` statuses and `leads` rows.

## Edge cases

| Case | Behavior |
|------|----------|
| Same business, new Google `place_id`, same website | Excluded via website |
| Same name+city, no website on either side | Soft-excluded |
| Same name, different city | Not soft-excluded |
| Lead exists, no website, no city in description | May still appear until Skip (acceptable) |
| Duplicate Places rows same place_id | Upsert / terminal set as today |

## Out of scope

- Manual “never again” list
- Fuzzy / typo-tolerant name matching
- Matching against clients or projects
- Auto-skip of Lost/no-go without them being leads (they already are leads)

## Success

- Skipping a card never resurfaces that place_id on later Search / Hunt days
- Existing pipeline leads (any status) do not reappear when website or name+city match
- Daily queue does not serve “ghost” cards for businesses already in leads

## Implementation notes

- Shared helper e.g. `src/lib/hunt/known.ts`: build known sets from leads + terminal place ids; `isKnownProspect(candidate | prospect)`
- Wire into `searchAndPool`, `ensureTodayQueue`, and queued-today cleanup
- Unit-testable pure match helpers preferred (normalize + city signal)
