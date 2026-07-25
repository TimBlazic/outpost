-- Ticket comments (Linear-style): threads, reactions, attachments

create table if not exists public.ticket_comments (
  id text primary key,
  ticket_id text not null references public.tickets (id) on delete cascade,
  parent_id text references public.ticket_comments (id) on delete cascade,
  body text not null default '',
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_name text not null default '',
  author_id text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists ticket_comments_ticket_idx on public.ticket_comments (ticket_id);
create index if not exists ticket_comments_parent_idx on public.ticket_comments (parent_id);

create table if not exists public.ticket_comment_reactions (
  id text primary key,
  comment_id text not null references public.ticket_comments (id) on delete cascade,
  emoji text not null,
  author_kind text not null check (author_kind in ('studio', 'client')),
  author_name text not null default '',
  created_at timestamptz not null default now(),
  unique (comment_id, emoji, author_kind, author_name)
);

create index if not exists ticket_comment_reactions_comment_idx
  on public.ticket_comment_reactions (comment_id);

alter table public.ticket_comments enable row level security;
alter table public.ticket_comment_reactions enable row level security;

drop policy if exists "ticket_comments all" on public.ticket_comments;
create policy "ticket_comments all" on public.ticket_comments
  for all to authenticated using (true) with check (true);

drop policy if exists "ticket_comment_reactions all" on public.ticket_comment_reactions;
create policy "ticket_comment_reactions all" on public.ticket_comment_reactions
  for all to authenticated using (true) with check (true);

alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments
  add constraint attachments_parent_type_check
  check (parent_type in ('lead', 'project', 'doc', 'portal_update', 'ticket', 'ticket_comment'));
