-- =============================================================================
-- Migração 105 — Classificar o nível dos treinos-modelo e mostrar ao aluno só
--                os de nível Iniciante
--
-- O QUE ESTAVA ERRADO
--   A coluna `nivel` existe desde a migração 066, mas NADA nunca a preencheu:
--   a 018 semeia os onze modelos sem nível, e não há passo posterior que
--   classifique. Ou seja, `nivel` está null em todos eles, em toda academia.
--
--   Consequência prática: filtrar os treinos sugeridos por `nivel = 'Iniciante'`
--   devolveria ZERO e a tela do aluno ficaria vazia. Por isso classificar vem
--   antes de filtrar, na mesma migração — as duas coisas separadas deixariam o
--   recurso quebrado no intervalo.
--
-- COMO A CLASSIFICAÇÃO É FEITA
--   Por nome EXATO dos onze modelos que a 018 semeia. Nada de `like`: um
--   modelo que a academia criou e batizou de "Treino A — alguma coisa" não pode
--   ser classificado por engano. Nome fora da lista devolve null, e nada é
--   tocado — a função falha fechada.
--
--   ABC, Full Body, funcional e cardio → 'Iniciante'.
--   ABCD → 'Intermediário': é um split de quatro dias, que pressupõe rotina
--   já estabelecida. Continua no painel para o instrutor prescrever; só não é
--   oferecido ao aluno que ainda não tem ficha e está sozinho na academia.
--
--   A classificação entra em DOIS lugares, de propósito:
--     • no `_add_treino_padrao`, para toda academia criada daqui em diante
--       nascer com os modelos já classificados (sem isso, academia nova teria
--       a tela de sugeridos vazia — exatamente o bug que este recurso conserta);
--     • num backfill, para as academias que já existem.
--
-- O QUE NÃO É TOCADO
--   Só linhas com `aluno_id is null` (modelo, nunca ficha de aluno — e as
--   fichas copiadas de um modelo carregam o mesmo nome) e `nivel is null`
--   (nível definido à mão pela academia vence sempre).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Mapa nome → nível. Imutável: depende só do texto que recebe.
-- -----------------------------------------------------------------------------
create or replace function public._nivel_do_treino_padrao(p_nome text)
returns text
language sql
immutable
as $$
  select case btrim(coalesce(p_nome, ''))
    when 'Treino A — Peito, Ombro e Tríceps'      then 'Iniciante'
    when 'Treino B — Costas e Bíceps'             then 'Iniciante'
    when 'Treino C — Pernas e Abdômen'            then 'Iniciante'
    when 'Full Body A — Corpo Inteiro (Iniciante)' then 'Iniciante'
    when 'Full Body B — Corpo Inteiro (Iniciante)' then 'Iniciante'
    when 'Funcional HIIT — Queima de Gordura'     then 'Iniciante'
    when 'Cardio Iniciante — Condicionamento'     then 'Iniciante'
    when 'ABCD · Treino A — Peito e Tríceps'      then 'Intermediário'
    when 'ABCD · Treino B — Costas e Bíceps'      then 'Intermediário'
    when 'ABCD · Treino C — Pernas e Panturrilha' then 'Intermediário'
    when 'ABCD · Treino D — Ombros e Abdômen'     then 'Intermediário'
    else null
  end;
$$;

comment on function public._nivel_do_treino_padrao(text) is
  'Nível de um treino-modelo da biblioteca-padrão (migração 018), por nome exato. Nome desconhecido devolve null — falha fechada, para nunca classificar modelo da academia por engano.';

-- -----------------------------------------------------------------------------
-- 2. Toda academia nova já nasce com os modelos classificados.
--    Mesma assinatura da 018; a única mudança é a coluna `nivel` no insert.
-- -----------------------------------------------------------------------------
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
    (academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem, nivel)
  values
    (p_academia_id, null, p_nome, p_objetivo, p_modalidade, p_ordem,
     public._nivel_do_treino_padrao(p_nome))
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

-- -----------------------------------------------------------------------------
-- 3. Backfill das academias que já existem.
-- -----------------------------------------------------------------------------
update public.treinos t
set nivel = public._nivel_do_treino_padrao(t.nome_treino)
where t.aluno_id is null
  and t.nivel is null
  and public._nivel_do_treino_padrao(t.nome_treino) is not null;

-- -----------------------------------------------------------------------------
-- 4. Treinos sugeridos: só nível Iniciante.
--
--    Filtro explícito, não "tudo que não é avançado": modelo sem nível não
--    aparece. Quem decide o que um aluno sozinho pode seguir é a academia,
--    marcando o nível do modelo — e não o silêncio do banco.
-- -----------------------------------------------------------------------------
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
      and btrim(coalesce(t.nivel, '')) = 'Iniciante'
      and (
        (t.academia_id = (select academia_id from alvo)
          and t.visibilidade in ('academia', 'plataforma'))
        or (t.academia_id is null and t.visibilidade = 'plataforma')
      )
      and exists (select 1 from alvo)
  ), '[]'::jsonb);
$$;

comment on function public.obter_treinos_sugeridos_aluno(uuid, text) is
  'Treinos-modelo de nível Iniciante que o aluno pode consultar enquanto não tem ficha própria. Resolvido por token+slug. Nunca devolve modelo privado de instrutor, ficha de outro aluno, nem modelo sem nível definido.';

revoke all on function public.obter_treinos_sugeridos_aluno(uuid, text) from public;
grant execute on function public.obter_treinos_sugeridos_aluno(uuid, text) to anon, authenticated;
