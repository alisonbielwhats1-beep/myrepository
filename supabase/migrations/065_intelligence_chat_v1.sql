-- =============================================================================
-- Migration 065 — GestAcad Intelligence Chat V1 (sem LLM)
--
-- Funções estritamente tipadas para as consultas operacionais do assistente.
-- Nenhuma função aceita academia_id: o tenant é sempre resolvido pela sessão
-- autenticada via academia_id_atual(). O texto digitado pelo usuário nunca
-- chega ao SQL; somente datas já interpretadas e limites numéricos chegam aqui.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.intelligence_resumo_operacional(
  p_inicio date,
  p_fim date
)
RETURNS TABLE (
  total_checkins integer,
  pico_hora integer,
  pico_quantidade integer,
  novos_alunos integer,
  alunos_ativos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_academia uuid := public.academia_id_atual();
BEGIN
  IF v_academia IS NULL OR public.papel_do_usuario_atual() <> 'dono' THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio > p_fim OR p_fim - p_inicio > 366 THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22007';
  END IF;

  RETURN QUERY
  WITH acessos_validos AS (
    SELECT
      EXTRACT(
        HOUR FROM timezone('America/Sao_Paulo', c.data_hora_entrada)
      )::integer AS hora
    FROM public.acessos_catraca c
    WHERE c.academia_id = v_academia
      AND c.cancelado_em IS NULL
      AND c.status_liberacao IN ('liberado', 'alerta')
      AND c.data_hora_entrada >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND c.data_hora_entrada < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ),
  horas AS (
    SELECT a.hora, COUNT(*)::integer AS quantidade
    FROM acessos_validos a
    GROUP BY a.hora
    ORDER BY quantidade DESC, a.hora ASC
  )
  SELECT
    (SELECT COUNT(*)::integer FROM acessos_validos),
    (SELECT h.hora FROM horas h LIMIT 1),
    COALESCE((SELECT h.quantidade FROM horas h LIMIT 1), 0),
    (
      SELECT COUNT(*)::integer
      FROM public.alunos a
      WHERE a.academia_id = v_academia
        AND a.criado_em >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND a.criado_em < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    ),
    (
      SELECT COUNT(*)::integer
      FROM public.alunos a
      WHERE a.academia_id = v_academia
        AND a.status_matricula = 'ativa'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.intelligence_resumo_operacional(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intelligence_resumo_operacional(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.intelligence_resumo_operacional(date, date) TO authenticated;

COMMENT ON FUNCTION public.intelligence_resumo_operacional(date, date) IS
  'Métricas operacionais agregadas do GestAcad Intelligence. Tenant e papel vêm da sessão; não aceita academia_id.';


CREATE OR REPLACE FUNCTION public.intelligence_inadimplentes_atuais(
  p_limite integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_academia uuid := public.academia_id_atual();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_resultado jsonb;
BEGIN
  IF v_academia IS NULL OR public.papel_do_usuario_atual() <> 'dono' THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  WITH agrupado AS (
    SELECT
      a.id AS aluno_id,
      a.nome,
      MIN(r.data) AS vencimento_mais_antigo,
      SUM(r.valor)::numeric AS valor_total,
      COUNT(*)::integer AS mensalidades
    FROM public.receitas r
    JOIN public.alunos a
      ON a.id = r.aluno_id
     AND a.academia_id = v_academia
    WHERE r.academia_id = v_academia
      AND r.tipo = 'mensalidade'
      AND r.status = 'pendente'
      AND r.data < v_hoje
    GROUP BY a.id, a.nome
  ), ordenado AS (
    SELECT
      g.*,
      ROW_NUMBER() OVER (ORDER BY g.vencimento_mais_antigo, g.nome) AS posicao,
      COUNT(*) OVER ()::integer AS total_alunos,
      SUM(g.valor_total) OVER ()::numeric AS total_valor
    FROM agrupado g
  )
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(o.total_alunos), 0),
    'totalValue', COALESCE(MAX(o.total_valor), 0),
    'items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', o.aluno_id,
          'name', o.nome,
          'dueDate', o.vencimento_mais_antigo,
          'daysOverdue', v_hoje - o.vencimento_mais_antigo,
          'value', o.valor_total,
          'charges', o.mensalidades
        ) ORDER BY o.vencimento_mais_antigo, o.nome
      ) FILTER (WHERE o.posicao <= LEAST(GREATEST(p_limite, 1), 10)),
      '[]'::jsonb
    )
  ) INTO v_resultado
  FROM ordenado o;

  RETURN COALESCE(v_resultado, '{"total":0,"totalValue":0,"items":[]}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.intelligence_inadimplentes_atuais(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intelligence_inadimplentes_atuais(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.intelligence_inadimplentes_atuais(integer) TO authenticated;

COMMENT ON FUNCTION public.intelligence_inadimplentes_atuais(integer) IS
  'Inadimplência atual por aluno, agregada e limitada. Estado histórico não é inferido.';


CREATE OR REPLACE FUNCTION public.intelligence_planos_vencendo(
  p_inicio date,
  p_fim date,
  p_limite integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_academia uuid := public.academia_id_atual();
  v_resultado jsonb;
BEGIN
  IF v_academia IS NULL OR public.papel_do_usuario_atual() <> 'dono' THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio > p_fim OR p_fim - p_inicio > 366 THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22007';
  END IF;

  WITH agrupado AS (
    SELECT
      a.id AS aluno_id,
      a.nome,
      COALESCE(p.nome, 'Plano não informado') AS plano_nome,
      MIN(r.data) AS vencimento,
      SUM(r.valor)::numeric AS valor_total,
      COUNT(*)::integer AS cobrancas
    FROM public.receitas r
    JOIN public.alunos a
      ON a.id = r.aluno_id
     AND a.academia_id = v_academia
    LEFT JOIN public.planos p
      ON p.id = a.plano_id
     AND p.academia_id = v_academia
    WHERE r.academia_id = v_academia
      AND r.tipo = 'mensalidade'
      AND r.status = 'pendente'
      AND r.data BETWEEN p_inicio AND p_fim
    GROUP BY a.id, a.nome, p.nome
  ), ordenado AS (
    SELECT
      g.*,
      ROW_NUMBER() OVER (ORDER BY g.vencimento, g.nome) AS posicao,
      COUNT(*) OVER ()::integer AS total_alunos
    FROM agrupado g
  )
  SELECT jsonb_build_object(
    'total', COALESCE(MAX(o.total_alunos), 0),
    'items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', o.aluno_id,
          'name', o.nome,
          'plan', o.plano_nome,
          'dueDate', o.vencimento,
          'value', o.valor_total,
          'charges', o.cobrancas
        ) ORDER BY o.vencimento, o.nome
      ) FILTER (WHERE o.posicao <= LEAST(GREATEST(p_limite, 1), 10)),
      '[]'::jsonb
    )
  ) INTO v_resultado
  FROM ordenado o;

  RETURN COALESCE(v_resultado, '{"total":0,"items":[]}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.intelligence_planos_vencendo(date, date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intelligence_planos_vencendo(date, date, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.intelligence_planos_vencendo(date, date, integer) TO authenticated;

COMMENT ON FUNCTION public.intelligence_planos_vencendo(date, date, integer) IS
  'Mensalidades de planos a vencer no período, limitadas e tenant-scoped.';

