-- =============================================================================
-- Migration 082 — hardening de papel em sincronizar_cobrancas/gerar_mensalidades_do_mes.
--
-- ACHADO (mapeamento de cobertura de testes, Lote 1 — Financeiro/Cobranças):
--   lib/permissoes.ts restringe a seção "financeiro" ao papel "dono" — nenhum
--   outro papel (gerente, recepção, instrutor) tem acesso, nem no menu nem em
--   requireSecao(slug, "financeiro") nas Server Actions.
--
--   Mas as duas RPCs abaixo, GRANT ... TO authenticated (migrations 032 e
--   025), NUNCA verificaram o papel de quem chama — diferente de
--   registrar_pagamento_mensalidade (migration 035), que já rejeita quem não
--   é 'dono'/'recepcao' dentro do próprio banco. Resultado: qualquer membro
--   autenticado da equipe (recepção, instrutor), chamando a RPC diretamente
--   via REST — sem passar pela tela, sem precisar de exploit — conseguia
--   gerar mensalidades pendentes para a academia inteira, mesmo o app achando
--   que essa ação é exclusiva do dono.
--
--   Não move dinheiro nem marca nada como pago (só cria lançamentos
--   'pendente'), mas viola o princípio do menor privilégio e o próprio modelo
--   de permissões do produto. Mesma classe de achado que a auditoria de
--   03/08/2026 já corrigiu em outros lugares (ver supabase/ci/10_assertivas_seguranca.sql).
--
-- CORREÇÃO:
--   CREATE OR REPLACE nas duas funções, mesma assinatura e mesmo corpo,
--   adicionando a checagem `v_papel <> 'dono' -> RAISE EXCEPTION` logo após a
--   checagem de sessão já existente. Nenhuma outra regra financeira muda.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sincronizar_cobrancas — botão manual "Sincronizar cobranças".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_cobrancas(p_dias integer DEFAULT 7)
RETURNS TABLE (
  criadas          integer,
  ja_existiam      integer,
  alunos_elegiveis integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academia uuid := public.academia_id_atual();
  v_papel    text := public.papel_do_usuario_atual();
BEGIN
  IF v_academia IS NULL THEN
    RAISE EXCEPTION 'Sem academia no contexto do usuário';
  END IF;

  IF v_papel <> 'dono' THEN
    RAISE EXCEPTION 'Apenas o dono da academia pode sincronizar cobranças.';
  END IF;

  RETURN QUERY SELECT * FROM public.sincronizar_cobrancas_academia(v_academia, p_dias);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_cobrancas(integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- gerar_mensalidades_do_mes — botão manual "Gerar mensalidades".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_do_mes(p_competencia date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academia          uuid    := public.academia_id_atual();
  v_papel             text    := public.papel_do_usuario_atual();
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

  IF v_papel <> 'dono' THEN
    RAISE EXCEPTION 'Apenas o dono da academia pode gerar mensalidades.';
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
