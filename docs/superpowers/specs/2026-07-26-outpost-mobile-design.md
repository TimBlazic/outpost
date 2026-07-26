# Outpost Mobile (Expo) — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** Studio-only Expo daily driver — Dashboard, Leads, Messages, Projects/Tickets — sheet-first, brand-matched.

## Goal

Use Outpost on the phone for the daily loop: see what needs attention, update leads, chat with clients on projects, and manage tickets — without rebuilding the whole web product.

## Locked decisions

| Topic | Choice |
|--------|--------|
| Audience | Studio only (Admin/Member); no client portal app in v1 |
| v1 tabs | Home · Leads · Projects · Messages |
| Stack | Expo + Expo Router + React Native |
| Navigation | Tabs + sheets/modals for detail/create/edit |
| Brand | Cream/ink editorial tokens; display italic titles; glass sheets when available |
| Data | Supabase JS with user JWT; Next API with Bearer for chat sync |
| Out of v1 | Hunt, Quotes/Invoices AI, Docs AI, Moodboard, client portal, kanban DnD |

## Architecture

- App lives in sibling repo `/Users/timblazic/Developer/Projects/outpost-mobile` (not nested in the web app)
- Auth: Supabase email/password + SecureStore session
- Lists/CRUD: direct Supabase (authenticated RLS)
- Chat mark-read / sync: existing Next `/api/chat/*` with `Authorization: Bearer <access_token>`
- Types: local `types.ts` mirrored from web `src/lib/data.ts` for v1 (no Turborepo extract yet)

## UX

- **Home:** follow-ups due, open tickets count, unread messages
- **Leads:** search + list; detail sheet; status change
- **Projects:** list; detail sheet with tickets; ticket detail sheet (status/priority)
- **Messages:** thread list → conversation (pushed or tall sheet); realtime
- Sheets preferred over new stack pages; liquid glass / blur fallback

## Success

Tim can run the daily studio loop from the phone with Outpost look-and-feel.
