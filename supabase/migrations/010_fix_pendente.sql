-- =============================================================================
-- Migration 010 — Fix de migrations pendentes (idempotente).
--
-- Por que existe: migrações 007, 008 e 009 podem não ter sido aplicadas
-- corretamente (o SQL Editor do Supabase pode rolar tudo de volta se uma
-- instrução do meio falhar). Este arquivo re-aplica tudo com segurança.
--
-- SEGURO rodar mais de uma vez — tudo usa "if not exists" / "on conflict".
-- =============================================================================

-- ============================================================
-- Bloco 1 — 007: colunas de loja e recorrência
-- ============================================================

-- receitas.competencia — mês de referência da mensalidade
alter table public.receitas
  add column if not exists competencia date;

-- receitas.produto_id — vincula a venda ao produto
alter table public.receitas
  add column if not exists produto_id uuid
    references public.produtos(id) on delete set null;

create index if not exists idx_receitas_produto      on public.receitas(produto_id);
create index if not exists idx_receitas_competencia  on public.receitas(competencia);

-- Impede mensalidade duplicada para o mesmo aluno no mesmo mês
create unique index if not exists uidx_mensalidade_aluno_comp
  on public.receitas (aluno_id, competencia)
  where tipo = 'mensalidade' and aluno_id is not null and competencia is not null;

-- produtos.estoque_minimo — limite para alerta de reposição
alter table public.produtos
  add column if not exists estoque_minimo integer not null default 5;

-- planos.cobranca_recorrente — ativa/desativa cobrança automática por plano
alter table public.planos
  add column if not exists cobranca_recorrente boolean not null default true;

-- RPC: gera mensalidades pendentes do mês para a academia logada (idempotente)
create or replace function public.gerar_mensalidades_do_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia   uuid    := public.academia_id_atual();
  v_comp       date    := date_trunc('month', p_competencia)::date;
  v_ultimo_dia integer := extract(day from (v_comp + interval '1 month - 1 day'));
  v_criadas    integer := 0;
  r            record;
  v_data       date;
  v_dia        integer;
  v_meses      integer;
begin
  if v_academia is null then
    raise exception 'Sem academia no contexto do usuário';
  end if;

  for r in
    select a.id, a.nome, a.criado_em, p.valor_mensal, p.recorrencia_meses
    from public.alunos a
    join public.planos p on p.id = a.plano_id
    where a.academia_id = v_academia
      and a.status_matricula = 'ativa'
      and coalesce(p.valor_mensal, 0) > 0
      and p.cobranca_recorrente = true
  loop
    v_meses := (extract(year from v_comp)::int * 12 + extract(month from v_comp)::int)
             - (extract(year from r.criado_em)::int * 12 + extract(month from r.criado_em)::int);
    if v_meses < 0 or (r.recorrencia_meses > 0 and (v_meses % r.recorrencia_meses) <> 0) then
      continue;
    end if;

    v_dia  := least(greatest(extract(day from r.criado_em)::int, 1), v_ultimo_dia);
    v_data := make_date(
      extract(year  from v_comp)::int,
      extract(month from v_comp)::int,
      v_dia
    );

    insert into public.receitas
      (academia_id, aluno_id, tipo, descricao, valor, data, status, competencia)
    values
      (v_academia, r.id, 'mensalidade', 'Mensalidade - ' || r.nome,
       r.valor_mensal, v_data, 'pendente', v_comp)
    on conflict (aluno_id, competencia)
      where tipo = 'mensalidade' and aluno_id is not null and competencia is not null
    do nothing;

    if found then
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return v_criadas;
end;
$$;

grant execute on function public.gerar_mensalidades_do_mes(date) to authenticated;

-- ============================================================
-- Bloco 2 — 008: papéis de acesso + histórico de planos
-- ============================================================

alter table public.perfis_admin
  add column if not exists papel text not null default 'dono';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'perfis_admin_papel_check'
  ) then
    alter table public.perfis_admin
      add constraint perfis_admin_papel_check
      check (papel in ('dono', 'gerente', 'recepcao', 'instrutor'));
  end if;
end$$;

drop policy if exists "perfil_equipe_select" on public.perfis_admin;
create policy "perfil_equipe_select" on public.perfis_admin
  for select to authenticated
  using (academia_id = public.academia_id_atual());

drop policy if exists "perfil_equipe_update" on public.perfis_admin;
create policy "perfil_equipe_update" on public.perfis_admin
  for update to authenticated
  using  (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

create table if not exists public.historico_planos (
  id                uuid          primary key default gen_random_uuid(),
  academia_id       uuid          not null references public.academias(id) on delete cascade,
  aluno_id          uuid          not null references public.alunos(id) on delete cascade,
  plano_id          uuid          references public.planos(id) on delete set null,
  plano_nome        text          not null,
  valor             numeric(10,2) not null default 0,
  recorrencia_meses integer       not null default 1,
  data_inicio       date          not null default current_date,
  criado_em         timestamptz   not null default now()
);

create index if not exists idx_hist_planos_academia on public.historico_planos(academia_id);
create index if not exists idx_hist_planos_aluno     on public.historico_planos(aluno_id);

alter table public.historico_planos enable row level security;

do $$
begin
  execute 'drop policy if exists "tenant_select_historico_planos"  on public.historico_planos';
  execute 'create policy "tenant_select_historico_planos" on public.historico_planos
             for select to authenticated using (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "tenant_insert_historico_planos"  on public.historico_planos';
  execute 'create policy "tenant_insert_historico_planos" on public.historico_planos
             for insert to authenticated with check (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "tenant_delete_historico_planos"  on public.historico_planos';
  execute 'create policy "tenant_delete_historico_planos" on public.historico_planos
             for delete to authenticated using (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "service_role_total_historico_planos" on public.historico_planos';
  execute 'create policy "service_role_total_historico_planos" on public.historico_planos
             for all to service_role using (true) with check (true)';
end$$;

-- ============================================================
-- Bloco 3 — 009: anamnese / histórico de saúde do aluno
-- ============================================================

alter table public.alunos add column if not exists objetivo                   text;
alter table public.alunos add column if not exists condicoes_medicas           text;
alter table public.alunos add column if not exists contato_emergencia_nome     text;
alter table public.alunos add column if not exists contato_emergencia_telefone text;
