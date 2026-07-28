-- =============================================================================
-- Migration 052 — Cancelar acesso (Histórico da Recepção), sem excluir a
-- linha, e retirada consistente do repasse/frequência/gráficos.
--
-- Receita recebida e repasse estimado são conceitos separados: excluir uma
-- receita nunca apagou (nem apaga) um acesso — mensalidade_id já é
-- `ON DELETE SET NULL` desde a migration 028. Para retirar um check-in do
-- repasse estimado, o caminho correto é cancelar o PRÓPRIO acesso, aqui.
--
-- Colunas novas em acessos_catraca (nunca exclui fisicamente):
--   cancelado_em, cancelado_por, motivo_cancelamento.
--
-- Único caminho de escrita: RPC cancelar_acesso_catraca abaixo (SECURITY
-- DEFINER, papel validado por dentro — não só na Server Action):
--   • dono cancela qualquer acesso da própria academia;
--   • recepção só cancela acesso com data_hora_entrada NO DIA ATUAL em
--     America/Sao_Paulo (mesmo critério de "hoje" da migration anterior);
--   • demais papéis: nenhuma linha afetada, sem mensagem reveladora;
--   • motivo obrigatório;
--   • idempotente: WHERE cancelado_em IS NULL impede cancelar duas vezes.
--
-- RETURNS boolean (não RETURNS TABLE): a migration 050 já mostrou que
-- RETURNS TABLE com nomes iguais às colunas da tabela vira variável OUT em
-- PL/pgSQL e ambiguía qualquer referência bare a esse nome (inclusive em
-- listas de colunas tipo ON CONFLICT). Um retorno escalar elimina a classe
-- inteira do problema.
--
-- Consultas que já formam "acesso válido" (repasse estimado, frequência/
-- retenção, último acesso por aluno) passam a exigir cancelado_em IS NULL —
-- CREATE OR REPLACE, mesma assinatura e mesmo comportamento fora disso.
-- getAcessosPaginado (Histórico) e o card do Financeiro NÃO filtram: o
-- acesso cancelado continua visível, com o valor histórico que tinha —
-- filtrar aqui seria apagar o rastro, não só descontar do repasse.
--
-- Não altera nenhuma migration anterior. Seguro rodar mais de uma vez.
-- =============================================================================

alter table public.acessos_catraca
  add column if not exists cancelado_em        timestamptz,
  add column if not exists cancelado_por       uuid references public.perfis_admin(id) on delete set null,
  add column if not exists motivo_cancelamento text;

create index if not exists idx_acessos_cancelado
  on public.acessos_catraca (academia_id)
  where cancelado_em is not null;

-- -----------------------------------------------------------------------------
-- RPC de cancelamento.
-- -----------------------------------------------------------------------------
create or replace function public.cancelar_acesso_catraca(
  p_acesso_id uuid,
  p_motivo    text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid    := public.academia_id_atual();
  v_papel    text    := public.papel_do_usuario_atual();
  v_motivo   text    := nullif(btrim(p_motivo), '');
  v_linhas   integer;
begin
  -- Papel: só dono e recepção chegam perto disto. Demais papéis não recebem
  -- mensagem nenhuma (nada é revelado sobre a existência do recurso).
  if v_academia is null or v_papel not in ('dono', 'recepcao') then
    return false;
  end if;

  if v_motivo is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.acessos_catraca
    set cancelado_em        = now(),
        cancelado_por       = auth.uid(),
        motivo_cancelamento = v_motivo
    where acessos_catraca.id = p_acesso_id
      and acessos_catraca.academia_id = v_academia
      and acessos_catraca.cancelado_em is null
      and (
        v_papel = 'dono'
        or (acessos_catraca.data_hora_entrada at time zone 'America/Sao_Paulo')::date
             = (now() at time zone 'America/Sao_Paulo')::date
      );

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

comment on function public.cancelar_acesso_catraca(uuid, text) is
  'Cancela (nunca exclui) um acesso da catraca. Dono: qualquer acesso da própria academia. Recepção: só acessos com data_hora_entrada hoje em America/Sao_Paulo. Motivo obrigatório. Idempotente (cancelado_em IS NULL na condição) — chamar duas vezes na mesma linha devolve false na segunda. Fora dono/recepção: false sem detalhar o motivo.';

revoke all on function public.cancelar_acesso_catraca(uuid, text) from public, anon;
grant execute on function public.cancelar_acesso_catraca(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Repasse estimado (migration 049): acesso cancelado não conta.
-- CREATE OR REPLACE — mesma assinatura, mesmo retorno, mesmo comportamento
-- fora do novo filtro.
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
    and a.cancelado_em is null
    and a.data_hora_entrada >= (select ini from periodo)
    and a.data_hora_entrada <  (select fim from periodo)
  where public.papel_do_usuario_atual() = 'dono'
  group by b.plataforma, cfg.valor_por_checkin;
$$;

-- -----------------------------------------------------------------------------
-- Frequência/retenção (migration 030): acesso cancelado não conta como
-- entrada efetiva. CREATE OR REPLACE — mesma assinatura e comportamento fora
-- do novo filtro.
-- -----------------------------------------------------------------------------
create or replace function public.retencao_alunos(p_dias_frequencia integer default 30)
returns table (
  aluno_id        uuid,
  nome            text,
  criado_em       timestamptz,
  ultimo_acesso   timestamptz,
  acessos_periodo integer
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select
    a.id,
    a.nome,
    a.criado_em,
    ac.ultimo_acesso,
    coalesce(ac.acessos_periodo, 0)::integer
  from public.alunos a
  left join (
    select
      c.aluno_id,
      max(c.data_hora_entrada) as ultimo_acesso,
      count(*) filter (
        where c.data_hora_entrada >= now() - make_interval(days => p_dias_frequencia)
      ) as acessos_periodo
    from public.acessos_catraca c
    where c.academia_id = public.academia_id_atual()
      and c.aluno_id is not null
      and c.status_liberacao in ('liberado', 'alerta')
      and c.cancelado_em is null
    group by c.aluno_id
  ) ac on ac.aluno_id = a.id
  where a.academia_id = public.academia_id_atual()
    and a.status_matricula = 'ativa'
  order by a.nome;
$$;

-- -----------------------------------------------------------------------------
-- Último acesso por aluno (migration 038): usado pela busca da Recepção.
-- CREATE OR REPLACE — mesma assinatura e comportamento fora do novo filtro.
-- -----------------------------------------------------------------------------
create or replace function public.ultimos_acessos_por_aluno()
returns table (
  aluno_id      uuid,
  ultimo_acesso timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select distinct on (c.aluno_id)
    c.aluno_id,
    c.data_hora_entrada as ultimo_acesso
  from public.acessos_catraca c
  where c.academia_id = public.academia_id_atual()
    and c.aluno_id is not null
    and c.status_liberacao in ('liberado', 'alerta')
    and c.cancelado_em is null
  order by c.aluno_id, c.data_hora_entrada desc;
$$;
