# Leadflow — Supabase + Full CRUD Design

**Date:** 2026-07-24  
**Status:** Approved (decisions delegated to agent)

## Goal

Internal CRM for a 2-person studio with reliable persistence, invite-only auth, full CRUD on all entities, and file attachments on leads, projects, and docs.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Backend | Supabase (Postgres + Auth + Storage) |
| App pattern | Next.js App Router + server actions (no REST layer) |
| Client | `@supabase/ssr` + `@supabase/supabase-js` |
| Auth | Email/password, invite-only (no public signup) |
| Deletes | Hard delete + confirm dialog + DB cascade |
| Attachments | Leads + projects + docs (Storage + optional external links) |
| Profiles | Synced from `auth.users` via trigger; role Admin/Member |
| Notes count | Computed at read time, not stored |
| Payments | Own table (`payments`), not JSON nested on project |
| JSON store | Removed once Supabase wired; seed via SQL |

## Architecture

1. Middleware refreshes session and protects all routes except `/login`.
2. Server Components / server actions use `createClient()` from `@/lib/supabase/server`.
3. Browser uploads use `@/lib/supabase/client`.
4. RLS: authenticated users can CRUD all business tables (trusted internal team).
5. Storage bucket `attachments` is private; downloads via signed URLs.
6. Types stay in `src/lib/data.ts` (enums + TS shapes); seed arrays become optional/demo-only.

## Data model

- `profiles` — id (= auth.users.id), name, initials, role
- `leads` — existing fields minus `notes` count
- `activities` — lead_id ON DELETE CASCADE
- `notes` — lead_id ON DELETE CASCADE; full update supported
- `tasks` — optional lead_id / project_id; SET NULL on parent delete for the other FK
- `projects` — optional lead_id SET NULL
- `payments` — project_id ON DELETE CASCADE
- `docs` — body required text; excerpt derived or stored
- `attachments` — parent_type enum (`lead`|`project`|`doc`), parent_id uuid, label, kind, url nullable, storage_path nullable, mime, size

Cascade rules:

- Delete lead → activities, notes, lead attachments, tasks with that lead_id
- Delete project → payments, project attachments, tasks with that project_id
- Delete doc → doc attachments (+ storage objects cleaned in action)

## Auth flow

1. Disable public signup in Supabase dashboard (and/or reject non-invited emails).
2. Admin invites Tim + Luka via Supabase Auth invite.
3. `/login` — email/password.
4. Unauthenticated → redirect `/login`.
5. `profiles` row created on first login via trigger.

## CRUD surface

Every entity (Lead, Project, Payment, Task, Doc, Note, Attachment) gets Create / Read / Update / Delete in UI + server actions. Activities remain create + read (timeline); delete only via lead cascade. Profiles are not user-editable beyond name/initials later if needed.

## UX polish (phase 4)

- Confirm dialogs before hard deletes
- Working topbar search (leads/projects/docs/tasks)
- Kanban status change (drag or click)
- Sync counters / activity logging on status change
- Topbar “New task” opens create dialog

## Phases

1. Supabase schema, clients, auth gate, env template  
2. Replace JSON store with Supabase queries; fill CRUD gaps (deletes, note edit, payment edit)  
3. Attachments UI + Storage  
4. UX polish  

## Out of scope (for now)

- Public marketing site
- Multi-tenant orgs / per-row ownership RLS
- Real-time collaboration
- Mobile apps
- Billing
