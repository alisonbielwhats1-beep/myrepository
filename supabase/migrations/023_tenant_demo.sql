-- =============================================================================
-- Migration 023 — Coluna is_demo para identificar tenants de demonstração.
--
-- Apenas alteração estrutural. Nenhum dado inserido ou atualizado aqui.
-- Todos os tenants existentes ficam com is_demo = false (default).
-- O tenant de demonstração é marcado pelo script scripts/criar-demo.mjs.
--
-- Seguro rodar mais de uma vez (IF NOT EXISTS).
-- =============================================================================

ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
