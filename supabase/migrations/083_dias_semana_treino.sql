-- =============================================================================
-- Migration 083 — Dia(s) da semana de um treino (App do aluno — Treinos)
--
-- CONTEXTO
--   A tela de Treinos do aluno passa a ter um seletor horizontal de dias
--   (Todos · Seg · Ter · … · Dom) e destaca o dia atual. Para isso o backend
--   precisa saber a QUE DIAS cada ficha se aplica — conceito que não existia:
--   `treinos` só tinha nome/ordem, e o aluno via "Treino A/B/C" solto.
--
-- MODELAGEM (decisão aprovada: coluna array, sem tabela de junção)
--   Uma coluna `dias_semana smallint[]` na própria `treinos`. Um treino pode
--   valer para um dia, vários, ou todos — SEM criar sete cópias. Convenção
--   ISO-8601: 1=segunda … 7=domingo. Array vazio = "sem dia definido": a ficha
--   continua aparecendo, mas só na aba "Todos" (nunca some por causa disto).
--   Fichas já existentes nascem com `{}` — nada quebra.
--
--   Atribuir dias NÃO altera a assinatura de `atribuir_modelo_treino` (080):
--   quem atribui chama, logo em seguida, a função `definir_dias_treino` abaixo.
--   Menos superfície mexida, mesma transação lógica do lado da aplicação.
--
-- SEGURANÇA / MULTITENANT
--   `definir_dias_treino` é `security definer`, resolve a academia pela SESSÃO
--   (`academia_id_atual()`) — nunca por id vindo do cliente — e só altera
--   fichas de aluno (`aluno_id is not null`) da própria academia. Papel exigido:
--   dono/gerente/instrutor, igual à atribuição. RLS de `treinos` permanece
--   intacta (as policies finas de visibilidade vivem 100% nas migrations).
--
-- Idempotente. NÃO aplicar em produção sem autorização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna dias_semana + CHECK (todo elemento entre 1 e 7).
-- -----------------------------------------------------------------------------
alter table public.treinos
  add column if not exists dias_semana smallint[] not null default '{}'::smallint[];

comment on column public.treinos.dias_semana is
  'Dias da semana em que a ficha se aplica (ISO: 1=seg … 7=dom). Vazio = sem dia definido (aparece só na aba "Todos" do app do aluno). Um treino pode valer para vários dias sem duplicar linhas.';

-- Garante que nenhum elemento fora de 1..7 entre por gravação direta. Usa
-- NOT VALID + validação separada para não travar em bancos grandes; como a
-- coluna nasce vazia em toda linha existente, a validação é imediata.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'treinos_dias_semana_1a7'
  ) then
    alter table public.treinos
      add constraint treinos_dias_semana_1a7
      check (dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]) not valid;
    alter table public.treinos validate constraint treinos_dias_semana_1a7;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2. Normaliza um array de dias vindo do cliente: mantém só 1..7, sem
--    repetições, ordenado. Função pura (immutable), sem acesso a tabela.
-- -----------------------------------------------------------------------------
create or replace function public._normalizar_dias_semana(p_dias smallint[])
returns smallint[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select array_agg(d order by d)
      from (
        select distinct d
        from unnest(coalesce(p_dias, '{}'::smallint[])) as d
        where d between 1 and 7
      ) s
    ),
    '{}'::smallint[]
  );
$$;

revoke all on function public._normalizar_dias_semana(smallint[]) from public;

-- -----------------------------------------------------------------------------
-- 3. Define os dias de uma FICHA DE ALUNO (aluno_id não nulo) da própria
--    academia. Usada tanto na atribuição (logo após atribuir_modelo_treino)
--    quanto para editar os dias depois, sem re-atribuir.
-- -----------------------------------------------------------------------------
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
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor') then
    raise exception 'Seu perfil não pode alterar treinos';
  end if;

  v_dias := public._normalizar_dias_semana(p_dias);

  update public.treinos
    set dias_semana = v_dias,
        atualizado_em = now()
    where id = p_treino_id
      and academia_id = v_academia_id
      and aluno_id is not null
    returning id into v_id;

  if v_id is null then
    raise exception 'Treino não encontrado nesta academia';
  end if;

  return jsonb_build_object('id', v_id, 'dias_semana', to_jsonb(v_dias));
end;
$$;

comment on function public.definir_dias_treino(uuid, smallint[]) is
  'Define os dias da semana (1=seg … 7=dom) de uma ficha de aluno da própria academia. Papel dono/gerente/instrutor. Academia sempre da sessão.';

revoke all on function public.definir_dias_treino(uuid, smallint[]) from public, anon;
grant execute on function public.definir_dias_treino(uuid, smallint[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. obter_ficha_aluno passa a devolver `dias_semana` em cada treino.
--    Corpo idêntico ao da migration 075 (hardening tenant) + a única linha nova
--    dentro do objeto de treino. Reproduzido inteiro de propósito: `create or
--    replace` substitui a função toda, então precisa vir completa para não
--    regredir nenhuma das proteções da 075.
-- -----------------------------------------------------------------------------
create or replace function public.obter_ficha_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id, a.academia_id as academia_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  )
  select jsonb_build_object(
    'aluno', (
      select jsonb_build_object(
        'id', a.id,
        'nome', a.nome,
        'foto_perfil_url', a.foto_perfil_url,
        'status_matricula', a.status_matricula,
        'matricula_codigo', a.matricula_codigo,
        'plano_nome', p.nome,
        'criado_em', a.criado_em
      )
      from public.alunos a
      left join public.planos p on p.id = a.plano_id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'academia', (
      select jsonb_build_object(
        'id', ac.id,
        'nome_fantasia', ac.nome_fantasia,
        'slug_url', ac.slug_url
      )
      from public.academias ac
      join public.alunos a on a.academia_id = ac.id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'treinos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nome_treino', t.nome_treino,
        'objetivo', t.objetivo,
        'ordem', t.ordem,
        'dias_semana', to_jsonb(coalesce(t.dias_semana, '{}'::smallint[])),
        'exercicios', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'treino_id', e.treino_id,
            'nome_exercicio', e.nome_exercicio,
            'series', e.series,
            'repeticoes', e.repeticoes,
            'carga_kg', e.carga_kg,
            'descanso_segundos', e.descanso_segundos,
            'imagem_demonstracao_url', e.imagem_demonstracao_url,
            'video_demonstracao_url', e.video_demonstracao_url,
            'observacoes', e.observacoes,
            'ordem', e.ordem,
            'criado_em', e.criado_em
          ) order by e.ordem), '[]'::jsonb)
          from public.exercicios_treino e
          where e.treino_id = t.id
        )
      ) order by t.ordem)
      from public.treinos t
      where t.aluno_id = (select aluno_id from aluno_resolvido)
        and t.academia_id = (select academia_id from aluno_resolvido)
        and t.ativo = true
    ), '[]'::jsonb),
    'progresso', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'data', pr.data,
        'peso_kg', pr.peso_kg,
        'percentual_gordura', pr.percentual_gordura,
        'peito_cm', pr.peito_cm,
        'cintura_cm', pr.cintura_cm,
        'quadril_cm', pr.quadril_cm,
        'braco_cm', pr.braco_cm,
        'coxa_cm', pr.coxa_cm,
        'foto_url', pr.foto_url
      ) order by pr.data asc)
      from public.progresso_aluno pr
      where pr.aluno_id = (select aluno_id from aluno_resolvido)
    ), '[]'::jsonb)
  )
  where exists (select 1 from aluno_resolvido);
$$;

grant execute on function public.obter_ficha_aluno(uuid, text) to anon, authenticated;
