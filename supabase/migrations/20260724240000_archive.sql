-- Soft-archive clients and projects

alter table public.clients
  add column if not exists archived_at timestamptz null;

alter table public.projects
  add column if not exists archived_at timestamptz null;

create index if not exists clients_archived_at_idx on public.clients (archived_at);
create index if not exists projects_archived_at_idx on public.projects (archived_at);
