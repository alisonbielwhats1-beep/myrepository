-- =============================================================================
-- Migration 067 — Resolver o acesso do aluno AUTENTICADO pela sessão.
--
-- Fase 3 (painel autenticado do aluno): depois de ativar, o aluno passa a
-- chegar à própria área pela SESSÃO, não pela URL com token. Mas as páginas do
-- aluno (/aluno/[slug]/[token]) resolvem por token_acesso_publico, e o aluno
-- não está em perfis_admin — então academia_id_atual() é NULL para ele e o RLS
-- de `alunos` não o deixa ler o próprio token diretamente.
--
-- Esta função (SECURITY DEFINER, search_path fixo) devolve, para a conta
-- autenticada (auth.uid()), os vínculos de aluno com o slug da academia e o
-- token_acesso_publico — que é a credencial PESSOAL do próprio dono, logo pode
-- ser devolvida a ele. A entrada /aluno usa isto para redirecionar à área
-- existente sem expor token de terceiros nem enfraquecer o RLS.
--
-- Retorna também vínculos suspensos/revogados, para a UI mostrar "acesso
-- suspenso nesta academia" em vez de um 404 confuso. O app filtra por status.
--
-- Depende da 065/066. Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.meu_acesso_aluno()
returns table (
  academia_slug  text,
  academia_nome  text,
  academia_logo  text,
  aluno_id       uuid,
  aluno_token    uuid,
  status_acesso  text
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select ac.slug_url, ac.nome_fantasia, ac.logo_url,
         a.id, a.token_acesso_publico, m.status_acesso
  from public.academia_membros m
  join public.alunos a   on a.id = m.aluno_id
  join public.academias ac on ac.id = m.academia_id
  where m.auth_user_id = auth.uid()
    and m.papel = 'aluno'
    and m.aluno_id is not null
  -- Ativos primeiro; depois por nome, para uma seleção estável quando o aluno
  -- pertence a mais de uma academia.
  order by (m.status_acesso = 'ativo') desc, ac.nome_fantasia;
$$;

comment on function public.meu_acesso_aluno() is
  'Vínculos de aluno da conta autenticada (slug, nome/logo da academia, token pessoal e status de acesso). Base da entrada /aluno por sessão. Só devolve dados do PRÓPRIO usuário (auth.uid()); o token é a credencial pessoal do dono.';

revoke all on function public.meu_acesso_aluno() from public;
grant execute on function public.meu_acesso_aluno() to authenticated;
