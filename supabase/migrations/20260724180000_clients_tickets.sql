-- Clients, project.client_id, tickets, portal permission flags

create table if not exists public.clients (
  id text primary key,
  name text not null,
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  website text not null default '',
  country text not null default '',
  notes text not null default '',
  lead_id text references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists clients_lead_idx on public.clients (lead_id);

alter table public.clients enable row level security;
drop policy if exists "clients all" on public.clients;
create policy "clients all" on public.clients
  for all to authenticated using (true) with check (true);

-- Backfill clients from distinct project.client names
insert into public.clients (id, name, company)
select
  'c_' || md5(lower(trim(client))),
  trim(client),
  trim(client)
from public.projects
where trim(client) <> ''
on conflict (id) do nothing;

alter table public.projects
  add column if not exists client_id text references public.clients (id) on delete set null,
  add column if not exists description text not null default '',
  add column if not exists phase text not null default 'Discovery',
  add column if not exists client_can_view_tickets boolean not null default true,
  add column if not exists client_can_create_tickets boolean not null default true,
  add column if not exists client_can_upload_files boolean not null default true,
  add column if not exists client_can_comment boolean not null default true;

update public.projects p
set client_id = 'c_' || md5(lower(trim(p.client)))
where p.client_id is null and trim(p.client) <> '';

create index if not exists projects_client_idx on public.projects (client_id);

create table if not exists public.tickets (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'Todo',
  created_at timestamptz not null default now(),
  due_at date,
  assignee_kind text not null default 'studio' check (assignee_kind in ('studio', 'client')),
  assignee_id text,
  created_by_kind text not null default 'studio' check (created_by_kind in ('studio', 'client')),
  created_by_name text not null default ''
);

create index if not exists tickets_project_idx on public.tickets (project_id);
create index if not exists tickets_status_idx on public.tickets (status);

alter table public.tickets enable row level security;
drop policy if exists "tickets all" on public.tickets;
create policy "tickets all" on public.tickets
  for all to authenticated using (true) with check (true);

alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments
  add constraint attachments_parent_type_check
  check (parent_type in ('lead', 'project', 'doc', 'portal_update', 'ticket'));
