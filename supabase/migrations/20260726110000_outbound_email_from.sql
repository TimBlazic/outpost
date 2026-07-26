-- Studio outbound From address (Resend)

alter table public.firm_settings
  add column if not exists outbound_from_name text not null default 'Tim Blažič';

alter table public.firm_settings
  add column if not exists outbound_from_email text not null default 'tim@timblazic.dev';

update public.firm_settings
set
  outbound_from_name = coalesce(nullif(trim(outbound_from_name), ''), 'Tim Blažič'),
  outbound_from_email = coalesce(nullif(trim(outbound_from_email), ''), 'tim@timblazic.dev')
where id = 'default';
