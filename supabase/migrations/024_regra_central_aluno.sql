-- 024_regra_central_aluno.sql
-- Fase 4 MVP: dia_vencimento, status cancelada, data_fim/motivo em historico_planos,
-- preenchimento de competencia em mensalidades sem alterar outras receitas.

-- 1. Valor cancelada no enum (ADD VALUE é seguro: não destrói dados existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelada'
      AND enumtypid = 'status_matricula_enum'::regtype
  ) THEN
    ALTER TYPE status_matricula_enum ADD VALUE 'cancelada';
  END IF;
END
$$;

-- 2. dia_vencimento em alunos (nullable; constraint separada para compatibilidade)
ALTER TABLE alunos
  ADD COLUMN IF NOT EXISTS dia_vencimento integer;

-- Constraint só se ainda não existir (idempotente via nome)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_alunos_dia_vencimento'
  ) THEN
    ALTER TABLE alunos
      ADD CONSTRAINT chk_alunos_dia_vencimento
      CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 28));
  END IF;
END
$$;

-- 3. Preencher dia_vencimento usando o dia de criado_em, limitado a 28
UPDATE alunos
  SET dia_vencimento = LEAST(EXTRACT(DAY FROM criado_em)::integer, 28)
  WHERE dia_vencimento IS NULL;

-- 4. data_fim e motivo em historico_planos
ALTER TABLE historico_planos
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS motivo text;

-- 5. Preencher competencia ausente SOMENTE em mensalidades
--    Demais tipos (matricula, venda_produto, outra) não são tocados.
UPDATE receitas
  SET competencia = DATE_TRUNC('month', data)::date
  WHERE tipo = 'mensalidade'
    AND competencia IS NULL
    AND data IS NOT NULL;
