-- =============================================================================
-- Migração 093 — Melhorias na execução de treino do aluno (aba Treinos).
--
-- Três acréscimos, todos SÓ de leitura ou reconstrução do jsonb já existente —
-- nenhuma tabela ou coluna nova, nada destrutivo, seguro colar no SQL Editor:
--
--   1. salvar_progresso_treino passa a preservar DOIS campos novos por
--      exercício, além dos que já gravava:
--        • esforco  ('leve' | 'medio' | 'pesado')  — RPE de 1 toque do aluno.
--        • nao_fez  (boolean)                        — "não consegui / substituí".
--      Reconstrução campo a campo idêntica à migration 045 (nunca aceita o
--      objeto do cliente puro). Campos desconhecidos continuam descartados.
--
--   2. obter_ultima_carga_aluno — para cada exercício, a carga_realizada_kg da
--      sessão FINALIZADA mais recente. Alimenta o pré-preenchimento ("semana
--      passada você fez X kg"), tirando do aluno o trabalho de lembrar.
--
--   3. obter_resumo_evolucao_aluno — contadores para o painel "Minha evolução":
--      total de treinos finalizados, finalizados no mês e dias distintos
--      treinados no mês (fuso America/Sao_Paulo, igual ao resto do app).
--
-- Todas resolvem o aluno por token pessoal + slug DENTRO do banco (nunca
-- aluno_id do cliente), mesmo desenho de obter_recordes_aluno (059). Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. salvar_progresso_treino — agora preserva `esforco` e `nao_fez`.
--    (Recriação completa da função da migration 045 + os dois campos novos.)
-- -----------------------------------------------------------------------------
create or replace function public.salvar_progresso_treino(
  p_token uuid,
  p_slug text,
  p_sessao_id uuid,
  p_progresso jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_treino_id uuid;
  v_item jsonb;
  v_exercicio_id uuid;
  v_concluido boolean;
  v_carga numeric;
  v_reps text;
  v_esforco text;
  v_nao_fez boolean;
  v_item_valido boolean;
  v_validado jsonb := '[]'::jsonb;
  v_qtd integer;
begin
  select a.id into v_aluno_id
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;

  if v_aluno_id is null then
    return null;
  end if;

  select treino_id into v_treino_id
  from public.sessoes_treino
  where id = p_sessao_id and aluno_id = v_aluno_id and status = 'ativa';

  if v_treino_id is null then
    return null;
  end if;

  if jsonb_typeof(p_progresso) is distinct from 'array' then
    return null;
  end if;

  v_qtd := jsonb_array_length(p_progresso);
  if v_qtd > 100 then
    return null;
  end if;

  for v_item in select * from jsonb_array_elements(p_progresso)
  loop
    v_item_valido := jsonb_typeof(v_item) = 'object';
    v_exercicio_id := null;
    v_concluido := false;
    v_carga := 0;
    v_reps := '';
    v_esforco := null;
    v_nao_fez := false;

    if v_item_valido then
      begin
        v_exercicio_id := (v_item ->> 'exercicio_id')::uuid;
        v_concluido := coalesce((v_item ->> 'concluido')::boolean, false);
        v_carga := least(greatest(coalesce((v_item ->> 'carga_realizada_kg')::numeric, 0), 0), 999);
        v_reps := left(coalesce(v_item ->> 'repeticoes_realizadas', ''), 50);
        -- Whitelist do esforço: qualquer valor fora dos três rótulos vira null.
        v_esforco := case lower(coalesce(v_item ->> 'esforco', ''))
          when 'leve' then 'leve'
          when 'medio' then 'medio'
          when 'pesado' then 'pesado'
          else null
        end;
        v_nao_fez := coalesce((v_item ->> 'nao_fez')::boolean, false);
      exception when others then
        v_item_valido := false;
      end;
    end if;

    if v_item_valido and v_exercicio_id is not null and exists (
      select 1 from public.exercicios_treino
      where id = v_exercicio_id and treino_id = v_treino_id
    ) then
      v_validado := v_validado || jsonb_build_array(jsonb_build_object(
        'exercicio_id', v_exercicio_id,
        'concluido', v_concluido,
        'carga_realizada_kg', v_carga,
        'repeticoes_realizadas', v_reps,
        'esforco', v_esforco,
        'nao_fez', v_nao_fez
      ));
    end if;
  end loop;

  update public.sessoes_treino
    set progresso = v_validado,
        atualizado_em = now()
    where id = p_sessao_id and aluno_id = v_aluno_id and status = 'ativa';

  return jsonb_build_object('progresso', v_validado);
end;
$$;

comment on function public.salvar_progresso_treino(uuid, text, uuid, jsonb) is
  'Grava o progresso REALIZADO de uma sessão ativa do próprio aluno. Reconstrói o jsonb campo a campo (exercicio_id, concluido, carga_realizada_kg, repeticoes_realizadas, esforco, nao_fez) e só aceita exercicios do treino da sessão. Nunca altera exercicios_treino.';

revoke all on function public.salvar_progresso_treino(uuid, text, uuid, jsonb) from public;
grant execute on function public.salvar_progresso_treino(uuid, text, uuid, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. obter_ultima_carga_aluno — última carga por exercício (sessão finalizada
--    mais recente). Pré-preenchimento da tela de execução.
-- -----------------------------------------------------------------------------
create or replace function public.obter_ultima_carga_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  ),
  cargas as (
    select
      (p->>'exercicio_id')::uuid as exercicio_id,
      (p->>'carga_realizada_kg')::numeric as carga,
      coalesce(s.finalizado_em, s.iniciado_em) as quando
    from public.sessoes_treino s
    cross join lateral jsonb_array_elements(s.progresso) as p
    where s.aluno_id = (select aluno_id from aluno_resolvido)
      and (select aluno_id from aluno_resolvido) is not null
      and s.status = 'finalizada'
      and jsonb_typeof(p->'exercicio_id') = 'string'
      and jsonb_typeof(p->'carga_realizada_kg') = 'number'
  ),
  ultima as (
    select distinct on (exercicio_id) exercicio_id, carga
    from cargas
    where carga > 0
    order by exercicio_id, quando desc
  )
  select coalesce(jsonb_object_agg(exercicio_id::text, carga), '{}'::jsonb)
  from ultima;
$$;

comment on function public.obter_ultima_carga_aluno(uuid, text) is
  'Última carga_realizada_kg por exercício (da sessão finalizada mais recente) do próprio aluno, resolvido por token pessoal + slug. Só leitura de sessoes_treino.';

revoke all on function public.obter_ultima_carga_aluno(uuid, text) from public;
grant execute on function public.obter_ultima_carga_aluno(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. obter_resumo_evolucao_aluno — contadores do painel "Minha evolução".
-- -----------------------------------------------------------------------------
create or replace function public.obter_resumo_evolucao_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  ),
  fin as (
    select (s.finalizado_em at time zone 'America/Sao_Paulo')::date as dia_local
    from public.sessoes_treino s
    where s.aluno_id = (select aluno_id from aluno_resolvido)
      and (select aluno_id from aluno_resolvido) is not null
      and s.status = 'finalizada'
      and s.finalizado_em is not null
  ),
  ref as (
    select date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) as mes_atual
  )
  select jsonb_build_object(
    'total_finalizados', (select count(*) from fin),
    'finalizados_mes', (
      select count(*) from fin
      where date_trunc('month', dia_local) = (select mes_atual from ref)
    ),
    'dias_mes', (
      select count(distinct dia_local) from fin
      where date_trunc('month', dia_local) = (select mes_atual from ref)
    )
  );
$$;

comment on function public.obter_resumo_evolucao_aluno(uuid, text) is
  'Contadores de evolução do próprio aluno (total de treinos finalizados, finalizados no mês e dias distintos treinados no mês, fuso America/Sao_Paulo), resolvido por token pessoal + slug. Só leitura de sessoes_treino.';

revoke all on function public.obter_resumo_evolucao_aluno(uuid, text) from public;
grant execute on function public.obter_resumo_evolucao_aluno(uuid, text) to anon, authenticated;
