-- =============================================================================
-- Rollback da migração 107 — remove a RPC da sugestão de progressão de carga.
--
-- Seguro em qualquer momento: a função é ADITIVA e nada mais depende dela no
-- banco. Sem ela, a chamada do app falha, o histórico chega vazio e a tela
-- simplesmente deixa de mostrar sugestão — o pré-preenchimento com a última
-- carga continua funcionando, porque vem de `obter_ultima_carga_aluno`
-- (migration 093), que esta migração nunca tocou.
--
-- Não apaga dado nenhum: `esforco` e `concluido` seguem gravados em
-- sessoes_treino, escritos pela 093.
-- =============================================================================

drop function if exists public.obter_ultima_execucao_aluno(uuid, text);
