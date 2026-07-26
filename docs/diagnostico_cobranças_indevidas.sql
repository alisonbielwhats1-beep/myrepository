-- =============================================================================
-- Diagnóstico: cobranças potencialmente indevidas
--
-- Execute no Supabase SQL Editor (painel > SQL Editor).
-- Retorna receitas do tipo 'mensalidade' cuja competencia NÃO coincide
-- com um mês de início de ciclo válido para o aluno.
--
-- "Indevida" = a competencia cai em um mês intermediário do ciclo
-- (ex: competencia = maio para um plano semestral ancorado em janeiro).
--
-- Não exclui nem altera nada. Apenas lista para revisão manual.
-- =============================================================================

WITH ciclo AS (
  SELECT
    a.id            AS aluno_id,
    a.nome,
    a.academia_id,
    p.recorrencia_meses,
    -- Âncora: último data_inicio do histórico; fallback: criado_em em SP.
    COALESCE(
      (SELECT h.data_inicio
       FROM public.historico_planos h
       WHERE h.aluno_id = a.id
       ORDER BY h.data_inicio DESC
       LIMIT 1),
      (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
    ) AS inicio_ciclo
  FROM public.alunos a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.plano_id IS NOT NULL
),
receitas_mensalidade AS (
  SELECT
    r.id,
    r.aluno_id,
    r.academia_id,
    r.competencia,
    r.valor,
    r.status,
    r.data AS data_vencimento
  FROM public.receitas r
  WHERE r.tipo       = 'mensalidade'
    AND r.aluno_id   IS NOT NULL
    AND r.competencia IS NOT NULL
)
SELECT
  rm.id             AS receita_id,
  c.nome            AS aluno,
  rm.competencia,
  rm.valor,
  rm.status,
  c.recorrencia_meses,
  c.inicio_ciclo,
  (
    (EXTRACT(YEAR  FROM rm.competencia)::int * 12 + EXTRACT(MONTH FROM rm.competencia)::int)
  - (EXTRACT(YEAR  FROM c.inicio_ciclo)::int * 12 + EXTRACT(MONTH FROM c.inicio_ciclo)::int)
  )                 AS meses_decorridos,
  (
    (EXTRACT(YEAR  FROM rm.competencia)::int * 12 + EXTRACT(MONTH FROM rm.competencia)::int)
  - (EXTRACT(YEAR  FROM c.inicio_ciclo)::int * 12 + EXTRACT(MONTH FROM c.inicio_ciclo)::int)
  ) % c.recorrencia_meses AS resto_ciclo
FROM receitas_mensalidade rm
JOIN ciclo c ON c.aluno_id = rm.aluno_id
WHERE c.recorrencia_meses > 1               -- planos mensais nunca são indevidos por ciclo
  AND (
    (EXTRACT(YEAR  FROM rm.competencia)::int * 12 + EXTRACT(MONTH FROM rm.competencia)::int)
  - (EXTRACT(YEAR  FROM c.inicio_ciclo)::int * 12 + EXTRACT(MONTH FROM c.inicio_ciclo)::int)
  ) % c.recorrencia_meses <> 0             -- resto <> 0 = mês intermediário = potencialmente indevido
ORDER BY c.nome, rm.competencia;
