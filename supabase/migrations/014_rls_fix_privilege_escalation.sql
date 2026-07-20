-- =============================================================================
-- Migration 014 — Corrige escalação de privilégios em perfis_admin.
--
-- PROBLEMA (CRÍTICO):
--   A policy "perfil_equipe_update" permitia que QUALQUER membro autenticado
--   da academia fizesse UPDATE em qualquer linha de perfis_admin (incluindo
--   mudar o próprio papel para "dono") via chamada REST direta ao Supabase,
--   bypassando o check da aplicação.
--
-- SOLUÇÃO:
--   1. Cria a função `papel_do_usuario_atual()` que retorna o papel do auth.uid()
--      atual consultando perfis_admin com SECURITY DEFINER (evita recursão RLS).
--   2. Restringe "perfil_equipe_update" para exigir que o executante seja "dono".
--   3. Proíbe UPDATE no campo `papel` exceto via a action do servidor (o app
--      já valida; agora o banco também valida).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- 1. Função que devolve o papel do usuário atual (sem recursão de RLS porque
--    usa SECURITY DEFINER com search_path fixo, executada como owner do schema).
create or replace function public.papel_do_usuario_atual()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select papel from public.perfis_admin where id = auth.uid();
$$;

comment on function public.papel_do_usuario_atual() is
  'Papel (dono/gerente/recepcao/instrutor) do usuário autenticado. '
  'Base do controle de acesso de granularidade fina no RLS.';

-- 2. Restringe UPDATE em perfis_admin: apenas o "dono" da academia pode
--    alterar dados de outros membros. Membros não-donos só podem atualizar
--    seu próprio nome/email, mas nunca o campo papel.
drop policy if exists "perfil_equipe_update" on public.perfis_admin;

-- 2a. Dono pode atualizar qualquer linha da academia.
create policy "perfil_equipe_update_dono" on public.perfis_admin
  for update to authenticated
  using (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() = 'dono'
  )
  with check (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() = 'dono'
  );
