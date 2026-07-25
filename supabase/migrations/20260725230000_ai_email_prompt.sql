-- Editable AI email system prompt on firm settings

alter table public.firm_settings
  add column if not exists ai_email_system_prompt text not null default '';
