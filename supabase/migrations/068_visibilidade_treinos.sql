-- =============================================================================
-- Migração 068 — Visibilidade dos treinos-modelo: plataforma / academia / instrutor
--
-- Três níveis para a biblioteca de treinos (aluno_id IS NULL):
--   • plataforma  → curado pelo GestAcad (academia_id NULL); toda academia vê,
--                   ninguém do tenant edita (gerenciado por service_role).
--   • academia    → compartilhado com toda a equipe da academia.
--   • instrutor   → privado de quem criou; além dele, só dono/gerente enxergam.
--
-- Regras decididas com o cliente:
--   • treino-modelo novo NASCE 'instrutor' (privado) — gravado pela aplicação;
--   • dono/gerente veem TUDO da academia (inclusive privados de instrutores);
--   • outro instrutor NÃO vê o privado alheio;
--   • ao atribuir a um aluno, cria-se uma CÓPIA na ficha (RPC 067) — o aluno vê
--     no app dele sem que o modelo privado vaze para a equipe.
--
-- Backfill:
--   • os 12 modelos importados do Vinicius (origem='planilha',
--     codigo_importacao 'vinicius-...') viram 'instrutor' (privados dele).
--     Já pertencem à academia Geração Saúde, então seguem isolados a esse tenant.
--   • todo o resto (modelos e fichas de aluno) fica 'academia' — ninguém perde
--     acesso ao que já enxergava hoje.
--
-- Segurança: as fichas de aluno (aluno_id NOT NULL) mantêm o comportamento atual
-- (a equipe da academia acessa), pois o recorte de visibilidade só faz sentido
-- para os modelos da biblioteca.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coluna de visibilidade.
--    Default 'academia' cobre o backfill e as fichas de aluno; a criação de
--    treino-modelo grava explicitamente 'instrutor' na aplicação.
-- ----------------------------------------------------------------------------
alter table public.treinos
  add column if not exists visibilidade text not null default 'academia';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'treinos_visibilidade_valida'
      and conrelid = 'public.treinos'::regclass
  ) then
    alter table public.treinos
      add constraint treinos_visibilidade_valida
      check (visibilidade in ('plataforma', 'academia', 'instrutor'));
  end if;
end$$;

create index if not exists idx_treinos_visibilidade
  on public.treinos(academia_id, visibilidade)
  where aluno_id is null;

create index if not exists idx_treinos_criado_por_visibilidade
  on public.treinos(criado_por)
  where aluno_id is null and visibilidade = 'instrutor';

-- ----------------------------------------------------------------------------
-- 2. Backfill dos modelos do Vinicius → privados dele.
--    Escopado pelo codigo_importacao 'vinicius-%' (só a Geração Saúde tem),
--    portanto não toca em nenhuma outra academia.
-- ----------------------------------------------------------------------------
update public.treinos
set visibilidade = 'instrutor'
where aluno_id is null
  and origem = 'planilha'
  and codigo_importacao like 'vinicius-%'
  and criado_por is not null;

-- ----------------------------------------------------------------------------
-- 3. RLS de treinos com visibilidade (substitui as políticas genéricas de tenant
--    criadas pelo loop do schema.sql).
-- ----------------------------------------------------------------------------
drop policy if exists "tenant_select_treinos" on public.treinos;
create policy "tenant_select_treinos" on public.treinos
  for select to authenticated
  using (
    -- Padrão da plataforma: visível para qualquer academia autenticada.
    (academia_id is null and visibilidade = 'plataforma')
    or (
      academia_id = public.academia_id_atual()
      and (
        aluno_id is not null                                  -- ficha de aluno: equipe acessa (comportamento atual)
        or visibilidade in ('academia', 'plataforma')         -- compartilhado com a academia
        or criado_por = auth.uid()                            -- meu treino privado
        or public.papel_do_usuario_atual() in ('dono', 'gerente')  -- gestão vê tudo
      )
    )
  );

drop policy if exists "tenant_insert_treinos" on public.treinos;
create policy "tenant_insert_treinos" on public.treinos
  for insert to authenticated
  with check (academia_id = public.academia_id_atual());

-- Editar/excluir: dono/gerente sempre; instrutor só o que ele criou. Fichas de
-- aluno seguem editáveis pela equipe (comportamento atual da tela de Alunos).
drop policy if exists "tenant_update_treinos" on public.treinos;
create policy "tenant_update_treinos" on public.treinos
  for update to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      aluno_id is not null
      or criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  )
  with check (
    academia_id = public.academia_id_atual()
    and (
      aluno_id is not null
      or criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  );

drop policy if exists "tenant_delete_treinos" on public.treinos;
create policy "tenant_delete_treinos" on public.treinos
  for delete to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      aluno_id is not null
      or criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  );

-- ----------------------------------------------------------------------------
-- 4. RLS de exercicios_treino alinhada à visibilidade do treino-pai.
--    Havia dois conjuntos históricos de políticas (schema.sql "*_exercicios_treino"
--    e migração 011 "*_exercicios"); removemos ambos e deixamos um só, coerente.
--    A leitura reaproveita o RLS de treinos no subquery: só aparece exercício de
--    treino que o usuário pode ver — então exercício de privado não vaza e o de
--    plataforma carrega normalmente.
-- ----------------------------------------------------------------------------
drop policy if exists "tenant_select_exercicios_treino" on public.exercicios_treino;
drop policy if exists "tenant_select_exercicios"        on public.exercicios_treino;
create policy "tenant_select_exercicios_treino" on public.exercicios_treino
  for select to authenticated
  using (treino_id in (select t.id from public.treinos t));

drop policy if exists "tenant_insert_exercicios_treino" on public.exercicios_treino;
drop policy if exists "tenant_insert_exercicios"        on public.exercicios_treino;
create policy "tenant_insert_exercicios_treino" on public.exercicios_treino
  for insert to authenticated
  with check (
    treino_id in (
      select t.id from public.treinos t
      where t.academia_id = public.academia_id_atual()
        and (
          t.aluno_id is not null
          or t.criado_por = auth.uid()
          or public.papel_do_usuario_atual() in ('dono', 'gerente')
        )
    )
  );

drop policy if exists "tenant_update_exercicios_treino" on public.exercicios_treino;
drop policy if exists "tenant_update_exercicios"        on public.exercicios_treino;
create policy "tenant_update_exercicios_treino" on public.exercicios_treino
  for update to authenticated
  using (
    treino_id in (
      select t.id from public.treinos t
      where t.academia_id = public.academia_id_atual()
        and (
          t.aluno_id is not null
          or t.criado_por = auth.uid()
          or public.papel_do_usuario_atual() in ('dono', 'gerente')
        )
    )
  )
  with check (
    treino_id in (
      select t.id from public.treinos t
      where t.academia_id = public.academia_id_atual()
        and (
          t.aluno_id is not null
          or t.criado_por = auth.uid()
          or public.papel_do_usuario_atual() in ('dono', 'gerente')
        )
    )
  );

drop policy if exists "tenant_delete_exercicios_treino" on public.exercicios_treino;
drop policy if exists "tenant_delete_exercicios"        on public.exercicios_treino;
create policy "tenant_delete_exercicios_treino" on public.exercicios_treino
  for delete to authenticated
  using (
    treino_id in (
      select t.id from public.treinos t
      where t.academia_id = public.academia_id_atual()
        and (
          t.aluno_id is not null
          or t.criado_por = auth.uid()
          or public.papel_do_usuario_atual() in ('dono', 'gerente')
        )
    )
  );

comment on column public.treinos.visibilidade is
  'Nível de visibilidade do treino-modelo: plataforma (GestAcad, academia_id NULL), academia (equipe toda) ou instrutor (privado de criado_por; dono/gerente também veem).';
