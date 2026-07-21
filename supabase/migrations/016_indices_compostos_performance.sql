-- =============================================================================
-- Migration 016 — Índices compostos (academia_id + coluna de tempo).
--
-- PROBLEMA (performance em escala):
--   As queries do painel SEMPRE filtram por academia_id (RLS) E ordenam/filtram
--   por uma coluna de data. Hoje existem índices single-column separados
--   (idx_acessos_academia, idx_acessos_data, ...), mas o Postgres só usa um por
--   vez — a query "check-ins da academia X ordenados por data" varre e ordena
--   em memória. Com milhões de linhas em acessos_catraca isso degrada.
--
-- SOLUÇÃO:
--   Cria índices compostos (academia_id, <data> DESC) que servem exatamente o
--   padrão real de acesso: filtro por tenant + ordenação temporal, em uma única
--   varredura de índice. E remove os índices single-column de data que se
--   tornaram redundantes (toda query passa por academia_id primeiro, por RLS),
--   reduzindo o custo de escrita no caminho quente de inserção.
--
-- Seguro rodar mais de uma vez. Não altera nenhum dado.
--
-- NOTA para tabelas grandes (futuro, > alguns milhões de linhas):
--   CREATE INDEX comum trava escritas na tabela durante a construção. Hoje
--   suas tabelas são pequenas (execução em milissegundos). Quando acessos_catraca
--   passar de alguns milhões de linhas, recrie usando CREATE INDEX CONCURRENTLY
--   (rodando cada statement fora de transação) para não bloquear inserções.
-- =============================================================================

-- acessos_catraca: tabela de maior crescimento. Serve getAcessos() e
-- getAlunosSumidos() (filtro academia_id + data_hora_entrada).
create index if not exists idx_acessos_academia_data
  on public.acessos_catraca (academia_id, data_hora_entrada desc);

-- receitas: serve getReceitas() (filtro academia_id + range de data).
create index if not exists idx_receitas_academia_data
  on public.receitas (academia_id, data desc);

-- despesas: serve getDespesas() (filtro academia_id + range de data).
create index if not exists idx_despesas_academia_data
  on public.despesas (academia_id, data desc);

-- feedbacks: serve getFeedbacks() (filtro academia_id + ordem por criado_em).
create index if not exists idx_feedbacks_academia_criado
  on public.feedbacks (academia_id, criado_em desc);

-- alunos: serve getAlunos() (filtro academia_id + ordem por criado_em).
create index if not exists idx_alunos_academia_criado
  on public.alunos (academia_id, criado_em desc);

-- progresso_aluno: serve getProgressoAluno() / getTodoProgresso().
create index if not exists idx_progresso_academia_data
  on public.progresso_aluno (academia_id, data desc);

-- ---------------------------------------------------------------------------
-- Remove índices single-column de data que ficaram redundantes: como TODA
-- query filtra academia_id primeiro (RLS), o composto (academia_id, data) já
-- cobre 100% dos casos. Manter os single-column só adiciona custo de escrita.
-- (Mantemos os índices de status/tipo/categoria, que servem filtros próprios.)
-- ---------------------------------------------------------------------------
drop index if exists public.idx_acessos_data;
drop index if exists public.idx_receitas_data;
drop index if exists public.idx_despesas_data;
drop index if exists public.idx_progresso_data;
