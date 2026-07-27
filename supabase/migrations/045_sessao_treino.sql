-- =============================================================================
-- Migration 045 — Sessão real de treino (Bloco 1, Parte B).
--
-- Problema corrigido: o botão "Marcar como concluído" em
-- components/aluno/ExercicioCard.tsx era só `useState` local — nunca
-- persistia, e o progresso sumia ao atualizar a página.
--
-- Solução: tabela `sessoes_treino` (uma sessão = uma execução do aluno de uma
-- ficha específica) + funções `security definer` que resolvem o aluno
-- SEMPRE por token_acesso_publico + slug (nunca aluno_id vindo do cliente),
-- validam que o treino pertence ao aluno e que cada exercício do progresso
-- pertence ao treino da sessão. A prescrição original (`exercicios_treino`,
-- migration 002) nunca é escrita por nenhuma função abaixo — só lida.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Tabela de sessões de treino.
--
-- `progresso` é jsonb — um array de objetos, um por exercício realizado,
-- reconstruído inteiramente dentro de `salvar_progresso_treino` (nunca
-- gravado como veio do cliente): só os campos conhecidos sobrevivem.
-- -----------------------------------------------------------------------------
create table if not exists public.sessoes_treino (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  aluno_id       uuid        not null references public.alunos(id) on delete cascade,
  treino_id      uuid        not null references public.treinos(id) on delete cascade,
  status         text        not null default 'ativa' check (status in ('ativa', 'finalizada')),
  progresso      jsonb       not null default '[]'::jsonb,
  iniciado_em    timestamptz not null default now(),
  finalizado_em  timestamptz,
  atualizado_em  timestamptz not null default now()
);

comment on table public.sessoes_treino is
  'Execução real de uma ficha de treino pelo aluno (Bloco 1). Prescrição original permanece em exercicios_treino, nunca alterada por esta tabela.';

comment on column public.sessoes_treino.progresso is
  'Array jsonb reconstruído pelo backend a cada gravação — nunca aceita o objeto do cliente verbatim. Um item por exercício: exercicio_id, concluido, carga_realizada_kg, repeticoes_realizadas.';

-- Só pode existir UMA sessão ativa por aluno+treino — impede duplicidade por
-- clique duplo em "Iniciar" mesmo sob concorrência (garantido pelo índice,
-- não só pela interface).
create unique index if not exists uidx_sessoes_treino_ativa_unica
  on public.sessoes_treino (aluno_id, treino_id)
  where status = 'ativa';

create index if not exists idx_sessoes_treino_aluno
  on public.sessoes_treino (aluno_id, treino_id);

-- RLS habilitada e sem nenhuma policy para anon/authenticated: o aluno não
-- tem `auth.uid()` (sem login, Fase 12) e a equipe da academia não acessa
-- esta tabela nesta etapa. Todo acesso passa pelas funções `security definer`
-- abaixo, que fazem sua própria validação de token+slug internamente — mesmo
-- padrão de `alunos`/`treinos`, que também não têm grant direto para anon.
alter table public.sessoes_treino enable row level security;

-- -----------------------------------------------------------------------------
-- 1. Resolve o aluno pelo token pessoal + slug (mesma junção das demais
-- funções da Fase 12) e valida que o treino pertence a ele.
-- Função auxiliar interna — não exposta via GRANT a nenhum papel.
-- -----------------------------------------------------------------------------
create or replace function public._resolver_aluno_treino(
  p_token uuid,
  p_slug text,
  p_treino_id uuid
)
returns table (aluno_id uuid, academia_id uuid)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select a.id, a.academia_id
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  join public.treinos t on t.aluno_id = a.id and t.id = p_treino_id and t.ativo = true
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;
$$;

revoke all on function public._resolver_aluno_treino(uuid, text, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Sessões ativas do aluno (uma por treino, no máximo) — usada no
-- carregamento da tela para decidir "Iniciar" vs "Retomar" sem precisar
-- consultar treino por treino.
-- -----------------------------------------------------------------------------
create or replace function public.obter_sessoes_ativas_treino(p_token uuid, p_slug text)
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'treino_id', s.treino_id,
    'status', s.status,
    'progresso', s.progresso,
    'iniciado_em', s.iniciado_em,
    'finalizado_em', s.finalizado_em
  )), '[]'::jsonb)
  from public.sessoes_treino s
  where s.aluno_id = (select aluno_id from aluno_resolvido)
    and s.status = 'ativa';
$$;

comment on function public.obter_sessoes_ativas_treino(uuid, text) is
  'Sessões de treino ATIVAS do próprio aluno (no máx. 1 por treino), resolvido por token pessoal + slug. Nunca aluno_id.';

revoke all on function public.obter_sessoes_ativas_treino(uuid, text) from public;
grant execute on function public.obter_sessoes_ativas_treino(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Iniciar (ou retomar) uma sessão de treino.
--
-- Idempotente por construção: se já existe sessão ativa para este
-- aluno+treino, devolve a existente em vez de criar outra — cobre o clique
-- duplo mesmo sob concorrência (o índice único faz a segunda tentativa
-- simultânea falhar com unique_violation, capturado abaixo).
-- -----------------------------------------------------------------------------
create or replace function public.iniciar_sessao_treino(
  p_token uuid,
  p_slug text,
  p_treino_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
  v_sessao public.sessoes_treino;
begin
  select r.aluno_id, r.academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_treino(p_token, p_slug, p_treino_id) r;

  if v_aluno_id is null then
    return null;
  end if;

  select * into v_sessao
  from public.sessoes_treino
  where aluno_id = v_aluno_id and treino_id = p_treino_id and status = 'ativa'
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_sessao.id,
      'treino_id', v_sessao.treino_id,
      'status', v_sessao.status,
      'progresso', v_sessao.progresso,
      'iniciado_em', v_sessao.iniciado_em,
      'finalizado_em', v_sessao.finalizado_em
    );
  end if;

  begin
    insert into public.sessoes_treino (academia_id, aluno_id, treino_id)
    values (v_academia_id, v_aluno_id, p_treino_id)
    returning * into v_sessao;
  exception when unique_violation then
    -- Duas requisições concorrentes de "iniciar": a que perdeu a corrida lê a
    -- sessão que a outra acabou de criar, em vez de duplicar ou falhar.
    select * into v_sessao
    from public.sessoes_treino
    where aluno_id = v_aluno_id and treino_id = p_treino_id and status = 'ativa'
    limit 1;
  end;

  return jsonb_build_object(
    'id', v_sessao.id,
    'treino_id', v_sessao.treino_id,
    'status', v_sessao.status,
    'progresso', v_sessao.progresso,
    'iniciado_em', v_sessao.iniciado_em,
    'finalizado_em', v_sessao.finalizado_em
  );
end;
$$;

comment on function public.iniciar_sessao_treino(uuid, text, uuid) is
  'Inicia (ou retoma, se já ativa) uma sessão de treino do próprio aluno. Treino precisa pertencer ao aluno resolvido pelo token. Nunca aceita aluno_id do cliente.';

revoke all on function public.iniciar_sessao_treino(uuid, text, uuid) from public;
grant execute on function public.iniciar_sessao_treino(uuid, text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Salvar progresso — reconstrói o jsonb campo a campo (nunca aceita o
-- objeto do cliente puro), valida que cada exercício pertence ao treino da
-- sessão e nunca escreve em exercicios_treino (prescrição original imutável
-- por esta função).
--
-- Limites: no máx. 100 itens (nenhuma ficha real chega perto disso),
-- carga_realizada_kg entre 0 e 999, repeticoes_realizadas até 50 caracteres —
-- suficiente para o payload nunca ser ilimitado.
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
    -- Sessão inexistente, de outro aluno, ou já finalizada: nada a salvar.
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

    -- Extração de cada campo isolada num bloco próprio: um tipo malformado em
    -- QUALQUER campo (ex.: "concluido": "banana", carga não numérica) só
    -- invalida este item — nunca aborta o salvamento dos demais exercícios
    -- válidos da mesma sessão. Evita depender de CONTINUE dentro de um
    -- handler de exceção (não testável neste ambiente sem Postgres real);
    -- em vez disso, uma flag decide se o item entra no resultado.
    if v_item_valido then
      begin
        v_exercicio_id := (v_item ->> 'exercicio_id')::uuid;
        v_concluido := coalesce((v_item ->> 'concluido')::boolean, false);
        v_carga := least(greatest(coalesce((v_item ->> 'carga_realizada_kg')::numeric, 0), 0), 999);
        v_reps := left(coalesce(v_item ->> 'repeticoes_realizadas', ''), 50);
      exception when others then
        v_item_valido := false;
      end;
    end if;

    -- Só entra no progresso um exercício que realmente pertence a este treino
    -- (whitelist contra exercicios_treino) — impede referenciar exercício de
    -- outro treino/aluno.
    if v_item_valido and v_exercicio_id is not null and exists (
      select 1 from public.exercicios_treino
      where id = v_exercicio_id and treino_id = v_treino_id
    ) then
      v_validado := v_validado || jsonb_build_array(jsonb_build_object(
        'exercicio_id', v_exercicio_id,
        'concluido', v_concluido,
        'carga_realizada_kg', v_carga,
        'repeticoes_realizadas', v_reps
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
  'Grava o progresso REALIZADO de uma sessão ativa do próprio aluno. Reconstrói o jsonb campo a campo (nunca aceita o objeto do cliente puro) e só aceita exercicios pertencentes ao treino da sessão. Nunca altera exercicios_treino (prescrição original).';

revoke all on function public.salvar_progresso_treino(uuid, text, uuid, jsonb) from public;
grant execute on function public.salvar_progresso_treino(uuid, text, uuid, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Finalizar sessão — idempotente: chamar duas vezes finaliza uma vez só.
-- O UPDATE condicional em status='ativa' faz a segunda chamada (mesma sessão,
-- concorrente ou repetida) não encontrar linhas para atualizar; o SELECT
-- seguinte devolve o estado (já finalizado) mesmo assim, sem erro.
-- -----------------------------------------------------------------------------
create or replace function public.finalizar_sessao_treino(
  p_token uuid,
  p_slug text,
  p_sessao_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_sessao public.sessoes_treino;
begin
  select a.id into v_aluno_id
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;

  if v_aluno_id is null then
    return null;
  end if;

  update public.sessoes_treino
    set status = 'finalizada',
        finalizado_em = now(),
        atualizado_em = now()
    where id = p_sessao_id and aluno_id = v_aluno_id and status = 'ativa';

  select * into v_sessao
  from public.sessoes_treino
  where id = p_sessao_id and aluno_id = v_aluno_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_sessao.id,
    'treino_id', v_sessao.treino_id,
    'status', v_sessao.status,
    'progresso', v_sessao.progresso,
    'iniciado_em', v_sessao.iniciado_em,
    'finalizado_em', v_sessao.finalizado_em
  );
end;
$$;

comment on function public.finalizar_sessao_treino(uuid, text, uuid) is
  'Finaliza uma sessão ativa do próprio aluno. Idempotente: chamar de novo numa sessão já finalizada apenas devolve o estado atual, sem erro e sem sobrescrever finalizado_em.';

revoke all on function public.finalizar_sessao_treino(uuid, text, uuid) from public;
grant execute on function public.finalizar_sessao_treino(uuid, text, uuid) to anon, authenticated;
