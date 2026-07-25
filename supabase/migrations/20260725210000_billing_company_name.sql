-- Issuer company name separate from personal / studio name

alter table public.firm_settings
  add column if not exists billing_company_name text not null default '';
