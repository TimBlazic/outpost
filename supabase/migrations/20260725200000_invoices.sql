-- Invoices + billing fields on firm_settings and clients

alter table public.firm_settings
  add column if not exists billing_address text not null default '',
  add column if not exists billing_email text not null default '',
  add column if not exists billing_phone text not null default '',
  add column if not exists tax_number text not null default '',
  add column if not exists vat_id text not null default '',
  add column if not exists vat_status text not null default '',
  add column if not exists registration_number text not null default '',
  add column if not exists iban text not null default '',
  add column if not exists bic text not null default '',
  add column if not exists bank_name text not null default '',
  add column if not exists issue_place text not null default '',
  add column if not exists signature_path text,
  add column if not exists invoice_prefix text not null default '',
  add column if not exists invoice_next_sequence_by_year jsonb not null default '{}'::jsonb,
  add column if not exists default_currency text not null default 'EUR',
  add column if not exists default_payment_terms_days integer not null default 14;

alter table public.clients
  add column if not exists billing_address text not null default '',
  add column if not exists tax_number text not null default '',
  add column if not exists vat_id text not null default '',
  add column if not exists registration_number text not null default '',
  add column if not exists payment_terms_days integer;

create table if not exists public.invoices (
  id text primary key,
  client_id text references public.clients (id) on delete set null,
  client_snapshot jsonb not null default '{}'::jsonb,
  invoice_number text,
  year integer,
  sequence integer,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'void')),
  issue_date date not null,
  due_date date not null,
  currency text not null default 'EUR',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  total numeric not null default 0,
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date desc);

alter table public.invoices enable row level security;
drop policy if exists "invoices all" on public.invoices;
create policy "invoices all"
  on public.invoices for all to authenticated
  using (true) with check (true);
