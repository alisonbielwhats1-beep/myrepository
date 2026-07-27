-- =============================================================================
-- Migration 047 — Status real de acesso na Home do aluno (Bloco 2, Parte A).
--
-- Problema corrigido: a Home do aluno mostrava status cadastral e financeiro,
-- mas não um status de ACESSO separado (Liberado / Liberado com alerta /
-- Bloqueado) — a mesma regra que a recepção já usa (decidirAcesso(), em
-- lib/utils.ts) nunca era exposta ao aluno.
--
-- A decisão em si continua sendo calculada em TypeScript por decidirAcesso()
-- (mesma função da recepção — nenhuma regra paralela é criada). O único dado
-- que faltava para isso no lado do aluno era a política de inadimplência da
-- academia (status_matricula e mensalidades pendentes já eram lidos por
-- outras funções da Fase 12). Esta migration adiciona só essa leitura, numa
-- função nova e mínima — não altera `obter_ficha_aluno` (migration 037).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.obter_politica_acesso_aluno(p_token uuid, p_slug text)
returns text
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select ac.politica_inadimplencia
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;
$$;

comment on function public.obter_politica_acesso_aluno(uuid, text) is
  'Política de inadimplência da academia do próprio aluno, resolvida por token pessoal + slug (nunca aluno_id/academia_id). Único dado que faltava para calcular decidirAcesso() no lado do aluno — status_matricula e mensalidades já vêm de outras funções da Fase 12.';

revoke all on function public.obter_politica_acesso_aluno(uuid, text) from public;
grant execute on function public.obter_politica_acesso_aluno(uuid, text) to anon, authenticated;
