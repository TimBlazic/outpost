-- Client project portal: token+PIN access, updates, comments

alter table public.projects
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_token text unique,
  add column if not exists portal_pin_hash text,
  add column if not exists staging_url text,
  add column if not exists portal_intro text;

alter table public.tasks
  add column if not exists client_visible boolean not null default false,
  add column if not exists waiting_on_client boolean not null default false;

create table if not exists public.portal_updates (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  body text not null,
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.portal_comments (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  target_type text not null check (target_type in ('update', 'task')),
  target_id text not null,
  body text not null,
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists portal_updates_project_idx on public.portal_updates (project_id);
create index if not exists portal_comments_project_idx on public.portal_comments (project_id);
create index if not exists portal_comments_target_idx on public.portal_comments (target_type, target_id);
create index if not exists projects_portal_token_idx on public.projects (portal_token);

alter table public.portal_updates enable row level security;
alter table public.portal_comments enable row level security;

drop policy if exists "portal_updates all" on public.portal_updates;
create policy "portal_updates all" on public.portal_updates
  for all to authenticated using (true) with check (true);

drop policy if exists "portal_comments all" on public.portal_comments;
create policy "portal_comments all" on public.portal_comments
  for all to authenticated using (true) with check (true);

-- Allow portal_update parent type on attachments (drop+recreate check if present)
alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments
  add constraint attachments_parent_type_check
  check (parent_type in ('lead', 'project', 'doc', 'portal_update'));
