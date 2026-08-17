-- =============================================================================
-- Migração 081 — Compartilhar treino-modelo com instrutores SELECIONADOS
--
-- Novo nível de visibilidade 'selecionado', entre 'privado' e 'equipe': o
-- dono/autor escolhe QUAIS instrutores enxergam/usam o modelo (um, vários ou
-- qualquer combinação), em vez de liberar para toda a equipe.
--
-- Implementado com uma tabela de ACL (treinos_compartilhamento) e um clause a
-- mais na policy de leitura de treinos. A checagem do ACL na policy passa por
-- uma função SECURITY DEFINER (evita recursão de RLS entre treinos e a ACL).
--
-- Aditivo/não-destrutivo: nada muda para privado/equipe/academia/plataforma.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela de compartilhamento (ACL): treino ↔ instrutor.
-- ----------------------------------------------------------------------------
create table if not exists public.treinos_compartilhamento (
  treino_id uuid not null references public.treinos(id) on delete cascade,
  perfil_id uuid not null references public.perfis_admin(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (treino_id, perfil_id)
);
create index if not exists idx_treinos_compart_perfil
  on public.treinos_compartilhamento(perfil_id);

alter table public.treinos_compartilhamento enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Helpers SECURITY DEFINER (rodam como owner → não recursam no RLS).
-- ----------------------------------------------------------------------------
-- "Este treino foi compartilhado comigo?" — usado na policy de treinos.
create or replace function public.treino_compartilhado_comigo(p_treino uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.treinos_compartilhamento tc
    where tc.treino_id = p_treino and tc.perfil_id = auth.uid()
  );
$$;
grant execute on function public.treino_compartilhado_comigo(uuid) to authenticated;

-- "Posso gerenciar o compartilhamento deste treino?" — autor ou dono/gerente,
-- e só treino-modelo da própria academia.
create or replace function public.posso_gerenciar_treino(p_treino uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.treinos t
    where t.id = p_treino
      and t.academia_id = public.academia_id_atual()
      and t.aluno_id is null
      and (
        t.criado_por = auth.uid()
        or public.papel_do_usuario_atual() in ('dono', 'gerente')
      )
  );
$$;
grant execute on function public.posso_gerenciar_treino(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS da tabela ACL.
-- ----------------------------------------------------------------------------
drop policy if exists "compart_select" on public.treinos_compartilhamento;
create policy "compart_select" on public.treinos_compartilhamento
  for select to authenticated
  using (perfil_id = auth.uid() or public.posso_gerenciar_treino(treino_id));

drop policy if exists "compart_insert" on public.treinos_compartilhamento;
create policy "compart_insert" on public.treinos_compartilhamento
  for insert to authenticated
  with check (
    public.posso_gerenciar_treino(treino_id)
    and exists (
      select 1 from public.perfis_admin p
      where p.id = perfil_id and p.academia_id = public.academia_id_atual()
    )
  );

drop policy if exists "compart_delete" on public.treinos_compartilhamento;
create policy "compart_delete" on public.treinos_compartilhamento
  for delete to authenticated
  using (public.posso_gerenciar_treino(treino_id));

drop policy if exists "service_role_total_treinos_compartilhamento" on public.treinos_compartilhamento;
create policy "service_role_total_treinos_compartilhamento" on public.treinos_compartilhamento
  for all to service_role using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 4. Novo valor de visibilidade + policy de leitura de treinos com o ACL.
-- ----------------------------------------------------------------------------
alter table public.treinos drop constraint if exists treinos_visibilidade_valida;
alter table public.treinos
  add constraint treinos_visibilidade_valida
  check (visibilidade in ('privado', 'equipe', 'academia', 'selecionado'));

drop policy if exists "tenant_select_treinos" on public.treinos;
create policy "tenant_select_treinos" on public.treinos
  for select to authenticated
  using (
    (academia_id is null and origem_tipo = 'gestacad')
    or (
      academia_id = public.academia_id_atual()
      and (
        aluno_id is not null                                              -- ficha de aluno: equipe acessa
        or visibilidade = 'academia'                                      -- toda a academia (inclui recepção)
        or (
          visibilidade = 'equipe'
          and public.papel_do_usuario_atual() in ('dono', 'gerente', 'instrutor')
        )                                                                 -- equipe técnica, sem recepção
        or (
          visibilidade = 'selecionado'
          and public.treino_compartilhado_comigo(id)
        )                                                                 -- instrutores escolhidos
        or criado_por = auth.uid()                                        -- meu treino
        or public.papel_do_usuario_atual() in ('dono', 'gerente')         -- gestão vê tudo
      )
    )
  );

comment on table public.treinos_compartilhamento is
  'ACL de compartilhamento de treino-modelo com instrutores específicos (visibilidade=selecionado). Gerenciada pelo autor ou dono/gerente; RLS via posso_gerenciar_treino().';
