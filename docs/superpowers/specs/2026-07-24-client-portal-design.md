# Outpost — Client Project Portal Design

**Date:** 2026-07-24  
**Status:** Approved (blanket)

## Goal

Per-project client portal: client opens a link, enters a PIN, and sees progress, staging link, client-visible work, waiting-on-them items, updates with comments and file uploads. Studio controls everything from the project detail **Portal** tab.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Access | Public token URL + PIN |
| Interaction | Comments + file uploads (no email notifications in v1) |
| Visibility | Opt-in only (`clientVisible` / studio-published updates) |
| Architecture | Separate `/portal/[token]` route + internal Portal tab |
| Auth for clients | Cookie session after PIN (not Supabase Auth) |
| Money | Hidden (value, payments, cost never shown) |

## Architecture

1. **Internal CRM** stays invite-only via Supabase Auth.
2. **Portal routes** are public (proxy allows `/portal/*` without login).
3. Project has `portalToken`, hashed PIN, `stagingUrl`, `portalEnabled`, optional intro text.
4. After correct PIN, set httpOnly signed cookie `outpost_portal` scoped to that token.
5. Portal server actions verify cookie; CRM tables remain RLS-authenticated; portal reads/writes via server using the authenticated studio client **or** a narrow server path that only exposes client-safe rows for that project.
6. Dual store: file JSON + Supabase (same pattern as today).

## Data model

**`projects` additions**

- `portal_enabled` boolean default false  
- `portal_token` text unique nullable  
- `portal_pin_hash` text nullable  
- `staging_url` text nullable  
- `portal_intro` text nullable  

**`tasks` additions**

- `client_visible` boolean default false  
- `waiting_on_client` boolean default false  

**`portal_updates`**

- `id`, `project_id`, `body`, `author_kind` (`studio`|`client`), `author_name`, `created_at`

**`portal_comments`**

- `id`, `project_id`, `target_type` (`update`|`task`), `target_id`, `body`, `author_kind`, `author_name`, `created_at`

**Attachments**

- Extend `parent_type` with `portal_update` for files on updates.

## Client portal UI (`/portal/[token]`)

1. PIN gate (if no valid cookie).
2. Header: project name, client name, status, estimated end.
3. Staging / live testing link (if set).
4. Intro / status note from studio.
5. **Waiting on you** — tasks with `waiting_on_client && client_visible`.
6. **In progress / upcoming** — other `client_visible` open tasks.
7. **Updates** feed — studio + client posts; each can have files; threaded comments.
8. Client can: post update, comment, upload file on update, mark waiting-on-you task done (sets status Done / clears waiting flag).

## Internal UI (project detail → Portal)

- Enable/disable portal, generate/regenerate token, set/reset PIN, copy link.
- Edit staging URL + intro.
- Toggle tasks client-visible / waiting-on-client.
- Post studio updates, view client comments/uploads.

## Security

- PIN stored as scrypt/sha-256 hash (never plaintext).
- Token is unguessable (`crypto.randomBytes`).
- Cookie: httpOnly, secure in prod, SameSite=Lax, signed payload `{ token, exp }`.
- Disable portal or rotate token invalidates access.
- Never expose payments/cost/internal notes.

## Out of scope (v1)

- Email/Slack notifications  
- Multiple PINs / named client users  
- Custom domains  
- Client editing of project fields beyond task-done + comments/uploads  
