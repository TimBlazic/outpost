-- Link project installments ↔ invoices (create one invoice at a time)

alter table public.payments
  add column if not exists invoice_id text references public.invoices (id) on delete set null;

alter table public.invoices
  add column if not exists payment_id text;

create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists invoices_payment_idx on public.invoices (payment_id);
