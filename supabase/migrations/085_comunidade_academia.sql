-- =============================================================================
-- Migration 085 — Comunidade interna da academia (App do aluno — MVP)
--
-- OBJETIVO
--   Um feed simples e ISOLADO POR ACADEMIA: aluno publica (legenda + 1 imagem),
--   curte, comenta, exclui a própria publicação e pode denunciar. Dono/gerente
--   moderam pelo painel. NÃO é um Instagram: sem chat, sem seguidores, sem
--   stories — só o essencial (itens marcados como Fase 2 ficam de fora).
--
-- ISOLAMENTO (item 12 do brief — segurança/multitenant)
--   Toda linha carrega `academia_id`. O aluno é resolvido SEMPRE por
--   token_acesso_publico + slug dentro das funções `security definer` (nunca
--   aluno_id do cliente), e o feed só devolve conteúdo da MESMA academia do
--   aluno. Aluno da Academia A jamais lê conteúdo da Academia B. As tabelas têm
--   RLS ligada e NENHUM grant direto para anon; só a moderação (painel, sessão
--   autenticada) tem policies, restritas a `academia_id_atual()`.
--
-- PRIVACIDADE (item 4 do brief)
--   O feed expõe apenas nome + foto de perfil + legenda + imagem. NUNCA
--   telefone, e-mail, CPF, plano, mensalidade ou qualquer dado do cadastro.
--
-- Imagens vão para o bucket Storage `comunidade` (escrita só pela service role,
-- validada em lib/comunidade-fotos.ts antes do upload). As RPCs recebem só a
-- URL pública já pronta e recusam URL fora desse bucket.
--
-- Padrão herdado da migration 045 (sessões de treino). Idempotente.
-- NÃO aplicar em produção sem autorização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.comunidade_posts (
  id            uuid        primary key default gen_random_uuid(),
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  aluno_id      uuid        not null references public.alunos(id) on delete cascade,
  legenda       text,
  imagem_url    text,
  criado_em     timestamptz not null default now(),
  -- Soft-delete: nunca apagamos a linha (preserva histórico p/ moderação e
  -- para não quebrar contagens). `removido_por`: 'autor' ou 'moderacao'.
  removido_em   timestamptz,
  removido_por  text        check (removido_por in ('autor', 'moderacao')),
  -- Ao menos um dos dois precisa existir (garantido também nas RPCs).
  constraint comunidade_posts_conteudo check (
    (legenda is not null and btrim(legenda) <> '') or imagem_url is not null
  )
);

comment on table public.comunidade_posts is
  'Publicações da comunidade interna, isoladas por academia. Soft-delete via removido_em. Feed expõe só nome/foto/legenda/imagem — nunca dados de cadastro.';

create index if not exists idx_comunidade_posts_feed
  on public.comunidade_posts (academia_id, criado_em desc)
  where removido_em is null;

create table if not exists public.comunidade_curtidas (
  post_id     uuid        not null references public.comunidade_posts(id) on delete cascade,
  aluno_id    uuid        not null references public.alunos(id) on delete cascade,
  academia_id uuid        not null references public.academias(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (post_id, aluno_id)
);

create index if not exists idx_comunidade_curtidas_post
  on public.comunidade_curtidas (post_id);

create table if not exists public.comunidade_comentarios (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.comunidade_posts(id) on delete cascade,
  aluno_id      uuid        not null references public.alunos(id) on delete cascade,
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  texto         text        not null,
  criado_em     timestamptz not null default now(),
  removido_em   timestamptz,
  removido_por  text        check (removido_por in ('autor', 'moderacao'))
);

create index if not exists idx_comunidade_comentarios_post
  on public.comunidade_comentarios (post_id, criado_em)
  where removido_em is null;

create table if not exists public.comunidade_denuncias (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.comunidade_posts(id) on delete cascade,
  aluno_id      uuid        not null references public.alunos(id) on delete cascade,
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  motivo        text,
  criado_em     timestamptz not null default now(),
  -- Um aluno denuncia um post no máximo uma vez.
  unique (post_id, aluno_id)
);

create index if not exists idx_comunidade_denuncias_post
  on public.comunidade_denuncias (post_id);

-- -----------------------------------------------------------------------------
-- 1. RLS: ligada em todas. Aluno (sem auth.uid) nunca acessa direto — só pelas
--    RPCs abaixo. Moderação (painel autenticado) enxerga/edita o conteúdo da
--    própria academia; nunca de outra.
-- -----------------------------------------------------------------------------
alter table public.comunidade_posts        enable row level security;
alter table public.comunidade_curtidas     enable row level security;
alter table public.comunidade_comentarios  enable row level security;
alter table public.comunidade_denuncias    enable row level security;

drop policy if exists "mod_select_posts" on public.comunidade_posts;
create policy "mod_select_posts" on public.comunidade_posts
  for select to authenticated using (academia_id = public.academia_id_atual());

drop policy if exists "mod_update_posts" on public.comunidade_posts;
create policy "mod_update_posts" on public.comunidade_posts
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

drop policy if exists "mod_select_comentarios" on public.comunidade_comentarios;
create policy "mod_select_comentarios" on public.comunidade_comentarios
  for select to authenticated using (academia_id = public.academia_id_atual());

drop policy if exists "mod_update_comentarios" on public.comunidade_comentarios;
create policy "mod_update_comentarios" on public.comunidade_comentarios
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

drop policy if exists "mod_select_denuncias" on public.comunidade_denuncias;
create policy "mod_select_denuncias" on public.comunidade_denuncias
  for select to authenticated using (academia_id = public.academia_id_atual());

-- -----------------------------------------------------------------------------
-- 2. Resolve o aluno pelo token pessoal + slug. Interna — sem grant a papéis.
-- -----------------------------------------------------------------------------
create or replace function public._resolver_aluno_comunidade(
  p_token uuid,
  p_slug text
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
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;
$$;

revoke all on function public._resolver_aluno_comunidade(uuid, text) from public, anon, authenticated;

-- Monta o objeto público de UM post (contagens + se o aluno atual curtiu/é
-- autor + comentários visíveis). `p_aluno_id` é o espectador. Interna.
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

-- -----------------------------------------------------------------------------
-- 3. Feed da comunidade do próprio aluno (só a academia dele, não removidos).
--    Paginação simples por `p_antes` (criado_em < p_antes). Limite teto 50.
-- -----------------------------------------------------------------------------
create or replace function public.obter_feed_comunidade(
  p_token uuid,
  p_slug text,
  p_limite int default 20,
  p_antes timestamptz default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with alvo as (
    select aluno_id, academia_id from public._resolver_aluno_comunidade(p_token, p_slug)
  )
  select coalesce(jsonb_agg(
    public._post_comunidade_json(po.id, (select aluno_id from alvo))
    order by po.criado_em desc
  ), '[]'::jsonb)
  from public.comunidade_posts po
  where po.academia_id = (select academia_id from alvo)
    and po.removido_em is null
    and (p_antes is null or po.criado_em < p_antes)
    and exists (select 1 from alvo)
  -- LIMIT dentro de subconsulta para o agg respeitar a paginação:
  and po.id in (
    select id from public.comunidade_posts pp
    where pp.academia_id = (select academia_id from alvo)
      and pp.removido_em is null
      and (p_antes is null or pp.criado_em < p_antes)
    order by pp.criado_em desc
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
  );
$$;

comment on function public.obter_feed_comunidade(uuid, text, int, timestamptz) is
  'Feed da comunidade da própria academia do aluno (resolvido por token+slug). Só posts não removidos. Expõe nome/foto/legenda/imagem — nunca dados de cadastro.';

revoke all on function public.obter_feed_comunidade(uuid, text, int, timestamptz) from public;
grant execute on function public.obter_feed_comunidade(uuid, text, int, timestamptz) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Criar publicação. Valida token+slug, exige conteúdo (legenda ou imagem),
--    recusa imagem fora do bucket `comunidade`, limita tamanho e aplica
--    anti-spam (acao_permitida) mesmo se a RPC for chamada direto pela anon key.
-- -----------------------------------------------------------------------------
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
  -- Só aceita imagem servida do NOSSO bucket público `comunidade` — bloqueia
  -- data:, javascript: e URLs externas coladas por um cliente adulterado.
  if v_imagem is not null and v_imagem !~ '^https://[^/]+/storage/v1/object/public/comunidade/' then
    raise exception 'Imagem inválida';
  end if;

  if v_legenda is null and v_imagem is null then
    raise exception 'Escreva algo ou anexe uma imagem';
  end if;

  -- Anti-spam: no máx. 8 publicações por janela (300s fixos no servidor).
  if public.acao_permitida('post:' || v_aluno_id::text, 8, 300) = false then
    raise exception 'Muitas publicações em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.comunidade_posts (academia_id, aluno_id, legenda, imagem_url)
  values (v_academia_id, v_aluno_id, v_legenda, v_imagem)
  returning id into v_post_id;

  return public._post_comunidade_json(v_post_id, v_aluno_id);
end;
$$;

comment on function public.criar_post_comunidade(uuid, text, text, text) is
  'Cria uma publicação do próprio aluno. Exige conteúdo, recusa imagem fora do bucket comunidade e aplica anti-spam. Academia sempre a do aluno resolvido.';

revoke all on function public.criar_post_comunidade(uuid, text, text, text) from public;
grant execute on function public.criar_post_comunidade(uuid, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Curtir / descurtir (idempotentes). Post precisa ser da mesma academia e
--    não estar removido. Devolve a contagem atualizada.
-- -----------------------------------------------------------------------------
create or replace function public.curtir_post_comunidade(
  p_token uuid,
  p_slug text,
  p_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
begin
  select aluno_id, academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.comunidade_posts
    where id = p_post_id and academia_id = v_academia_id and removido_em is null
  ) then
    return null;
  end if;

  insert into public.comunidade_curtidas (post_id, aluno_id, academia_id)
  values (p_post_id, v_aluno_id, v_academia_id)
  on conflict (post_id, aluno_id) do nothing;

  return jsonb_build_object(
    'post_id', p_post_id,
    'curtido_por_mim', true,
    'total_curtidas', (select count(*) from public.comunidade_curtidas where post_id = p_post_id)
  );
end;
$$;

revoke all on function public.curtir_post_comunidade(uuid, text, uuid) from public;
grant execute on function public.curtir_post_comunidade(uuid, text, uuid) to anon, authenticated;

create or replace function public.descurtir_post_comunidade(
  p_token uuid,
  p_slug text,
  p_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
begin
  select aluno_id, academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  delete from public.comunidade_curtidas
  where post_id = p_post_id and aluno_id = v_aluno_id and academia_id = v_academia_id;

  return jsonb_build_object(
    'post_id', p_post_id,
    'curtido_por_mim', false,
    'total_curtidas', (select count(*) from public.comunidade_curtidas where post_id = p_post_id)
  );
end;
$$;

revoke all on function public.descurtir_post_comunidade(uuid, text, uuid) from public;
grant execute on function public.descurtir_post_comunidade(uuid, text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Comentar. Texto obrigatório (<=300), post da mesma academia e não
--    removido. Anti-spam. Devolve o comentário criado.
-- -----------------------------------------------------------------------------
create or replace function public.comentar_post_comunidade(
  p_token uuid,
  p_slug text,
  p_post_id uuid,
  p_texto text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
  v_texto text;
  v_id uuid;
  v_aluno public.alunos%rowtype;
begin
  select aluno_id, academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  v_texto := nullif(btrim(coalesce(p_texto, '')), '');
  if v_texto is null then
    raise exception 'Escreva um comentário';
  end if;
  v_texto := left(v_texto, 300);

  if not exists (
    select 1 from public.comunidade_posts
    where id = p_post_id and academia_id = v_academia_id and removido_em is null
  ) then
    return null;
  end if;

  if public.acao_permitida('coment:' || v_aluno_id::text, 30, 300) = false then
    raise exception 'Muitos comentários em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.comunidade_comentarios (post_id, aluno_id, academia_id, texto)
  values (p_post_id, v_aluno_id, v_academia_id, v_texto)
  returning id into v_id;

  select * into v_aluno from public.alunos where id = v_aluno_id;

  return jsonb_build_object(
    'id', v_id,
    'texto', v_texto,
    'criado_em', now(),
    'sou_autor', true,
    'autor', jsonb_build_object('nome', v_aluno.nome, 'foto_url', v_aluno.foto_perfil_url)
  );
end;
$$;

revoke all on function public.comentar_post_comunidade(uuid, text, uuid, text) from public;
grant execute on function public.comentar_post_comunidade(uuid, text, uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Excluir a PRÓPRIA publicação / comentário (soft-delete). Só o autor.
-- -----------------------------------------------------------------------------
create or replace function public.excluir_post_comunidade(
  p_token uuid,
  p_slug text,
  p_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_id uuid;
begin
  select aluno_id into v_aluno_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  update public.comunidade_posts
    set removido_em = now(), removido_por = 'autor'
    where id = p_post_id and aluno_id = v_aluno_id and removido_em is null
    returning id into v_id;

  return jsonb_build_object('id', p_post_id, 'removido', v_id is not null);
end;
$$;

revoke all on function public.excluir_post_comunidade(uuid, text, uuid) from public;
grant execute on function public.excluir_post_comunidade(uuid, text, uuid) to anon, authenticated;

create or replace function public.excluir_comentario_comunidade(
  p_token uuid,
  p_slug text,
  p_comentario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_id uuid;
begin
  select aluno_id into v_aluno_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  update public.comunidade_comentarios
    set removido_em = now(), removido_por = 'autor'
    where id = p_comentario_id and aluno_id = v_aluno_id and removido_em is null
    returning id into v_id;

  return jsonb_build_object('id', p_comentario_id, 'removido', v_id is not null);
end;
$$;

revoke all on function public.excluir_comentario_comunidade(uuid, text, uuid) from public;
grant execute on function public.excluir_comentario_comunidade(uuid, text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Denunciar publicação (uma por aluno+post). Alimenta a fila de moderação.
-- -----------------------------------------------------------------------------
create or replace function public.denunciar_post_comunidade(
  p_token uuid,
  p_slug text,
  p_post_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno_id uuid;
  v_academia_id uuid;
begin
  select aluno_id, academia_id into v_aluno_id, v_academia_id
  from public._resolver_aluno_comunidade(p_token, p_slug);
  if v_aluno_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.comunidade_posts
    where id = p_post_id and academia_id = v_academia_id and removido_em is null
  ) then
    return null;
  end if;

  if public.acao_permitida('denuncia:' || v_aluno_id::text, 20, 300) = false then
    raise exception 'Muitas denúncias em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.comunidade_denuncias (post_id, aluno_id, academia_id, motivo)
  values (p_post_id, v_aluno_id, v_academia_id, nullif(left(btrim(coalesce(p_motivo, '')), 300), ''))
  on conflict (post_id, aluno_id) do nothing;

  return jsonb_build_object('post_id', p_post_id, 'denunciado', true);
end;
$$;

revoke all on function public.denunciar_post_comunidade(uuid, text, uuid, text) from public;
grant execute on function public.denunciar_post_comunidade(uuid, text, uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. MODERAÇÃO (painel, sessão autenticada). Academia sempre da sessão.
--    Papel dono/gerente. Lista posts (denunciados primeiro) e remove conteúdo.
-- -----------------------------------------------------------------------------
create or replace function public.listar_posts_moderacao(
  p_limite int default 30,
  p_apenas_denunciados boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;
  if v_papel not in ('dono', 'gerente') then
    raise exception 'Seu perfil não pode moderar a comunidade';
  end if;

  return coalesce((
    select jsonb_agg(j order by (j->>'total_denuncias')::int desc, (j->>'criado_em') desc)
    from (
      select jsonb_build_object(
        'id', po.id,
        'legenda', po.legenda,
        'imagem_url', po.imagem_url,
        'criado_em', po.criado_em,
        'removido_em', po.removido_em,
        'removido_por', po.removido_por,
        'autor', jsonb_build_object('nome', au.nome, 'foto_url', au.foto_perfil_url),
        'total_denuncias', (
          select count(*) from public.comunidade_denuncias d where d.post_id = po.id
        ),
        'total_curtidas', (
          select count(*) from public.comunidade_curtidas c where c.post_id = po.id
        ),
        'total_comentarios', (
          select count(*) from public.comunidade_comentarios cm
          where cm.post_id = po.id and cm.removido_em is null
        )
      ) as j
      from public.comunidade_posts po
      join public.alunos au on au.id = po.aluno_id
      where po.academia_id = v_academia_id
        and (
          p_apenas_denunciados = false
          or exists (select 1 from public.comunidade_denuncias d where d.post_id = po.id)
        )
      order by po.criado_em desc
      limit least(greatest(coalesce(p_limite, 30), 1), 100)
    ) s
  ), '[]'::jsonb);
end;
$$;

comment on function public.listar_posts_moderacao(int, boolean) is
  'Lista publicações da academia da SESSÃO para moderação (denunciadas primeiro). Papel dono/gerente. Nunca de outra academia.';

revoke all on function public.listar_posts_moderacao(int, boolean) from public, anon;
grant execute on function public.listar_posts_moderacao(int, boolean) to authenticated;

create or replace function public.remover_post_moderacao(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_id uuid;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;
  if v_papel not in ('dono', 'gerente') then
    raise exception 'Seu perfil não pode moderar a comunidade';
  end if;

  update public.comunidade_posts
    set removido_em = coalesce(removido_em, now()), removido_por = 'moderacao'
    where id = p_post_id and academia_id = v_academia_id
    returning id into v_id;

  if v_id is null then
    raise exception 'Publicação não encontrada nesta academia';
  end if;

  return jsonb_build_object('id', v_id, 'removido', true);
end;
$$;

comment on function public.remover_post_moderacao(uuid) is
  'Remove (soft-delete) uma publicação da própria academia. Papel dono/gerente. Academia sempre da sessão.';

revoke all on function public.remover_post_moderacao(uuid) from public, anon;
grant execute on function public.remover_post_moderacao(uuid) to authenticated;
