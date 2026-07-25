# Client Accounts (Magic Link) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invite clients to a magic-link account, run short billing/profile onboarding, land them in a multi-project-aware portal, then switch chat/tickets to Supabase Realtime and retire PIN as primary access.

**Architecture:** Studio invites via Supabase Admin API and links `clients.auth_user_id`. Client host (`client.*`) uses OTP magic link + `/auth/callback`. Session resolves the Client row; onboarding gates portal until complete. Project access is by `projects.client_id`. Realtime replaces poll sync once Auth identity exists.

**Tech Stack:** Next.js App Router, Supabase Auth (OTP), Supabase Admin (`inviteUserByEmail` / `generateLink`), existing portal UI, Supabase Realtime.

**Spec:** `docs/superpowers/specs/2026-07-25-client-accounts-design.md`

## Global Constraints

- Magic link only — no client passwords
- Portal account is opt-in at client create/edit
- Portal login email may differ from contact email (`portal_email`)
- Clients never see money fields in portal
- Studio roles stay Admin/Member; clients use `profiles.role = 'Client'`
- Do not commit unless the user explicitly asks
- Read Next.js docs under `node_modules/next/dist/docs/` before new App Router APIs

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260725290000_client_accounts.sql` | Schema: client auth fields, profiles.role Client, trigger metadata |
| `src/lib/data.ts` | Client type fields |
| `src/lib/supabase/db.ts` / `store` maps | Persist new client columns |
| `src/lib/client-accounts/invite.ts` | Admin invite + link `auth_user_id` |
| `src/lib/client-accounts/session.ts` | Resolve current Client from `auth.uid()` |
| `src/lib/auth/actions.ts` | `requestClientMagicLink`, callback helpers |
| `src/app/auth/callback/route.ts` | Exchange code for session |
| `src/app/(client)/login/page.tsx` | Magic-link login UI (or `src/app/login` branched by host) |
| `src/app/(client)/onboarding/page.tsx` + form | Wizard |
| `src/app/(client)/page.tsx` | Project picker / redirect |
| `src/app/(client)/projects/[id]/page.tsx` | Auth-gated portal project view |
| `src/components/client-form.tsx` | Checkbox + portal email |
| `src/components/client-portal-account-panel.tsx` | Status + resend |
| `src/lib/hosts.ts` + `src/proxy.ts` | Allow client-host auth/onboarding paths; run session on client host |
| `src/lib/portal/*` | Migrate assert from token cookie → client session + project membership |
| Realtime hooks | Replace poll in `portal-chat.tsx` / ticket comments |
| PIN UI | Remove gates/panels; stop default PIN on `createProject` |

---

### Task 1: Database — client account columns + Client role

**Files:**
- Create: `supabase/migrations/20260725290000_client_accounts.sql`
- Modify: `docs/SETUP-SUPABASE.md` (add migration to list)
- Modify: `src/lib/data.ts` (`Client` type + `normalizeClient`)
- Modify: `src/lib/supabase/db.ts` (`mapClient` / save upsert)
- Modify: `src/lib/actions.ts` (`ClientInput`, create/update defaults)

**Interfaces:**
- Produces: `Client` fields `authUserId`, `portalEmail`, `onboardingCompletedAt`, `billingKind`, `firstName`, `lastName`

- [ ] **Step 1: Write migration**

```sql
-- Client portal accounts (magic link)

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('Admin', 'Member', 'Client'));

alter table public.clients
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists portal_email text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists billing_kind text
    check (billing_kind is null or billing_kind in ('person', 'company')),
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

create index if not exists clients_auth_user_id_idx on public.clients (auth_user_id);

-- Recreate handle_new_user to honor invite metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  kind text := coalesce(meta->>'kind', '');
  client_id text := meta->>'client_id';
  display_name text := coalesce(
    meta->>'name',
    split_part(coalesce(new.email, 'Client'), '@', 1),
    'Client'
  );
  initials text := upper(left(display_name, 2));
  new_role text := case when kind = 'client' then 'Client' else 'Member' end;
begin
  insert into public.profiles (id, name, initials, role)
  values (new.id, display_name, initials, new_role)
  on conflict (id) do nothing;

  if kind = 'client' and client_id is not null then
    update public.clients
    set auth_user_id = new.id,
        portal_email = coalesce(portal_email, new.email)
    where id = client_id
      and (auth_user_id is null or auth_user_id = new.id);
  end if;

  return new;
end;
$$;
```

- [ ] **Step 2: Extend TypeScript `Client`**

In `src/lib/data.ts` add to `Client` and `normalizeClient`:

```ts
authUserId: string | null;
portalEmail: string | null;
onboardingCompletedAt: string | null;
billingKind: "person" | "company" | null;
firstName: string;
lastName: string;
```

Map snake_case in `db.ts` the same way as other client fields.

- [ ] **Step 3: Apply migration in Supabase (manual)**

User runs SQL in dashboard (or `supabase db push`). Confirm columns exist.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`  
Expected: PASS (fix any `Client` object literals missing new fields via `normalizeClient`)

---

### Task 2: Invite helpers (studio → Auth)

**Files:**
- Create: `src/lib/client-accounts/invite.ts`
- Create: `src/lib/client-accounts/session.ts`

**Interfaces:**
- Produces:
  - `inviteClientPortalAccount(clientId: string, portalEmail: string): Promise<{ userId: string }>`
  - `resendClientMagicLink(clientId: string): Promise<void>`
  - `getClientForAuthUser(userId: string): Promise<Client | null>`
  - `requireClientSession(): Promise<{ userId: string; client: Client }>`

- [ ] **Step 1: Implement invite**

```ts
// src/lib/client-accounts/invite.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientById, saveClients, getClients } from "@/lib/store"; // use existing getters
import { getPortalBaseUrl } from "@/lib/hosts";

export async function inviteClientPortalAccount(
  clientId: string,
  portalEmail: string
) {
  const email = portalEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid portal email required");

  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");

  const supabase = createAdminClient();
  const redirectTo = `${getPortalBaseUrl() || "http://localhost:3000"}/auth/callback`;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { kind: "client", client_id: clientId, name: client.name },
  });
  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (!userId) throw new Error("Invite failed");

  // Trigger may already link; ensure row is updated
  const all = await getClients();
  await saveClients(
    all.map((c) =>
      c.id === clientId
        ? { ...c, authUserId: userId, portalEmail: email }
        : c
    )
  );

  return { userId };
}
```

If `inviteUserByEmail` is disabled in project settings, fall back to `generateLink({ type: 'magiclink', ... })` and document that studio must enable email auth.

Also implement `resendClientMagicLink` using `supabase.auth.admin.generateLink` or `inviteUserByEmail` again.

- [ ] **Step 2: Implement `requireClientSession`**

```ts
// src/lib/client-accounts/session.ts
import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/lib/store";

export async function requireClientSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const clients = await getClients();
  const client = clients.find((c) => c.authUserId === user.id) ?? null;
  if (!client) throw new Error("No client profile linked");

  return { userId: user.id, client };
}
```

Add `getClientById` in store if missing (thin wrapper over `getClients`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`  
Expected: PASS

---

### Task 3: Client form — create account checkbox

**Files:**
- Modify: `src/components/client-form.tsx`
- Modify: `src/lib/actions.ts` (`createClient` / `updateClient` accept portal invite flags)

**Interfaces:**
- Consumes: `inviteClientPortalAccount`
- Produces: form fields `createPortalAccount`, `portalEmail`

- [ ] **Step 1: Extend actions**

```ts
// In createClient / updateClient input:
createPortalAccount?: boolean;
portalEmail?: string;

// After saveClients(...):
if (input.createPortalAccount) {
  const email = (input.portalEmail || input.email || "").trim();
  await inviteClientPortalAccount(client.id, email);
}
```

- [ ] **Step 2: UI on `ClientForm`**

Add checkbox + conditional portal email input under contact email. Prefill portal email from `client.portalEmail || client.email`. On edit, if `authUserId` already set, show “Portal account linked” + optional Resend (Task 4 panel can own resend).

- [ ] **Step 3: Manual test**

Create client with checkbox on → Auth user appears in Supabase → `clients.auth_user_id` set.

---

### Task 4: Client detail — account status panel

**Files:**
- Create: `src/components/client-portal-account-panel.tsx`
- Modify: `src/app/clients/[id]/page.tsx`

- [ ] **Step 1: Panel UI**

Show: No account | Invited (has authUserId, !onboardingCompletedAt) | Active.  
Buttons: Resend magic link, (optional) Change portal email → re-invite.

- [ ] **Step 2: Wire resend server action** calling `resendClientMagicLink`.

---

### Task 5: Auth callback + client login page

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/client-login/page.tsx` (or branch existing login by host)
- Modify: `src/lib/auth/actions.ts` — `requestClientMagicLink(email: string)`
- Modify: `src/lib/hosts.ts` — expand `isClientHostAllowedPath`
- Modify: `src/proxy.ts` — run `updateSession` on client host; allow `/login`, `/client-login`, `/onboarding`, `/projects`, `/auth`

**Interfaces:**
- Produces: magic-link request + session cookie on client host

- [ ] **Step 1: Callback route**

```ts
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
```

- [ ] **Step 2: `requestClientMagicLink`**

```ts
export async function requestClientMagicLink(email: string) {
  const supabase = await createClient(); // browser-safe via server action with publishable client
  const base = getPortalBaseUrl() || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${base}/auth/callback?next=/`,
      shouldCreateUser: false, // only invited users
    },
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Login UI** — email + “Send magic link”, no password.

- [ ] **Step 4: Proxy / hosts**

Update `isClientHostAllowedPath` to allow:

```ts
pathname === "/login" ||
pathname === "/client-login" ||
pathname.startsWith("/onboarding") ||
pathname.startsWith("/projects") ||
pathname.startsWith("/auth") ||
pathname.startsWith("/api/") ||
isPortalPath(pathname)
```

On client host, call `updateSession(request)` instead of bare `NextResponse.next()`.

Redirect client host `/` → authenticated home (Task 6), not blindly `/portal`.

- [ ] **Step 5: Supabase dashboard config (manual)**

Add redirect URL: `https://client.timblazic.dev/auth/callback` and localhost equivalent. Enable Email OTP / magic link.

---

### Task 6: Onboarding wizard

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/components/client-onboarding-form.tsx`
- Create: `src/lib/client-accounts/onboarding-actions.ts`

**Interfaces:**
- Consumes: `requireClientSession`
- Produces: `completeClientOnboarding(input)` sets billing + names + `onboardingCompletedAt`

- [ ] **Step 1: Server action**

Validate + update client row + `profiles.name` / avatar (reuse profile avatar upload pattern from settings).

```ts
export type OnboardingInput = {
  firstName: string;
  lastName: string;
  billingKind: "person" | "company";
  company?: string;
  billingAddress: string;
  taxNumber?: string;
  vatId?: string;
  registrationNumber?: string;
};
```

Set `onboardingCompletedAt = now`, `name = `${firstName} ${lastName}``.

- [ ] **Step 2: Wizard UI** — 2 steps (You → Billing), cannot skip.

- [ ] **Step 3: Gate** — client home redirects to `/onboarding` if `!client.onboardingCompletedAt`.

---

### Task 7: Project picker + auth-gated project portal

**Files:**
- Create: `src/app/(client-app)/page.tsx` pattern OR replace `src/app/portal/page.tsx` + new `src/app/projects/[id]/page.tsx` for client host
- Create: `src/lib/client-accounts/projects.ts` — `listProjectsForClient(clientId)`
- Modify: portal view entry to accept session instead of token
- Modify: `src/components/portal-client-view.tsx` — remove `PortalPinGate` usage from auth path

**Interfaces:**
- Produces: client lands on picker or single project

- [ ] **Step 1: `listProjectsForClient`**

```ts
export async function listProjectsForClient(clientId: string) {
  const projects = await getProjects();
  return projects.filter(
    (p) => p.clientId === clientId && !isArchived(p) && p.portalEnabled !== false
  );
}
```

(Decide: require `portalEnabled` or treat all client projects as visible once account exists — **prefer all non-archived projects for that client**.)

- [ ] **Step 2: Home page**

```ts
const { client } = await requireClientSession();
if (!client.onboardingCompletedAt) redirect("/onboarding");
const projects = await listProjectsForClient(client.id);
if (projects.length === 1) redirect(`/projects/${projects[0].id}`);
// else render picker cards linking to /projects/[id]
```

- [ ] **Step 3: Project page**

Load portal data with admin/store filtered by membership check:

```ts
const { client } = await requireClientSession();
const project = await getProjectById(id);
if (!project || project.clientId !== client.id) notFound();
// render PortalClientView without token prop — pass session flag
```

Refactor `PortalClientView` / actions: prefer `viewer: "portal-account"` that uses `requireClientSession` instead of `assertPortalAccess(token)`.

Keep legacy `/portal/[token]` temporarily redirecting to `/login?next=/projects/...` if token maps to a project (optional nicety in this task).

- [ ] **Step 4: Manual test** — 1 project auto-open; 2 projects show picker.

---

### Task 8: Portal server actions — session instead of PIN token

**Files:**
- Modify: `src/lib/portal/actions.ts`, `src/lib/portal/message-actions.ts`, `src/app/api/portal/**`
- Create: helpers `assertClientProjectAccess(projectId)`

- [ ] **Step 1: Add access helper**

```ts
export async function assertClientProjectAccess(projectId: string) {
  const { client } = await requireClientSession();
  const project = await getProjectById(projectId);
  if (!project || project.clientId !== client.id) {
    throw new Error("Forbidden");
  }
  return { client, project };
}
```

- [ ] **Step 2: Dual-path during transition**

For each mutating portal action: if `portalToken` provided, keep old `assertPortalAccess` **or** (cleaner) cut over fully once Task 7 works — **cut over fully**; delete PIN unlock from happy path.

- [ ] **Step 3: Wire chat/tickets/uploads to session-based actions** (pass `projectId`, not token).

- [ ] **Step 4: Typecheck + manual comment/message from client account**

---

### Task 9: Remove PIN as primary access

**Files:**
- Modify: `src/lib/actions.ts` (`createProject` — no default PIN / still can set `portalEnabled: true` without pin)
- Modify: `src/components/project-workspace.tsx`, `project-portal-panel.tsx` — replace PIN UI with “Client account” status + link to client
- Modify: `src/components/portal-client-view.tsx` — remove `PortalPinGate` export usage
- Modify: `src/app/portal/[token]/page.tsx` — redirect to login

- [ ] **Step 1: `createProject`** — keep `portalEnabled: true`, set `portalPinHash: null`, token optional/unused.

- [ ] **Step 2: Strip PIN enable/reset/disable from studio UI**; show client portal account state instead.

- [ ] **Step 3: Legacy token URL → `/login`**

- [ ] **Step 4: Manual regression** — studio creates client+account+project; client never sees PIN.

---

### Task 10: Realtime messages (replace poll)

**Files:**
- Create: `src/lib/realtime/portal-chat.ts` (client hook)
- Modify: `src/components/portal-chat.tsx` — subscribe instead of 2s fetch loop
- Modify: RLS or use authenticated selects on `portal_messages` for Client role
- Migration (if needed): `20260725300000_portal_realtime_rls.sql` — policies so client can `select` messages for their projects; enable realtime publication

**Interfaces:**
- Consumes: Supabase browser client channel `postgres_changes` filter `project_id=eq.…`
- Keeps: mark-read + unread badge light poll **or** derive unread from presence of new rows (badge can stay on 5–10s poll temporarily)

- [ ] **Step 1: RLS policies** so `authenticated` + Client can read/write messages for projects where `projects.client_id = (select id from clients where auth_user_id = auth.uid())`. Studio Member/Admin keep full access.

- [ ] **Step 2: Add tables to `supabase_realtime` publication**

```sql
alter publication supabase_realtime add table public.portal_messages;
alter publication supabase_realtime add table public.portal_message_reactions;
```

- [ ] **Step 3: Hook in `PortalChat`**

```ts
useEffect(() => {
  const supabase = createBrowserClient(...);
  const channel = supabase
    .channel(`portal-chat-${projectId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "portal_messages", filter: `project_id=eq.${projectId}` }, () => { void syncChat(); })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}, [projectId]);
```

Remove `setInterval(..., CHAT_POLL_MS)` for message body sync; keep one initial fetch.

- [ ] **Step 4: Manual test** — two browsers, message appears &lt;1s without refresh.

---

### Task 11: Realtime ticket comments + presence

**Files:**
- Modify: `src/components/ticket-comments.tsx` or portal tickets wrapper
- Publication: `ticket_comments`, `ticket_comment_reactions`
- Presence: Realtime presence channel `portal-presence-${projectId}` — client tracks; studio subscribes; client does not render studio presence

- [ ] **Step 1: RLS + publication for ticket comment tables** (client can access comments for tickets on their projects).

- [ ] **Step 2: Subscribe in ticket UI**; `router.refresh()` or local state merge on events.

- [ ] **Step 3: Presence** — replace `/api/portal/presence` heartbeat with channel track; studio header “Client online” from presence sync.

- [ ] **Step 4: Manual test** comments + online indicator.

---

### Task 12: Docs + cleanup

**Files:**
- Modify: `docs/SETUP-SUPABASE.md` — Auth redirect URLs, magic link, Client role, migrations list
- Modify: spec status to Implemented (when done)
- Remove dead PIN/poll code paths left unused

- [ ] **Step 1: Update SETUP** with client auth checklist  
- [ ] **Step 2: Grep for `assertPortalAccess`, `PortalPinGate`, `DEFAULT_PORTAL_PIN`, `/api/portal/chat/sync` — delete or archive unused  
- [ ] **Step 3: Full manual QA script**

1. Create client + portal account  
2. Receive magic link (Inbucket/Supabase logs locally)  
3. Onboarding  
4. Land in project  
5. Second project → picker  
6. Message realtime both ways  
7. Ticket comment realtime  
8. Studio unread badge still works  
9. No PIN prompt  

---

## Self-review vs spec

| Spec requirement | Task |
|------------------|------|
| Checkbox + portal email on create client | 3 |
| Magic link, no password | 5 |
| `clients.auth_user_id` + profile Client | 1–2 |
| Onboarding billing + name + photo | 6 |
| Multi-project picker / single redirect | 7 |
| Remove PIN primary access | 9 |
| Realtime messages | 10 |
| Realtime ticket comments | 11 |
| Presence studio-only | 11 |
| Money hidden | unchanged portal rules (no task) |

No TBD placeholders. Types aligned: `authUserId`, `portalEmail`, `onboardingCompletedAt`, `billingKind`, `firstName`, `lastName`.

## Suggested execution waves

- **Wave A (Tasks 1–9):** accounts usable end-to-end (poll may remain briefly)  
- **Wave B (Tasks 10–12):** Realtime + cleanup  

---

## Execution

Plan saved to `docs/superpowers/plans/2026-07-25-client-accounts.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, batch with checkpoints  

Which approach?
