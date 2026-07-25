# Outpost — Client Accounts (Magic Link) Design

**Date:** 2026-07-25  
**Status:** Implemented  
**Supersedes (access model):** PIN + per-project token as the primary client entry (`2026-07-24-client-portal-design.md`). Project UI and tickets/messages stay; identity moves to Supabase Auth.

## Goal

Give each invited client a **login account** (magic link, no password) so they can:

1. Complete a short **onboarding** (invoice/billing + personal profile)
2. Open the **client portal** for their project(s)
3. Use **realtime** chat and ticket comments without polling
4. Optionally manage **multiple projects** under one account

Studio creates the account when creating/editing a client (checkbox + email).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Auth | Supabase Auth magic link (OTP email) — **no password** |
| Who gets an account | Opt-in at client create/edit (“Create portal account”) |
| Portal email | Prefill `client.email`; studio may type a different invite email |
| Identity link | `clients.auth_user_id` → `auth.users.id` (1:1) |
| Role | Studio stays `Admin`/`Member`; clients are `Client` (profiles.role) |
| Entry host | `client.timblazic.dev` — login + onboarding + portal |
| Project access | All projects where `project.client_id` = that client |
| Multi-project | Picker if >1; else deep-link into the only project |
| PIN / token URL | **Remove as primary access** after accounts ship (keep columns temporarily unused or drop in follow-up migration) |
| Money in portal | Still hidden (invoices stay studio-side; client only supplies billing fields) |
| Realtime | Supabase Realtime for `portal_messages`, reactions, ticket comments (replace poll sync) |

## Architecture

```
Studio (admin.*)                    Client (client.*)
─────────────────                   ─────────────────
Create client                       /login  →  magic link email
  └ checkbox + invite email            └ /auth/callback
Invite via admin API                  └ if !onboarding → /onboarding
                                      └ else /  (project picker or single project)
Projects.client_id ───────────────►  Auth session scopes data by client_id
```

1. **Studio** remains invite-only password auth on `admin.*`.
2. **Client host** uses Supabase browser session (magic link). Proxy allows `/login`, `/auth/*`, `/onboarding`, `/`, `/projects/*`, `/api/*` as needed.
3. Portal data access switches from “token cookie + service role” to **authenticated client user** with RLS (or server actions that resolve `client` from `auth.uid()` and filter by `client_id`).
4. Polling chat/unread endpoints become Realtime subscriptions; unread cursors stay (`portal_*_last_read_at`).

## Data model

### `clients` additions

| Column | Type | Notes |
|--------|------|--------|
| `auth_user_id` | uuid unique nullable → `auth.users` | Set when invite succeeds |
| `portal_email` | text nullable | Email used for magic link (may differ from contact `email`) |
| `onboarding_completed_at` | timestamptz nullable | Null = must finish wizard |
| `billing_kind` | text | `person` \| `company` (set in onboarding) |
| `first_name` / `last_name` | text | Split from display name in onboarding |
| (existing) | | `billing_address`, `tax_number`, `vat_id`, `registration_number`, `company`, `payment_terms_days` filled/confirmed in onboarding |

### `profiles` change

- Extend `role` check to include **`Client`** (today: Admin | Member).
- Trigger `handle_new_user`: if invite metadata `kind=client`, create profile with `role=Client` and link `clients.auth_user_id`.
- Client avatar uses existing `avatar_url` on profiles (optional photo in onboarding).

### Invite metadata

When inviting via `auth.admin.inviteUserByEmail` / `generateLink`:

```json
{ "kind": "client", "client_id": "c_xxx" }
```

### Projects / PIN

- Stop setting default PIN / requiring PIN gate for new access.
- Studio UI: remove Enable PIN / Reset PIN primary flows; show “Portal account: invited / active / needs onboarding”.
- Optional later migration: drop `portal_pin_hash` usage; `portal_token` may remain for legacy redirects → login.

## Studio flows

### Create / edit client

On `ClientForm`:

1. Checkbox: **Create client portal account**
2. If checked: **Portal login email** input (default = contact email)
3. On save:
   - Upsert client row
   - If account requested and no `auth_user_id` yet: invite user + set `portal_email`, `auth_user_id`
   - If account exists and email changed: update Auth email / resend invite (studio action “Resend magic link”)

Errors: duplicate Auth email → show clear message (email already used).

### Client detail

- Status chip: No account | Invited | Active | Onboarding incomplete  
- Actions: Resend invite, Change portal email  

## Client flows

### Login (`client.*/login`)

1. Email field only → `signInWithOtp` / magic link  
2. Email link → `/auth/callback` → session  
3. Resolve client by `auth_user_id`  
4. If `!onboarding_completed_at` → `/onboarding`  
5. Else → home  

### Onboarding (`/onboarding`)

Linear, short:

1. **You** — first name, last name, optional avatar upload  
2. **Billing** — Person vs Company  
   - Person: billing address (+ tax id if needed)  
   - Company: company name, address, tax number, VAT, registration number  
3. Submit → set `onboarding_completed_at`, sync `clients.name` / `company` / billing fields, profile name/avatar  
4. Redirect to portal home  

Cannot skip; cannot open projects until done.

### Portal home

- Load projects for `client_id`  
- **0 projects:** empty state (“Studio hasn’t linked a project yet”)  
- **1 project:** redirect to project portal view  
- **N projects:** list/cards → open one  

### Project view

Same capabilities as today’s portal (overview, messages, tickets, files) but:

- Auth = Supabase session (not PIN cookie)  
- `authorKind: client` messages/comments use client profile name + avatar  
- Realtime subscriptions on messages + ticket comments  

## Realtime (same release)

Replace 2s polling for:

- `portal_messages` + `portal_message_reactions`  
- `ticket_comments` + reactions (portal + studio where useful)  
- Presence: client online via Realtime Presence (studio sees client; client does not see studio — keep current product rule)  

Unread cursors remain; mark-read on open thread stays.

RLS (or server-mediated channel auth) must ensure a client only receives events for their `client_id` projects.

## Host / proxy

| Host | Behavior |
|------|----------|
| `admin.*` | Studio only; redirect logged-in `Client` role away from CRM |
| `client.*` | Client login, onboarding, portal; studio users optional redirect to admin |
| localhost | Both, path-based |

Middleware: client host requires Auth for portal routes except `/login` and `/auth/*`.

## Migration from PIN portals

1. Ship accounts + onboarding; new invites use magic link.  
2. Existing projects: studio invites the linked client (or sets portal email) — one-time.  
3. PIN gate removed from UI; old `/portal/[token]` URLs redirect to `client.*/login?next=…` (optional nicety).  
4. Follow-up: drop PIN columns when unused.

## Out of scope (v1)

- Client password login  
- Client self-signup without studio invite  
- Client-facing invoice PDF list (billing data only)  
- Email notifications for new messages  
- Multiple Auth users per client company  

## Success criteria

- Studio can create a client + portal account in one form submit  
- Client receives magic link, completes onboarding, lands in project portal  
- Multi-project client sees a picker  
- Messages and ticket comments update without polling  
- PIN is no longer required for day-to-day client access  
