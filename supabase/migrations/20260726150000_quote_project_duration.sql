-- Optional project duration estimate on quotes (shown on PDF only if set)

alter table public.quotes
  add column if not exists project_duration text not null default '';
