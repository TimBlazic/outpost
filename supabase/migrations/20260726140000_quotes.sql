-- AI Quotes (ponudbe)

alter table public.firm_settings
  add column if not exists quote_next_sequence_by_year jsonb not null default '{}'::jsonb;

create table if not exists public.quotes (
  id text primary key,
  lead_id text references public.leads (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined')),
  locale text not null default 'sl'
    check (locale in ('sl', 'en')),
  number text,
  year integer,
  sequence integer,
  client_name text not null default '',
  client_company text not null default '',
  client_email text not null default '',
  intro text not null default '',
  scope text not null default '',
  notes text not null default '',
  discovery_notes text not null default '',
  line_items jsonb not null default '[]'::jsonb,
  currency text not null default 'EUR',
  subtotal numeric not null default 0,
  total numeric not null default 0,
  valid_until date,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quotes_number_uidx
  on public.quotes (number)
  where number is not null;

create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_lead_idx on public.quotes (lead_id);
create index if not exists quotes_updated_idx on public.quotes (updated_at desc);

alter table public.quotes enable row level security;

drop policy if exists "quotes all" on public.quotes;
create policy "quotes all" on public.quotes
  for all to authenticated
  using (true) with check (true);
