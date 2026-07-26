# Supabase setup (Outpost)

The app runs in **local file-store mode** until Supabase env vars are set. With env configured, data + auth switch to Supabase automatically.

## Checklist

1. [ ] Create Supabase project
2. [ ] Add `.env.local` with URL + anon key
3. [ ] Run `supabase/migrations/20260724120000_init.sql` in SQL Editor
4. [ ] (Optional) Run `supabase/seed.sql` for a starter lead + doc
5. [ ] Disable public signups
6. [ ] Invite yourself (and partner) via Auth → Users → Invite
7. [ ] Sign in at `/login`
8. [ ] Confirm CRUD works, then delete the seed lead

## 1. Create project

1. Create a project at [supabase.com](https://supabase.com)
2. Project Settings → API → copy **Project URL** and **anon public** key
3. Copy `.env.local.example` → `.env.local` and paste values

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

(Newer Supabase projects show a **publishable** key instead of the old `anon` JWT — that’s correct.)

## 2. Apply schema

In Supabase SQL Editor, run in order:

1. `supabase/migrations/20260724120000_init.sql`  
   (includes `firm_settings` — if you already ran an older init without it, also run `20260724130000_firm_settings.sql`)
2. `supabase/migrations/20260724160000_client_portal.sql` (client portals)
3. `supabase/migrations/20260724170000_delivery_hub.sql` (legacy phases / checklist — optional)
4. `supabase/migrations/20260724180000_clients_tickets.sql` (clients + tickets)
5. `supabase/migrations/20260724200000_portal_locale.sql` (portal language)
6. `supabase/migrations/20260724210000_ticket_comments.sql` (ticket comments / reactions)
7. `supabase/migrations/20260724220000_profile_avatar.sql` (profile avatar)
8. `supabase/migrations/20260724230000_task_description.sql` (task description + files)
9. `supabase/migrations/20260724240000_archive.sql` (archive clients / projects)
10. `supabase/migrations/20260724250000_lead_description.sql` (lead description)
11. `supabase/migrations/20260725200000_invoices.sql` (invoices + billing fields)
12. `supabase/migrations/20260725210000_billing_company_name.sql` (issuer company name)
13. `supabase/migrations/20260725220000_invoice_project_paid.sql` (invoice ↔ project + paid_at)
14. `supabase/migrations/20260725230000_ai_email_prompt.sql` (AI email system prompt)
15. `supabase/migrations/20260725250000_portal_messages.sql` (portal project chat)
16. `supabase/migrations/20260725260000_portal_messages_rich.sql` (replies, reactions, soft unsend)
17. `supabase/migrations/20260725270000_portal_presence.sql` (client online heartbeat)
18. `supabase/migrations/20260725280000_portal_read_cursors.sql` (chat read/unread cursors)
19. `supabase/migrations/20260725290000_client_accounts.sql` (client portal accounts + Client role)
20. `supabase/migrations/20260725300000_portal_realtime_rls.sql` (Realtime RLS for `portal_messages` + reactions)
21. `supabase/migrations/20260725310000_ticket_comments_realtime_rls.sql` (Realtime RLS for ticket comments/reactions)
22. `supabase/migrations/20260725320000_client_portal_locale.sql` (portal language on client account)
23. `supabase/seed.sql` (optional)
24. `supabase/seed-odobreni-leadi.sql` (optional — 35 SI website-redesign leads)

Or with CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_REF
npx supabase db push
```

## 3. Auth (invite-only + client magic links)

1. Authentication → Providers → Email enabled.
2. Authentication → Settings → **disable** “Allow new users to sign up”.
3. Keep Studio users invite-only via Authentication → Users → Invite (admin/member accounts).
4. Client portal accounts are created from the app (Client form/panel) and use **magic links only**.
5. `supabase/migrations/20260725290000_client_accounts.sql` allows `profiles.role = 'Client'` and links invited auth users to `clients.auth_user_id`.

## 4. Storage + client portal

The migration creates a private `attachments` bucket + RLS. Uploads go to Storage and open via short-lived signed URLs once you’re signed in.

For **client portals** (`/portal/...`), also add the **service_role** key (server-only) to `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Never expose this key to the browser. Studio CRM still uses the publishable key + auth.

### Lead Qualify pipeline (optional)

`/leads/qualify` uses Anthropic (same as AI email) plus optional PageSpeed Insights:

```env
ANTHROPIC_API_KEY=sk-ant-...
PAGESPEED_API_KEY=   # Google PageSpeed Insights API key; if unset, Lighthouse step is skipped
```

### Resend outbound email (optional)

Studio **Send** (Qualify / Generate email) uses Resend. Nothing sends without a click.

```env
RESEND_API_KEY=re_...
```

Also run migration `20260726110000_outbound_email_from.sql`, then set From name/email under **Settings → Email** (default `Tim <tim@timblazic.dev>`). Verify `timblazic.dev` (or your domain) in the Resend dashboard.

## 5. Force file store (optional)

```env
OUTPOST_USE_FILE_STORE=1
```

## 6. Website → Outpost inbound leads

Public endpoint (API key required, no login):

`POST /api/leads/inbound`

Headers:

```
Authorization: Bearer <OUTPOST_INGEST_SECRET>
Content-Type: application/json
```

Body (from timblazic.dev contact form):

```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "projectType": "website",
  "budget": "b3",
  "message": "Need a redesign…",
  "locale": "en"
}
```

Creates a **New** lead with tags `hot` + `website` + type, estimated `value` from budget, and a pinned note with type / budget / message.

On the Outpost server set `OUTPOST_INGEST_SECRET` (+ `SUPABASE_SERVICE_ROLE_KEY` if using Supabase).  
On timblazic.dev set `OUTPOST_API_URL` + the same `OUTPOST_INGEST_SECRET`.

## 7. Deploy admin + client hosts

One Next.js app, two domains (e.g. Vercel):

| Domain | Role |
|--------|------|
| `admin.timblazic.dev` | Studio CRM (login required) |
| `client.timblazic.dev` | Client portal only (`/portal/...`) |

Add both domains to the same deployment, then set:

```env
NEXT_PUBLIC_ADMIN_URL=https://admin.timblazic.dev
NEXT_PUBLIC_PORTAL_URL=https://client.timblazic.dev
```

Behavior:

- **client.*** — only portal routes; `/` redirects to `/portal` (landing if no token)
- **admin.*** — studio + auth; `/portal/...` redirects to the client host
- **localhost** — both work by path (no split)

Also required for production portals: `SUPABASE_SERVICE_ROLE_KEY` (+ `OUTPOST_PORTAL_SECRET` recommended).

Supabase Auth → URL config:

- Site URL: `https://admin.timblazic.dev`
- Redirect URLs:
  - `https://admin.timblazic.dev/**`
  - `https://client.timblazic.dev/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback`
  - (wildcard OK if supported) `http://localhost:3000/**`

Local invites from `localhost:3000` now set `redirectTo` to `http://localhost:3000/auth/callback?next=/` (not production `client.*`). Expired/invalid links that land on `/#error=otp_expired` are redirected to `/client-login`.

Magic-link callback flow:

- Client signs in at `/client-login`.
- App sends a magic link with `redirectTo = <client host>/auth/callback`.
- Callback exchanges `code` for a session and redirects to the requested path (`next`).

Inbound website leads should call **admin** (or the deployment URL), not the client host:

`https://admin.timblazic.dev/api/leads/inbound`

Copy-link in the studio uses `NEXT_PUBLIC_PORTAL_URL`, so clients always get `https://client.timblazic.dev/portal/<token>`.

## 8. Manual QA checklist (Task 12)

Run this script after migrations/env are configured:

1. Create a client and enable portal account invite.
2. Confirm magic link email is received (Inbucket or Supabase Auth logs in local/dev).
3. Complete onboarding (billing + profile).
4. Confirm login lands in a valid project view.
5. If client has 2+ projects, verify project picker appears and switches correctly.
6. Post chat messages both ways and confirm realtime delivery.
7. Add ticket comments/reactions both ways and confirm realtime updates.
8. Confirm studio unread badge/count still updates.
9. Confirm client is never prompted for a portal PIN.

## Notes

- Without env vars, CRUD still works against `/data/*.json` (gitignored).
- Local file uploads go to `/data/uploads` and are served via `/api/files/...`.
- After switching to Supabase, local `/data` is unused unless you force file store.
