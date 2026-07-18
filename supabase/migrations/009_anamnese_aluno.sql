-- =============================================================================
-- Migration 009 — Anamnese e histórico de saúde do aluno.
--
-- Adiciona campos sensíveis de saúde ao cadastro do aluno, para o professor
-- montar o treino com segurança. Ficam SÓ do lado do admin — nunca são
-- expostos pela RPC pública obter_ficha_aluno (que o aluno acessa sem login).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

alter table public.alunos add column if not exists objetivo text;
alter table public.alunos add column if not exists condicoes_medicas text;
alter table public.alunos add column if not exists contato_emergencia_nome text;
alter table public.alunos add column if not exists contato_emergencia_telefone text;

comment on column public.alunos.objetivo is 'Objetivo do aluno na academia (ex: emagrecimento, hipertrofia).';
comment on column public.alunos.condicoes_medicas is 'Anamnese: condições, restrições e lesões relevantes para o treino.';
