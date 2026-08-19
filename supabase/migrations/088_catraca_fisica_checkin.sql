-- =============================================================================
-- Migração 088 — Check-in pela catraca física (Henry + leitor Control iD EVO).
--
-- Até aqui os check-ins automáticos vinham só das plataformas parceiras
-- (Gympass/TotalPass, migrations 012/022). Esta migração habilita a CATRACA
-- FÍSICA da própria academia — o torniquete Henry com leitor facial/cartão
-- Control iD (linha EVO) — a registrar cada passagem e, no modo "online", a
-- perguntar ao app se deve liberar a pessoa. A decisão usa a MESMA regra
-- central `decidirAcesso` (lib/utils.ts) da recepção — nenhuma regra paralela.
--
-- O endpoint que o equipamento/integrador chama é:
--   POST /api/webhook/catraca/<slug-da-academia>
--   Authorization: Bearer <catraca_webhook_secret>
--
-- Seguro rodar mais de uma vez (idempotente).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Novo valor de origem para `acessos_catraca.origem` — identifica a passagem
--    que veio da catraca física, separando-a de 'Direto' (recepção manual),
--    'Gympass', 'TotalPass' e 'qr'. Mesmo padrão da migration 044 ('qr').
-- -----------------------------------------------------------------------------
alter type public.origem_acesso_enum add value if not exists 'Catraca';

-- -----------------------------------------------------------------------------
-- 2. Segredo do webhook da catraca — um por academia, autentica o equipamento
--    via `Authorization: Bearer <segredo>`. Mesmo padrão dos segredos de
--    Gympass/TotalPass (migration 012): populado automaticamente para as
--    academias já existentes. Rotacionável na tela de Integrações.
-- -----------------------------------------------------------------------------
alter table public.academias
  add column if not exists catraca_webhook_secret text not null default gen_random_uuid()::text;

comment on column public.academias.catraca_webhook_secret is
  'Segredo (Bearer) do webhook da catraca física — POST /api/webhook/catraca/<slug>. Rotacionável em Integrações; nunca exposto por inteiro ao client (só o sufixo mascarado).';

-- -----------------------------------------------------------------------------
-- 3. Auditoria: a catraca também rotaciona segredo, então `log_integracoes`
--    passa a aceitar a plataforma 'catraca' (além de gympass/totalpass da
--    migration 022). Aditivo — não remove os valores já permitidos.
-- -----------------------------------------------------------------------------
alter table public.log_integracoes
  drop constraint if exists log_integracoes_plataforma_check;

alter table public.log_integracoes
  add constraint log_integracoes_plataforma_check
  check (plataforma in ('gympass', 'totalpass', 'catraca'));
