-- =============================================================================
-- Migration 008 — Papéis de acesso da equipe + histórico de planos do aluno.
--
-- Adiciona:
--   • perfis_admin.papel — 'dono' | 'gerente' | 'recepcao' | 'instrutor'.
--     Controla o que cada usuário vê no painel. Usuários existentes viram 'dono'.
--   • historico_planos — registro de cada plano que o aluno assumiu (troca/
--     renovação), para ver o histórico e calcular a próxima renovação.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Papéis
-- -----------------------------------------------------------------------------
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

-- Permite ao dono/gerente ver os demais perfis da MESMA academia (tela Equipe).
drop policy if exists "perfil_equipe_select" on public.perfis_admin;
create policy "perfil_equipe_select" on public.perfis_admin
  for select to authenticated
  using (academia_id = public.academia_id_atual());

-- Dono/gerente podem atualizar o papel dos colegas da mesma academia.
drop policy if exists "perfil_equipe_update" on public.perfis_admin;
create policy "perfil_equipe_update" on public.perfis_admin
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

-- -----------------------------------------------------------------------------
-- 2. Histórico de planos do aluno
-- -----------------------------------------------------------------------------
create table if not exists public.historico_planos (
  id           uuid        primary key default gen_random_uuid(),
  academia_id  uuid        not null references public.academias(id) on delete cascade,
  aluno_id     uuid        not null references public.alunos(id) on delete cascade,
  plano_id     uuid        references public.planos(id) on delete set null,
  plano_nome   text        not null,
  valor        numeric(10,2) not null default 0,
  recorrencia_meses integer not null default 1,
  data_inicio  date        not null default current_date,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_hist_planos_academia on public.historico_planos(academia_id);
create index if not exists idx_hist_planos_aluno     on public.historico_planos(aluno_id);

alter table public.historico_planos enable row level security;

do $$
begin
  execute 'drop policy if exists "tenant_select_historico_planos" on public.historico_planos';
  execute 'create policy "tenant_select_historico_planos" on public.historico_planos
             for select to authenticated using (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "tenant_insert_historico_planos" on public.historico_planos';
  execute 'create policy "tenant_insert_historico_planos" on public.historico_planos
             for insert to authenticated with check (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "tenant_delete_historico_planos" on public.historico_planos';
  execute 'create policy "tenant_delete_historico_planos" on public.historico_planos
             for delete to authenticated using (academia_id = public.academia_id_atual())';
  execute 'drop policy if exists "service_role_total_historico_planos" on public.historico_planos';
  execute 'create policy "service_role_total_historico_planos" on public.historico_planos
             for all to service_role using (true) with check (true)';
end$$;
