-- Firm / studio settings (goals, chart seed data)

create table if not exists public.firm_settings (
  id text primary key default 'default',
  firm_name text not null default 'Studio',
  revenue_goal numeric not null default 20000,
  goal_year integer not null default 2026,
  avg_project_value numeric not null default 6000,
  monthly_revenue jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.firm_settings enable row level security;

drop policy if exists "firm_settings all" on public.firm_settings;
create policy "firm_settings all"
  on public.firm_settings for all to authenticated
  using (true) with check (true);

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
