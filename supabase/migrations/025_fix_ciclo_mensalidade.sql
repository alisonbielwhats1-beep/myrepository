-- =============================================================================
-- Migration 025 — Corrige ciclo de cobrança por recorrência
--
-- Problemas corrigidos:
--   • RPC usava alunos.criado_em como âncora e ignorava dia_vencimento.
--   • Alunos sem historico_planos ficavam sem âncora de ciclo.
--
-- Esta migration:
--   1. Emite contagem de alunos sem histórico (RAISE NOTICE).
--   2. Faz backfill idempotente de historico_planos.
--   3. Recria a RPC com ancoragem em historico_planos, fallback em
--      criado_em, uso de dia_vencimento e fuso America/Sao_Paulo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Contagem prévia (somente informativa, não altera dados)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_sem_historico integer;
BEGIN
  SELECT COUNT(*) INTO v_sem_historico
  FROM public.alunos a
  WHERE a.plano_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.historico_planos h WHERE h.aluno_id = a.id
    );
  RAISE NOTICE 'Alunos com plano sem historico_planos (backfill pendente): %', v_sem_historico;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Backfill — insere um registro inicial para alunos com plano sem histórico.
--    Copia academia_id, aluno_id, plano atual e data_inicio baseada em criado_em.
--    Idempotente: filtra somente quem não tem nenhum registro.
-- ---------------------------------------------------------------------------
INSERT INTO public.historico_planos
  (academia_id, aluno_id, plano_id, plano_nome, valor, recorrencia_meses, data_inicio)
SELECT
  a.academia_id,
  a.id,
  a.plano_id,
  p.nome,
  p.valor_mensal,
  p.recorrencia_meses,
  (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
FROM public.alunos a
JOIN public.planos p ON p.id = a.plano_id
WHERE a.plano_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.historico_planos h WHERE h.aluno_id = a.id
  );

-- ---------------------------------------------------------------------------
-- 3. RPC atualizada
--    Âncora: historico_planos.data_inicio mais recente; fallback: criado_em.
--    Vencimento: alunos.dia_vencimento (COALESCE 1).
--    Fuso: America/Sao_Paulo em toda operação de data.
--    Ciclo: só gera quando meses_decorridos % recorrencia_meses = 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_do_mes(p_competencia date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academia          uuid    := public.academia_id_atual();
  v_comp              date    := date_trunc('month', p_competencia)::date;
  v_ultimo_dia        integer;
  v_criadas           integer := 0;
  r                   record;
  v_data              date;
  v_dia               integer;
  v_meses_decorridos  integer;
BEGIN
  IF v_academia IS NULL THEN
    RAISE EXCEPTION 'Sem academia no contexto do usuário';
  END IF;

  v_ultimo_dia := EXTRACT(DAY FROM (v_comp + INTERVAL '1 month - 1 day'))::integer;

  FOR r IN
    SELECT
      a.id                                  AS aluno_id,
      a.nome,
      COALESCE(a.dia_vencimento, 1)         AS dia_vencimento,
      p.valor_mensal,
      p.recorrencia_meses,
      -- Âncora do ciclo: último data_inicio do histórico; fallback criado_em em SP.
      COALESCE(
        (SELECT h.data_inicio
         FROM public.historico_planos h
         WHERE h.aluno_id = a.id
           AND h.academia_id = v_academia
         ORDER BY h.data_inicio DESC
         LIMIT 1),
        (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS inicio_ciclo
    FROM public.alunos a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.academia_id = v_academia
      AND a.status_matricula = 'ativa'
      AND COALESCE(p.valor_mensal, 0) > 0
      AND p.cobranca_recorrente = true
  LOOP
    -- Meses completos entre início do ciclo e a competência alvo.
    v_meses_decorridos :=
      (EXTRACT(YEAR  FROM v_comp)::int * 12 + EXTRACT(MONTH FROM v_comp)::int)
    - (EXTRACT(YEAR  FROM r.inicio_ciclo)::int * 12 + EXTRACT(MONTH FROM r.inicio_ciclo)::int);

    -- Planos mensais (recorrencia = 1): cobrar todo mês.
    -- Demais: só quando v_comp coincide com o início de um novo ciclo completo.
    IF v_meses_decorridos < 0
       OR (r.recorrencia_meses > 1 AND (v_meses_decorridos % r.recorrencia_meses) <> 0)
    THEN
      CONTINUE;
    END IF;

    -- Dia de vencimento limitado ao último dia do mês.
    v_dia  := LEAST(r.dia_vencimento, v_ultimo_dia);
    v_data := make_date(
      EXTRACT(YEAR  FROM v_comp)::int,
      EXTRACT(MONTH FROM v_comp)::int,
      v_dia
    );

    INSERT INTO public.receitas
      (academia_id, aluno_id, tipo, descricao, valor, data, status, competencia)
    VALUES
      (v_academia, r.aluno_id, 'mensalidade',
       'Mensalidade - ' || r.nome,
       r.valor_mensal, v_data, 'pendente', v_comp)
    ON CONFLICT (aluno_id, competencia)
      WHERE tipo = 'mensalidade' AND aluno_id IS NOT NULL AND competencia IS NOT NULL
    DO NOTHING;

    IF FOUND THEN
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  RETURN v_criadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_mensalidades_do_mes(date) TO authenticated;
