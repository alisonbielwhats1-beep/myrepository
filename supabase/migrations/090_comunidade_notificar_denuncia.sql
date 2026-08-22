-- =============================================================================
-- Migration 090 — Notificar o gestor quando um post da comunidade é denunciado.
--
-- ACHADO (auditoria — follow-up do Lote 3): a moderação da comunidade era
-- "pull". O aluno denuncia, o post pode até ser auto-ocultado (089), mas o
-- gestor só descobre se ABRIR a tela de Moderação. Ninguém o avisa.
--
-- MUDANÇA: a denúncia passa a criar um alerta na central de notificações que o
-- painel já tem (migration 041) — o mesmo sino de "mensalidade vencendo",
-- "aluno sumido" etc. Uma notificação por post (dedupe), categoria 'comunidade',
-- visível a dono e gerente (os papéis que moderam), levando à Moderação.
--
--   • Nova categoria 'comunidade' + tipo 'comunidade_denuncia' + entidade 'post'
--     nos CHECKs de public.notificacoes.
--   • Policy de SELECT de notificacoes ganha a regra da categoria 'comunidade'
--     (dono/gerente), espelhando a seção "comunidade" de lib/permissoes.ts.
--   • denunciar_post_comunidade (085/089) passa a inserir a notificação. A
--     função é SECURITY DEFINER e roda como owner, então grava em notificacoes
--     sem policy de INSERT para authenticated (mesmo padrão de
--     gerar_notificacoes_diarias). NUNCA expõe dado do autor — só que houve
--     denúncia e o link para revisar.
--
-- Idempotente. NÃO aplicar em produção sem autorização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Ampliar os CHECKs de notificacoes (aditivo — só amplia o conjunto aceito).
-- -----------------------------------------------------------------------------
alter table public.notificacoes drop constraint if exists notificacoes_categoria_check;
alter table public.notificacoes add constraint notificacoes_categoria_check
  check (categoria in ('mensalidade', 'acesso', 'retencao', 'estoque', 'sistema', 'comunidade'));

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'mensalidade_vencendo', 'mensalidade_atrasada', 'plano_vencimento',
    'aluno_ausente', 'aniversario', 'estoque_baixo',
    'comunidade_denuncia'
  ));

alter table public.notificacoes drop constraint if exists notificacoes_entidade_check;
alter table public.notificacoes add constraint notificacoes_entidade_check
  check (entidade in ('aluno', 'mensalidade', 'produto', 'post'));

-- -----------------------------------------------------------------------------
-- 1. Recriar a policy de SELECT incluindo a categoria 'comunidade' (dono/gerente).
--    Mesma policy da migration 041, só com a linha nova — nada mais muda.
-- -----------------------------------------------------------------------------
drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes
  for select to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() = 'dono'
      or categoria in ('sistema', 'acesso')
      or (categoria = 'retencao' and public.papel_do_usuario_atual() = 'gerente')
      or (categoria = 'estoque' and public.papel_do_usuario_atual() in ('gerente', 'recepcao'))
      or (categoria = 'comunidade' and public.papel_do_usuario_atual() in ('dono', 'gerente'))
    )
  );

-- -----------------------------------------------------------------------------
-- 2. denunciar_post_comunidade: mesmo corpo da 089 (auto-ocultar), acrescido do
--    INSERT da notificação ao gestor. Dedupe por post: uma notificação por
--    publicação denunciada, mesmo que várias pessoas denunciem.
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
  v_total_denuncias integer;
  v_ocultado boolean := false;
  v_limite_auto constant integer := 3;
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

  -- Avisa o gestor na central de notificações (sino do painel). Uma por post:
  -- ON CONFLICT no dedupe_key não repete o alerta a cada nova denúncia. Sem
  -- nenhum dado do autor/denunciante — só que há o que revisar.
  insert into public.notificacoes
    (academia_id, categoria, tipo, prioridade, titulo, mensagem,
     entidade, entidade_id, data_referencia, dedupe_key, metadados)
  values (
    v_academia_id, 'comunidade', 'comunidade_denuncia', 'media',
    'Publicação denunciada',
    'Uma publicação da comunidade foi denunciada. Revise na Moderação.',
    'post', p_post_id,
    (now() at time zone 'America/Sao_Paulo')::date,
    'post:' || p_post_id::text || ':denuncia',
    jsonb_build_object('post_id', p_post_id)
  )
  on conflict (academia_id, dedupe_key) do nothing;

  -- Auto-ocultar: ao atingir o limite de denúncias distintas, tira do ar na
  -- hora (removido_por='auto'). Reversível pela moderação (restaurar_post_moderacao).
  v_total_denuncias := (
    select count(*) from public.comunidade_denuncias where post_id = p_post_id
  );
  if v_total_denuncias >= v_limite_auto then
    update public.comunidade_posts
      set removido_em = now(), removido_por = 'auto'
      where id = p_post_id and academia_id = v_academia_id and removido_em is null;
    v_ocultado := found;
  end if;

  return jsonb_build_object(
    'post_id', p_post_id,
    'denunciado', true,
    'ocultado', coalesce(v_ocultado, false)
  );
end;
$$;

revoke all on function public.denunciar_post_comunidade(uuid, text, uuid, text) from public;
grant execute on function public.denunciar_post_comunidade(uuid, text, uuid, text) to anon, authenticated;
