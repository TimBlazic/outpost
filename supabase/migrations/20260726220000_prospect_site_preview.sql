-- Hunt card site preview (title / meta / signal) filled on search

alter table public.prospects
  add column if not exists site_title text,
  add column if not exists site_description text,
  add column if not exists site_cms text,
  add column if not exists site_signal text
    check (
      site_signal is null
      or site_signal in ('none', 'down', 'dated', 'ok', 'modern')
    ),
  add column if not exists site_previewed_at timestamptz;
