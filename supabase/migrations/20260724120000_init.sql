-- Outpost initial schema: Postgres + RLS + Storage + profile trigger

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  initials text not null,
  role text not null default 'Member' check (role in ('Admin', 'Member')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
  initials text;
begin
  full_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'User'
  );
  initials := upper(left(regexp_replace(full_name, '[^A-Za-z]', '', 'g'), 2));
  if initials = '' then
    initials := 'U';
  end if;
  insert into public.profiles (id, name, initials, role)
  values (new.id, full_name, initials, 'Member')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leads
create table public.leads (
  id text primary key,
  company text not null,
  website text not null default '',
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  country text not null default '',
  category text not null,
  source text not null,
  owner_id text not null,
  status text not null,
  value numeric not null default 0,
  probability integer not null default 0,
  first_contact date,
  last_contact date,
  next_follow_up date,
  tags text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table public.activities (
  id text primary key,
  lead_id text not null references public.leads (id) on delete cascade,
  type text not null,
  title text not null,
  detail text,
  date date not null,
  user_id text not null,
  created_at timestamptz not null default now()
);

create table public.notes (
  id text primary key,
  lead_id text not null references public.leads (id) on delete cascade,
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  date date not null,
  user_id text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  name text not null,
  client text not null,
  type text not null,
  value numeric not null default 0,
  status text not null,
  start_date date not null,
  estimated_end date not null,
  actual_end date,
  owner_id text not null,
  cost numeric not null default 0,
  source text not null,
  lead_id text references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  label text not null,
  percent numeric not null default 0,
  due_on date,
  paid boolean not null default false,
  paid_on date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id text primary key,
  title text not null,
  lead_id text references public.leads (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  assigned_to text not null,
  due date not null,
  priority text not null,
  status text not null,
  reminder boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.docs (
  id text primary key,
  title text not null,
  category text not null,
  excerpt text not null default '',
  body text not null default '',
  author_id text not null,
  last_edited date not null,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- Attachments: file upload and/or external URL, polymorphic parent
create table public.attachments (
  id text primary key,
  parent_type text not null check (parent_type in ('lead', 'project', 'doc')),
  parent_id text not null,
  label text not null,
  kind text not null default 'doc',
  url text,
  storage_path text,
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);

create index attachments_parent_idx on public.attachments (parent_type, parent_id);
create index activities_lead_idx on public.activities (lead_id);
create index notes_lead_idx on public.notes (lead_id);
create index tasks_lead_idx on public.tasks (lead_id);
create index tasks_project_idx on public.tasks (project_id);
create index payments_project_idx on public.payments (project_id);

-- Firm / studio settings
create table public.firm_settings (
  id text primary key default 'default',
  firm_name text not null default 'Studio',
  revenue_goal numeric not null default 20000,
  goal_year integer not null default 2026,
  avg_project_value numeric not null default 6000,
  monthly_revenue jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.firm_settings (
  id, firm_name, revenue_goal, goal_year, avg_project_value, monthly_revenue
) values (
  'default',
  'Studio',
  20000,
  2026,
  6000,
  '[
    {"month":"Jan","revenue":5200},
    {"month":"Feb","revenue":0},
    {"month":"Mar","revenue":0},
    {"month":"Apr","revenue":6800},
    {"month":"May","revenue":0},
    {"month":"Jun","revenue":4500}
  ]'::jsonb
) on conflict (id) do nothing;

-- RLS: invite-only authenticated team can manage everything
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.notes enable row level security;
alter table public.projects enable row level security;
alter table public.payments enable row level security;
alter table public.tasks enable row level security;
alter table public.docs enable row level security;
alter table public.attachments enable row level security;
alter table public.firm_settings enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "leads all" on public.leads for all to authenticated using (true) with check (true);
create policy "activities all" on public.activities for all to authenticated using (true) with check (true);
create policy "notes all" on public.notes for all to authenticated using (true) with check (true);
create policy "projects all" on public.projects for all to authenticated using (true) with check (true);
create policy "payments all" on public.payments for all to authenticated using (true) with check (true);
create policy "tasks all" on public.tasks for all to authenticated using (true) with check (true);
create policy "docs all" on public.docs for all to authenticated using (true) with check (true);
create policy "attachments all" on public.attachments for all to authenticated using (true) with check (true);
create policy "firm_settings all" on public.firm_settings for all to authenticated using (true) with check (true);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments storage read"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy "attachments storage insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "attachments storage update"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments');

create policy "attachments storage delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
