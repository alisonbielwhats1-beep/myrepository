-- =============================================================================
-- Rollback da migração 105 — volta a mostrar TODOS os modelos ao aluno e tira
-- o nível que o backfill gravou.
--
-- O `update` só limpa onde o nível ainda é exatamente o que a 105 teria
-- gravado: se alguém ajustou o nível pelo painel depois, aquele valor fica.
-- =============================================================================

-- 1. Sugeridos voltam a ignorar o nível.
create or replace function public.obter_treinos_sugeridos_aluno(
  p_token uuid,
  p_slug text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with alvo as (
    select a.id as aluno_id, a.academia_id as academia_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  )
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'nome_treino', t.nome_treino,
      'objetivo', t.objetivo,
      'modalidade', t.modalidade,
      'nivel', t.nivel,
      'publico_alvo', t.publico_alvo,
      'ordem', t.ordem,
      'exercicios', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', e.id,
          'treino_id', e.treino_id,
          'nome_exercicio', e.nome_exercicio,
          'series', e.series,
          'repeticoes', e.repeticoes,
          'carga_kg', e.carga_kg,
          'descanso_segundos', e.descanso_segundos,
          'imagem_demonstracao_url', coalesce(
            nullif(e.imagem_demonstracao_url, ''),
            nullif(c.imagem_demonstracao_url, '')
          ),
          'video_demonstracao_url', coalesce(
            nullif(e.video_demonstracao_url, ''),
            nullif(c.video_demonstracao_url, '')
          ),
          'observacoes', e.observacoes,
          'ordem', e.ordem,
          'criado_em', e.criado_em
        ) order by e.ordem), '[]'::jsonb)
        from public.exercicios_treino e
        left join public.catalogo_exercicios c
          on c.id = e.catalogo_exercicio_id
         and (c.academia_id is null or c.academia_id = t.academia_id)
        where e.treino_id = t.id
      )
    ) order by t.modalidade nulls last, t.ordem)
    from public.treinos t
    where t.aluno_id is null
      and t.ativo = true
      and (
        (t.academia_id = (select academia_id from alvo)
          and t.visibilidade in ('academia', 'plataforma'))
        or (t.academia_id is null and t.visibilidade = 'plataforma')
      )
      and exists (select 1 from alvo)
  ), '[]'::jsonb);
$$;

revoke all on function public.obter_treinos_sugeridos_aluno(uuid, text) from public;
grant execute on function public.obter_treinos_sugeridos_aluno(uuid, text) to anon, authenticated;

-- 2. Academia nova volta a nascer com os modelos sem nível.
create or replace function public._add_treino_padrao(
  p_academia_id uuid,
  p_nome        text,
  p_objetivo    text,
  p_modalidade  text,
  p_ordem       int,
  p_exercicios  jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treino_id uuid;
begin
  insert into public.treinos
    (academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem)
  values
    (p_academia_id, null, p_nome, p_objetivo, p_modalidade, p_ordem)
  returning id into v_treino_id;

  insert into public.exercicios_treino
    (treino_id, nome_exercicio, series, repeticoes, descanso_segundos, ordem)
  select
    v_treino_id,
    e->>'nome',
    coalesce((e->>'series')::int, 3),
    coalesce(e->>'reps', '12'),
    coalesce((e->>'descanso')::int, 60),
    ord::int
  from jsonb_array_elements(p_exercicios) with ordinality as t(e, ord);
end;
$$;

-- 3. Limpa só o que o backfill gravou.
update public.treinos t
set nivel = null
where t.aluno_id is null
  and t.nivel is not null
  and t.nivel = public._nivel_do_treino_padrao(t.nome_treino);

drop function if exists public._nivel_do_treino_padrao(text);
