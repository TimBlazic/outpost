-- Lead description (research / pitch notes that aren't structured fields)

alter table public.leads
  add column if not exists description text not null default '';
