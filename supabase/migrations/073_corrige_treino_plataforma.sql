-- =============================================================================
-- Migração 073 — Corrige os RPCs para os treinos-modelo de plataforma (069)
--
-- Ao introduzir a camada "Padrão GestAcad" (academia_id NULL), dois RPCs
-- escritos antes dessa camada passaram a falhar com esses treinos:
--
--   1) atribuir_modelo_treino (067): exigia t.academia_id = academia_da_sessao,
--      então atribuir um treino padrão a um aluno dava "Modelo não encontrado".
--      → agora aceita também o modelo de plataforma (academia_id NULL +
--        visibilidade='plataforma'). A cópia continua nascendo na academia do
--        aluno (v_academia_id), como antes.
--
--   2) obter_treino_publico (002): fazia JOIN em academias por academia_id, e
--      com academia_id NULL não retornava linha → link/QR público dava 404.
--      → vira LEFT JOIN e mostra "GestAcad" como origem quando não há academia.
--
-- Ambos idempotentes (create or replace).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. atribuir_modelo_treino — aceita modelo da academia OU da plataforma.
-- ----------------------------------------------------------------------------
create or replace function public.atribuir_modelo_treino(
  p_treino_modelo_id uuid,
  p_aluno_id uuid,
  p_nome_treino text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_modelo public.treinos%rowtype;
  v_novo_treino_id uuid;
  v_ordem integer;
  v_nome text;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor') then
    raise exception 'Seu perfil não pode atribuir treinos';
  end if;

  -- Modelo válido: da própria academia OU um modelo padrão da plataforma.
  select t.* into v_modelo
  from public.treinos t
  where t.id = p_treino_modelo_id
    and (
      t.academia_id = v_academia_id
      or (t.academia_id is null and t.visibilidade = 'plataforma')
    )
    and t.aluno_id is null
    and t.ativo = true;

  if not found then
    raise exception 'Modelo de treino não encontrado';
  end if;

  if not exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.academia_id = v_academia_id
      and a.status_matricula = 'ativa'
  ) then
    raise exception 'Aluno ativo não encontrado nesta academia';
  end if;

  v_nome := nullif(btrim(coalesce(p_nome_treino, '')), '');
  if v_nome is null then
    v_nome := v_modelo.nome_treino;
  end if;
  if char_length(v_nome) > 120 then
    raise exception 'O nome do treino deve ter no máximo 120 caracteres';
  end if;

  select coalesce(max(t.ordem), 0) + 1 into v_ordem
  from public.treinos t
  where t.academia_id = v_academia_id
    and t.aluno_id = p_aluno_id;

  insert into public.treinos (
    academia_id,
    aluno_id,
    nome_treino,
    objetivo,
    modalidade,
    ordem,
    ativo,
    publico,
    criado_por,
    profissional_nome,
    nivel,
    publico_alvo,
    origem,
    codigo_importacao,
    metadados,
    modelo_origem_id,
    atribuido_por,
    atribuido_em,
    versao_origem
  )
  values (
    v_academia_id,
    p_aluno_id,
    v_nome,
    v_modelo.objetivo,
    v_modelo.modalidade,
    v_ordem,
    true,
    false,
    auth.uid(),
    v_modelo.profissional_nome,
    v_modelo.nivel,
    v_modelo.publico_alvo,
    'modelo',
    null,
    coalesce(v_modelo.metadados, '{}'::jsonb) || jsonb_build_object(
      'modelo_origem_id', v_modelo.id,
      'modelo_nome_original', v_modelo.nome_treino
    ),
    v_modelo.id,
    auth.uid(),
    now(),
    1
  )
  returning id into v_novo_treino_id;

  insert into public.exercicios_treino (
    treino_id,
    nome_exercicio,
    series,
    repeticoes,
    carga_kg,
    descanso_segundos,
    imagem_demonstracao_url,
    video_demonstracao_url,
    observacoes,
    ordem,
    configuracao
  )
  select
    v_novo_treino_id,
    e.nome_exercicio,
    e.series,
    e.repeticoes,
    e.carga_kg,
    e.descanso_segundos,
    e.imagem_demonstracao_url,
    e.video_demonstracao_url,
    e.observacoes,
    e.ordem,
    coalesce(e.configuracao, '{}'::jsonb)
  from public.exercicios_treino e
  where e.treino_id = v_modelo.id
  order by e.ordem;

  return v_novo_treino_id;
end;
$$;

revoke all on function public.atribuir_modelo_treino(uuid, uuid, text) from public;
grant execute on function public.atribuir_modelo_treino(uuid, uuid, text) to authenticated;

comment on function public.atribuir_modelo_treino(uuid, uuid, text) is
  'Copia transacionalmente um modelo (da academia ou padrão da plataforma) para a ficha de um aluno ativo da academia da sessão. Tenant e papel vêm da sessão; academia_id nunca é parâmetro.';

-- ----------------------------------------------------------------------------
-- 2. obter_treino_publico — LEFT JOIN para não dar 404 em treino sem academia.
-- ----------------------------------------------------------------------------
create or replace function public.obter_treino_publico(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'treino', jsonb_build_object(
      'id', t.id,
      'nome_treino', t.nome_treino,
      'objetivo', t.objetivo,
      'modalidade', t.modalidade,
      'ordem', t.ordem
    ),
    'academia', jsonb_build_object(
      'nome_fantasia', coalesce(ac.nome_fantasia, 'GestAcad'),
      'slug_url', coalesce(ac.slug_url, '')
    ),
    'exercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by e.ordem)
      from public.exercicios_treino e
      where e.treino_id = t.id
    ), '[]'::jsonb)
  )
  from public.treinos t
  left join public.academias ac on ac.id = t.academia_id
  where t.share_token = p_token and t.publico = true;
$$;

grant execute on function public.obter_treino_publico(uuid) to anon, authenticated;
