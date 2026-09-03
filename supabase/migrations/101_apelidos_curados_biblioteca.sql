-- =============================================================================
-- Migração 101 — Apelidos curados: o vocabulário da academia aponta para a
--                biblioteca
--
-- CONTEXTO
--   Depois das migrações 098 (vínculo) e 100 (promoção da biblioteca padrão ao
--   catálogo), sobraram exercícios sem foto porque a academia chama o mesmo
--   movimento por outro nome: "Peck Deck" em vez de "Crucifixo na Máquina",
--   "ELEV. LATERAL" em vez de "Elevação Lateral", "Adutor" em vez de "Cadeira
--   Adutora".
--
--   `catalogo_exercicios.aliases` já existe (migração 066) e o casamento da
--   098 JÁ consulta essa coluna. Então isto aqui é só dado: nenhuma linha de
--   código muda.
--
-- COMO ESTA LISTA FOI FEITA — e por que ela é curta
--   Cada par foi julgado olhando a FOTO que o item da biblioteca realmente
--   usa, não o nome. Só entraram os casos em que movimento E aparelho
--   coincidem. Ficaram DE FORA, de propósito:
--     • Leg Press 90°  -> Leg Press 45°   (o ângulo é o nome; outro aparelho)
--     • CRUCIFIXO INCLINADO -> Crucifixo com Halteres (a foto é banco reto)
--     • Glúteo no Solo -> Glúteo no Cabo  (Glute_Kickback é na polia)
--     • Rosca Cross                        (não há rosca na polia na biblioteca)
--   Nesses, mostrar a foto errada seria pior que o placeholder: o aluno
--   copiaria o movimento errado. Eles seguem sem imagem até alguém subir uma.
--
--   "Adutor" e "ABDUTOR" apontam para máquinas DIFERENTES (Thigh_Adductor e
--   Thigh_Abductor) — são músculos opostos, e as duas fotos existem.
--
--   Aprovado item a item pelo dono do produto antes de virar migração.
--
-- O QUE ELA **NÃO** FAZ
--   Não altera nome, imagem nem vídeo de exercício nenhum, não cria item de
--   catálogo e não apaga apelido existente (só acrescenta o que falta). A
--   verificação compara a impressão digital de todos os exercícios antes e
--   depois e ABORTA em rollback se divergir.
--
-- REVERSÍVEL: remover o apelido do array desfaz o vínculo daquele nome.
-- IDEMPOTENTE: apelido já presente não é duplicado; só liga linhas sem vínculo.
-- PRÉ-REQUISITO: migrações 098 e 100.
-- =============================================================================

do $apelidos$
declare
  v_impressao_antes  text;
  v_impressao_depois text;
  v_ex_antes         bigint;
  v_ex_depois        bigint;
  v_faltando         text;
  v_apelidos         bigint := 0;
  v_linhas           bigint;
  v_vinculados       bigint;
  v_com_foto         bigint;
  v_sem_foto         bigint;
  r                  record;
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
  -- 1. A lista curada. Coluna 1 = como a academia escreve; coluna 2 = nome
  --    do item na biblioteca; coluna 3 = a foto que vai aparecer (só
  --    documentação, para conferência humana).
  -- ---------------------------------------------------------------------
  drop table if exists apelidos_curados;
  create temporary table apelidos_curados (apelido text, alvo text, foto text) on commit drop;
  insert into apelidos_curados values
    ('Leg Press',              'Leg Press 45°',          'Leg_Press'),
    ('Adutor',                 'Cadeira Adutora',        'Thigh_Adductor'),
    ('Abdutor',                'Cadeira Abdutora',       'Thigh_Abductor'),
    ('Peck Deck',              'Crucifixo na Máquina',   'Butterfly'),
    ('Remada Sentado',         'Remada Sentada',         'Seated_Cable_Rows'),
    ('Pulley Frente Fechado',  'Puxada Supinada',        'Close-Grip_Front_Lat_Pulldown'),
    ('Pulley Frente Aberto',   'Puxada Frontal',         'Wide-Grip_Lat_Pulldown'),
    ('Supino Sentado',         'Supino Máquina',         'Leverage_Chest_Press'),
    ('Elev. Lateral',          'Elevação Lateral',       'Side_Lateral_Raise'),
    ('Panturrilha na Cadeira', 'Panturrilha Sentado',    'Seated_Calf_Raise'),
    ('Hack-Machine',           'Hack',                   'Hack_Squat'),
    ('Abdominal no Solo',      'Abdominal Supra',        'Crunches'),
    -- Escolha do dono: os dois supinos sem qualificação vão para a versão
    -- COM BARRA (e não para a máquina / halteres).
    ('Supino Reto',            'Supino Reto com Barra',      'Barbell_Bench_Press'),
    ('Supino Inclinado',       'Supino Inclinado com Barra', 'Barbell_Incline_Bench_Press');

  -- ---------------------------------------------------------------------
  -- 2. Todo alvo precisa existir no catálogo de sistema. Se algum não
  --    existir, o apelido seria silenciosamente inútil — melhor abortar e
  --    avisar do que aplicar pela metade.
  -- ---------------------------------------------------------------------
  select string_agg(a.alvo, ', ' order by a.alvo) into v_faltando
  from apelidos_curados a
  where not exists (
    select 1 from public.catalogo_exercicios c
    where c.academia_id is null
      and public.normalizar_nome_exercicio(c.nome)
        = public.normalizar_nome_exercicio(a.alvo)
  );

  if v_faltando is not null then
    raise exception
      'MIGRAÇÃO 101 ABORTADA: estes itens não existem no catálogo de sistema: %. '
      'A migração 100 foi aplicada? Nenhuma alteração foi mantida.', v_faltando;
  end if;

  -- ---------------------------------------------------------------------
  -- 3. Acrescenta o apelido onde ainda não está.
  -- ---------------------------------------------------------------------
  for r in select * from apelidos_curados loop
    update public.catalogo_exercicios c
       set aliases = array_append(coalesce(c.aliases, '{}'::text[]), r.apelido)
     where c.academia_id is null
       and public.normalizar_nome_exercicio(c.nome)
         = public.normalizar_nome_exercicio(r.alvo)
       and not exists (
         select 1 from unnest(coalesce(c.aliases, '{}'::text[])) as existente
         where public.normalizar_nome_exercicio(existente)
             = public.normalizar_nome_exercicio(r.apelido)
       );
    get diagnostics v_linhas = row_count;
    v_apelidos := v_apelidos + v_linhas;
  end loop;

  -- ---------------------------------------------------------------------
  -- 4. Refaz o casamento para o que continua sem vínculo (mesma regra da 098).
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
  -- 5. Verificação.
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
      'MIGRAÇÃO 101 ABORTADA: nome ou mídia de algum exercício mudou. '
      'Impressão antes=% depois=%.', v_impressao_antes, v_impressao_depois;
  end if;

  if v_ex_antes <> v_ex_depois then
    raise exception 'MIGRAÇÃO 101 ABORTADA: contagem divergente (%/%).',
      v_ex_antes, v_ex_depois;
  end if;

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
    'Migração 101 OK — % apelidos novos gravados; % exercícios ligados agora. '
    'Nas academias: % exercícios sem foto própria passam a exibir a da '
    'biblioteca, % seguem sem foto (placeholder proposital). '
    'Nenhum nome, imagem ou vídeo alterado.',
    v_apelidos, v_vinculados, v_com_foto, v_sem_foto;
end
$apelidos$;
