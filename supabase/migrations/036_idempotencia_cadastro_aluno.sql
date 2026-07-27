-- =============================================================================
-- Migration 036 — Fase 11: idempotência no cadastro de aluno.
--
-- PROBLEMA (BLOQUEADOR — corrupção de dados):
--   `alunos` tem `unique (academia_id, cpf)` (schema.sql), mas CPF é opcional.
--   Sem CPF (comum em academias que não exigem no cadastro), duplo clique ou
--   reenvio de rede em "Cadastrar aluno" cria DUAS matrículas para a mesma
--   pessoa — cada uma com seu próprio histórico de plano, cobrança e acesso.
--   Mesmo padrão já corrigido na Fase 8 para acessos_catraca (migration 033).
--
-- SOLUÇÃO: mesma receita — chave de idempotência gerada uma vez por abertura
-- do formulário, com índice único parcial. Reenvio da mesma tentativa não
-- duplica; um novo cadastro legítimo depois usa uma chave nova.
--
-- Seguro rodar mais de uma vez. Não altera dados existentes.
-- =============================================================================

alter table public.alunos
  add column if not exists chave_idempotencia text;

create unique index if not exists uidx_alunos_chave_idempotencia
  on public.alunos (academia_id, chave_idempotencia)
  where chave_idempotencia is not null;

comment on column public.alunos.chave_idempotencia is
  'Chave gerada pelo cliente por tentativa de cadastro (Fase 11). Evita '
  'duplicar o aluno em duplo clique/reenvio quando não há CPF cadastrado.';
