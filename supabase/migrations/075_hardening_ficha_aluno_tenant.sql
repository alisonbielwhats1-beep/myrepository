-- =============================================================================
-- Migração 075 — Hardening multi-tenant da ficha do aluno (obter_ficha_aluno)
--
-- PROBLEMA (defesa em profundidade):
--   A política de INSERT de `treinos` (migration 068 "tenant_insert_treinos")
--   só exige `academia_id = academia_id_atual()`. Ela NÃO valida que o
--   `aluno_id` informado pertença à mesma academia. Já a RPC pública
--   `obter_ficha_aluno` (migration 037) montava a lista de treinos filtrando
--   SOMENTE por `aluno_id`:
--
--       from public.treinos t
--       where t.aluno_id = (aluno resolvido) and t.ativo = true
--
--   Combinando os dois: um admin autenticado de qualquer academia poderia
--   inserir, via chamada REST direta, uma linha de treino com
--   `academia_id = (a própria)` e `aluno_id = (aluno de OUTRA academia)`. Essa
--   linha passa no RLS de insert (é da academia dele) e, por não haver recorte
--   de tenant no SELECT da ficha, apareceria injetada na ficha da vítima.
--   Não expõe dados da vítima (é escrita/spam, não leitura), e exige conhecer
--   o UUID do aluno-alvo, mas viola o isolamento e não deve ser possível.
--
-- CORREÇÃO:
--   A ficha passa a listar apenas treinos da MESMA academia do aluno resolvido
--   (`t.academia_id = (academia do aluno)`), fechando a injeção de outro tenant.
--   Alteração puramente restritiva (só adiciona uma condição no WHERE): nenhum
--   treino legítimo do próprio aluno deixa de aparecer, pois a atribuição
--   (RPC 067/073) e a criação de ficha sempre gravam `academia_id` = academia
--   do aluno. Idempotente (create or replace); nada é apagado ou migrado.
-- =============================================================================

create or replace function public.obter_ficha_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id, a.academia_id as academia_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  )
  select jsonb_build_object(
    'aluno', (
      select jsonb_build_object(
        'id', a.id,
        'nome', a.nome,
        'foto_perfil_url', a.foto_perfil_url,
        'status_matricula', a.status_matricula,
        'matricula_codigo', a.matricula_codigo,
        'plano_nome', p.nome,
        'criado_em', a.criado_em
      )
      from public.alunos a
      left join public.planos p on p.id = a.plano_id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'academia', (
      select jsonb_build_object(
        'id', ac.id,
        'nome_fantasia', ac.nome_fantasia,
        'slug_url', ac.slug_url
      )
      from public.academias ac
      join public.alunos a on a.academia_id = ac.id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'treinos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nome_treino', t.nome_treino,
        'objetivo', t.objetivo,
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
            'imagem_demonstracao_url', e.imagem_demonstracao_url,
            'video_demonstracao_url', e.video_demonstracao_url,
            'observacoes', e.observacoes,
            'ordem', e.ordem,
            'criado_em', e.criado_em
          ) order by e.ordem), '[]'::jsonb)
          from public.exercicios_treino e
          where e.treino_id = t.id
        )
      ) order by t.ordem)
      from public.treinos t
      where t.aluno_id = (select aluno_id from aluno_resolvido)
        and t.academia_id = (select academia_id from aluno_resolvido)
        and t.ativo = true
    ), '[]'::jsonb),
    'progresso', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'data', pr.data,
        'peso_kg', pr.peso_kg,
        'percentual_gordura', pr.percentual_gordura,
        'peito_cm', pr.peito_cm,
        'cintura_cm', pr.cintura_cm,
        'quadril_cm', pr.quadril_cm,
        'braco_cm', pr.braco_cm,
        'coxa_cm', pr.coxa_cm,
        'foto_url', pr.foto_url
      ) order by pr.data asc)
      from public.progresso_aluno pr
      where pr.aluno_id = (select aluno_id from aluno_resolvido)
    ), '[]'::jsonb)
  )
  where exists (select 1 from aluno_resolvido);
$$;

comment on function public.obter_ficha_aluno(uuid, text) is
  'Leitura pública e restrita (sem CPF/e-mail/telefone) da ficha de um aluno, resolvida por token pessoal + slug da academia (nunca por aluno_id). Só lista treinos da mesma academia do aluno (migration 075 — isolamento multi-tenant). Token ou slug incorretos devolvem null, indistinguível de "aluno inexistente".';

grant execute on function public.obter_ficha_aluno(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Causa raiz: o INSERT de treinos (068) não validava que o aluno_id pertence à
-- academia da sessão. Reforçamos o WITH CHECK para exigir que, quando há
-- aluno_id, esse aluno seja da própria academia. Treino-modelo (aluno_id NULL)
-- continua liberado. Puramente restritivo — os fluxos legítimos (criar/editar
-- ficha) sempre usam aluno da própria academia; a atribuição é SECURITY DEFINER
-- e não passa por este RLS.
-- ----------------------------------------------------------------------------
drop policy if exists "tenant_insert_treinos" on public.treinos;
create policy "tenant_insert_treinos" on public.treinos
  for insert to authenticated
  with check (
    academia_id = public.academia_id_atual()
    and (
      aluno_id is null
      or exists (
        select 1 from public.alunos a
        where a.id = treinos.aluno_id
          and a.academia_id = public.academia_id_atual()
      )
    )
  );
