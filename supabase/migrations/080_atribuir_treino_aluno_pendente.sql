-- =============================================================================
-- Migração 080 — Atribuir treino também a aluno com matrícula PENDENTE
--
-- PROBLEMA (bug relatado):
--   atribuir_modelo_treino (077) exigia `status_matricula = 'ativa'`. Um aluno
--   criado SEM plano nasce 'pendente' (alunos/actions.ts) — então atribuir um
--   treino a ele falhava com "Aluno ativo não encontrado", que a camada de erro
--   mostrava como o críptico "(código P0001)". Negar um treino a um aluno que
--   já existe só porque o pagamento/plano ainda não foi definido é indesejado.
--
-- CORREÇÃO:
--   Aceita 'ativa' OU 'pendente'. Continua barrando 'trancada'/'cancelada'/
--   'inativa' (aí o certo é reativar a matrícula antes). A mensagem de erro fica
--   explícita sobre o motivo. Só muda a cláusula do aluno e o texto do raise;
--   todo o resto é idêntico à 077.
--
-- Idempotente (create or replace).
-- =============================================================================

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

  -- Modelo válido: da própria academia OU um modelo padrão da plataforma
  -- (identificado por origem_tipo='gestacad' desde a migration 077).
  select t.* into v_modelo
  from public.treinos t
  where t.id = p_treino_modelo_id
    and (
      t.academia_id = v_academia_id
      or (t.academia_id is null and t.origem_tipo = 'gestacad')
    )
    and t.aluno_id is null
    and t.ativo = true;

  if not found then
    raise exception 'Modelo de treino não encontrado';
  end if;

  -- Aluno da academia com matrícula utilizável. 'pendente' (recém-criado, sem
  -- plano) é aceito de propósito; 'trancada'/'cancelada'/'inativa' não —
  -- reative a matrícula antes de atribuir treinos.
  if not exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.academia_id = v_academia_id
      and a.status_matricula in ('ativa', 'pendente')
  ) then
    raise exception 'Aluno não encontrado nesta academia ou com matrícula inativa (trancada/cancelada). Reative a matrícula para atribuir treinos.';
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
    academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem, ativo,
    publico, criado_por, profissional_nome, nivel, publico_alvo, origem,
    codigo_importacao, metadados, modelo_origem_id, atribuido_por, atribuido_em,
    versao_origem
  )
  values (
    v_academia_id, p_aluno_id, v_nome, v_modelo.objetivo, v_modelo.modalidade,
    v_ordem, true, false, auth.uid(), v_modelo.profissional_nome, v_modelo.nivel,
    v_modelo.publico_alvo, 'modelo', null,
    coalesce(v_modelo.metadados, '{}'::jsonb) || jsonb_build_object(
      'modelo_origem_id', v_modelo.id,
      'modelo_nome_original', v_modelo.nome_treino
    ),
    v_modelo.id, auth.uid(), now(), 1
  )
  returning id into v_novo_treino_id;

  insert into public.exercicios_treino (
    treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos,
    imagem_demonstracao_url, video_demonstracao_url, observacoes, ordem, configuracao
  )
  select
    v_novo_treino_id, e.nome_exercicio, e.series, e.repeticoes, e.carga_kg,
    e.descanso_segundos, e.imagem_demonstracao_url, e.video_demonstracao_url,
    e.observacoes, e.ordem, coalesce(e.configuracao, '{}'::jsonb)
  from public.exercicios_treino e
  where e.treino_id = v_modelo.id
  order by e.ordem;

  return v_novo_treino_id;
end;
$$;

revoke all on function public.atribuir_modelo_treino(uuid, uuid, text) from public;
grant execute on function public.atribuir_modelo_treino(uuid, uuid, text) to authenticated;
