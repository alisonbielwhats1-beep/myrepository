-- =============================================================================
-- Migração 102 — Repontar exercícios presos num item de biblioteca SEM foto
--
-- O ENCADEAMENTO QUE CRIOU O PROBLEMA
--   1. A migração 066 criou o catálogo DA ACADEMIA sem `imagem_demonstracao_url`
--      (o insert simplesmente não tem a coluna). Todo exercício que a academia
--      cadastrou ficou sem foto no catálogo.
--   2. A migração 098 ligou cada exercício de treino ao item que casasse pelo
--      nome. Para os nomes que só existiam no catálogo da academia, o único
--      candidato era justamente essa entrada SEM foto — e o vínculo foi feito
--      para ela. Correto na época: não havia alternativa melhor.
--   3. A migração 100 promoveu a biblioteca padrão ao catálogo, criando enfim
--      versões COM foto desses mesmos movimentos. Mas o passo de ligação da
--      100 só olha linhas com `catalogo_exercicio_id IS NULL`. As que já
--      estavam ligadas ao item sem foto ficaram presas nele para sempre.
--
--   Medido na base do cliente: a 100 recuperou 113 exercícios, quando a
--   contagem prévia apontava 168 recuperáveis. A diferença são exatamente
--   esses vínculos presos.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   Repõe o vínculo APENAS quando as três condições valem ao mesmo tempo:
--     • o exercício não tem foto própria (foto do professor sempre vence);
--     • o item de biblioteca a que ele está ligado NÃO tem foto;
--     • existe outro item, no mesmo escopo de tenant, com o MESMO nome (ou
--       apelido) e COM foto.
--   Nesses casos o vínculo passa a apontar para o item fotografado. Em
--   qualquer outro caso, nada muda.
--
--   Também roda a ligação normal para o que ainda estiver sem vínculo, de
--   modo que esta migração seja suficiente sozinha se rodar depois da 101.
--
-- O QUE ELA **NÃO** FAZ
--   Não altera nome, imagem nem vídeo de exercício nenhum, não cria nem apaga
--   item de catálogo, e nunca troca um vínculo que já aponta para um item com
--   foto. A verificação compara a impressão digital de todos os exercícios
--   antes e depois e ABORTA em rollback se divergir.
--
-- IDEMPOTENTE: na segunda execução não há mais vínculo preso a corrigir.
-- PRÉ-REQUISITOS: 098 e 100 (idealmente também a 101, para os apelidos
-- entrarem na conta).
-- =============================================================================

do $repontar$
declare
  v_impressao_antes  text;
  v_impressao_depois text;
  v_ex_antes         bigint;
  v_ex_depois        bigint;
  v_repontados       bigint;
  v_ligados          bigint;
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

  -- ---------------------------------------------------------------------
  -- 1. Repontar os presos.
  -- ---------------------------------------------------------------------
  with melhor as (
    select distinct on (e.id)
      e.id  as exercicio_id,
      novo.id as novo_catalogo_id
    from public.exercicios_treino e
    join public.treinos t on t.id = e.treino_id
    join public.catalogo_exercicios atual on atual.id = e.catalogo_exercicio_id
    join public.catalogo_exercicios novo
      on (novo.academia_id is null or novo.academia_id = t.academia_id)
     and coalesce(novo.imagem_demonstracao_url, '') <> ''
     and (
          public.normalizar_nome_exercicio(novo.nome)
            = public.normalizar_nome_exercicio(e.nome_exercicio)
       or exists (
            select 1 from unnest(coalesce(novo.aliases, '{}'::text[])) as alias
            where public.normalizar_nome_exercicio(alias)
                = public.normalizar_nome_exercicio(e.nome_exercicio)
          )
        )
    where e.catalogo_exercicio_id is not null
      and coalesce(atual.imagem_demonstracao_url, '') = ''   -- preso em item sem foto
      and coalesce(e.imagem_demonstracao_url, '') = ''       -- e sem foto própria
    order by
      e.id,
      (public.normalizar_nome_exercicio(novo.nome)
        = public.normalizar_nome_exercicio(e.nome_exercicio)) desc,
      (novo.academia_id is not null) desc,
      novo.id
  ), aplicados as (
    update public.exercicios_treino e
       set catalogo_exercicio_id = m.novo_catalogo_id
      from melhor m
     where e.id = m.exercicio_id
    returning 1
  )
  select count(*) into v_repontados from aplicados;

  -- ---------------------------------------------------------------------
  -- 2. Ligação normal do que ainda está sem vínculo (mesma regra da 098).
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
  select count(*) into v_ligados from aplicados;

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

  if v_impressao_antes is distinct from v_impressao_depois then
    raise exception
      'MIGRAÇÃO 102 ABORTADA: nome ou mídia de algum exercício mudou. '
      'Impressão antes=% depois=%.', v_impressao_antes, v_impressao_depois;
  end if;

  if v_ex_antes <> v_ex_depois then
    raise exception 'MIGRAÇÃO 102 ABORTADA: contagem divergente (%/%).',
      v_ex_antes, v_ex_depois;
  end if;

  -- Nenhum exercício pode ter sobrado ligado a item sem foto tendo alternativa.
  if exists (
    select 1
    from public.exercicios_treino e
    join public.treinos t on t.id = e.treino_id
    join public.catalogo_exercicios atual on atual.id = e.catalogo_exercicio_id
    where coalesce(e.imagem_demonstracao_url,'') = ''
      and coalesce(atual.imagem_demonstracao_url,'') = ''
      and exists (
        select 1 from public.catalogo_exercicios novo
        where (novo.academia_id is null or novo.academia_id = t.academia_id)
          and coalesce(novo.imagem_demonstracao_url,'') <> ''
          and public.normalizar_nome_exercicio(novo.nome)
            = public.normalizar_nome_exercicio(e.nome_exercicio)
      )
  ) then
    raise exception
      'MIGRAÇÃO 102 ABORTADA: sobrou exercício preso em item sem foto tendo '
      'alternativa fotografada. Nenhuma alteração foi mantida.';
  end if;

  select
    count(*) filter (
      where coalesce(e.imagem_demonstracao_url,'') <> ''
         or coalesce(c.imagem_demonstracao_url,'') <> ''),
    count(*) filter (
      where coalesce(e.imagem_demonstracao_url,'') = ''
        and coalesce(c.imagem_demonstracao_url,'') = '')
    into v_com_foto, v_sem_foto
  from public.exercicios_treino e
  join public.treinos t on t.id = e.treino_id
  left join public.catalogo_exercicios c on c.id = e.catalogo_exercicio_id
  where t.academia_id is not null;

  raise notice
    'Migração 102 OK — % vínculos repontados para um item COM foto; % ligados '
    'agora. Nas academias: % exercícios com foto, % ainda sem. '
    'Nenhum nome, imagem ou vídeo alterado.',
    v_repontados, v_ligados, v_com_foto, v_sem_foto;
end
$repontar$;
