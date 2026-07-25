-- Portal UI language per project (en | sl)

alter table public.projects
  add column if not exists portal_locale text not null default 'en'
  check (portal_locale in ('en', 'sl'));
