-- Portal UI language lives on the client account (not per-project).
alter table public.clients
  add column if not exists portal_locale text not null default 'en'
  check (portal_locale in ('en', 'sl'));

-- Backfill from a linked project's locale when available.
update public.clients c
set portal_locale = p.portal_locale
from (
  select distinct on (client_id) client_id, portal_locale
  from public.projects
  where client_id is not null
  order by client_id, created_at desc nulls last
) p
where c.id = p.client_id
  and p.portal_locale in ('en', 'sl');
