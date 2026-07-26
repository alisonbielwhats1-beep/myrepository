-- =============================================================================
-- Migration 028 — Fase 5: política de acesso e inadimplência
--
-- Estado confirmado antes desta migration:
--   • status_liberacao_enum = ('liberado', 'negado', 'pendente') — sem 'alerta'.
--   • academias NÃO possui politica_inadimplencia.
--   • acessos_catraca já possui: origem (origem_acesso_enum), observacao (usada
--     como motivo da decisão) e evento_externo_id. NÃO possui política aplicada,
--     mensalidade relacionada, dias de atraso nem usuário responsável.
--
-- Por isso: 'observacao' é reaproveitada como motivo (não criamos coluna nova) e
-- 'origem' já existe. Criamos apenas o que falta.
--
-- DEFAULT 'liberar' é o que garante que NENHUMA academia passa a bloquear aluno
-- automaticamente: o padrão reproduz exatamente o comportamento atual, em que a
-- situação financeira não interfere no acesso.
--
-- Aditiva e idempotente. Nenhum dado existente é alterado.
-- =============================================================================

-- 1. Novo resultado possível de uma tentativa de acesso.
--    ADD VALUE não é usado nesta mesma migration (Postgres não permite usar um
--    valor de enum na transação em que ele é criado).
ALTER TYPE public.status_liberacao_enum ADD VALUE IF NOT EXISTS 'alerta';

-- 2. Política por academia.
ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS politica_inadimplencia text NOT NULL DEFAULT 'liberar';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_academias_politica_inadimplencia'
  ) THEN
    ALTER TABLE public.academias
      ADD CONSTRAINT chk_academias_politica_inadimplencia
      CHECK (politica_inadimplencia IN ('liberar', 'alertar', 'bloquear'));
  END IF;
END
$$;

-- 3. Histórico de acesso: preserva o que era verdade no momento da tentativa.
--    dias_atraso é gravado (e não derivado) porque a mensalidade pode ser paga
--    ou cancelada depois — o log precisa continuar contando o que valia ali.
ALTER TABLE public.acessos_catraca
  ADD COLUMN IF NOT EXISTS politica_aplicada text,
  ADD COLUMN IF NOT EXISTS mensalidade_id    uuid REFERENCES public.receitas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dias_atraso       integer,
  ADD COLUMN IF NOT EXISTS registrado_por    uuid REFERENCES public.perfis_admin(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acessos_politica
  ON public.acessos_catraca(academia_id, politica_aplicada)
  WHERE politica_aplicada IS NOT NULL;
