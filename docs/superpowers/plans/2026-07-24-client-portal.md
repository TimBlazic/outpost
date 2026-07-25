# Client Portal Implementation Plan

> **For agentic workers:** Implement task-by-task. Working portal before polish.

**Goal:** Ship per-project client portal with PIN access, opt-in visibility, updates/comments/uploads.

**Tech:** Next.js App Router, existing store dual-mode, new SQL migration, signed cookie session.

## File map

- `supabase/migrations/20260724160000_client_portal.sql` — schema
- `src/lib/data.ts` — types + seed fields
- `src/lib/portal/{session,pin,store}.ts` — PIN/session + portal data helpers
- `src/lib/store.ts` + `src/lib/supabase/db.ts` — persist new fields/collections
- `src/lib/actions.ts` + `src/lib/portal/actions.ts` — CRM + portal actions
- `src/lib/supabase/middleware.ts` — allow `/portal`
- `src/components/app-shell.tsx` — skip shell on `/portal`
- `src/components/project-portal-panel.tsx` — internal admin
- `src/components/project-detail.tsx` — Portal tab
- `src/app/portal/[token]/page.tsx` + client components — public UI
- `src/components/task-dialog.tsx` — clientVisible / waitingOnClient toggles

## Tasks

### Task 1: Schema + types + store
Migration + TS types + file/supabase read/write for portal fields, updates, comments.

### Task 2: PIN + session
Hash PIN, set/clear signed cookie, middleware allowlist, layout skip shell.

### Task 3: Internal Portal panel
Enable portal, staging, intro, copy link, post updates, toggle task visibility.

### Task 4: Public portal UI
PIN gate, progress sections, updates/comments/uploads, mark waiting task done.

### Task 5: Verify
`npm run build` passes; smoke locally with file store.
