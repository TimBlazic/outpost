# Portal Client Email Notifications — Design

**Date:** 2026-07-26  
**Status:** Implemented  

## Goal

Notify clients by email when studio activity happens in their portal project — with batching so bulk tickets and message bursts never spam, a polished preview UI, and online-aware skip for chat/comments.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Batching model | **Hybrid:** ticket events flush ASAP; messages debounce **2.5 min** after last studio message |
| Recipient | **`client.portalEmail` only** — if missing, skip (no fallback to contact email) |
| Online skip | Messages + ticket comments skip if client online; **Waiting on client** + **bulk tickets** always send |
| Online signal | Server uses `projects.portal_client_last_seen_at` + existing `isClientOnline` (45s window) |
| Delivery | DB event queue + flush (`after()` + Vercel cron safety net) |
| Send path | Resend via new portal notification helper (firm From name/email; **no** studio signature; **no** BCC to studio) |
| Locale | `client.portalLocale` (`en` \| `sl`) for subject + body |
| CTA | Deep link: `/client-login?email=…&lang=…&next=…` → project ticket or messages |
| Direction | Studio → client only |

## Triggers

| Event | Enqueue source | Payload highlights | Flush timing | Skip if online |
|-------|----------------|--------------------|--------------|----------------|
| Bulk tickets created | `createTicketsBulkAction` | `count`, up to 5 titles, projectId | immediate (`not_before = now`) | no |
| Ticket → Waiting on client | `setTicketStatus` / `updateTicket` when status **transitions into** `"Waiting on client"` | ticketId, title | immediate | no |
| Studio ticket comment | `createTicketComment` (studio author only) | ticketId, title, comment excerpt | immediate | yes |
| Studio chat message | studio send path in portal message actions | messageId, excerpt | debounce: set/bump `not_before = now + 2.5m` on pending message events for that project | yes (re-checked at flush) |

### Explicit non-triggers

- Client-authored comments or messages  
- Reactions, edits, unsends, deletes  
- Ticket status moves other than into `"Waiting on client"`  
- Single ticket create that stays `Todo` / `In progress` / `Done` (bulk create is the only “new tickets” email)  
- Invoices, payments, delivery approvals, portal invites  

## Architecture

```
Studio action (write OK)
        │
        ▼
enqueue portal_notification_events
        │
        ├─ after() → flushPortalNotifications()
        └─ cron /api/cron/portal-notifications (~1m) → same flush
                │
                ▼
        claim ready rows → group by project
                │
                ▼
        resolve portalEmail → online skip → render HTML → Resend
                │
                ▼
        mark sent | skipped | failed (retry ≤ 3)
```

### Table `portal_notification_events`

| Column | Notes |
|--------|--------|
| `id` | uuid |
| `project_id` | fk projects |
| `client_id` | fk clients |
| `type` | `message` \| `ticket_comment` \| `ticket_waiting` \| `tickets_bulk` |
| `payload` | jsonb preview fields |
| `not_before` | messages: `now + 2.5m` (bumped on each new studio message); others: `now` |
| `status` | `pending` \| `sending` \| `sent` \| `skipped` \| `failed` |
| `attempts` | int, default 0 |
| `last_error` | text nullable |
| `created_at` / `updated_at` | timestamptz |

Indexes: `(status, not_before)` for claim; `(project_id, type, status)` for message debounce bump.

### Message debounce rule

Keep **at most one** `pending` `message` row per project:

- If none: insert with `messageIds` / excerpts, `not_before = now + 2.5m`
- If one exists: append `messageId` + excerpt to payload and reset `not_before = now + 2.5m`

At flush that row becomes **one** email (preview up to 3 excerpts, “+N more”).

### Bulk tickets rule

`createTicketsBulkAction` enqueues **exactly one** `tickets_bulk` event for the batch (never one per ticket).

### Flush grouping

Per project, per flush cycle:

1. **Messages** → one email (batched)  
2. **Ticket waiting / comment / bulk** → one email per event  
   - Optional polish in same flush: if `ticket_comment` + `ticket_waiting` share the same `ticketId`, merge into one email (“Needs your input” + comment preview)

### Online skip (flush time)

- `message`, `ticket_comment`: if `isClientOnline(portal_client_last_seen_at)` → mark `skipped` (reason: online)  
- `ticket_waiting`, `tickets_bulk`: never skip for online  

If `portalEmail` blank → `skipped` (reason: no_portal_email).

### Cron

- Route: `POST` (or `GET`) `/api/cron/portal-notifications`  
- Auth: `Authorization: Bearer CRON_SECRET` (or Vercel cron header)  
- Schedule: every 1 minute (safety net if `after()` did not run)  
- Also invoke flush opportunistically after enqueue via Next `after()`

### Deep links (`next`)

Portal must honor query on project view (small UI work if missing):

| Email type | `next` path |
|------------|-------------|
| messages | `/projects/{projectId}?tab=messages` |
| ticket comment / waiting | `/projects/{projectId}?ticket={ticketId}` (open that ticket in portal) |
| bulk tickets | `/projects/{projectId}` (overview / tickets) |

CTA URL shape:

`{portalOrigin}/client-login?email={portalEmail}&lang={locale}&next={encodeURIComponent(path)}`

Auth callback already supports `next`; ensure `/client-login` preserves `next` through magic-link request → `/auth/callback`.

## Email UI

Shared HTML template (inline CSS, light transactional):

1. **Header** — product mark + project name  
2. **Headline** — localized by type  
3. **Preview card** — event-specific content (see below)  
4. **CTA button** — “Open in portal” / “Odpri portal”  
5. **Footer** — short reason line (portal access); no unsubscribe in v1  

### Preview cards

| Type | Card content |
|------|----------------|
| messages | Up to 3 message excerpts (studio → client), truncated; if more, “+N more” |
| ticket_comment | Ticket title + comment excerpt |
| ticket_waiting | Ticket title + “Needs your input” / “Potrebujemo tvoj input” |
| tickets_bulk | “N new tickets” + up to 5 titles |

### Subjects (examples)

**EN**

- messages (1): `New message · {project}`  
- messages (n): `{n} new messages · {project}`  
- comment: `Comment on {ticket} · {project}`  
- waiting: `We need your input · {ticket}`  
- bulk: `{n} new tickets · {project}`  

**SL**

- messages (1): `Novo sporočilo · {project}`  
- messages (n): `{n} nova sporočila · {project}`  
- comment: `Komentar na {ticket} · {project}`  
- waiting: `Potrebujemo tvoj input · {ticket}`  
- bulk: `{n} novih ticketov · {project}`  

### Visual direction

Clean transactional email: light surface, one accent, clear hierarchy. Align with portal branding; avoid purple-glow / generic AI marketing aesthetics. No studio sales signature block.

### From / Resend

- From: `` `${firm.outboundFromName} <${firm.outboundFromEmail}>` ``  
- Reply-To: same From (client can reply to studio inbox)  
- Do **not** append studio email signature  
- Do **not** BCC studio (unlike lead/quote sends)

## Code touchpoints (implementation guide)

| Area | Path / symbol |
|------|----------------|
| Enqueue + flush | new `src/lib/portal/notifications/*` |
| HTML render | new template module under same folder |
| Resend send | thin wrapper around Resend (reuse API key; separate from `sendStudioEmail` behavior) |
| Bulk tickets | `createTicketsBulkAction` — `src/lib/tickets/actions.ts` |
| Status | `setTicketStatus`, `updateTicket` — `src/lib/actions.ts` |
| Comments | `createTicketComment` — `src/lib/actions.ts` |
| Messages | studio send in `src/lib/portal/message-actions.ts` (or equivalent) |
| Online | `isClientOnline` — `src/lib/portal/chat-sync-shared.ts` |
| Cron | `src/app/api/cron/portal-notifications/route.ts` + `vercel.json` cron |
| Deep link UI | `portal-client-view` honor `tab` / `ticket` query |

## Out of scope (v1)

- Push, Slack, SMS  
- Client → studio notification emails  
- Preference center / per-type mute / unsubscribe  
- Invoice, payment, delivery-approval emails  
- Daily digest  
- Fallback to `client.email` when `portalEmail` is empty  
- Notifying on single non-bulk ticket create  

## Success criteria

1. Generating N tickets → **one** email with count + title preview  
2. Studio comment → email with comment preview (skipped if client online)  
3. Move to Waiting on client → email even if client online  
4. Several studio messages within 2.5m → **one** email after quiet period; no email if client online at flush  
5. Emails render as branded HTML with CTA into the right portal surface  
6. No send when `portalEmail` is missing  

## Open implementation notes

- Claim rows with optimistic locking (`pending` → `sending` where clause) to avoid double-send under concurrent cron + `after()`.  
- Failed Resend: increment `attempts`, set `failed` after 3, else return to `pending` with short backoff on `not_before`.  
- Do not log full message bodies in app logs; payload in DB is enough for preview.  
