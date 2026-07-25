# Leadflow Supabase + Full CRUD Implementation Plan

> **For agentic workers:** Implement task-by-task. Prefer finishing a phase with a working app before starting the next.

**Goal:** Move Leadflow from JSON files to Supabase with invite-only auth, complete CRUD, and attachments.

**Architecture:** Next.js server actions talk to Supabase Postgres; Auth via `@supabase/ssr`; files in private Storage bucket.

**Tech Stack:** Next.js 16, React 19, Supabase JS/SSR, Tailwind/shadcn UI already in repo.

## Global Constraints

- Keep existing UI language and component patterns.
- No commits unless user asks.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Do not commit secrets.

---

## Phase 1 — Foundation

### Task 1: Dependencies + env
- Install `@supabase/supabase-js` `@supabase/ssr`
- Add `.env.local.example`
- Ignore `.env.local` if needed

### Task 2: SQL migration
- `supabase/migrations/20260724120000_init.sql` — tables, FKs, RLS, storage bucket policies, profile trigger

### Task 3: Supabase clients + middleware
- `src/lib/supabase/{client,server,middleware}.ts`
- `src/middleware.ts` — session refresh + auth redirect

### Task 4: Login page
- `/login` + logout action
- Wire `app-shell` user from profile

## Phase 2 — Data + CRUD

### Task 5: Replace `store.ts`
- Query helpers using server Supabase client
- Keep return shapes compatible with existing pages

### Task 6: Expand `actions.ts`
- deleteLead / deleteProject / deleteDoc
- updateNote, full payment CRUD
- cascade storage cleanup in deletes
- revalidatePath as today

### Task 7: UI delete + note edit
- Confirm dialogs on detail pages
- Note edit in lead detail

## Phase 3 — Attachments

### Task 8: Attachment actions + UI
- Upload/download/delete for lead, project, doc parents
- Link-only attachments still supported

## Phase 4 — UX polish

### Task 9: Search, kanban, activity on status, new-task shortcut

---

## Verification

- `npm run build` passes
- With real Supabase env: login, CRUD each entity, upload file, delete lead cascades
