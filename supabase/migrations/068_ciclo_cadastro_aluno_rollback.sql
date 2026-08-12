-- Rollback da migration 068 — remove as RPCs de ciclo do cadastro do aluno.
-- Não altera dados; status_cadastro dos alunos permanece como está.
-- Seguro rodar mais de uma vez.
drop function if exists public.reativar_cadastro_aluno(uuid);
drop function if exists public.arquivar_aluno(uuid, text);
