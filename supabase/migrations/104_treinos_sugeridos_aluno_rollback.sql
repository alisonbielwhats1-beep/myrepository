-- Rollback da migração 104 — remove o acesso do aluno aos treinos sugeridos.
--
-- Só derruba a RPC; nenhum dado é tocado (os treinos-modelo da 018 continuam
-- onde sempre estiveram, visíveis no painel). Depois disso a aba Treinos volta
-- a mostrar o texto de "ficha em montagem" para quem não tem treino.
drop function if exists public.obter_treinos_sugeridos_aluno(uuid, text);
