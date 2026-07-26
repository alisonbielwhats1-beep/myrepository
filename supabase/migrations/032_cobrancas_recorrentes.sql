-- =============================================================================
-- Migration 032 — Geração automática de cobranças recorrentes
--
-- A RPC gerar_mensalidades_do_mes (migration 025) gera "o mês inteiro de uma
-- competência". Isso serve a um botão manual, mas não a um cron diário: ela não
-- sabe o que é "faltam 7 dias para o vencimento".
--
-- Esta migration adiciona a lógica central de sincronização. Botão manual e
-- rotina agendada chamam a MESMA função — a regra existe em um lugar só.
--
-- O espelho testável desta regra está em lib/cobrancas.ts, coberto por
-- tests/cobrancas.test.cjs. Ao mexer aqui, mexa lá.
--
-- Nada aqui movimenta dinheiro: só cria receita com status 'pendente'.
-- gerar_mensalidades_do_mes NÃO é removida — segue disponível.
--
-- Aditiva e idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Núcleo: sincroniza uma academia.
--
-- Para cada aluno elegível (matrícula ativa + plano com cobrança recorrente e
-- valor > 0), percorre as competências do mês corrente até o mês em que cai
-- hoje + p_dias, e cria a cobrança quando:
--   • a competência fecha um ciclo do plano, ancorado em
--     historico_planos.data_inicio (fallback: criação do aluno em SP); e
--   • o vencimento já está dentro da antecedência (vencimento <= hoje + p_dias).
--
-- Status de pagamento NUNCA é consultado: agosto nasce mesmo com julho vencido.
-- A janela não retroage antes do mês corrente, para um cron que ficou fora do
-- ar não despejar meses de cobranças retroativas de uma vez.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_cobrancas_academia(
  p_academia uuid,
  p_dias     integer DEFAULT 7
)
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
  v_hoje       date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_limite     date;
  v_criadas    integer := 0;
  v_existiam   integer := 0;
  v_elegiveis  integer := 0;
  r            record;
  v_comp       date;
  v_decorridos integer;
  v_venc       date;
  v_ja         boolean;
BEGIN
  IF p_academia IS NULL THEN
    RAISE EXCEPTION 'Academia não informada';
  END IF;

  v_limite := v_hoje + GREATEST(COALESCE(p_dias, 7), 0);

  FOR r IN
    SELECT
      a.id                            AS aluno_id,
      a.nome,
      COALESCE(a.dia_vencimento, 1)   AS dia_vencimento,
      p.valor_mensal,
      GREATEST(COALESCE(p.recorrencia_meses, 1), 1) AS recorrencia_meses,
      COALESCE(
        (SELECT h.data_inicio
           FROM public.historico_planos h
          WHERE h.aluno_id = a.id
            AND h.academia_id = p_academia
          ORDER BY h.data_inicio DESC
          LIMIT 1),
        (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS inicio_ciclo
    FROM public.alunos a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.academia_id = p_academia
      AND a.status_matricula = 'ativa'      -- trancado/inativo/cancelado ficam fora
      AND a.plano_id IS NOT NULL
      AND p.cobranca_recorrente = true
      AND COALESCE(p.valor_mensal, 0) > 0
  LOOP
    v_elegiveis := v_elegiveis + 1;

    -- Competências do mês corrente até o mês do limite (1 ou 2 iterações).
    FOR v_comp IN
      SELECT generate_series(
        date_trunc('month', v_hoje)::date,
        date_trunc('month', v_limite)::date,
        interval '1 month'
      )::date
    LOOP
      v_decorridos :=
        (EXTRACT(YEAR FROM v_comp)::int * 12 + EXTRACT(MONTH FROM v_comp)::int)
      - (EXTRACT(YEAR FROM r.inicio_ciclo)::int * 12 + EXTRACT(MONTH FROM r.inicio_ciclo)::int);

      -- Antes do início do ciclo, ou mês intermediário de plano não mensal.
      IF v_decorridos < 0
         OR (r.recorrencia_meses > 1 AND (v_decorridos % r.recorrencia_meses) <> 0)
      THEN
        CONTINUE;
      END IF;

      v_venc := make_date(
        EXTRACT(YEAR FROM v_comp)::int,
        EXTRACT(MONTH FROM v_comp)::int,
        LEAST(
          r.dia_vencimento,
          EXTRACT(DAY FROM (v_comp + interval '1 month - 1 day'))::int
        )
      );

      -- Ainda falta mais que a antecedência: não cria agora.
      IF v_venc > v_limite THEN
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.receitas x
         WHERE x.aluno_id = r.aluno_id
           AND x.competencia = v_comp
           AND x.tipo = 'mensalidade'
      ) INTO v_ja;

      IF v_ja THEN
        v_existiam := v_existiam + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.receitas
        (academia_id, aluno_id, tipo, descricao, valor, data, status, competencia)
      VALUES
        (p_academia, r.aluno_id, 'mensalidade',
         'Mensalidade - ' || r.nome,
         r.valor_mensal, v_venc, 'pendente', v_comp)
      ON CONFLICT (aluno_id, competencia)
        WHERE tipo = 'mensalidade' AND aluno_id IS NOT NULL AND competencia IS NOT NULL
      DO NOTHING;

      IF FOUND THEN
        v_criadas := v_criadas + 1;
      ELSE
        -- Corrida com outra execução: o índice único protegeu.
        v_existiam := v_existiam + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_criadas, v_existiam, v_elegiveis;
END;
$$;

-- -----------------------------------------------------------------------------
-- Botão manual "Sincronizar cobranças": mesma lógica, escopo da academia do
-- usuário logado. Não aceita academia_id como parâmetro.
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
BEGIN
  IF v_academia IS NULL THEN
    RAISE EXCEPTION 'Sem academia no contexto do usuário';
  END IF;
  RETURN QUERY SELECT * FROM public.sincronizar_cobrancas_academia(v_academia, p_dias);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_cobrancas(integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- Rotina agendada: varre todas as academias. Só o service_role chama (a rota
-- /api/cron/cobrancas), nunca o navegador — por isso NÃO há grant para
-- authenticated aqui.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_cobrancas_todas(p_dias integer DEFAULT 7)
RETURNS TABLE (
  academia_id      uuid,
  criadas          integer,
  ja_existiam      integer,
  alunos_elegiveis integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  res record;
BEGIN
  FOR a IN SELECT id FROM public.academias LOOP
    SELECT * INTO res FROM public.sincronizar_cobrancas_academia(a.id, p_dias);
    academia_id      := a.id;
    criadas          := res.criadas;
    ja_existiam      := res.ja_existiam;
    alunos_elegiveis := res.alunos_elegiveis;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_cobrancas_todas(integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_cobrancas_academia(uuid, integer) FROM public, anon, authenticated;
