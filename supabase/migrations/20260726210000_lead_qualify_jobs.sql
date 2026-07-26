-- Durable background lead qualify queue (1 job at a time via app flush)

create table if not exists public.lead_qualify_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads (id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'done', 'skipped', 'failed'
  )),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_qualify_jobs_pending_idx
  on public.lead_qualify_jobs (created_at)
  where status = 'pending';

create unique index if not exists lead_qualify_jobs_active_lead_uidx
  on public.lead_qualify_jobs (lead_id)
  where status in ('pending', 'running');

alter table public.lead_qualify_jobs enable row level security;
-- No policies: service role only.
