-- =============================================================================
-- Migration 011 — Índices ausentes e melhoria de RLS em exercicios_treino.
--
-- Adiciona índices que estavam faltando (detectados por análise de performance):
--   • alunos.plano_id         — JOIN na geração de mensalidades
--   • feedbacks.aluno_id      — JOIN na listagem de feedbacks
--   • historico_planos.plano_id — ON DELETE SET NULL cascade lookup
--
-- Melhora a política RLS de exercicios_treino para usar JOIN em vez de
-- subquery correlacionada (evita loop por linha).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- Índices
create index if not exists idx_alunos_plano         on public.alunos(plano_id)        where plano_id is not null;
create index if not exists idx_feedbacks_aluno       on public.feedbacks(aluno_id)     where aluno_id is not null;
create index if not exists idx_hist_planos_plano     on public.historico_planos(plano_id) where plano_id is not null;

-- Melhora RLS de exercicios_treino: substitui subquery correlacionada por EXISTS+JOIN
-- (o EXISTS para quando encontra o primeiro match; mais eficiente com índice no treino_id)
do $$
begin
  drop policy if exists "tenant_select_exercicios"  on public.exercicios_treino;
  drop policy if exists "tenant_insert_exercicios"  on public.exercicios_treino;
  drop policy if exists "tenant_update_exercicios"  on public.exercicios_treino;
  drop policy if exists "tenant_delete_exercicios"  on public.exercicios_treino;

  execute $pol$
    create policy "tenant_select_exercicios" on public.exercicios_treino
      for select to authenticated
      using (
        exists (
          select 1 from public.treinos t
          where t.id = exercicios_treino.treino_id
            and t.academia_id = public.academia_id_atual()
        )
      )
  $pol$;

  execute $pol$
    create policy "tenant_insert_exercicios" on public.exercicios_treino
      for insert to authenticated
      with check (
        exists (
          select 1 from public.treinos t
          where t.id = exercicios_treino.treino_id
            and t.academia_id = public.academia_id_atual()
        )
      )
  $pol$;

  execute $pol$
    create policy "tenant_update_exercicios" on public.exercicios_treino
      for update to authenticated
      using (
        exists (
          select 1 from public.treinos t
          where t.id = exercicios_treino.treino_id
            and t.academia_id = public.academia_id_atual()
        )
      )
  $pol$;

  execute $pol$
    create policy "tenant_delete_exercicios" on public.exercicios_treino
      for delete to authenticated
      using (
        exists (
          select 1 from public.treinos t
          where t.id = exercicios_treino.treino_id
            and t.academia_id = public.academia_id_atual()
        )
      )
  $pol$;
end$$;
