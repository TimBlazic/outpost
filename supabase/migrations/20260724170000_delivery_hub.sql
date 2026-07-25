-- Delivery hub: runbook links, phases, checklist, approvals

alter table public.projects
  add column if not exists figma_url text,
  add column if not exists repo_url text,
  add column if not exists brief_url text;

create table if not exists public.project_phases (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  status text not null check (status in ('upcoming', 'active', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.phase_checklist_items (
  id text primary key,
  phase_id text not null references public.project_phases (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  client_visible boolean not null default false,
  waiting_on_client boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_approvals (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('design', 'staging', 'launch')),
  approved_at timestamptz not null default now(),
  approved_by_name text not null default '',
  note text,
  unique (project_id, kind)
);

create index if not exists project_phases_project_idx on public.project_phases (project_id);
create index if not exists phase_checklist_phase_idx on public.phase_checklist_items (phase_id);
create index if not exists portal_approvals_project_idx on public.portal_approvals (project_id);

alter table public.project_phases enable row level security;
alter table public.phase_checklist_items enable row level security;
alter table public.portal_approvals enable row level security;

drop policy if exists "project_phases all" on public.project_phases;
create policy "project_phases all" on public.project_phases
  for all to authenticated using (true) with check (true);

drop policy if exists "phase_checklist all" on public.phase_checklist_items;
create policy "phase_checklist all" on public.phase_checklist_items
  for all to authenticated using (true) with check (true);

drop policy if exists "portal_approvals all" on public.portal_approvals;
create policy "portal_approvals all" on public.portal_approvals
  for all to authenticated using (true) with check (true);
