-- =============================================================================
-- Migration 031 — Fase 7A: regime de caixa e saldo registrado
--
-- Estado confirmado antes desta migration:
--   • receitas já possui data_pagamento e forma_pagamento (migration 027).
--   • despesas NÃO possui nenhuma das duas — assimetria que impedia calcular
--     despesa paga em regime de caixa.
--   • academias NÃO possui saldo inicial, então o "fluxo de caixa" nunca teve
--     ponto de partida e jamais bateria com extrato nenhum.
--
-- Esta migration é aditiva e idempotente. NENHUM valor existente é alterado e
-- NÃO há backfill: despesas já pagas continuam com data_pagamento nula e serão
-- reportadas na interface como fora do regime de caixa, em vez de receberem uma
-- data inventada.
-- =============================================================================

-- 1. Simetria com receitas: quando e como a despesa foi efetivamente paga.
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_pagamento  date,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

-- 2. Ponto de partida do saldo registrado no GestAcad.
--    data_saldo_inicial nula = contar desde o primeiro lançamento pago com data.
ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS saldo_inicial      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_saldo_inicial date;

-- 3. Índices para os recortes de caixa por período.
CREATE INDEX IF NOT EXISTS idx_receitas_academia_data_pagamento
  ON public.receitas (academia_id, data_pagamento)
  WHERE data_pagamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_academia_data_pagamento
  ON public.despesas (academia_id, data_pagamento)
  WHERE data_pagamento IS NOT NULL;

-- Pendências (vencido/futuro) varrem por status + vencimento.
CREATE INDEX IF NOT EXISTS idx_receitas_academia_status_data
  ON public.receitas (academia_id, status, data);
CREATE INDEX IF NOT EXISTS idx_despesas_academia_status_data
  ON public.despesas (academia_id, status, data);

-- Competência (DRE).
CREATE INDEX IF NOT EXISTS idx_receitas_academia_competencia
  ON public.receitas (academia_id, competencia);
CREATE INDEX IF NOT EXISTS idx_despesas_academia_competencia
  ON public.despesas (academia_id, competencia);

-- =============================================================================
-- 4. Agregações no banco.
--
-- Antes desta migration o Financeiro carregava TODO o histórico de receitas e
-- despesas para o Node e somava em memória. Além de não escalar (uma academia
-- com anos de histórico transfere dezenas de milhares de linhas a cada abertura
-- da página), o PostgREST aplica um teto de linhas por resposta — ou seja, os
-- totais seriam silenciosamente TRUNCADOS, sem erro nenhum.
--
-- As três funções abaixo devolvem apenas os números necessários. As tabelas
-- detalhadas continuam usando as consultas normais, já filtradas por período.
-- Todas resolvem o tenant por academia_id_atual(); nenhuma aceita academia_id
-- como parâmetro.
-- =============================================================================

-- 4.1 Resumo: caixa do período, pendências, saldo e lançamentos incompletos.
CREATE OR REPLACE FUNCTION public.financeiro_resumo(p_inicio date, p_fim date)
RETURNS TABLE (
  receita_recebida            numeric,
  despesa_paga                numeric,
  resultado                   numeric,
  receber_vencido             numeric,
  receber_futuro              numeric,
  receber_qtd_vencido         integer,
  receber_qtd_futuro          integer,
  pagar_vencido               numeric,
  pagar_futuro                numeric,
  pagar_qtd_vencido           integer,
  pagar_qtd_futuro            integer,
  saldo_inicial               numeric,
  saldo_desde                 date,
  saldo_recebido              numeric,
  saldo_pago                  numeric,
  saldo                       numeric,
  incompletas_receitas        integer,
  incompletas_receitas_valor  numeric,
  incompletas_despesas        integer,
  incompletas_despesas_valor  numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_academia uuid := public.academia_id_atual();
  v_hoje     date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicial  numeric;
  v_corte    date;
  v_desde    date;
BEGIN
  IF v_academia IS NULL THEN
    RAISE EXCEPTION 'Sem academia no contexto do usuário';
  END IF;

  SELECT a.saldo_inicial, a.data_saldo_inicial
    INTO v_inicial, v_corte
  FROM public.academias a WHERE a.id = v_academia;

  -- Sem data de corte, o saldo conta desde o primeiro lançamento pago com data.
  -- LEAST ignora NULL, então funciona mesmo se um dos lados não tiver nada.
  v_desde := COALESCE(v_corte, LEAST(
    (SELECT MIN(r.data_pagamento) FROM public.receitas r
      WHERE r.academia_id = v_academia AND r.status = 'pago' AND r.data_pagamento IS NOT NULL),
    (SELECT MIN(d.data_pagamento) FROM public.despesas d
      WHERE d.academia_id = v_academia AND d.status = 'pago' AND d.data_pagamento IS NOT NULL)
  ));

  RETURN QUERY
  WITH cx AS (
    SELECT
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'pago' AND r.data_pagamento BETWEEN p_inicio AND p_fim), 0) AS receita,
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'pendente' AND r.data < v_hoje), 0)                          AS rec_venc,
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'pendente' AND r.data >= v_hoje), 0)                         AS rec_fut,
      COUNT(*) FILTER (WHERE r.status = 'pendente' AND r.data <  v_hoje)              AS rec_qv,
      COUNT(*) FILTER (WHERE r.status = 'pendente' AND r.data >= v_hoje)              AS rec_qf,
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'pago' AND r.data_pagamento IS NOT NULL
          AND (v_desde IS NULL OR r.data_pagamento >= v_desde)), 0)                   AS rec_saldo,
      COUNT(*) FILTER (WHERE r.status = 'pago' AND r.data_pagamento IS NULL)          AS rec_inc,
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'pago' AND r.data_pagamento IS NULL), 0)                     AS rec_inc_val
    FROM public.receitas r
    WHERE r.academia_id = v_academia
  ),
  dx AS (
    SELECT
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'pago' AND d.data_pagamento BETWEEN p_inicio AND p_fim), 0) AS despesa,
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'pendente' AND d.data < v_hoje), 0)                          AS des_venc,
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'pendente' AND d.data >= v_hoje), 0)                         AS des_fut,
      COUNT(*) FILTER (WHERE d.status = 'pendente' AND d.data <  v_hoje)              AS des_qv,
      COUNT(*) FILTER (WHERE d.status = 'pendente' AND d.data >= v_hoje)              AS des_qf,
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'pago' AND d.data_pagamento IS NOT NULL
          AND (v_desde IS NULL OR d.data_pagamento >= v_desde)), 0)                   AS des_saldo,
      COUNT(*) FILTER (WHERE d.status = 'pago' AND d.data_pagamento IS NULL)          AS des_inc,
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'pago' AND d.data_pagamento IS NULL), 0)                     AS des_inc_val
    FROM public.despesas d
    WHERE d.academia_id = v_academia
  )
  SELECT
    cx.receita, dx.despesa, cx.receita - dx.despesa,
    cx.rec_venc, cx.rec_fut, cx.rec_qv::integer, cx.rec_qf::integer,
    dx.des_venc, dx.des_fut, dx.des_qv::integer, dx.des_qf::integer,
    COALESCE(v_inicial, 0), v_desde, cx.rec_saldo, dx.des_saldo,
    COALESCE(v_inicial, 0) + cx.rec_saldo - dx.des_saldo,
    cx.rec_inc::integer, cx.rec_inc_val,
    dx.des_inc::integer, dx.des_inc_val
  FROM cx, dx;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_resumo(date, date) TO authenticated;

-- 4.2 DRE por competência, separando o que já foi realizado do que está em aberto.
--     Competência ausente (venda de produto, receita manual antiga) cai no mês
--     da data do lançamento — contabilizado em `sem_competencia` para a interface
--     poder avisar quantos históricos usaram o fallback.
CREATE OR REPLACE FUNCTION public.financeiro_dre(p_inicio date, p_fim date)
RETURNS TABLE (
  escopo           text,
  chave            text,
  total            numeric,
  realizado        numeric,
  em_aberto        numeric,
  sem_competencia  integer
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH lim AS (
    SELECT date_trunc('month', p_inicio)::date AS ini, p_fim AS fim
  )
  SELECT
    'receita'::text,
    r.tipo::text,
    COALESCE(SUM(r.valor), 0),
    COALESCE(SUM(r.valor) FILTER (WHERE r.status = 'pago'), 0),
    COALESCE(SUM(r.valor) FILTER (WHERE r.status = 'pendente'), 0),
    COUNT(*) FILTER (WHERE r.competencia IS NULL)::integer
  FROM public.receitas r, lim
  WHERE r.academia_id = public.academia_id_atual()
    AND r.status <> 'cancelada'
    AND COALESCE(r.competencia, date_trunc('month', r.data)::date) BETWEEN lim.ini AND lim.fim
  GROUP BY r.tipo

  UNION ALL

  SELECT
    'despesa'::text,
    d.categoria::text,
    COALESCE(SUM(d.valor), 0),
    COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'pago'), 0),
    COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'pendente'), 0),
    COUNT(*) FILTER (WHERE d.competencia IS NULL)::integer
  FROM public.despesas d, lim
  WHERE d.academia_id = public.academia_id_atual()
    AND d.status <> 'cancelada'
    AND COALESCE(d.competencia, date_trunc('month', d.data)::date) BETWEEN lim.ini AND lim.fim
  GROUP BY d.categoria;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_dre(date, date) TO authenticated;

-- 4.3 Série do gráfico. p_diario=true agrupa por dia; false, por mês.
--     Barras = caixa realizado (data_pagamento). Pendências entram pelo
--     vencimento no mesmo bucket. Cancelada nunca entra.
CREATE OR REPLACE FUNCTION public.financeiro_serie(
  p_inicio  date,
  p_fim     date,
  p_diario  boolean DEFAULT true
)
RETURNS TABLE (
  bucket          date,
  receita         numeric,
  despesa         numeric,
  receita_pend    numeric,
  despesa_pend    numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH buckets AS (
    SELECT generate_series(
      CASE WHEN p_diario THEN p_inicio ELSE date_trunc('month', p_inicio)::date END,
      p_fim,
      CASE WHEN p_diario THEN interval '1 day' ELSE interval '1 month' END
    )::date AS b
  ),
  chave AS (
    SELECT
      CASE WHEN p_diario THEN 'day' ELSE 'month' END AS unidade
  ),
  rec AS (
    SELECT
      date_trunc((SELECT unidade FROM chave), r.data_pagamento)::date AS b,
      SUM(r.valor) AS v
    FROM public.receitas r
    WHERE r.academia_id = public.academia_id_atual()
      AND r.status = 'pago'
      AND r.data_pagamento BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  des AS (
    SELECT
      date_trunc((SELECT unidade FROM chave), d.data_pagamento)::date AS b,
      SUM(d.valor) AS v
    FROM public.despesas d
    WHERE d.academia_id = public.academia_id_atual()
      AND d.status = 'pago'
      AND d.data_pagamento BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  recp AS (
    SELECT
      date_trunc((SELECT unidade FROM chave), r.data)::date AS b,
      SUM(r.valor) AS v
    FROM public.receitas r
    WHERE r.academia_id = public.academia_id_atual()
      AND r.status = 'pendente'
      AND r.data BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  desp AS (
    SELECT
      date_trunc((SELECT unidade FROM chave), d.data)::date AS b,
      SUM(d.valor) AS v
    FROM public.despesas d
    WHERE d.academia_id = public.academia_id_atual()
      AND d.status = 'pendente'
      AND d.data BETWEEN p_inicio AND p_fim
    GROUP BY 1
  )
  SELECT
    buckets.b,
    COALESCE(rec.v, 0),
    COALESCE(des.v, 0),
    COALESCE(recp.v, 0),
    COALESCE(desp.v, 0)
  FROM buckets
  LEFT JOIN rec  ON rec.b  = buckets.b
  LEFT JOIN des  ON des.b  = buckets.b
  LEFT JOIN recp ON recp.b = buckets.b
  LEFT JOIN desp ON desp.b = buckets.b
  ORDER BY buckets.b;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_serie(date, date, boolean) TO authenticated;
