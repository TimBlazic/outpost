-- Optional project link + paid date for dashboard revenue

alter table public.invoices
  add column if not exists project_id text references public.projects (id) on delete set null,
  add column if not exists paid_at date;

create index if not exists invoices_project_idx on public.invoices (project_id);
create index if not exists invoices_paid_at_idx on public.invoices (paid_at desc);
