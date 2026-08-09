-- =============================================================================
-- Reversão da migration 056 — faixas comerciais internas.
--
-- Só rode isto se precisar desfazer a 053. A 053 é puramente aditiva (não
-- alterou nenhuma tabela existente), então derrubar as duas tabelas devolve o
-- banco exatamente ao estado anterior — nenhum dado de academia, aluno,
-- mensalidade ou financeiro é tocado aqui.
--
-- ATENÇÃO: isto APAGA o histórico de alterações de preço
-- (faixas_comerciais_log). Se o histórico importar, exporte antes:
--
--   select * from public.faixas_comerciais_log order by registrado_em;
--
-- Depois de rodar, a área /admin/planos volta a exibir o aviso de
-- "migration pendente" em vez de quebrar.
-- =============================================================================

drop table if exists public.faixas_comerciais_log;
drop table if exists public.faixas_comerciais;
