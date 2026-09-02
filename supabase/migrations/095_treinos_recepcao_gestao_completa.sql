-- =============================================================================
-- Migração 095 — Recepção passa a GERENCIAR treinos (como a equipe técnica)
--
-- PEDIDO DO CLIENTE (02/09/2026)
--   A academia pediu para "liberar os treinos para a Recepção". Até aqui a
--   recepção só CONSULTAVA a seção de treinos (RLS de leitura via nível
--   'academia'/plataforma) e era barrada de qualquer ESCRITA — no TypeScript
--   (lib/permissoes.ts), nas rotas de API e, principalmente, no próprio banco:
--   as RPCs security-definer recusavam papel 'recepcao', e a política de leitura
--   escondia os modelos de nível 'equipe'.
--
-- DECISÃO
--   A recepção passa a integrar a EQUIPE TÉCNICA de treinos, com as mesmas
--   capacidades de um instrutor: cria, edita, exclui, atribui, define dias,
--   muda visibilidade e compartilha os PRÓPRIOS modelos, e ENXERGA os modelos de
--   nível 'equipe'. Continua NÃO vendo o privado alheio (só o autor e dono/
--   gerente veem) — exatamente como um instrutor. A camada de aplicação
--   (podeGerenciarTreinos) foi liberada em conjunto; esta migration remove a
--   trava equivalente no banco, para as duas andarem juntas.
--
--   CONSEQUÊNCIA DE PRODUTO: como a recepção era o ÚNICO papel fora do nível
--   'equipe', na prática 'equipe' e 'academia' passam a ter a mesma audiência.
--   O nível continua existindo (nada é migrado), mas deixa de excluir alguém.
--
-- ESCOPO EXATO (só o que dependia do papel 'recepcao'):
--   1. RLS de leitura tenant_select_treinos — inclui 'recepcao' na cláusula de
--      nível 'equipe' (base: migration 081, corpo idêntico afora esse ponto).
--   2. RPC atribuir_modelo_treino     — aceita 'recepcao' (base: migration 080).
--   3. RPC atribuir_modelos_treino    — aceita 'recepcao' (base: migration 087).
--   4. RPC definir_dias_treino        — aceita 'recepcao' (base: migration 091).
--
--   As políticas de insert/update/delete (068) já liberam quem é autor
--   (criado_por = auth.uid()) — então criar/editar/excluir os próprios modelos
--   passa a funcionar para a recepção sem alteração aqui. posso_gerenciar_treino
--   (081) também não muda: recepção gerencia o compartilhamento dos modelos que
--   ela mesma criou, igual a um instrutor.
--
-- Idempotente (create or replace / drop+create policy). NÃO aplicar em produção
-- sem autorização.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS de leitura: a recepção passa a ver os modelos de nível 'equipe'.
--    Corpo idêntico ao da migration 081, só somando 'recepcao' à lista de papéis
--    da cláusula de 'equipe'. Todo o resto (plataforma, academia, selecionado,
--    autor, gestão) permanece igual.
-- ----------------------------------------------------------------------------
drop policy if exists "tenant_select_treinos" on public.treinos;
create policy "tenant_select_treinos" on public.treinos
  for select to authenticated
  using (
    (academia_id is null and origem_tipo = 'gestacad')
    or (
      academia_id = public.academia_id_atual()
      and (
        aluno_id is not null                                              -- ficha de aluno: equipe acessa
        or visibilidade = 'academia'                                      -- toda a academia (inclui recepção)
        or (
          visibilidade = 'equipe'
          and public.papel_do_usuario_atual() in ('dono', 'gerente', 'instrutor', 'recepcao')
        )                                                                 -- equipe técnica (agora com recepção)
        or (
          visibilidade = 'selecionado'
          and public.treino_compartilhado_comigo(id)
        )                                                                 -- instrutores/recepção escolhidos
        or criado_por = auth.uid()                                        -- meu treino
        or public.papel_do_usuario_atual() in ('dono', 'gerente')         -- gestão vê tudo
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 2. RPC atribuir_modelo_treino — libera 'recepcao'.
--    Base: migration 080 (aceita aluno ativa/pendente); só a lista de papéis muda.
-- ----------------------------------------------------------------------------
create or replace function public.atribuir_modelo_treino(
  p_treino_modelo_id uuid,
  p_aluno_id uuid,
  p_nome_treino text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_modelo public.treinos%rowtype;
  v_novo_treino_id uuid;
  v_ordem integer;
  v_nome text;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor', 'recepcao') then
    raise exception 'Seu perfil não pode atribuir treinos';
  end if;

  -- Modelo válido: da própria academia OU um modelo padrão da plataforma
  -- (identificado por origem_tipo='gestacad' desde a migration 077).
  select t.* into v_modelo
  from public.treinos t
  where t.id = p_treino_modelo_id
    and (
      t.academia_id = v_academia_id
      or (t.academia_id is null and t.origem_tipo = 'gestacad')
    )
    and t.aluno_id is null
    and t.ativo = true;

  if not found then
    raise exception 'Modelo de treino não encontrado';
  end if;

  -- Aluno da academia com matrícula utilizável. 'pendente' (recém-criado, sem
  -- plano) é aceito de propósito; 'trancada'/'cancelada'/'inativa' não —
  -- reative a matrícula antes de atribuir treinos.
  if not exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.academia_id = v_academia_id
      and a.status_matricula in ('ativa', 'pendente')
  ) then
    raise exception 'Aluno não encontrado nesta academia ou com matrícula inativa (trancada/cancelada). Reative a matrícula para atribuir treinos.';
  end if;

  v_nome := nullif(btrim(coalesce(p_nome_treino, '')), '');
  if v_nome is null then
    v_nome := v_modelo.nome_treino;
  end if;
  if char_length(v_nome) > 120 then
    raise exception 'O nome do treino deve ter no máximo 120 caracteres';
  end if;

  select coalesce(max(t.ordem), 0) + 1 into v_ordem
  from public.treinos t
  where t.academia_id = v_academia_id
    and t.aluno_id = p_aluno_id;

  insert into public.treinos (
    academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem, ativo,
    publico, criado_por, profissional_nome, nivel, publico_alvo, origem,
    codigo_importacao, metadados, modelo_origem_id, atribuido_por, atribuido_em,
    versao_origem
  )
  values (
    v_academia_id, p_aluno_id, v_nome, v_modelo.objetivo, v_modelo.modalidade,
    v_ordem, true, false, auth.uid(), v_modelo.profissional_nome, v_modelo.nivel,
    v_modelo.publico_alvo, 'modelo', null,
    coalesce(v_modelo.metadados, '{}'::jsonb) || jsonb_build_object(
      'modelo_origem_id', v_modelo.id,
      'modelo_nome_original', v_modelo.nome_treino
    ),
    v_modelo.id, auth.uid(), now(), 1
  )
  returning id into v_novo_treino_id;

  insert into public.exercicios_treino (
    treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos,
    imagem_demonstracao_url, video_demonstracao_url, observacoes, ordem, configuracao
  )
  select
    v_novo_treino_id, e.nome_exercicio, e.series, e.repeticoes, e.carga_kg,
    e.descanso_segundos, e.imagem_demonstracao_url, e.video_demonstracao_url,
    e.observacoes, e.ordem, coalesce(e.configuracao, '{}'::jsonb)
  from public.exercicios_treino e
  where e.treino_id = v_modelo.id
  order by e.ordem;

  return v_novo_treino_id;
end;
$$;

revoke all on function public.atribuir_modelo_treino(uuid, uuid, text) from public;
grant execute on function public.atribuir_modelo_treino(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC atribuir_modelos_treino (lote) — libera 'recepcao'.
--    Base: migration 087; só a lista de papéis muda.
-- ----------------------------------------------------------------------------
create or replace function public.atribuir_modelos_treino(
  p_aluno_id uuid,
  p_treino_modelo_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_ids uuid[];
  v_id uuid;
  v_novo uuid;
  v_nome text;
  v_ja_tem boolean;
  v_criados jsonb := '[]'::jsonb;
  v_ignorados jsonb := '[]'::jsonb;
  v_falhas jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor', 'recepcao') then
    raise exception 'Seu perfil não pode atribuir treinos';
  end if;

  -- Aluno da academia com matrícula utilizável (ativa/pendente) — mesma regra da
  -- migration 080. Barra trancada/cancelada/inativa com mensagem explícita.
  if not exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.academia_id = v_academia_id
      and a.status_matricula in ('ativa', 'pendente')
  ) then
    raise exception 'Aluno não encontrado nesta academia ou com matrícula inativa (trancada/cancelada). Reative a matrícula para atribuir treinos.';
  end if;

  -- Normaliza a lista: descarta nulos e repetições, preservando a ordem em que
  -- os modelos chegaram (a ficha do aluno respeita essa ordem de seleção).
  select coalesce(array_agg(id order by ord), '{}'::uuid[])
    into v_ids
  from (
    select id, min(ord) as ord
    from unnest(p_treino_modelo_ids) with ordinality as u(id, ord)
    where id is not null
    group by id
  ) s;

  if array_length(v_ids, 1) is null then
    raise exception 'Selecione pelo menos um treino.';
  end if;

  if array_length(v_ids, 1) > 20 then
    raise exception 'Selecione no máximo 20 treinos por vez.';
  end if;

  foreach v_id in array v_ids loop
    -- Nome do modelo só para o relatório amigável. Restringe ao conjunto
    -- atribuível (própria academia ou modelo de plataforma); se não achar aqui,
    -- a chamada abaixo devolve o erro "modelo não encontrado" para este item.
    select t.nome_treino into v_nome
    from public.treinos t
    where t.id = v_id
      and (
        t.academia_id = v_academia_id
        or (t.academia_id is null and t.origem_tipo = 'gestacad')
      )
      and t.aluno_id is null;

    -- Já atribuído a este aluno? Ignora em vez de duplicar a ficha.
    select exists (
      select 1
      from public.treinos f
      where f.aluno_id = p_aluno_id
        and f.academia_id = v_academia_id
        and f.modelo_origem_id = v_id
        and f.ativo = true
    ) into v_ja_tem;

    if v_ja_tem then
      v_ignorados := v_ignorados || jsonb_build_object(
        'modelo_id', v_id,
        'nome', coalesce(v_nome, 'treino')
      );
      continue;
    end if;

    -- Copia reutilizando a RPC canônica (mesma cópia de exercícios e checagens).
    -- O bloco EXCEPTION isola cada item: uma falha vira relatório, não rollback
    -- do lote inteiro.
    begin
      v_novo := public.atribuir_modelo_treino(v_id, p_aluno_id, null);
      v_criados := v_criados || jsonb_build_object(
        'modelo_id', v_id,
        'treino_id', v_novo,
        'nome', coalesce(v_nome, 'treino')
      );
    exception
      when others then
        v_falhas := v_falhas || jsonb_build_object(
          'modelo_id', v_id,
          'nome', coalesce(v_nome, 'treino'),
          'motivo', sqlerrm
        );
    end;
  end loop;

  return jsonb_build_object(
    'criados', v_criados,
    'ignorados', v_ignorados,
    'falhas', v_falhas
  );
end;
$$;

revoke all on function public.atribuir_modelos_treino(uuid, uuid[]) from public, anon;
grant execute on function public.atribuir_modelos_treino(uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC definir_dias_treino — libera 'recepcao'.
--    Base: migration 091 (slot exclusivo por dia); só a lista de papéis muda.
-- ----------------------------------------------------------------------------
create or replace function public.definir_dias_treino(
  p_treino_id uuid,
  p_dias smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_dias smallint[];
  v_id uuid;
  v_aluno_id uuid;
  v_realocados jsonb;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor', 'recepcao') then
    raise exception 'Seu perfil não pode alterar treinos';
  end if;

  v_dias := public._normalizar_dias_semana(p_dias);

  update public.treinos
    set dias_semana = v_dias,
        atualizado_em = now()
    where id = p_treino_id
      and academia_id = v_academia_id
      and aluno_id is not null
    returning id, aluno_id into v_id, v_aluno_id;

  if v_id is null then
    raise exception 'Treino não encontrado nesta academia';
  end if;

  -- Cada dia pertence a UMA ficha por vez, igual a um slot de agenda: tira o
  -- dia de qualquer outra ficha do mesmo aluno que colidia com o que acabou
  -- de ser gravado acima. `alvo` captura o valor ANTES da troca (necessário
  -- porque RETURNING de um UPDATE sempre mostra o estado DEPOIS da escrita —
  -- sem isso, "dias_perdidos" sempre daria vazio).
  with alvo as (
    select id, nome_treino, dias_semana
    from public.treinos
    where academia_id = v_academia_id
      and aluno_id = v_aluno_id
      and id <> v_id
      and ativo = true
      and dias_semana && v_dias
  ),
  atualizado as (
    update public.treinos t
      set dias_semana = (
            select coalesce(array_agg(d order by d), '{}'::smallint[])
            from unnest(t.dias_semana) as d
            where d <> all(v_dias)
          ),
          atualizado_em = now()
      from alvo
      where t.id = alvo.id
      returning t.id, alvo.nome_treino, alvo.dias_semana as dias_antes
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'nome_treino', nome_treino,
           'dias_perdidos', to_jsonb(
             (select coalesce(array_agg(d order by d), '{}'::smallint[])
              from unnest(dias_antes) as d
              where d = any(v_dias))
           )
         )), '[]'::jsonb)
  into v_realocados
  from atualizado;

  return jsonb_build_object(
    'id', v_id,
    'dias_semana', to_jsonb(v_dias),
    'realocados', v_realocados
  );
end;
$$;

comment on function public.definir_dias_treino(uuid, smallint[]) is
  'Define os dias da semana (1=seg … 7=dom) de uma ficha de aluno da própria academia. Cada dia é um slot exclusivo por aluno: gravar aqui tira o dia de qualquer outra ficha ativa do mesmo aluno que já o usava (devolvido em "realocados"). Papel dono/gerente/instrutor/recepcao (migration 095). Academia sempre da sessão.';

revoke all on function public.definir_dias_treino(uuid, smallint[]) from public, anon;
grant execute on function public.definir_dias_treino(uuid, smallint[]) to authenticated;
