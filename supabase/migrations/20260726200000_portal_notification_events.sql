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
