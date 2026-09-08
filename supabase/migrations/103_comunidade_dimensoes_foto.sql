-- =============================================================================
-- Migração 103 — Guardar largura e altura da foto da publicação
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--   O card do feed precisa reservar o espaço da foto ANTES de ela carregar.
--   Sem reserva, o feed inteiro pula a cada imagem que chega — medido: o
--   container mede 0px de altura enquanto a foto não carrega.
--
--   Sem saber a proporção real, a única forma de reservar era uma caixa de
--   proporção fixa (4:5) com a foto encaixada por `contain`. Isso não corta
--   nada, mas deixa faixa escura em foto muito fora de 4:5 — uma paisagem
--   16:9, por exemplo.
--
--   Com largura e altura gravadas na publicação, cada card reserva a caixa na
--   proporção REAL daquela foto: não corta, não deixa faixa e não pula.
--
--   As dimensões saem do redimensionamento que JÁ acontece no navegador
--   (lib/imagem-cliente.ts calcula `largura`/`altura` para desenhar no canvas),
--   então nenhum processamento novo é criado — o número só deixa de ser
--   descartado.
--
-- COMPATIBILIDADE — importante, porque migração aqui é aplicada à mão
--   • As duas colunas são opcionais. Publicação antiga, e publicação sem foto,
--     fica com null e o card volta à caixa 4:5 de hoje. Nada quebra.
--   • Os parâmetros novos da RPC têm DEFAULT null, então uma chamada com os
--     quatro argumentos antigos continua válida.
--   • Enquanto esta migração NÃO estiver aplicada, o app detecta a RPC antiga
--     (PGRST202) e republica sem as dimensões — publicar continua funcionando.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Colunas
-- -----------------------------------------------------------------------------
alter table public.comunidade_posts
  add column if not exists imagem_largura int,
  add column if not exists imagem_altura  int;

comment on column public.comunidade_posts.imagem_largura is
  'Largura em px da imagem já redimensionada no navegador. Null em post sem foto ou anterior à migração 103.';
comment on column public.comunidade_posts.imagem_altura is
  'Altura em px da imagem já redimensionada no navegador. Null em post sem foto ou anterior à migração 103.';

-- Ou o par inteiro existe, ou nenhum dos dois: meia dimensão não serve para
-- calcular proporção nenhuma. Teto de 20000 é sanidade contra valor absurdo
-- vindo de um cliente adulterado.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comunidade_posts_dimensoes'
      and conrelid = 'public.comunidade_posts'::regclass
  ) then
    alter table public.comunidade_posts
      add constraint comunidade_posts_dimensoes check (
        (imagem_largura is null and imagem_altura is null)
        or (
          imagem_largura between 1 and 20000
          and imagem_altura between 1 and 20000
        )
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Serializador do post — passa a expor as duas dimensões.
--    Assinatura inalterada, então `create or replace` basta e o feed inteiro
--    (que usa esta função) ganha os campos de uma vez.
-- -----------------------------------------------------------------------------
create or replace function public._post_comunidade_json(p_post_id uuid, p_aluno_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select jsonb_build_object(
    'id', po.id,
    'legenda', po.legenda,
    'imagem_url', po.imagem_url,
    'imagem_largura', po.imagem_largura,
    'imagem_altura', po.imagem_altura,
    'criado_em', po.criado_em,
    'sou_autor', (po.aluno_id = p_aluno_id),
    'autor', jsonb_build_object(
      'nome', au.nome,
      'foto_url', au.foto_perfil_url
    ),
    'total_curtidas', (
      select count(*) from public.comunidade_curtidas c where c.post_id = po.id
    ),
    'curtido_por_mim', exists (
      select 1 from public.comunidade_curtidas c
      where c.post_id = po.id and c.aluno_id = p_aluno_id
    ),
    'total_comentarios', (
      select count(*) from public.comunidade_comentarios cm
      where cm.post_id = po.id and cm.removido_em is null
    ),
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id,
        'texto', cm.texto,
        'criado_em', cm.criado_em,
        'sou_autor', (cm.aluno_id = p_aluno_id),
        'autor', jsonb_build_object('nome', ca.nome, 'foto_url', ca.foto_perfil_url)
      ) order by cm.criado_em asc)
      from public.comunidade_comentarios cm
      join public.alunos ca on ca.id = cm.aluno_id
      where cm.post_id = po.id and cm.removido_em is null
    ), '[]'::jsonb)
  )
  from public.comunidade_posts po
  join public.alunos au on au.id = po.aluno_id
  where po.id = p_post_id;
$$;

revoke all on function public._post_comunidade_json(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Criar publicação — agora aceita as dimensões.
--
--    A versão de 4 argumentos é DERRUBADA em vez de conviver com a nova: com
--    as duas ficando lado a lado, uma chamada nomeada com quatro argumentos
--    casaria com ambas (a nova tem defaults) e o Postgres recusaria por
--    ambiguidade. Como os parâmetros novos têm DEFAULT null, quem ainda chamar
--    com quatro argumentos continua atendido pela função nova.
-- -----------------------------------------------------------------------------
drop function if exists public.criar_post_comunidade(uuid, text, text, text);

create or replace function public.criar_post_comunidade(
  p_token uuid,
  p_slug text,
  p_legenda text,
  p_imagem_url text,
  p_imagem_largura int default null,
  p_imagem_altura int default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
  v_legenda text;
  v_imagem text;
  v_largura int;
  v_altura int;
  v_post_id uuid;
begin
  select aluno_id, academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  v_legenda := nullif(btrim(coalesce(p_legenda, '')), '');
  if v_legenda is not null and char_length(v_legenda) > 500 then
    v_legenda := left(v_legenda, 500);
  end if;

  v_imagem := nullif(btrim(coalesce(p_imagem_url, '')), '');
  -- Só aceita imagem servida do NOSSO bucket público `comunidade` — bloqueia
  -- data:, javascript: e URLs externas coladas por um cliente adulterado.
  if v_imagem is not null and v_imagem !~ '^https://[^/]+/storage/v1/object/public/comunidade/' then
    raise exception 'Imagem inválida';
  end if;

  if v_legenda is null and v_imagem is null then
    raise exception 'Escreva algo ou anexe uma imagem';
  end if;

  -- Dimensão só faz sentido junto da imagem, e só em par. Valor fora da faixa
  -- vira null em vez de derrubar a publicação: a foto do aluno é mais
  -- importante que a otimização de layout.
  if v_imagem is not null
     and p_imagem_largura between 1 and 20000
     and p_imagem_altura between 1 and 20000 then
    v_largura := p_imagem_largura;
    v_altura := p_imagem_altura;
  end if;

  -- Anti-spam: no máx. 8 publicações por janela (300s fixos no servidor).
  if public.acao_permitida('post:' || v_aluno_id::text, 8, 300) = false then
    raise exception 'Muitas publicações em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.comunidade_posts
    (academia_id, aluno_id, legenda, imagem_url, imagem_largura, imagem_altura)
  values
    (v_academia_id, v_aluno_id, v_legenda, v_imagem, v_largura, v_altura)
  returning id into v_post_id;

  return public._post_comunidade_json(v_post_id, v_aluno_id);
end;
$$;

comment on function public.criar_post_comunidade(uuid, text, text, text, int, int) is
  'Cria uma publicação do próprio aluno. Exige conteúdo, recusa imagem fora do bucket comunidade, guarda as dimensões da foto (para o feed reservar a caixa na proporção certa) e aplica anti-spam.';

revoke all on function public.criar_post_comunidade(uuid, text, text, text, int, int) from public;
grant execute on function public.criar_post_comunidade(uuid, text, text, text, int, int) to anon, authenticated;
