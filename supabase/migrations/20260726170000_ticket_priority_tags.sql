-- Ticket priority + tags for richer board cards / AI drafts

alter table public.tickets
  add column if not exists priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High')),
  add column if not exists tags text[] not null default '{}';

create index if not exists tickets_priority_idx on public.tickets (priority);
