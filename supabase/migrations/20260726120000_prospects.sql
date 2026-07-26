-- Lead Hunt prospects (Google Places → daily Keep/Skip queue)

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  name text not null,
  address text,
  city text,
  website text,
  maps_url text,
  query text not null default '',
  status text not null default 'pooled'
    check (status in ('pooled', 'queued_today', 'kept', 'skipped')),
  queued_on date,
  lead_id text references public.leads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on public.prospects (status);
create index if not exists prospects_queued_on_idx on public.prospects (queued_on);

alter table public.prospects enable row level security;

create policy "prospects all" on public.prospects
  for all to authenticated
  using (true) with check (true);
