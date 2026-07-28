-- =============================================================================
-- Migration 049 — Repasse estimado configurável por check-in (TotalPass/Gympass)
--
-- Hoje o valor de repasse é uma CONSTANTE FIXA no código (REPASSE_TOTALPASS=10
-- e REPASSE_GYMPASS=12.5 nos webhooks) — igual para toda academia, o que está
-- errado na prática: cada academia tem um contrato diferente com cada
-- plataforma. Esta migration move o valor para configuração por academia,
-- editável só pelo dono, e os webhooks passam a copiar o valor VIGENTE no
-- momento do check-in — mudar a configuração depois nunca recalcula o
-- histórico já gravado.
--
-- Os valores NÃO viram colunas de `academias` de propósito: a policy
-- "academia_tenant_select" (schema.sql) libera SELECT do row inteiro de
-- academias para QUALQUER papel do tenant (dono, gerente, recepção,
-- instrutor) — é assim que getSessao() funciona hoje, e é como
-- gympass_webhook_secret/totalpass_webhook_secret já trafegam para todo
-- papel (mascarados na interface, mas presentes na consulta). Se o valor do
-- repasse fosse coluna de `academias`, gerente/recepção/instrutor
-- enxergariam o dado pela mesma consulta, mesmo que a interface nunca
-- renderize. Tabela própria com RLS restrita a "dono" evita esse vazamento
-- na raiz, e a única forma de ESCREVER é a RPC abaixo — não há policy de
-- INSERT/UPDATE/DELETE.
--
-- Seguro rodar mais de uma vez. Não altera nem substitui nenhuma migration
-- anterior.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de configuração — no máximo 2 linhas por academia (uma por
--    plataforma). `valor_por_checkin` nulo = "não configurado": nunca
--    inventamos um valor padrão.
-- -----------------------------------------------------------------------------
create table if not exists public.config_repasse_parceiros (
  id                 uuid           primary key default gen_random_uuid(),
  academia_id        uuid           not null references public.academias(id) on delete cascade,
  plataforma         text           not null check (plataforma in ('gympass', 'totalpass')),
  valor_por_checkin  numeric(6,2)   check (
    valor_por_checkin is null or (valor_por_checkin >= 0 and valor_por_checkin <= 500)
  ),
  ativo              boolean        not null default false,
  atualizado_em      timestamptz    not null default now(),
  atualizado_por     uuid,
  unique (academia_id, plataforma)
);

comment on table public.config_repasse_parceiros is
  'Valor ESTIMADO que a academia espera receber por check-in validado de cada parceiro (TotalPass/Gympass/Wellhub). Não é receita confirmada, depósito real nem faturamento — só uma estimativa configurável pelo dono via RPC definir_valor_repasse_parceiro(). Valor null = não configurado.';

create index if not exists idx_config_repasse_academia
  on public.config_repasse_parceiros (academia_id);

alter table public.config_repasse_parceiros enable row level security;

-- SELECT: só o dono da própria academia. Sem policy de INSERT/UPDATE/DELETE —
-- a única forma de escrever é a RPC definir_valor_repasse_parceiro abaixo
-- (SECURITY DEFINER), que valida o papel por dentro da função, não só na
-- Server Action.
create policy config_repasse_select on public.config_repasse_parceiros
  for select to authenticated
  using (
    exists (
      select 1 from public.perfis_admin
      where perfis_admin.id = auth.uid()
        and perfis_admin.academia_id = config_repasse_parceiros.academia_id
        and perfis_admin.papel = 'dono'
    )
  );

revoke all on public.config_repasse_parceiros from public, anon;
grant select on public.config_repasse_parceiros to authenticated;

-- -----------------------------------------------------------------------------
-- 2. RPC de escrita — único caminho para gravar valor/ativo. Segue o padrão
--    de regenerar_token_qr_acesso (migration 044): quem não é dono não
--    recebe erro descritivo, só nenhuma linha (nada é revelado sobre a
--    existência do recurso para quem não deveria acessá-lo).
-- -----------------------------------------------------------------------------
create or replace function public.definir_valor_repasse_parceiro(
  p_plataforma text,
  p_valor      numeric,
  p_ativo      boolean
)
returns table (
  plataforma        text,
  valor_por_checkin numeric,
  ativo             boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
begin
  if public.papel_do_usuario_atual() is distinct from 'dono' then
    return;
  end if;

  if v_academia is null then
    return;
  end if;

  if p_plataforma not in ('gympass', 'totalpass') then
    raise exception 'Plataforma inválida.';
  end if;

  if p_valor is not null and (p_valor < 0 or p_valor > 500) then
    raise exception 'Valor fora da faixa permitida (0 a 500).';
  end if;

  insert into public.config_repasse_parceiros
    (academia_id, plataforma, valor_por_checkin, ativo, atualizado_em, atualizado_por)
  values
    (v_academia, p_plataforma, p_valor, coalesce(p_ativo, false), now(), auth.uid())
  on conflict (academia_id, plataforma) do update
    set valor_por_checkin = excluded.valor_por_checkin,
        ativo             = excluded.ativo,
        atualizado_em     = now(),
        atualizado_por    = auth.uid();

  return query
    select c.plataforma, c.valor_por_checkin, c.ativo
    from public.config_repasse_parceiros c
    where c.academia_id = v_academia and c.plataforma = p_plataforma;
end;
$$;

comment on function public.definir_valor_repasse_parceiro(text, numeric, boolean) is
  'Único caminho de escrita para o valor estimado de repasse por check-in (TotalPass/Gympass). Só o dono da própria academia — verificado dentro da função (retorna vazio, sem erro, para quem não é dono). Valor null = "não configurado", nunca inventa um padrão.';

revoke all on function public.definir_valor_repasse_parceiro(text, numeric, boolean) from public, anon;
grant execute on function public.definir_valor_repasse_parceiro(text, numeric, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RPC de leitura para o Financeiro — segue exatamente o padrão de
--    financeiro_formas_pagamento (migration 048): papel checado dentro do
--    WHERE, quem não é dono recebe conjunto vazio (nunca erro).
--
--    "Check-in válido" = mesma regra de acesso efetivo usada em retenção e
--    notificações (status_liberacao in ('liberado','alerta')). A estrutura
--    atual NÃO tem cancelamento de acesso (status_liberacao só tem liberado/
--    negado/pendente/alerta) — quando existir, adicionar aqui o filtro
--    "and a.status_liberacao <> 'cancelado'". Fica pendente, registrado
--    também no relatório da implementação.
--
--    Usa o valor HISTÓRICO gravado em cada acesso (acessos_catraca.valor_
--    repasse) — nunca recalcula o período inteiro com o valor atual.
-- -----------------------------------------------------------------------------
create or replace function public.repasses_parceiros_resumo(p_inicio date, p_fim date)
returns table (
  plataforma               text,
  checkins_validos         integer,
  valor_estimado_total     numeric,
  valor_configurado_atual  numeric
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with periodo as (
    select p_inicio::timestamptz as ini, (p_fim + 1)::timestamptz as fim
  ),
  base as (
    select 'gympass'::text as plataforma, 'Gympass'::public.origem_acesso_enum as origem
    union all
    select 'totalpass'::text, 'TotalPass'::public.origem_acesso_enum
  )
  select
    b.plataforma,
    count(a.id) filter (where a.id is not null)::integer as checkins_validos,
    coalesce(sum(a.valor_repasse), 0)                    as valor_estimado_total,
    cfg.valor_por_checkin                                as valor_configurado_atual
  from base b
  left join public.config_repasse_parceiros cfg
    on cfg.academia_id = public.academia_id_atual()
    and cfg.plataforma = b.plataforma
  left join public.acessos_catraca a
    on a.academia_id = public.academia_id_atual()
    and a.origem = b.origem
    and a.status_liberacao in ('liberado', 'alerta')
    and a.data_hora_entrada >= (select ini from periodo)
    and a.data_hora_entrada <  (select fim from periodo)
  where public.papel_do_usuario_atual() = 'dono'
  group by b.plataforma, cfg.valor_por_checkin;
$$;

comment on function public.repasses_parceiros_resumo(date, date) is
  'Repasse ESTIMADO de TotalPass/Gympass no período: quantidade de check-ins válidos (liberado/alerta), soma do valor histórico gravado em cada acesso (acessos_catraca.valor_repasse — nunca recalculado) e o valor atualmente configurado. Autorização dentro da função: só dono, escopado por academia_id_atual(); quem não é dono recebe conjunto vazio. Não soma em Receita/Caixa/Saldo — separado de propósito.';

revoke all on function public.repasses_parceiros_resumo(date, date) from public, anon;
grant execute on function public.repasses_parceiros_resumo(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Auditoria — estende log_integracoes (migration 022) em vez de criar
--    outra tabela: mesmo padrão já usado por rotacao_secret/atualizar_status
--    para ações de integração.
-- -----------------------------------------------------------------------------
alter table public.log_integracoes
  add column if not exists valor_anterior numeric(6,2),
  add column if not exists valor_novo     numeric(6,2),
  add column if not exists ativo_novo     boolean;

alter table public.log_integracoes drop constraint if exists log_integracoes_acao_check;
alter table public.log_integracoes add constraint log_integracoes_acao_check
  check (acao in ('rotacao_secret', 'atualizar_status', 'definir_valor_repasse'));
