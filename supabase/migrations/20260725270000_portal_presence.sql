-- One-way client presence for studio chat (client last seen)

alter table public.projects
  add column if not exists portal_client_last_seen_at timestamptz;
