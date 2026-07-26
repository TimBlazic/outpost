# Portal Client Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email clients about studio portal activity (bulk tickets, waiting status, comments, offline messages) with batched sends and branded HTML previews.

**Architecture:** Studio actions enqueue rows into `portal_notification_events`. Flush claims ready rows, applies online/`portalEmail` rules, renders HTML, sends via Resend. Immediate types flush via `after()`; messages debounce 2.5 minutes; Vercel cron is the safety net.

**Tech Stack:** Next.js App Router (`after` from `next/server`), Supabase (service role), Resend, existing firm outbound From settings, portal locale i18n.

**Spec:** `docs/superpowers/specs/2026-07-26-portal-client-email-notifications-design.md`

## Global Constraints

- Recipient is **`client.portalEmail` only** — never fall back to `client.email`
- Online skip only for `message` + `ticket_comment` (use `isClientOnline` / 45s window)
- `ticket_waiting` + `tickets_bulk` always send (if email present)
- Studio → client only; never notify for client-authored content
- Bulk create → **one** `tickets_bulk` event; messages → **one** pending row per project
- Portal notification send: firm From, **no** studio signature, **no** BCC
- Notifications require Supabase admin client; if unavailable, enqueue is a silent no-op
- Do not commit unless the user explicitly asks
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` before using `after()`

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260726200000_portal_notification_events.sql` | Queue table + indexes + RLS (service role only) |
| `src/lib/portal/notifications/types.ts` | Event types + payload shapes |
| `src/lib/portal/notifications/copy.ts` | EN/SL subjects + headlines |
| `src/lib/portal/notifications/template.ts` | HTML email renderer |
| `src/lib/portal/notifications/enqueue.ts` | Enqueue helpers + message coalesce |
| `src/lib/portal/notifications/flush.ts` | Claim, skip rules, send, mark status |
| `src/lib/portal/notifications/send.ts` | Resend wrapper (no signature/BCC) |
| `src/lib/portal/notifications/schedule.ts` | `schedulePortalNotificationFlush()` via `after()` |
| `src/lib/portal/notifications/links.ts` | Deep-link + login CTA URL builders |
| `src/app/api/cron/portal-notifications/route.ts` | Cron flush endpoint |
| `vercel.json` | Cron schedule (create if missing) |
| `src/lib/tickets/actions.ts` | Enqueue bulk |
| `src/lib/actions.ts` | Enqueue waiting + studio comment |
| `src/lib/portal/message-actions.ts` | Enqueue studio message |
| `src/lib/hosts.ts` + `src/lib/auth/actions.ts` | Magic-link `next` preservation |
| `src/lib/supabase/middleware.ts` | Logged-in login redirect honors `next` |
| `src/components/portal-client-view.tsx` | Honor `?tab=` / `?ticket=` |
| `src/app/projects/[id]/page.tsx` | Pass searchParams into portal view |
| `.env.example` or setup docs | `CRON_SECRET` note if present |

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/20260726200000_portal_notification_events.sql`
- Create: `src/lib/portal/notifications/types.ts`

**Interfaces:**
- Produces:
```ts
export type PortalNotificationType =
  | "message"
  | "ticket_comment"
  | "ticket_waiting"
  | "tickets_bulk";

export type PortalNotificationStatus =
  | "pending"
  | "sending"
  | "sent"
  | "skipped"
  | "failed";

export type MessagePayload = {
  messageIds: string[];
  excerpts: string[]; // parallel to messageIds, truncated
};

export type TicketCommentPayload = {
  ticketId: string;
  ticketTitle: string;
  commentId: string;
  excerpt: string;
};

export type TicketWaitingPayload = {
  ticketId: string;
  ticketTitle: string;
};

export type TicketsBulkPayload = {
  count: number;
  titles: string[]; // up to 5
  ticketIds: string[];
};

export type PortalNotificationPayload =
  | MessagePayload
  | TicketCommentPayload
  | TicketWaitingPayload
  | TicketsBulkPayload;

export type PortalNotificationEvent = {
  id: string;
  projectId: string;
  clientId: string;
  type: PortalNotificationType;
  payload: PortalNotificationPayload;
  notBefore: string;
  status: PortalNotificationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MESSAGE_DEBOUNCE_MS = 150_000; // 2.5 minutes
export const MAX_SEND_ATTEMPTS = 3;
```

- [ ] **Step 1: Write migration**

```sql
-- Portal client email notification queue

create table if not exists public.portal_notification_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  client_id text not null references public.clients (id) on delete cascade,
  type text not null check (type in (
    'message', 'ticket_comment', 'ticket_waiting', 'tickets_bulk'
  )),
  payload jsonb not null default '{}'::jsonb,
  not_before timestamptz not null default now(),
  status text not null default 'pending' check (status in (
    'pending', 'sending', 'sent', 'skipped', 'failed'
  )),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_notification_events_claim_idx
  on public.portal_notification_events (status, not_before);

create index if not exists portal_notification_events_message_coalesce_idx
  on public.portal_notification_events (project_id, type, status)
  where type = 'message' and status = 'pending';

alter table public.portal_notification_events enable row level security;
-- No policies: only service role (bypasses RLS) reads/writes this table.
```

Confirm `projects.id` / `clients.id` column types match existing migrations (text vs uuid). If they are uuid, change `text` → `uuid` in the FKs.

- [ ] **Step 2: Add `types.ts`** with the interfaces above.

- [ ] **Step 3: Apply migration** in local/Supabase SQL Editor (or `supabase db push` if that is the project workflow).

- [ ] **Step 4: Manual check** — table exists in Supabase Table Editor.

---

### Task 2: Copy + HTML template + deep links

**Files:**
- Create: `src/lib/portal/notifications/copy.ts`
- Create: `src/lib/portal/notifications/template.ts`
- Create: `src/lib/portal/notifications/links.ts`
- Modify: `src/lib/hosts.ts` — optional helper if needed by links

**Interfaces:**
- Produces:
```ts
// copy.ts
export function notificationSubject(
  locale: "en" | "sl",
  input:
    | { type: "message"; projectName: string; count: number }
    | { type: "ticket_comment"; projectName: string; ticketTitle: string }
    | { type: "ticket_waiting"; projectName: string; ticketTitle: string }
    | { type: "tickets_bulk"; projectName: string; count: number }
): string;

export function notificationHeadline(
  locale: "en" | "sl",
  type: PortalNotificationType
): string;

// links.ts
export function buildPortalNotificationCtaUrl(input: {
  portalEmail: string;
  locale: "en" | "sl";
  nextPath: string; // e.g. /projects/p1?ticket=tk_1
}): string;
// → {portalOrigin}/projects/...?  (direct deep link; middleware adds login+next if needed)

export function nextPathForNotification(
  type: PortalNotificationType,
  projectId: string,
  payload: PortalNotificationPayload
): string;

// template.ts
export function renderPortalNotificationEmail(input: {
  locale: "en" | "sl";
  projectName: string;
  type: PortalNotificationType;
  payload: PortalNotificationPayload;
  ctaUrl: string;
}): { subject: string; html: string; text: string };
```

- [ ] **Step 1: Implement `copy.ts`** using subjects from the spec (EN + SL).

- [ ] **Step 2: Implement `links.ts`**

```ts
import { getClientPortalOrigin } from "@/lib/hosts";
import type {
  PortalNotificationPayload,
  PortalNotificationType,
} from "./types";

export function nextPathForNotification(
  type: PortalNotificationType,
  projectId: string,
  payload: PortalNotificationPayload
): string {
  if (type === "message") {
    return `/projects/${projectId}?tab=messages`;
  }
  if (type === "tickets_bulk") {
    return `/projects/${projectId}`;
  }
  const ticketId =
    "ticketId" in payload ? String(payload.ticketId) : "";
  return ticketId
    ? `/projects/${projectId}?ticket=${encodeURIComponent(ticketId)}`
    : `/projects/${projectId}`;
}

/** Prefer direct project URL — middleware preserves next on auth redirect. */
export function buildPortalNotificationCtaUrl(input: {
  nextPath: string;
}): string {
  const origin = getClientPortalOrigin();
  const path = input.nextPath.startsWith("/")
    ? input.nextPath
    : `/${input.nextPath}`;
  return `${origin}${path}`;
}
```

- [ ] **Step 3: Implement `template.ts`**

Inline-CSS HTML: header (project name), localized headline, preview card by type, CTA button, footer line. Also return plain-text fallback. Escape all user strings (`escapeHtml`).

Preview rules:
- message: up to 3 excerpts; if `excerpts.length > 3` show `+N more`
- ticket_comment: title + excerpt
- ticket_waiting: title + needs-input line
- tickets_bulk: count + up to 5 titles

- [ ] **Step 4: Spot-check** — in a scratch `node`/dev log, render one of each type and open HTML in a browser (or Resend test later).

---

### Task 3: Enqueue + send + schedule flush helpers

**Files:**
- Create: `src/lib/portal/notifications/send.ts`
- Create: `src/lib/portal/notifications/enqueue.ts`
- Create: `src/lib/portal/notifications/schedule.ts`

**Interfaces:**
- Produces:
```ts
export async function sendPortalNotificationEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }>;

export async function enqueueTicketsBulk(input: {
  projectId: string;
  clientId: string;
  count: number;
  titles: string[];
  ticketIds: string[];
}): Promise<void>;

export async function enqueueTicketWaiting(input: {
  projectId: string;
  clientId: string;
  ticketId: string;
  ticketTitle: string;
}): Promise<void>;

export async function enqueueTicketComment(input: {
  projectId: string;
  clientId: string;
  ticketId: string;
  ticketTitle: string;
  commentId: string;
  excerpt: string;
}): Promise<void>;

export async function enqueueStudioMessage(input: {
  projectId: string;
  clientId: string;
  messageId: string;
  excerpt: string;
}): Promise<void>;

export function schedulePortalNotificationFlush(): void;
```

- [ ] **Step 1: `send.ts`** — Resend send using firm settings From; **do not** call `appendStudioEmailSignature`; **do not** BCC. Mirror key loading from `src/lib/email/resend.ts` but keep this helper free of `requireStudioSession` (flush runs from cron/`after`).

- [ ] **Step 2: `enqueue.ts`**

Use `createAdminClient()` / `hasAdminClient()`. If `!hasAdminClient()`, return.

Shared insert helper for immediate types. For `enqueueStudioMessage`:

1. Select one pending message row:  
   `.from("portal_notification_events").select("*").eq("project_id", …).eq("type","message").eq("status","pending").maybeSingle()`
2. If none → insert with payload `{ messageIds: [id], excerpts: [excerpt] }`, `not_before = now + 2.5m`
3. If exists → update payload arrays (append), set `not_before = now + 2.5m`, bump `updated_at`

Truncate excerpts to ~180 chars.

- [ ] **Step 3: `schedule.ts`**

```ts
import { after } from "next/server";
import { flushPortalNotifications } from "./flush";

export function schedulePortalNotificationFlush(): void {
  try {
    after(async () => {
      await flushPortalNotifications();
    });
  } catch {
    // Outside request scope (rare): cron will pick up.
    void flushPortalNotifications();
  }
}
```

Note: `flush.ts` is Task 4 — add a temporary stub `export async function flushPortalNotifications() {}` if needed to keep types compiling, then replace in Task 4.

- [ ] **Step 4: Wire stub compile check** — `npx tsc --noEmit` (or project lint) should not fail on these modules.

---

### Task 4: Flush engine

**Files:**
- Create: `src/lib/portal/notifications/flush.ts`

**Interfaces:**
- Consumes: enqueue types, template, send, `isClientOnline`, store getters for project/client
- Produces:
```ts
export async function flushPortalNotifications(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}>;
```

- [ ] **Step 1: Implement claim**

```ts
// Pseudocode — use admin client
const now = new Date().toISOString();
const { data: ready } = await supabase
  .from("portal_notification_events")
  .select("*")
  .eq("status", "pending")
  .lte("not_before", now)
  .order("created_at", { ascending: true })
  .limit(50);

for (const row of ready ?? []) {
  const { data: claimed } = await supabase
    .from("portal_notification_events")
    .update({ status: "sending", updated_at: now })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!claimed) continue; // lost race
  // process claimed…
}
```

- [ ] **Step 2: Process rules**

For each claimed row:

1. Load project + client (`getProjectById` / `getClientById` or admin select).
2. If `!client.portalEmail` → status `skipped`, `last_error = "no_portal_email"`.
3. If type is `message` or `ticket_comment` and `isClientOnline(project.portalClientLastSeenAt)` → `skipped`, `last_error = "client_online"`.
4. Else render + `sendPortalNotificationEmail`.
5. Success → `sent`. Failure → increment `attempts`; if `attempts >= MAX_SEND_ATTEMPTS` → `failed`; else back to `pending` with `not_before = now + 1m` and `last_error`.

Optional same-flush merge: if both `ticket_comment` and `ticket_waiting` for same `ticketId` are claimed, send one combined email and mark both `sent`. Implement only if straightforward; otherwise send separately (spec allows either).

- [ ] **Step 3: Manual dry-run** — insert a pending `tickets_bulk` row via SQL with your `portalEmail` client, call flush from a temporary server action or cron route (Task 5), confirm Resend delivery.

---

### Task 5: Cron route + env

**Files:**
- Create: `src/app/api/cron/portal-notifications/route.ts`
- Create or modify: `vercel.json`
- Modify: `docs/SETUP-SUPABASE.md` or `.env.example` if it exists — document `CRON_SECRET`

- [ ] **Step 1: Cron route**

```ts
import { NextResponse } from "next/server";
import { flushPortalNotifications } from "@/lib/portal/notifications/flush";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await flushPortalNotifications();
  return NextResponse.json(result);
}

export const POST = GET;
```

- [ ] **Step 2: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/portal-notifications",
      "schedule": "* * * * *"
    }
  ]
}
```

Note: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` only if `CRON_SECRET` is set in the project (verify current Vercel cron auth behavior for this account; if Vercel uses a different header, match it).

- [ ] **Step 3: Add `CRON_SECRET` to `.env.local`** (generate a random string). Do not commit secrets.

- [ ] **Step 4: Verify** — `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/portal-notifications`

---

### Task 6: Wire enqueue into studio actions

**Files:**
- Modify: `src/lib/tickets/actions.ts` — `createTicketsBulkAction`
- Modify: `src/lib/actions.ts` — `setTicketStatus`, `updateTicket`, `createTicketComment`
- Modify: `src/lib/portal/message-actions.ts` — `postStudioPortalMessage` (and any other studio send path that persists messages)

**Interfaces:**
- Consumes: enqueue_* + `schedulePortalNotificationFlush`

- [ ] **Step 1: Bulk tickets** — after `saveTickets`, if `project.clientId`:

```ts
await enqueueTicketsBulk({
  projectId,
  clientId: project.clientId,
  count: created.length,
  titles: created.map((t) => t.title).slice(0, 5),
  ticketIds: created.map((t) => t.id),
});
schedulePortalNotificationFlush();
```

- [ ] **Step 2: Waiting on client** — in `setTicketStatus` and `updateTicket`, after save, if previous status !== `"Waiting on client"` and new status === `"Waiting on client"`:

```ts
const project = await getProjectById(current.projectId);
if (project?.clientId) {
  await enqueueTicketWaiting({
    projectId: project.id,
    clientId: project.clientId,
    ticketId: current.id,
    ticketTitle: /* updated title if updateTicket changed it */ current.title,
  });
  schedulePortalNotificationFlush();
}
```

For `updateTicket`, use the new title from `input.title` when building payload.

- [ ] **Step 3: Studio comment** — end of `createTicketComment` after save:

```ts
const project = await getProjectById(ticket.projectId);
if (project?.clientId) {
  await enqueueTicketComment({
    projectId: project.id,
    clientId: project.clientId,
    ticketId,
    ticketTitle: ticket.title,
    commentId: comment.id,
    excerpt: body.slice(0, 180),
  });
  schedulePortalNotificationFlush();
}
```

Do **not** enqueue from `clientCreateTicketComment` / session client variants.

- [ ] **Step 4: Studio message** — end of `postStudioPortalMessage` (and duplicate studio send in `src/lib/portal/actions.ts` if that path still posts studio messages):

```ts
if (project.clientId) {
  await enqueueStudioMessage({
    projectId,
    clientId: project.clientId,
    messageId: message.id,
    excerpt: text.slice(0, 180),
  });
  schedulePortalNotificationFlush();
}
```

Message flush will usually no-op until `not_before`; cron/`after` still fine.

- [ ] **Step 5: Manual QA checklist**

1. Client with `portalEmail` set, portal tab closed (stale last_seen).  
2. Bulk generate 5 tickets → **1** email.  
3. Move ticket to Waiting on client → email with preview.  
4. Studio comment → email (then open portal so last_seen fresh; comment again → skipped/no email).  
5. Send 3 messages quickly → wait ~2.5–3 min → **1** email with multiple excerpts.  
6. Client without `portalEmail` → events skipped, no send.

---

### Task 7: Deep-link plumbing (portal UI + auth `next`)

**Files:**
- Modify: `src/components/portal-client-view.tsx`
- Modify: `src/components/portal-tickets.tsx` (already has `initialSelectedId` — wire only)
- Modify: `src/app/projects/[id]/page.tsx` (session portal entry)
- Modify: `src/lib/hosts.ts` — `getClientAuthCallbackUrl(origin, next?)`
- Modify: `src/lib/auth/actions.ts` — `requestClientMagicLink(email, next?)`
- Modify: `src/app/client-login/page.tsx` — pass `next` into magic link request
- Modify: `src/lib/supabase/middleware.ts` — logged-in user on login honors `next`

- [ ] **Step 1: Portal query params**

In `projects/[id]/page.tsx` (client session branch), read `searchParams` (`tab`, `ticket`) and pass to `PortalClientView`.

In `PortalClientView`:
- On mount, if `tab === "messages"` → `setTab("messages")`
- Pass `initialSelectedId={ticket}` into `PortalTickets`
- If `ticket` is set, force overview tab so tickets section can open the dialog; optionally `scrollIntoView` on `#portal-tickets`

- [ ] **Step 2: Fix magic-link `next`**

```ts
// hosts.ts
export function getClientAuthCallbackUrl(
  requestOrigin?: string,
  nextPath: string = "/"
) {
  const next = nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/";
  const url = new URL(
    `${getClientPortalOrigin(requestOrigin)}/auth/callback`
  );
  url.searchParams.set("next", next);
  return url.toString();
}

// auth/actions.ts
export async function requestClientMagicLink(
  email: string,
  nextPath: string = "/"
) {
  // …
  const emailRedirectTo = getClientAuthCallbackUrl(
    `${proto}://${host}`,
    nextPath
  );
  // …
}

// client-login sendMagicLink:
await requestClientMagicLink(submittedEmail, requestedNext);
```

- [ ] **Step 3: Middleware logged-in redirect**

Replace the branch that clears search when `user && isLogin`:

```ts
if (user && isLogin) {
  const next = request.nextUrl.searchParams.get("next");
  const safe =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = safe.split("?")[0] || "/";
  redirectUrl.search = safe.includes("?")
    ? safe.slice(safe.indexOf("?"))
    : "";
  // Simpler: redirect to `new URL(safe, request.nextUrl.origin)`
  return NextResponse.redirect(new URL(safe, request.url));
}
```

- [ ] **Step 4: Verify deep links**

1. Logged out: open CTA `/projects/{id}?ticket={tid}` → lands on login with `next` → magic link → opens ticket.  
2. Logged in: open same URL → ticket dialog opens.  
3. `?tab=messages` → messages tab.

---

### Task 8: Spec status + smoke pass

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-portal-client-email-notifications-design.md` — status `Implemented` when done

- [ ] **Step 1: Full smoke** against the Success criteria in the spec.  
- [ ] **Step 2: Mark spec Implemented.**  
- [ ] **Step 3: Stop** — ask user before any commit.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Bulk tickets → one email | 6.1 + 3 enqueue |
| Studio comment email | 6.3 |
| Waiting on client email | 6.2 |
| Messages only if offline + debounce | 3 coalesce + 4 skip + 6.4 |
| Branded HTML preview | 2 |
| Deep link CTA | 2 links + 7 |
| portalEmail only | 4 |
| Online skip hybrid | 4 |
| DB queue + cron + after | 1, 4, 5, 3 schedule |
| No signature / no BCC | 3 send |
| Out of scope items | not implemented |

## Self-review notes

- No test runner in repo — verification is manual QA (matches prior Outpost plans).  
- Magic-link `next=/` bug is in scope because deep links otherwise break after OTP.  
- File-store mode: silent no-op enqueue (Supabase-only queue).  
