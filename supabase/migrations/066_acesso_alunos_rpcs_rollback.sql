-- =============================================================================
-- Rollback da migration 066 — RPCs de convite/ativação/ciclo de acesso.
-- Remove só as funções criadas pela 066. Rode ANTES do rollback da 065.
-- Seguro rodar mais de uma vez.
-- =============================================================================

drop function if exists public.auditar_migracao_alunos();
drop function if exists public.encerrar_matricula(uuid, text, text, date);
drop function if exists public.iniciar_matricula(uuid, uuid, date);
drop function if exists public.reativar_acesso_aluno(uuid);
drop function if exists public.suspender_acesso_aluno(uuid, text);
drop function if exists public.revogar_convite_acesso(uuid);
drop function if exists public._registrar_rejeicao_acesso(uuid, uuid, uuid, uuid, text);
drop function if exists public.ativar_convite_acesso(text);
drop function if exists public.preview_convite_acesso(text);
drop function if exists public.gerar_convite_acesso(uuid, text, timestamptz);
