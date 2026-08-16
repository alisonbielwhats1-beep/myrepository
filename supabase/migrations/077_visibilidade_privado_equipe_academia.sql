-- =============================================================================
-- Migração 077 — Visibilidade em três níveis: privado / equipe / academia
--                (Fase 3 da desconflação origem × visibilidade)
--
-- Agora que a ORIGEM vive em `origem_tipo` (migration 076), a coluna
-- `visibilidade` passa a responder SÓ pelo eixo de quem enxerga, com três
-- níveis distintos (a pedido do cliente):
--   • privado  → só o criador (dono/gerente sempre veem tudo);
--   • equipe   → a equipe TÉCNICA (dono, gerente e instrutores) — recepção não;
--   • academia → todo mundo da academia, inclusive recepção.
--
-- O valor `plataforma` é aposentado de `visibilidade` (era ORIGEM, hoje em
-- origem_tipo='gestacad'); e `instrutor` vira `privado`.
--
-- NÃO-DESTRUTIVO / sem perda de acesso:
--   • quem via um treino 'academia' continua vendo (mapeia para 'academia');
--   • privados continuam privados ('instrutor' → 'privado');
--   • 'equipe' é um nível NOVO, opcional — ninguém é rebaixado para ele.
--   • fichas de aluno (aluno_id != null) ignoram visibilidade (RLS por
--     aluno_id), então o backfill não muda nada para elas.
--
-- Ordem importa: primeiro soltamos o CHECK de coerência da plataforma (que
-- amarrava visibilidade='plataforma' às linhas sem academia) para poder
-- reescrever esses valores; depois backfill; depois re-aperta os CHECKs.
-- Idempotente.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coerência da plataforma passa a se basear em origem_tipo (076), não mais
--    em visibilidade — libera reescrever a visibilidade das linhas de plataforma.
-- ----------------------------------------------------------------------------
alter table public.treinos drop constraint if exists treinos_plataforma_coerente;
alter table public.treinos
  add constraint treinos_plataforma_coerente check (
    academia_id is not null
    or (origem_tipo = 'gestacad' and aluno_id is null)
  );

-- ----------------------------------------------------------------------------
-- 2. Libera o CHECK de visibilidade para o backfill e reescreve os valores.
-- ----------------------------------------------------------------------------
alter table public.treinos drop constraint if exists treinos_visibilidade_valida;

update public.treinos set visibilidade = 'privado'  where visibilidade = 'instrutor';
update public.treinos set visibilidade = 'academia' where visibilidade = 'plataforma';

-- Novos treinos-modelo nascem privados (a aplicação também grava isso
-- explicitamente); fichas seguem no default e ignoram o campo.
alter table public.treinos alter column visibilidade set default 'privado';

-- ----------------------------------------------------------------------------
-- 3. Re-aperta o CHECK com o conjunto final de três níveis.
-- ----------------------------------------------------------------------------
alter table public.treinos
  add constraint treinos_visibilidade_valida
  check (visibilidade in ('privado', 'equipe', 'academia'));

-- ----------------------------------------------------------------------------
-- 4. RLS de leitura: única política que lia `visibilidade`. Reescreve os três
--    níveis e passa a detectar plataforma por origem_tipo. Demais políticas
--    (insert da 075, update/delete da 068, exercicios_treino) não tocam em
--    visibilidade e ficam como estão.
--
--    equipe = dono/gerente/instrutor (a recepção NÃO vê treino de equipe);
--    academia = qualquer membro do tenant (inclui recepção).
-- ----------------------------------------------------------------------------
drop policy if exists "tenant_select_treinos" on public.treinos;
create policy "tenant_select_treinos" on public.treinos
  for select to authenticated
  using (
    -- Modelo padrão da plataforma: visível para qualquer academia autenticada.
    (academia_id is null and origem_tipo = 'gestacad')
    or (
      academia_id = public.academia_id_atual()
      and (
        aluno_id is not null                                       -- ficha de aluno: equipe acessa (comportamento atual)
        or visibilidade = 'academia'                               -- toda a academia (inclui recepção)
        or (
          visibilidade = 'equipe'
          and public.papel_do_usuario_atual() in ('dono', 'gerente', 'instrutor')
        )                                                          -- equipe técnica, sem recepção
        or criado_por = auth.uid()                                 -- meu treino privado
        or public.papel_do_usuario_atual() in ('dono', 'gerente')  -- gestão vê tudo
      )
    )
  );

comment on column public.treinos.visibilidade is
  'Nível de visibilidade do treino-modelo (migration 077): privado (só o criador; dono/gerente também), equipe (dono/gerente/instrutor — recepção não) ou academia (todo o tenant, inclusive recepção). Fichas de aluno ignoram o campo. A ORIGEM fica em origem_tipo.';

-- ----------------------------------------------------------------------------
-- 5. RPC atribuir_modelo_treino: identificava o modelo de plataforma por
--    `visibilidade = 'plataforma'` (migration 073). Como esse valor foi
--    aposentado acima, o modelo GestAcad passa a ser identificado por
--    `origem_tipo = 'gestacad'` — senão atribuir um treino padrão volta a dar
--    "Modelo não encontrado". Restante da função idêntico à 073.
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
