-- Which KPI cards to show on the studio dashboard

alter table public.firm_settings
  add column if not exists dashboard_kpis jsonb not null default '[
    "new_leads",
    "qualified_go",
    "contacted",
    "proposals",
    "pipeline_value",
    "conversion"
  ]'::jsonb;
