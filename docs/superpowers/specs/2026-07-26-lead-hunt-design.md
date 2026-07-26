# Lead Hunt (Hybrid Discovery) — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** C — Search fills a prospect pool; daily Hunt serves ~5 to Keep / Skip

## Goal

Help find **new** outreach targets when the pipeline is empty — without leaving Outpost for Google/Maps tabs.

**Search (industry + city) → prospect pool → daily Hunt of ~5 → Keep (lead) / Skip**

Manual sourcing (walk, IG, Google) stays valid; Hunt is the in-app discovery loop.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Shape | Hybrid (search + daily queue) |
| Daily size | 5 prospects |
| Keep | Create lead (`New`); do **not** auto-open Qualify |
| Skip | Remove from pool; never show again |
| Card fields (v1) | Name, address/city, website (if any), Maps link |
| Data source (v1) | Google Places API (Text Search / Nearby-style by query) |
| Companywall / site scrape | Out of scope on Hunt; use Qualify after Keep if wanted |
| Auto email | Out of scope |
| Sidebar | New **Hunt** nav item near Leads |

## User flow

### Search → pool

1. Open **Hunt**
2. Enter **industry/query** (e.g. `frizerski salon`) + **city** (e.g. `Maribor`)
3. Run search → results merge into **prospect pool** (dedupe by place id)
4. Already-skipped / already-kept / existing lead websites are excluded from new imports

### Daily Hunt

1. Hunt section shows up to **5** pool items for “today”
2. Per card: **Keep** | **Skip** | open Maps / website
3. When today’s five are done: calm empty state (“Come back tomorrow” or “Search to refill”)
4. If pool empty before 5: CTA to run Search

### Keep

- Create lead with: `company`, `website` (normalized host if present), `status: New`, short note/source tag e.g. `hunt`, optional address in description/notes
- Stay on Hunt (toast + next card). No forced Qualify.

### Skip

- Mark prospect `skipped` with timestamp
- Never return in Hunt or Search import

## Data model

### `prospects` (Supabase)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `place_id` | text | Google place id, unique |
| `name` | text | |
| `address` | text | nullable |
| `city` | text | nullable / from search |
| `website` | text | nullable |
| `maps_url` | text | nullable |
| `query` | text | search query used |
| `status` | text | `pooled` \| `queued_today` \| `kept` \| `skipped` |
| `queued_on` | date | nullable — which local day it was served |
| `lead_id` | text | nullable — set on Keep |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Studio-only; same auth posture as other CRM tables (authenticated studio user).

### Firm / session prefs (optional v1)

Remember last `query` + `city` in localStorage or `firm_settings` JSON — nice-to-have, not blocking.

## Provider

- Env: `GOOGLE_PLACES_API_KEY` (server-only)
- Server action: `searchProspects({ query, city })` → Places Text Search  
  Query shape: `"{query} in {city}"` (SI-friendly free text)
- Map result → prospect rows; upsert on `place_id`
- Rate / cost: user-triggered search only; no cron in v1
- Daily queue: pick up to 5 `pooled` not skipped/kept, set `queued_on = today`, status `queued_today`

If Places key missing: clear settings-style error on Hunt page.

## UI

### `/hunt`

- Header: title + short line (“Find firms. Review five a day.”)
- **Search** strip: query, city, Search button
- **Today** list: up to 5 cards
- Card: name, address, links, Keep / Skip
- Pool hint: “N waiting in pool” (optional)

Nav: sidebar **Hunt** (icon: Binoculars / Compass), command palette “Hunt”.

Visual: match studio (no new design system); cards consistent with leads density, not moodboard flip aesthetic.

## Edge cases

| Case | Behavior |
|------|----------|
| Duplicate place | Upsert; don’t double-queue |
| Website matches existing lead | Skip import or mark already-known; don’t Keep twice |
| No website | Keep still allowed (company + address only) |
| Search returns 0 | Empty state on search |
| Midday Keep then refresh | Same day’s remaining queue persists via `queued_on` |
| Timezone | Use Europe/Ljubljana (or server local date consistent with app) for “today” |

## Out of scope (v1)

- Instagram / walking capture
- Auto-refill cron
- Website quality scoring / Lighthouse on prospects
- Companywall at Hunt time
- Mobile-specific PWA
- Sharing pool with clients

## Success

- Stuck day: Search once → Hunt five without leaving Outpost  
- Keep lands a usable `New` lead in under two clicks  
- Skip permanently clears noise  

## Implementation notes

- New: `src/app/hunt/page.tsx`, `src/lib/hunt/*`, migration for `prospects`
- Wire `createLead` on Keep; reuse URL normalization helpers if present from Qualify
- Docs: `SETUP-SUPABASE.md` + env for Places key
