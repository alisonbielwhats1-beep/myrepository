-- =============================================================================
-- Migração 012 — Integrações Gympass / TotalPass
--
-- Adiciona um segredo único por academia para autenticar os webhooks de
-- check-in enviados pelas plataformas parceiras.
--
-- Execute no SQL Editor do Supabase (é idempotente).
-- =============================================================================

alter table public.academias
  add column if not exists gympass_webhook_secret   text not null default gen_random_uuid()::text,
  add column if not exists totalpass_webhook_secret text not null default gen_random_uuid()::text;
