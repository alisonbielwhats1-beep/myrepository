-- =============================================================================
-- Migração 108 — Integração OFICIAL com a API de Validação de Check-in da
--                TotalPass (dev.totalpass.com)
--
-- O QUE MUDA
--   Até aqui o GestAcad esperava que a TotalPass chamasse uma URL nossa com um
--   segredo gerado por nós (migração 012). Não é assim que a TotalPass
--   funciona. O fluxo oficial é:
--     1. o ERP autentica a unidade em POST /partner/auth com DUAS chaves:
--        partner_api_key (do GestAcad, fica numa variável de ambiente — nunca
--        no banco) + place_api_key (da academia, gerada pelo dono no Portal
--        de Parceiros da TotalPass) → recebe um JWT de 24 h;
--     2. com o JWT, o ERP cadastra a URL onde quer receber os check-ins;
--     3. a cada check-in, a TotalPass chama essa URL com um link exclusivo de
--        validação; o ERP libera a entrada com um POST nesse link (90 min).
--
--   Esta tabela guarda, por academia, a place_api_key e o estado da conexão.
--
-- SEGURANÇA
--   A place_api_key é credencial: a tabela tem RLS LIGADO e NENHUMA policy —
--   anon/authenticated não leem nem gravam nada. Só o servidor, com a service
--   role, acessa (Server Actions do painel já validam dono + plano antes; a
--   rota do webhook resolve a academia pelo `webhook_token`, que é longo e
--   imprevisível). A chave nunca volta ao navegador: o painel mostra só os 4
--   últimos caracteres.
--
-- ADITIVA E SEGURA NA ORDEM
--   Não altera tabelas existentes além da lista de ações da auditoria. Antes
--   de aplicar, o painel mostra "aguardando atualização do banco" no bloco da
--   TotalPass e o resto do sistema segue igual. Aplicar antes ou depois do
--   deploy é seguro. Idempotente.
-- =============================================================================

create table if not exists public.integracao_totalpass (
  academia_id          uuid        primary key references public.academias(id) on delete cascade,
  place_api_key        text        not null,
  -- Código de 8 caracteres da unidade (place.code no webhook). Usado para
  -- conferir que o check-in recebido é mesmo desta academia.
  codigo_unidade       text,
  place_uuid           text,
  place_nome           text,
  -- Segredo que compõe a URL do webhook cadastrada na TotalPass
  -- (/api/totalpass/checkin/<token>). A TotalPass não assina o webhook, então
  -- a URL imprevisível + a conferência do código da unidade são a autenticação.
  webhook_token        text        not null unique,
  webhook_url          text,
  webhook_registrado   boolean     not null default false,
  -- Liga/desliga o POST de validação automático. Desligado, o check-in é só
  -- registrado aqui e a recepção valida pelo Portal da TotalPass.
  validacao_automatica boolean     not null default true,
  conectado_em         timestamptz not null default now(),
  ultimo_teste_em      timestamptz,
  ultimo_checkin_em    timestamptz,
  ultimo_erro          text,
  atualizado_em        timestamptz not null default now()
);

comment on table public.integracao_totalpass is
  'Conexão da academia com a API oficial de check-in da TotalPass. Só service role.';

alter table public.integracao_totalpass enable row level security;
revoke all on table public.integracao_totalpass from anon, authenticated;

-- Auditoria: novas ações de integração, no mesmo log das anteriores (022/049).
alter table public.log_integracoes drop constraint if exists log_integracoes_acao_check;
alter table public.log_integracoes add constraint log_integracoes_acao_check
  check (acao in (
    'rotacao_secret', 'atualizar_status', 'definir_valor_repasse',
    'conectar_api', 'desconectar_api', 'alterar_validacao_automatica'
  ));
