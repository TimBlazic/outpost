-- Editable AI qualify pricing guidance on firm settings

alter table public.firm_settings
  add column if not exists ai_qualify_pricing_prompt text not null default '';
