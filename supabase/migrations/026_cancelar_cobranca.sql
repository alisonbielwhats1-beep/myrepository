-- =============================================================================
-- Migration 026 — Adiciona status 'cancelada' ao enum de pagamentos
--
-- Permite cancelar cobranças individualmente com motivo, preservando
-- o histórico completo. Cobranças canceladas são ignoradas nos cálculos
-- financeiros mas continuam visíveis no histórico.
--
-- ADD VALUE IF NOT EXISTS é idempotente e não altera dados existentes.
-- =============================================================================

ALTER TYPE public.status_pagamento_enum ADD VALUE IF NOT EXISTS 'cancelada';
