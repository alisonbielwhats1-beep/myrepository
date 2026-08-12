-- Rollback da migration 067 — remove a função de resolução do acesso do aluno.
-- Seguro rodar mais de uma vez.
drop function if exists public.meu_acesso_aluno();
