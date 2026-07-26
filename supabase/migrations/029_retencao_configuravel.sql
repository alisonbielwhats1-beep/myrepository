-- =============================================================================
-- Migration 029 — Fase 6: retenção configurável por academia
--
-- Estado confirmado antes desta migration:
--   • academias NÃO possui nenhum campo de retenção. A única ocorrência de
--     "dias_" no schema é acessos_catraca.dias_atraso (Fase 5), sem relação.
--   • acessos_catraca usa as colunas academia_id, aluno_id e data_hora_entrada.
--   • Índices existentes na tabela: idx_acessos_academia (academia_id),
--     idx_acessos_aluno (aluno_id), idx_acessos_origem (origem),
--     idx_acessos_academia_data (academia_id, data_hora_entrada DESC) e
--     uidx_acessos_evento_externo. NENHUM cobre (academia_id, aluno_id, data),
--     que é o padrão da agregação "último acesso por aluno".
--
-- Defaults 10 e 14 reproduzem os dois cortes que já existiam em código
-- (Retenção usava 10, painel usava 14), então os números atuais não mudam.
-- "atenção" e a tolerância são faixas novas.
--
-- Aditiva e idempotente. Nenhuma academia perde dados ou configuração.
-- =============================================================================

-- 1. Limites configuráveis por academia.
ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS dias_atencao_sem_acesso    integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS dias_risco_sem_acesso      integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dias_sumido_sem_acesso     integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS tolerancia_novo_aluno_dias integer NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_academias_retencao'
  ) THEN
    ALTER TABLE public.academias
      ADD CONSTRAINT chk_academias_retencao CHECK (
        dias_atencao_sem_acesso    >= 1 AND
        dias_risco_sem_acesso      >= 1 AND
        dias_sumido_sem_acesso     >= 1 AND
        tolerancia_novo_aluno_dias >= 1 AND
        dias_atencao_sem_acesso < dias_risco_sem_acesso AND
        dias_risco_sem_acesso   < dias_sumido_sem_acesso
      );
  END IF;
END
$$;

-- 2. Índice que serve a agregação por aluno (último acesso + contagem no
--    período). O composto existente para por (academia_id, data_hora_entrada)
--    e não ajuda a agrupar por aluno.
CREATE INDEX IF NOT EXISTS idx_acessos_academia_aluno_data
  ON public.acessos_catraca (academia_id, aluno_id, data_hora_entrada DESC);

-- ---------------------------------------------------------------------------
-- 3. RPC única de retenção.
--
-- Devolve UMA linha por aluno ativo, já agregada no banco: nada de trazer o
-- histórico de acessos para o frontend, nada de limite arbitrário (3000/20000)
-- e nada de uma consulta por aluno. A subquery agrupa os acessos da academia
-- uma única vez e o LEFT JOIN preserva quem nunca acessou (ultimo_acesso NULL).
--
-- A classificação em si NÃO acontece aqui — fica em classificarRetencao
-- (lib/utils.ts), para Dashboard e Retenção compartilharem a mesma regra.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retencao_alunos(p_dias_frequencia integer DEFAULT 30)
RETURNS TABLE (
  aluno_id        uuid,
  nome            text,
  criado_em       timestamptz,
  ultimo_acesso   timestamptz,
  acessos_periodo integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.id,
    a.nome,
    a.criado_em,
    ac.ultimo_acesso,
    COALESCE(ac.acessos_periodo, 0)::integer
  FROM public.alunos a
  LEFT JOIN (
    SELECT
      c.aluno_id,
      MAX(c.data_hora_entrada) AS ultimo_acesso,
      COUNT(*) FILTER (
        WHERE c.data_hora_entrada >= now() - make_interval(days => p_dias_frequencia)
      ) AS acessos_periodo
    FROM public.acessos_catraca c
    WHERE c.academia_id = public.academia_id_atual()
      AND c.aluno_id IS NOT NULL
    GROUP BY c.aluno_id
  ) ac ON ac.aluno_id = a.id
  WHERE a.academia_id = public.academia_id_atual()
    AND a.status_matricula = 'ativa'
  ORDER BY a.nome;
$$;

GRANT EXECUTE ON FUNCTION public.retencao_alunos(integer) TO authenticated;
