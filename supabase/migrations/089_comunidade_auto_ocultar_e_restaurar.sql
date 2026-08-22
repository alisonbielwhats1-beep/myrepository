-- =============================================================================
-- Migration 089 — Comunidade: auto-ocultar por denúncias + restaurar (moderação)
--
-- ACHADO (auditoria de produto, 2026-08-22):
--   A moderação da comunidade era 100% "pull": um post denunciado só saía do ar
--   quando o dono/gerente abria a tela de Moderação e removia manualmente. Até
--   lá, conteúdo impróprio muito denunciado seguia visível para todos os alunos
--   da academia.
--
-- MUDANÇA:
--   1) `denunciar_post_comunidade` passa a OCULTAR a publicação automaticamente
--      quando ela atinge o limite de denúncias distintas (LIMITE_AUTO = 3),
--      marcando removido_por = 'auto'. Proteção imediata, sem esperar a
--      moderação.
--   2) Novo `restaurar_post_moderacao` (dono/gerente) permite reverter uma
--      remoção da MODERAÇÃO (manual ou automática) — nunca a exclusão feita
--      pelo próprio autor. Assim o auto-ocultar nunca é destrutivo: um falso
--      positivo (ex.: denúncias coordenadas) é reversível em um clique.
--
--   O limite é conservador (3) e o feed já não mostrava posts removidos, então
--   o efeito é só "some antes" para conteúdo realmente denunciado. A tela de
--   Moderação (denunciados primeiro) continua sendo o lugar de revisar/restaurar.
--
-- Idempotente. NÃO aplicar em produção sem autorização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Permitir removido_por = 'auto' em comunidade_posts.
-- -----------------------------------------------------------------------------
alter table public.comunidade_posts
  drop constraint if exists comunidade_posts_removido_por_check;
alter table public.comunidade_posts
  add constraint comunidade_posts_removido_por_check
  check (removido_por in ('autor', 'moderacao', 'auto'));

-- -----------------------------------------------------------------------------
-- 1. Denunciar + auto-ocultar ao atingir o limite. Mesma assinatura/corpo da
--    migration 085, acrescentando só o bloco de auto-ocultar no final.
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
  -- Denúncias distintas (a PK (post_id, aluno_id) garante 1 por aluno) que
  -- disparam o auto-ocultar. Constante do servidor — nunca vem do cliente.
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

-- -----------------------------------------------------------------------------
-- 2. Restaurar uma publicação removida PELA MODERAÇÃO (manual ou automática).
--    Papel dono/gerente, academia sempre da sessão. Nunca reverte a exclusão
--    feita pelo próprio autor.
-- -----------------------------------------------------------------------------
create or replace function public.restaurar_post_moderacao(p_post_id uuid)
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
    set removido_em = null, removido_por = null
    where id = p_post_id
      and academia_id = v_academia_id
      and removido_por in ('moderacao', 'auto')
    returning id into v_id;

  if v_id is null then
    raise exception 'Publicação não encontrada nesta academia ou não pode ser restaurada';
  end if;

  return jsonb_build_object('id', v_id, 'restaurado', true);
end;
$$;

comment on function public.restaurar_post_moderacao(uuid) is
  'Restaura (remove o soft-delete) uma publicação tirada do ar pela moderação (manual ou auto). Papel dono/gerente. Nunca reverte exclusão do autor. Academia sempre da sessão.';

revoke all on function public.restaurar_post_moderacao(uuid) from public, anon;
grant execute on function public.restaurar_post_moderacao(uuid) to authenticated;
