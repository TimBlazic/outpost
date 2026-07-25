-- Project-level portal chat (studio ↔ client)

create table if not exists public.portal_messages (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  body text not null,
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_id text,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  attachment_id text
);

create index if not exists portal_messages_project_created_idx
  on public.portal_messages (project_id, created_at);

alter table public.portal_messages enable row level security;
drop policy if exists "portal_messages all" on public.portal_messages;
create policy "portal_messages all"
  on public.portal_messages for all to authenticated
  using (true) with check (true);
