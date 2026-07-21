-- =============================================================================
-- Migration 020 — Meta de faturamento mensal por academia.
--
-- Permite ao dono definir uma meta de receita mensal. O painel mostra o
-- progresso (recebido no mês vs. meta) em uma barra.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

alter table public.academias
  add column if not exists meta_faturamento_mensal numeric(12,2) not null default 0;
