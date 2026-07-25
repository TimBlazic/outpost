-- Per-side last-read cursors for portal chat unread counts

alter table public.projects
  add column if not exists portal_studio_last_read_at timestamptz,
  add column if not exists portal_client_last_read_at timestamptz;
