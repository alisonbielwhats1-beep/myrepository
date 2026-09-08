-- =============================================================================
-- Rollback da migração 103 — desfaz as dimensões da foto da publicação.
--
-- Devolve `criar_post_comunidade` e `_post_comunidade_json` ao estado da 085 e
-- remove as colunas. As dimensões já gravadas são PERDIDAS (só voltam quando
-- os alunos publicarem de novo) — mas nenhuma foto se perde, porque a URL da
-- imagem vive noutra coluna.
--
-- Aplique isto só se a 103 tiver causado problema; o app tolera a ausência das
-- colunas (o card volta à caixa 4:5) e a ausência dos parâmetros novos da RPC.
-- =============================================================================

drop function if exists public.criar_post_comunidade(uuid, text, text, text, int, int);

create or replace function public.criar_post_comunidade(
  p_token uuid,
  p_slug text,
  p_legenda text,
  p_imagem_url text
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
  if v_imagem is not null and v_imagem !~ '^https://[^/]+/storage/v1/object/public/comunidade/' then
    raise exception 'Imagem inválida';
  end if;

  if v_legenda is null and v_imagem is null then
    raise exception 'Escreva algo ou anexe uma imagem';
  end if;

  if public.acao_permitida('post:' || v_aluno_id::text, 8, 300) = false then
    raise exception 'Muitas publicações em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.comunidade_posts (academia_id, aluno_id, legenda, imagem_url)
  values (v_academia_id, v_aluno_id, v_legenda, v_imagem)
  returning id into v_post_id;

  return public._post_comunidade_json(v_post_id, v_aluno_id);
end;
$$;

revoke all on function public.criar_post_comunidade(uuid, text, text, text) from public;
grant execute on function public.criar_post_comunidade(uuid, text, text, text) to anon, authenticated;

-- Serializador sem as dimensões (estado da 085).
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

alter table public.comunidade_posts
  drop constraint if exists comunidade_posts_dimensoes;

alter table public.comunidade_posts
  drop column if exists imagem_largura,
  drop column if exists imagem_altura;
