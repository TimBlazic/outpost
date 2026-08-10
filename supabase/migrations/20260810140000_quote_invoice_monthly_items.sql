-- Optional monthly / retainer line items on quotes and invoices (document-only).

alter table public.quotes
  add column if not exists monthly_items jsonb not null default '[]'::jsonb,
  add column if not exists monthly_total numeric not null default 0;

alter table public.invoices
  add column if not exists monthly_items jsonb not null default '[]'::jsonb,
  add column if not exists monthly_total numeric not null default 0;
