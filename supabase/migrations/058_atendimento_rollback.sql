-- =============================================================================
-- Reversão da migration 058 — Atendimento.
--
-- ATENÇÃO: apaga todos os atendimentos e mensagens. Exporte antes se houver
-- conteúdo real:
--
--   select t.*, m.autor_tipo, m.autor_nome, m.mensagem, m.criado_em
--   from public.atendimentos t
--   join public.atendimento_mensagens m on m.atendimento_id = t.id
--   order by t.criado_em, m.criado_em;
--
-- Nenhuma tabela pré-existente é tocada: a 055 só criou coisas novas.
-- =============================================================================

drop function if exists public.obter_atendimentos_aluno(uuid, text);
drop function if exists public.responder_atendimento_aluno(uuid, text, uuid, text);
drop function if exists public.abrir_atendimento(uuid, text, text, text, text);

drop table if exists public.atendimento_mensagens;
drop table if exists public.atendimentos;
