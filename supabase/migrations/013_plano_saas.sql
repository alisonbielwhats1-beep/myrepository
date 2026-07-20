-- Migration 013: SaaS subscription plan column for academias.
-- Default is 'profissional' so all existing academies retain full access.
-- Values: 'basico' | 'profissional' | 'premium'

alter table public.academias
  add column if not exists plano_saas text not null default 'profissional'
  check (plano_saas in ('basico', 'profissional', 'premium'));
