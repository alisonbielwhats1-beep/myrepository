-- =============================================================================
-- Migration 033 — Fase 8/10: idempotência do registro manual + guarda do
-- último proprietário ativo.
--
-- #1 Idempotência do registro manual de acesso (Fase 8):
--   O formulário de "Registrar entrada" da Recepção pode ser reenviado (duplo
--   clique, F5 durante o pending, retry de rede). Sem uma chave no servidor,
--   dois envios da mesma tentativa criam duas linhas em acessos_catraca, cada
--   uma com seu próprio repasse. Reaproveita exatamente o padrão já usado para
--   o webhook (evento_externo_id, migration 021, item #5): uma chave por
--   tentativa, com índice único parcial. O app gera a chave uma vez por
--   abertura do formulário (não por aluno), então uma nova tentativa legítima
--   depois tem uma chave nova e nunca é bloqueada.
--
-- #2 Guarda do último "dono" (Fase 10):
--   A troca de papel e a remoção de membro já são restritas ao "dono" via app
--   (equipe/actions.ts) e via RLS (migration 014, só dono faz UPDATE em
--   perfis_admin). A Server Action passa a contar quantos "dono" ativos a
--   academia tem antes de agir — a policy "perfil_equipe_select" já existente
--   (migration 010) permite essa leitura para qualquer membro autenticado da
--   própria academia, então nenhuma função nova é necessária aqui.
--
-- Seguro rodar mais de uma vez. Não altera dados existentes.
-- =============================================================================

alter table public.acessos_catraca
  add column if not exists chave_idempotencia text;

create unique index if not exists uidx_acessos_chave_idempotencia
  on public.acessos_catraca (academia_id, chave_idempotencia)
  where chave_idempotencia is not null;

comment on column public.acessos_catraca.chave_idempotencia is
  'Chave gerada pelo cliente por tentativa de registro manual (Fase 8). '
  'Evita duplicar a entrada em duplo clique/reenvio; não se repete entre '
  'tentativas legítimas porque o formulário gera uma chave nova a cada envio.';
