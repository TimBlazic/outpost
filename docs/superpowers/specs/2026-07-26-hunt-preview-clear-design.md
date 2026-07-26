# Hunt preview + clear review — Design

**Date:** 2026-07-26  
**Status:** Approved (approach A)  

## Goal

Decide Keep/Skip on Hunt without opening every website. Also clear the active review list when starting fresh.

## Decisions

| Topic | Choice |
|--------|--------|
| Preview timing | On search (parallel lightweight scrape) |
| Preview fields | `site_title`, `site_description`, `site_signal`, `site_cms` |
| Signal enum | `none` \| `down` \| `dated` \| `ok` \| `modern` |
| AI / Lighthouse | Out of scope on Hunt |
| Clear review | Mark all `pooled` + `queued_today` as `skipped` (confirm dialog). Does not touch `kept`. |

## Flow

1. Search Places → filter known → upsert as `queued_today`
2. For each result with a website: fetch HTML (~5s timeout), extract title/meta, CMS hint, heuristic signal
3. Persist preview on prospect; card shows host, title, meta (2 lines), signal badge, CMS
4. **Clear review** → confirm → skip entire active list

## Heuristic (v1)

- No website → `none`
- Fetch/HTTP fail → `down`
- Strong dated cues (no viewport, layout tables, `<font>`/`marquee`, ancient jQuery) → `dated`
- Modern stack cues (`__NEXT_DATA__`, Webflow, Framer) + viewport/OG → `modern`
- Else → `ok`

## Out of scope

Screenshots, full Qualify, auto-Keep by signal.