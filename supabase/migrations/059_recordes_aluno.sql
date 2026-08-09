-- =============================================================================
-- Migration 059 — Recordes de carga do aluno (PR / personal record).
--
-- Gamificacao da tela de treino: para cada exercicio, o maior peso que o aluno
-- ja registrou como "carga realizada" em qualquer sessao (ativa ou finalizada).
-- A tela mostra "Recorde: X kg" e comemora quando o aluno bate um novo.
--
-- UMA funcao de LEITURA (language sql, security definer). Resolve o aluno por
-- token pessoal + slug DENTRO do banco — nunca aluno_id vindo do cliente, mesmo
-- desenho de obter_sessoes_ativas_treino (migration 045). Nenhuma tabela ou
-- coluna nova: so agrega sessoes_treino.progresso, que ja existe.
--
-- Guardas jsonb_typeof antes de castar evitam erro se um item de progresso vier
-- sem os campos esperados. Sem DO block, sem format(), sem cifrao dentro do
-- corpo — seguro colar no editor SQL do dashboard.
--
-- Idempotente. Reversao: 059_recordes_aluno_rollback.sql
-- =============================================================================

create or replace function public.obter_recordes_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  ),
  cargas as (
    select
      (p->>'exercicio_id')::uuid as exercicio_id,
      (p->>'carga_realizada_kg')::numeric as carga
    from public.sessoes_treino s
    cross join lateral jsonb_array_elements(s.progresso) as p
    where s.aluno_id = (select aluno_id from aluno_resolvido)
      and (select aluno_id from aluno_resolvido) is not null
      and jsonb_typeof(p->'exercicio_id') = 'string'
      and jsonb_typeof(p->'carga_realizada_kg') = 'number'
  )
  select coalesce(jsonb_object_agg(exercicio_id::text, maxc), '{}'::jsonb)
  from (
    select exercicio_id, max(carga) as maxc
    from cargas
    where carga > 0
    group by exercicio_id
  ) x;
$$;

comment on function public.obter_recordes_aluno(uuid, text) is
  'Recorde de carga (max carga_realizada_kg) por exercicio do proprio aluno, resolvido por token pessoal + slug. So leitura de sessoes_treino.';

revoke all on function public.obter_recordes_aluno(uuid, text) from public;
grant execute on function public.obter_recordes_aluno(uuid, text) to anon, authenticated;
