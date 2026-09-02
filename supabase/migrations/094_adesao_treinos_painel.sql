-- =============================================================================
-- Migração 094 — Adesão aos treinos (painel do dono).
--
-- A Retenção (migrations 029/030) mede ACESSO à academia (catraca). Ela não
-- responde a outra pergunta, tão importante quanto: "o professor montou a
-- ficha — o aluno está de fato TREINANDO?". Esta função responde isso a partir
-- de sessoes_treino (migration 045), por aluno da academia do funcionário
-- logado.
--
-- UMA função de LEITURA (security definer), no mesmo desenho de retencao_alunos
-- (030): isola por public.academia_id_atual() (nunca aceita academia do
-- cliente) e só conta sessões FINALIZADAS — treino que de fato aconteceu.
-- Nenhuma tabela ou coluna nova. Idempotente.
--
-- Colunas devolvidas por aluno ativo:
--   tem_ficha        — tem ao menos uma ficha ativa atribuída (senão, não dá
--                      nem para cobrar adesão: o professor ainda não montou).
--   ultima_sessao    — data da última sessão finalizada (null = nunca treinou).
--   sessoes_periodo  — sessões finalizadas nos últimos p_dias.
--   total_sessoes    — sessões finalizadas em toda a história.
-- =============================================================================

create or replace function public.adesao_treinos_alunos(p_dias integer default 30)
returns table (
  aluno_id        uuid,
  nome            text,
  tem_ficha       boolean,
  ultima_sessao   timestamptz,
  sessoes_periodo integer,
  total_sessoes   integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.nome,
    exists (
      select 1 from public.treinos t
      where t.aluno_id = a.id and t.ativo = true
    ) as tem_ficha,
    s.ultima_sessao,
    coalesce(s.sessoes_periodo, 0)::integer,
    coalesce(s.total_sessoes, 0)::integer
  from public.alunos a
  left join (
    select
      se.aluno_id,
      max(se.finalizado_em) as ultima_sessao,
      count(*) filter (
        where se.finalizado_em >= now() - make_interval(days => p_dias)
      ) as sessoes_periodo,
      count(*) as total_sessoes
    from public.sessoes_treino se
    where se.academia_id = public.academia_id_atual()
      and se.status = 'finalizada'
      and se.finalizado_em is not null
    group by se.aluno_id
  ) s on s.aluno_id = a.id
  where a.academia_id = public.academia_id_atual()
    and a.status_matricula = 'ativa'
  order by a.nome;
$$;

comment on function public.adesao_treinos_alunos(integer) is
  'Adesão aos treinos por aluno ativo da academia do funcionário logado (isolado por academia_id_atual). Conta só sessoes_treino finalizadas. Só leitura.';

grant execute on function public.adesao_treinos_alunos(integer) to authenticated;
