-- =============================================================================
-- Migração 100 — A biblioteca padrão vira catálogo de verdade
--
-- O QUE ESTAVA ERRADO (falha da migração 098, corrigida aqui)
--   Existem DUAS fontes de imagem no sistema, e a 098 só enxergava a menor:
--
--     • catalogo_exercicios (migração 003) ....... 33 nomes com foto
--     • biblioteca padrão GestAcad (migração 070) . 57 nomes / ~155 exercícios
--
--   A 070 gravou as fotos em `exercicios_treino` de TREINOS-MODELO de
--   plataforma — não em `catalogo_exercicios`. O efeito prático era duplo e
--   invisível:
--     1. o vínculo da 098 nunca encontrava essas fotos;
--     2. o construtor de treinos oferece só os itens de `catalogo_exercicios`,
--        então o instrutor não conseguia sequer ESCOLHER esses 57 exercícios —
--        as fotos existiam e ficavam inalcançáveis.
--
--   Medido na base do cliente: dos 405 exercícios de academia ainda sem foto,
--   168 (41%) têm foto pronta na biblioteca padrão e só não apareciam por
--   causa disto.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   Promove cada exercício fotografado da biblioteca padrão a uma linha de
--   `catalogo_exercicios` no nível de SISTEMA (academia_id nulo), e depois
--   refaz o casamento da 098 para as linhas que continuam sem vínculo.
--
--   Nenhum arquivo é duplicado: a linha nova aponta para a MESMA URL que já
--   estava no exercício do treino-modelo. O que passa a existir é o registro
--   de catálogo — o "nome estável" que faltava para o vínculo e para o
--   construtor.
--
-- O QUE ELA **NÃO** FAZ
--   Não altera nome, imagem nem vídeo de nenhum exercício de treino, não toca
--   nos treinos-modelo de plataforma, não mexe em catálogo de academia nenhuma
--   e não cria linha com nome que já exista no catálogo de sistema. A
--   verificação no fim compara a impressão digital de todos os exercícios
--   (id + nome + imagem + vídeo) antes e depois e ABORTA em rollback se
--   divergir.
--
-- IDEMPOTENTE: pula nome que já exista no catálogo de sistema e só liga linhas
-- com `catalogo_exercicio_id` nulo. Reexecutar não duplica nem redefine nada.
--
-- PRÉ-REQUISITO: migração 098 (coluna catalogo_exercicio_id + a função
-- normalizar_nome_exercicio).
-- =============================================================================

do $promocao$
declare
  v_impressao_antes  text;
  v_impressao_depois text;
  v_ex_antes         bigint;
  v_ex_depois        bigint;
  v_catalogo_antes   bigint;
  v_catalogo_depois  bigint;
  v_promovidos       bigint;
  v_vinculados       bigint;
  v_com_foto         bigint;
  v_sem_foto         bigint;
begin
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

  select count(*) into v_catalogo_antes from public.catalogo_exercicios;

  -- ---------------------------------------------------------------------
  -- 1. Promoção. `distinct on` pela chave normalizada: o mesmo exercício
  --    aparece em vários treinos-modelo, e queremos UMA linha de catálogo.
  --    Empate resolvido preferindo quem tem vídeo além da foto.
  -- ---------------------------------------------------------------------
  with candidatos as (
    select distinct on (public.normalizar_nome_exercicio(e.nome_exercicio))
      e.nome_exercicio,
      e.imagem_demonstracao_url,
      e.video_demonstracao_url,
      e.series,
      e.repeticoes,
      coalesce(nullif(e.configuracao->>'grupo_muscular', ''), 'perna') as grupo
    from public.exercicios_treino e
    join public.treinos t on t.id = e.treino_id
    where t.academia_id is null
      and t.visibilidade = 'plataforma'
      and coalesce(e.imagem_demonstracao_url, '') <> ''
      -- nome que já exista no catálogo de sistema não vira linha nova
      and not exists (
        select 1 from public.catalogo_exercicios c
        where c.academia_id is null
          and public.normalizar_nome_exercicio(c.nome)
            = public.normalizar_nome_exercicio(e.nome_exercicio)
      )
    order by
      public.normalizar_nome_exercicio(e.nome_exercicio),
      (coalesce(e.video_demonstracao_url, '') <> '') desc,
      e.nome_exercicio
  ), inseridos as (
    insert into public.catalogo_exercicios (
      academia_id, visibilidade, grupo_muscular, nome,
      series_padrao, repeticoes_padrao,
      imagem_demonstracao_url, video_demonstracao_url,
      ordem, aliases, metadados
    )
    select
      null,
      'sistema',
      c.grupo::public.grupo_muscular_enum,
      c.nome_exercicio,
      greatest(coalesce(c.series, 3), 1),
      coalesce(nullif(c.repeticoes, ''), '12'),
      c.imagem_demonstracao_url,
      c.video_demonstracao_url,
      0,
      '{}'::text[],
      jsonb_build_object('origem', 'biblioteca-padrao-gestacad', 'promovido_em', now())
    from candidatos c
    returning 1
  )
  select count(*) into v_promovidos from inseridos;

  -- ---------------------------------------------------------------------
  -- 2. Refaz o casamento da 098 para o que continua sem vínculo. Mesma
  --    regra e mesma ordenação de lá: ter foto vem primeiro.
  -- ---------------------------------------------------------------------
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
      (coalesce(c.imagem_demonstracao_url, '') <> '') desc,
      (public.normalizar_nome_exercicio(c.nome)
        = public.normalizar_nome_exercicio(e.nome_exercicio)) desc,
      (c.academia_id is not null) desc,
      c.id
  ), aplicados as (
    update public.exercicios_treino e
       set catalogo_exercicio_id = ca.catalogo_id
      from candidatos ca
     where e.id = ca.exercicio_id
    returning 1
  )
  select count(*) into v_vinculados from aplicados;

  -- ---------------------------------------------------------------------
  -- 3. Verificação.
  -- ---------------------------------------------------------------------
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

  select count(*) into v_catalogo_depois from public.catalogo_exercicios;

  if v_impressao_antes is distinct from v_impressao_depois then
    raise exception
      'MIGRAÇÃO 100 ABORTADA: nome ou mídia de algum exercício mudou. '
      'Impressão antes=% depois=%. Nenhuma alteração foi mantida.',
      v_impressao_antes, v_impressao_depois;
  end if;

  if v_ex_antes <> v_ex_depois then
    raise exception
      'MIGRAÇÃO 100 ABORTADA: contagem de exercícios divergente (%/%).',
      v_ex_antes, v_ex_depois;
  end if;

  if v_catalogo_depois <> v_catalogo_antes + v_promovidos then
    raise exception
      'MIGRAÇÃO 100 ABORTADA: catálogo saiu de % para %, esperado % (+% promovidos).',
      v_catalogo_antes, v_catalogo_depois, v_catalogo_antes + v_promovidos, v_promovidos;
  end if;

  -- Quantos exercícios de ACADEMIA passam a exibir foto (o resultado prático).
  select
    count(*) filter (
      where coalesce(e.imagem_demonstracao_url,'') = ''
        and coalesce(c.imagem_demonstracao_url,'') <> ''),
    count(*) filter (
      where coalesce(e.imagem_demonstracao_url,'') = ''
        and coalesce(c.imagem_demonstracao_url,'') = '')
    into v_com_foto, v_sem_foto
  from public.exercicios_treino e
  join public.treinos t on t.id = e.treino_id
  left join public.catalogo_exercicios c on c.id = e.catalogo_exercicio_id
  where t.academia_id is not null;

  raise notice
    'Migração 100 OK — % exercícios da biblioteca padrão promovidos ao catálogo '
    '(agora escolhíveis no construtor); % exercícios ligados agora. '
    'Nas academias: % exercícios sem foto própria passam a exibir a da biblioteca, '
    '% seguem sem foto em fonte nenhuma. Nenhum nome, imagem ou vídeo alterado.',
    v_promovidos, v_vinculados, v_com_foto, v_sem_foto;
end
$promocao$;
