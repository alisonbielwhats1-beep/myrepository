-- Reversao da migration 059 — remove a funcao de recordes do aluno.
-- Seguro: nenhuma tabela ou dado e afetado, so a funcao de leitura sai.
drop function if exists public.obter_recordes_aluno(uuid, text);
