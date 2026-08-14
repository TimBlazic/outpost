create table public.site_events (
  id text primary key,
  session_id text not null,
  lead_id text references public.leads (id) on delete set null,
  event text not null,
  target text not null default '',
  path text not null default '',
  locale text not null default '',
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  gclid text not null default '',
  created_at timestamptz not null default now()
);

create index site_events_session_idx on public.site_events (session_id);
create index site_events_lead_idx on public.site_events (lead_id);
create index site_events_event_created_idx on public.site_events (event, created_at desc);
create index site_events_created_idx on public.site_events (created_at desc);

alter table public.site_events enable row level security;

create policy "site_events all" on public.site_events
  for all to authenticated using (true) with check (true);
