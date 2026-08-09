-- =============================================================================
-- Migration 056 — Faixas comerciais internas do GestAcad.
--
-- Referência para o processo COMERCIAL (apresentação, negociação, proposta).
-- Nada aqui cobra, altera contrato, faz upgrade/downgrade ou bloqueia academia:
-- é tabela de consulta do superadministrador da plataforma.
--
-- Três conceitos de "plano" convivem no projeto e NÃO podem ser confundidos:
--
--   1. public.planos              — o plano que a ACADEMIA vende ao ALUNO dela
--                                   (mensalidade). Tenant-scoped. Intocado aqui.
--   2. academias.plano_saas       — tier de FUNCIONALIDADE (basico/profissional/
--                                   premium) que libera telas no painel
--                                   (lib/planos.ts). Intocado aqui.
--   3. public.faixas_comerciais   — ESTA tabela: faixa de preço por quantidade
--                                   de alunos ativos, usada só internamente.
--
-- Dado de PLATAFORMA, não de tenant: por isso não tem academia_id e não entra
-- no padrão de policy `academia_id = public.academia_id_atual()`.
--
-- ACESSO (fail-closed, ver seção 3): RLS ligada com policy EXCLUSIVA para
-- service_role. Sem policy para anon/authenticated, o Postgres nega tudo — nem
-- o dono de uma academia, nem recepção/instrutor/aluno enxergam uma linha,
-- mesmo chamando a API REST direto com um token válido. A aplicação só lê isto
-- por `createServiceRoleClient()`, que é server-only e fica atrás do guard
-- `requireAdminPlataforma()` (lib/admin-plataforma.ts).
--
-- Puramente ADITIVA: cria duas tabelas novas, não altera nem apaga nada que já
-- exista. Idempotente — seguro rodar mais de uma vez.
-- Reversão: supabase/migrations/056_faixas_comerciais_rollback.sql
--
-- Depende de public.set_atualizado_em() (schema.sql, seção 4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Faixas comerciais
-- -----------------------------------------------------------------------------
create table if not exists public.faixas_comerciais (
  id                        uuid          primary key default gen_random_uuid(),
  nome                      text          not null unique,
  -- Intervalo de alunos ATIVOS (alunos.status_matricula = 'ativa').
  alunos_min                integer       not null default 0,
  alunos_max                integer,      -- null = faixa sem teto
  preco_mensal              numeric(10,2) not null default 0,
  -- Desativar em vez de excluir: preserva o histórico de quem já usou a faixa.
  ativo                     boolean       not null default true,
  -- Exposição pública na landing. Nasce FALSE de propósito: a página pública
  -- mostra apenas "Planos a partir de R$ X/mês", nunca a tabela completa.
  publico                   boolean       not null default false,
  disponivel_novos_clientes boolean       not null default true,
  ordem                     integer       not null default 0,
  descricao_interna         text,
  observacoes_comerciais    text,
  criado_em                 timestamptz   not null default now(),
  atualizado_em             timestamptz   not null default now(),
  constraint faixas_comerciais_intervalo
    check (alunos_max is null or alunos_max >= alunos_min),
  constraint faixas_comerciais_min_nao_negativo check (alunos_min >= 0),
  constraint faixas_comerciais_preco_nao_negativo check (preco_mensal >= 0)
);

comment on table public.faixas_comerciais is
  'Faixas de preço por quantidade de alunos ativos. Referência interna do processo comercial do GestAcad — não cobra, não altera contrato e não é o plano que a academia vende ao aluno (public.planos) nem o tier de funcionalidade (academias.plano_saas). Visível apenas para service_role.';

create index if not exists idx_faixas_comerciais_ordem
  on public.faixas_comerciais (ordem, alunos_min);

drop trigger if exists trg_faixas_comerciais_upd on public.faixas_comerciais;
create trigger trg_faixas_comerciais_upd
  before update on public.faixas_comerciais
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 2. Auditoria — quem mudou o quê, quando, de qual valor para qual.
--
-- Só INSERT pela aplicação; nenhuma tela oferece edição ou exclusão de log.
-- `faixa_nome` é desnormalizado de propósito: se um dia a faixa for removida
-- fora da aplicação, o histórico continua legível (faixa_id vira null, o nome
-- permanece).
-- -----------------------------------------------------------------------------
create table if not exists public.faixas_comerciais_log (
  id             uuid        primary key default gen_random_uuid(),
  faixa_id       uuid        references public.faixas_comerciais(id) on delete set null,
  faixa_nome     text        not null,
  usuario_id     uuid,
  usuario_email  text        not null,
  acao           text        not null
                 check (acao in ('criada', 'atualizada', 'ativada', 'desativada')),
  -- Snapshots completos da linha: cobrem preço anterior/novo, limite anterior/
  -- novo e qualquer campo que venha a existir, sem migration adicional.
  valor_anterior jsonb,
  valor_novo     jsonb,
  motivo         text,
  registrado_em  timestamptz not null default now()
);

comment on table public.faixas_comerciais_log is
  'Histórico imutável de alterações em faixas_comerciais: usuário responsável, data/hora, snapshot anterior e novo (preço e limites inclusos) e motivo. Append-only: a aplicação nunca faz UPDATE nem DELETE aqui.';

create index if not exists idx_faixas_comerciais_log_registrado
  on public.faixas_comerciais_log (registrado_em desc);

-- -----------------------------------------------------------------------------
-- 3. RLS fail-closed
--
-- O `revoke` tira o GRANT que o Supabase concede por padrão a anon/authenticated
-- em tabelas novas do schema public. A RLS sem policy para esses roles é a
-- segunda barreira: mesmo que um GRANT volte no futuro, continua negado.
-- -----------------------------------------------------------------------------
alter table public.faixas_comerciais     enable row level security;
alter table public.faixas_comerciais_log enable row level security;

revoke all on public.faixas_comerciais     from anon, authenticated;
revoke all on public.faixas_comerciais_log from anon, authenticated;

drop policy if exists "service_role_total_faixas_comerciais" on public.faixas_comerciais;
create policy "service_role_total_faixas_comerciais"
  on public.faixas_comerciais
  for all to service_role
  using (true) with check (true);

drop policy if exists "service_role_total_faixas_comerciais_log" on public.faixas_comerciais_log;
create policy "service_role_total_faixas_comerciais_log"
  on public.faixas_comerciais_log
  for all to service_role
  using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 4. Seed das três faixas iniciais.
--
-- `where not exists` por nome: rodar de novo não duplica nem sobrescreve o que
-- o superadministrador já tiver ajustado pelo painel.
-- publico = false nas três (a landing não divulga a tabela).
-- -----------------------------------------------------------------------------
insert into public.faixas_comerciais
  (nome, alunos_min, alunos_max, preco_mensal, ordem, publico, descricao_interna)
select v.nome, v.alunos_min, v.alunos_max, v.preco_mensal, v.ordem, v.publico, v.descricao_interna
from (values
  ('Start',    0, 200,  99.90, 1, false, 'Até 200 alunos ativos.'),
  ('Growth', 201, 350, 159.00, 2, false, 'De 201 a 350 alunos ativos.'),
  ('Pro',    351, 500, 229.00, 3, false, 'De 351 a 500 alunos ativos.')
) as v(nome, alunos_min, alunos_max, preco_mensal, ordem, publico, descricao_interna)
where not exists (
  select 1 from public.faixas_comerciais f where f.nome = v.nome
);

-- Acima de 500 alunos ativos NÃO existe faixa fixa por decisão comercial: o
-- painel mostra "Necessária avaliação comercial personalizada."
-- (lib/faixas-comerciais.ts, MENSAGEM_ACIMA_DA_TABELA).
