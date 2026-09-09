-- =============================================================================
-- Migração 104 — Treinos sugeridos visíveis para o aluno
--
-- O PROBLEMA
--   Aluno novo entra na academia num dia em que o instrutor não consegue montar
--   a ficha na hora. Ele instala o app, abre a aba Treinos e encontra um beco
--   sem saída: "Seu treino ainda está sendo montado. Fale com a recepção."
--   O aplicativo nasce inútil justamente no dia em que o aluno está mais
--   animado.
--
-- O QUE JÁ EXISTIA
--   A migração 018 semeia ONZE treinos-modelo em toda academia criada — ABC,
--   ABCD, dois Full Body marcados "(Iniciante)", funcional e cardio. Eles já
--   estão no banco de todo cliente, com exercícios, séries, repetições e
--   descanso. Só que vivem do lado do PAINEL: `getTreinosBiblioteca` roda com
--   sessão autenticada e RLS por perfil, e a área do aluno é pública, resolvida
--   por token+slug. Não havia caminho do aluno até eles.
--
--   Esta migração abre exatamente esse caminho, e nada mais.
--
-- O QUE ESTA RPC DEVOLVE, E O QUE ELA NUNCA DEVOLVE
--   Devolve os treinos-modelo (aluno_id null, ativos) da academia DO ALUNO
--   resolvido por token+slug, mais os da plataforma. Mesmo formato de exercício
--   da `obter_ficha_aluno` — inclusive a coalescência de foto/vídeo com o
--   catálogo —, para as telas do aluno reaproveitarem os mesmos componentes.
--
--   NUNCA devolve modelo com `visibilidade = 'instrutor'`: pela migração 068
--   esse é o rascunho privado de quem criou, que nem outro instrutor da mesma
--   academia enxerga. Ficha de outro aluno também não entra: o filtro exige
--   `aluno_id is null`, então só passa o que é modelo.
-- =============================================================================

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

comment on function public.obter_treinos_sugeridos_aluno(uuid, text) is
  'Treinos-modelo (aluno_id null, ativos) que o aluno pode consultar enquanto não tem ficha própria. Resolvido por token+slug. Nunca devolve modelo privado de instrutor nem ficha de outro aluno.';

revoke all on function public.obter_treinos_sugeridos_aluno(uuid, text) from public;
grant execute on function public.obter_treinos_sugeridos_aluno(uuid, text) to anon, authenticated;
