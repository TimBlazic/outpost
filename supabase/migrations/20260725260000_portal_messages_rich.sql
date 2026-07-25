-- Rich portal messages: replies, edit, soft unsend, reactions, attachments

alter table public.portal_messages
  add column if not exists parent_id text
    references public.portal_messages (id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists portal_messages_parent_idx
  on public.portal_messages (parent_id);

create table if not exists public.portal_message_reactions (
  id text primary key,
  message_id text not null references public.portal_messages (id) on delete cascade,
  emoji text not null,
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_name text not null default '',
  created_at timestamptz not null default now(),
  unique (message_id, emoji, author_kind, author_name)
);

create index if not exists portal_message_reactions_message_idx
  on public.portal_message_reactions (message_id);

alter table public.portal_message_reactions enable row level security;
drop policy if exists "portal_message_reactions all" on public.portal_message_reactions;
create policy "portal_message_reactions all"
  on public.portal_message_reactions for all to authenticated
  using (true) with check (true);

alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments
  add constraint attachments_parent_type_check
  check (parent_type in (
    'lead', 'project', 'doc', 'portal_update', 'ticket', 'ticket_comment', 'task', 'portal_message'
  ));
