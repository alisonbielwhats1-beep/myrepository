-- =============================================================================
-- Migração 098 — Exercício do treino ligado à biblioteca por identificador
--
-- O PROBLEMA (causa real, achada no código antes de mexer em dado)
--   Exercício adicionado ao treino não usava a imagem que já existe na
--   biblioteca. Três motivos somados, nenhum deles de renderização:
--
--   1. NÃO HAVIA VÍNCULO. `exercicios_treino` guardava só o texto do nome e
--      uma URL de imagem. O ExercicioBuilder COPIAVA a URL do catálogo no
--      momento em que o exercício era adicionado
--      (components/painel/ExercicioBuilder.tsx). Cópia por valor: se a
--      biblioteca ganhasse a foto depois, o treino já criado continuava sem
--      nada, para sempre.
--   2. A BIBLIOTECA DA ACADEMIA NASCE SEM IMAGEM. `criarExercicioCatalogo`
--      (app/painel/[slug]/treinos/actions.ts) insere em `catalogo_exercicios`
--      sem `imagem_demonstracao_url` — e o formulário nem oferece o campo.
--      Só as ~35 linhas semeadas na migração 003 têm foto. Numa academia que
--      montou o catálogo dela, portanto, NENHUM exercício tinha imagem para
--      copiar.
--   3. A IMPORTAÇÃO APAGAVA. `importarTreinos` gravava literalmente
--      `imagem_demonstracao_url: ""` em todo exercício importado por planilha,
--      mesmo quando o nome batia com um item do catálogo que tem foto.
--
--   A renderização sempre esteve correta: ExercicioCard e a lista do painel já
--   exibem a imagem quando ela existe e caem num ícone quando não existe.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   Cria o identificador estável que faltava: `catalogo_exercicio_id` em
--   `exercicios_treino`. Com ele, a imagem passa a ser RESOLVIDA NA LEITURA
--   (coalesce da imagem própria do exercício com a da biblioteca), em vez de
--   copiada na escrita. Consequências:
--     • a foto aparece sozinha no treino, sem duplicar arquivo nenhum;
--     • foto adicionada à biblioteca depois vale retroativamente para todos os
--       treinos já montados;
--     • quem quiser foto própria naquele exercício continua podendo subir uma
--       — a imagem do próprio exercício SEMPRE vence a da biblioteca.
--
--   O casamento por NOME acontece uma única vez, aqui, como migração dos dados
--   antigos. Daqui pra frente quem grava o vínculo é o construtor de treinos,
--   pelo id. Nome é fallback de migração, nunca a regra.
--
-- O QUE ELA **NÃO** FAZ
--   Não altera `imagem_demonstracao_url` nem `video_demonstracao_url` de
--   nenhum exercício, não apaga nada, não mexe em treinos, fichas de aluno ou
--   atribuições. Só preenche a coluna nova. O bloco de verificação compara a
--   impressão digital de todos os exercícios (id + nome + imagem + vídeo)
--   antes e depois e ABORTA em rollback se algo divergir.
--
-- IDEMPOTENTE: o preenchimento só toca linhas com `catalogo_exercicio_id`
-- nulo. Reexecutar não desfaz vínculo já gravado nem ajuste manual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Normalização de nome — usada só pelo casamento de migração.
--    Sem depender da extensão `unaccent` (que pode não estar habilitada):
--    translate() cobre os acentos do português, que é todo o vocabulário aqui.
-- -----------------------------------------------------------------------------
create or replace function public.normalizar_nome_exercicio(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p_nome, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
      '\([^)]*\)', ' ', 'g'          -- descarta "(cabo)", "(leve)" etc.
    ),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

comment on function public.normalizar_nome_exercicio(text) is
  'Normaliza nome de exercício (minúsculas, sem acento, sem parênteses) para o '
  'casamento de migração entre exercicios_treino e catalogo_exercicios. '
  'Não é regra de negócio: o vínculo corrente é por id.';

-- -----------------------------------------------------------------------------
-- 2. A coluna do vínculo.
--    `on delete set null`: apagar um item do catálogo NUNCA pode apagar o
--    exercício de uma ficha de aluno — ele só perde a referência e volta a
--    valer a imagem própria (ou o placeholder).
-- -----------------------------------------------------------------------------
alter table public.exercicios_treino
  add column if not exists catalogo_exercicio_id uuid
    references public.catalogo_exercicios(id) on delete set null;

comment on column public.exercicios_treino.catalogo_exercicio_id is
  'Exercício da biblioteca que originou esta linha. A imagem é resolvida na '
  'leitura: imagem própria do exercício, senão a da biblioteca. Nulo = '
  'exercício digitado à mão, sem correspondente na biblioteca.';

create index if not exists idx_exercicios_treino_catalogo
  on public.exercicios_treino(catalogo_exercicio_id)
  where catalogo_exercicio_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Casamento por nome dos dados antigos + verificação de que nada mudou.
-- -----------------------------------------------------------------------------
do $verificacao$
declare
  v_impressao_antes  text;
  v_impressao_depois text;
  v_ex_antes         bigint;
  v_ex_depois        bigint;
  v_treinos_antes    bigint;
  v_treinos_depois   bigint;
  v_vinculados       bigint;
  v_ganharam_imagem  bigint;
  v_sem_imagem       bigint;
begin
  -- Impressão digital: id + nome + mídia de TODO exercício. É o que não pode
  -- mudar — a migração só escreve na coluna nova.
  select
    coalesce(md5(string_agg(
      e.id::text || '|' || e.nome_exercicio || '|' ||
      coalesce(e.imagem_demonstracao_url, '-') || '|' ||
      coalesce(e.video_demonstracao_url, '-'),
      ',' order by e.id
    )), 'base-vazia'),
    count(*)
    into v_impressao_antes, v_ex_antes
  from public.exercicios_treino e;

  select count(*) into v_treinos_antes from public.treinos;

  -- Casa cada exercício com UM item do catálogo. `distinct on` + ordenação
  -- resolve o empate: catálogo da própria academia ganha do catálogo de
  -- sistema (a academia renomeou por um motivo), e nome exato ganha de alias.
  with candidatos as (
    select distinct on (e.id)
      e.id as exercicio_id,
      c.id as catalogo_id
    from public.exercicios_treino e
    join public.treinos t on t.id = e.treino_id
    join public.catalogo_exercicios c
      on (c.academia_id is null or c.academia_id = t.academia_id)
     and (
          public.normalizar_nome_exercicio(c.nome)
            = public.normalizar_nome_exercicio(e.nome_exercicio)
       or exists (
            select 1 from unnest(coalesce(c.aliases, '{}'::text[])) as alias
            where public.normalizar_nome_exercicio(alias)
                = public.normalizar_nome_exercicio(e.nome_exercicio)
          )
        )
    where e.catalogo_exercicio_id is null
    order by
      e.id,
      -- TER FOTO vem primeiro, de propósito. O objetivo desta migração é fazer
      -- a imagem aparecer; entre dois itens que descrevem o mesmo movimento,
      -- o que tem foto é sempre mais útil que o que não tem. Preferir o
      -- catálogo da academia antes disso deixava o exercício sem imagem
      -- sempre que a academia tinha cadastrado o mesmo nome sem foto — que é
      -- exatamente o estado da base hoje (criarExercicioCatalogo nunca gravou
      -- imagem).
      (coalesce(c.imagem_demonstracao_url, '') <> '') desc,
      (public.normalizar_nome_exercicio(c.nome)
        = public.normalizar_nome_exercicio(e.nome_exercicio)) desc,
      (c.academia_id is not null) desc,   -- desempate: catálogo da academia
      c.id
  ), aplicados as (
    update public.exercicios_treino e
       set catalogo_exercicio_id = ca.catalogo_id
      from candidatos ca
     where e.id = ca.exercicio_id
    returning 1
  )
  select count(*) into v_vinculados from aplicados;

  select
    coalesce(md5(string_agg(
      e.id::text || '|' || e.nome_exercicio || '|' ||
      coalesce(e.imagem_demonstracao_url, '-') || '|' ||
      coalesce(e.video_demonstracao_url, '-'),
      ',' order by e.id
    )), 'base-vazia'),
    count(*)
    into v_impressao_depois, v_ex_depois
  from public.exercicios_treino e;

  select count(*) into v_treinos_depois from public.treinos;

  if v_impressao_antes is distinct from v_impressao_depois then
    raise exception
      'MIGRAÇÃO 098 ABORTADA: nome ou mídia de algum exercício mudou. '
      'Impressão antes=% depois=%. Nenhuma alteração foi mantida.',
      v_impressao_antes, v_impressao_depois;
  end if;

  if v_ex_antes <> v_ex_depois or v_treinos_antes <> v_treinos_depois then
    raise exception
      'MIGRAÇÃO 098 ABORTADA: contagem divergente. exercicios %/%, treinos %/%.',
      v_ex_antes, v_ex_depois, v_treinos_antes, v_treinos_depois;
  end if;

  -- Quantos exercícios que estavam SEM imagem passam a ter uma, agora vinda
  -- da biblioteca. É o ganho concreto desta migração.
  select count(*) into v_ganharam_imagem
    from public.exercicios_treino e
    join public.catalogo_exercicios c on c.id = e.catalogo_exercicio_id
   where coalesce(e.imagem_demonstracao_url, '') = ''
     and coalesce(c.imagem_demonstracao_url, '') <> '';

  select count(*) into v_sem_imagem
    from public.exercicios_treino e
    left join public.catalogo_exercicios c on c.id = e.catalogo_exercicio_id
   where coalesce(e.imagem_demonstracao_url, '') = ''
     and coalesce(c.imagem_demonstracao_url, '') = '';

  raise notice
    'Migração 098 OK — % exercícios ligados à biblioteca; % deles estavam sem '
    'imagem e passam a exibir a da biblioteca; % seguem sem imagem em lugar '
    'nenhum (placeholder). Nenhum nome, imagem ou vídeo foi alterado.',
    v_vinculados, v_ganharam_imagem, v_sem_imagem;
end
$verificacao$;

-- -----------------------------------------------------------------------------
-- 4. A leitura do APP DO ALUNO passa a resolver a imagem pela biblioteca.
--
--    Esta é a metade que faz a diferença aparecer na tela: os treinos do aluno
--    NÃO vêm das queries do painel, vêm desta RPC (o app do aluno não tem
--    sessão — entra pelo token pessoal). Sem mexer aqui, o vínculo existiria
--    no banco e o aluno continuaria vendo o ícone cinza.
--
--    Regra: mídia própria do exercício SEMPRE vence; a biblioteca só preenche
--    o que está vazio. `nullif(...,'')` porque importações antigas gravaram
--    string vazia em vez de null.
--
--    O join repete a checagem de tenant (`c.academia_id is null or =
--    t.academia_id`) mesmo com o id já validado na escrita: esta função é
--    SECURITY DEFINER e ignora RLS, então nenhuma linha de catálogo de outra
--    academia pode entrar na resposta por um vínculo errado.
--
--    Recriada por inteiro a partir da versão da migração 083 (dias_semana),
--    com a única diferença sendo o join e os dois coalesce.
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
            'imagem_demonstracao_url', coalesce(
              nullif(e.imagem_demonstracao_url, ''),
              nullif(c.imagem_demonstracao_url, '')
            ),
            'video_demonstracao_url', coalesce(
              nullif(e.video_demonstracao_url, ''),
              nullif(c.video_demonstracao_url, '')
            ),
            'observacoes', e.observacoes,
            'ordem', e.ordem,
            'criado_em', e.criado_em
          ) order by e.ordem), '[]'::jsonb)
          from public.exercicios_treino e
          left join public.catalogo_exercicios c
            on c.id = e.catalogo_exercicio_id
           and (c.academia_id is null or c.academia_id = t.academia_id)
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
