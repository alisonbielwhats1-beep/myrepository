-- =============================================================================
-- Migration 018 — Catálogo de treinos padrão por academia.
--
-- OBJETIVO:
--   Toda academia nova já nasce com uma biblioteca de treinos-modelo prontos
--   (Musculação ABC, ABCD, Full Body iniciante e Funcional/Cardio), para o dono
--   não precisar montar tudo do zero. As academias já existentes também são
--   preenchidas (backfill no final deste arquivo).
--
-- COMO FUNCIONA:
--   • _add_treino_padrao(...)  — helper: cria 1 treino-modelo + seus exercícios.
--   • seed_treinos_padrao(id)  — cria TODOS os treinos-modelo de uma academia.
--     É idempotente: se a academia já tem qualquer treino de biblioteca
--     (aluno_id null), não faz nada — assim nunca duplica nem sobrescreve o
--     que o dono já criou.
--
-- Treinos-modelo = treinos com aluno_id NULL (biblioteca). O dono pode editar,
-- excluir ou usar como base para a ficha de cada aluno.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- Helper: insere um treino-modelo e seus exercícios (recebidos como JSON).
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

-- Cria toda a biblioteca-padrão de uma academia (idempotente).
create or replace function public.seed_treinos_padrao(p_academia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existe int;
begin
  select count(*) into v_existe
    from public.treinos
   where academia_id = p_academia_id
     and aluno_id is null;
  if v_existe > 0 then
    return; -- academia já tem treinos-modelo; não mexe
  end if;

  -- ===================== MUSCULAÇÃO — DIVISÃO ABC (3x/semana) =================
  perform public._add_treino_padrao(p_academia_id,
    'Treino A — Peito, Ombro e Tríceps', 'Hipertrofia', 'Musculação', 1,
    '[
      {"nome":"Supino Reto com Barra","series":4,"reps":"8-10","descanso":90},
      {"nome":"Supino Inclinado com Halteres","series":3,"reps":"10-12","descanso":75},
      {"nome":"Crucifixo na Máquina (Peck Deck)","series":3,"reps":"12-15","descanso":60},
      {"nome":"Desenvolvimento Militar com Halteres","series":4,"reps":"8-10","descanso":90},
      {"nome":"Elevação Lateral","series":3,"reps":"12-15","descanso":45},
      {"nome":"Tríceps Testa","series":3,"reps":"10-12","descanso":60},
      {"nome":"Tríceps Corda na Polia","series":3,"reps":"12-15","descanso":45}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'Treino B — Costas e Bíceps', 'Hipertrofia', 'Musculação', 2,
    '[
      {"nome":"Puxada Frontal na Polia","series":4,"reps":"8-10","descanso":90},
      {"nome":"Remada Curvada com Barra","series":4,"reps":"8-10","descanso":90},
      {"nome":"Remada Baixa (Triângulo)","series":3,"reps":"10-12","descanso":75},
      {"nome":"Pulldown / Puxada Neutra","series":3,"reps":"12","descanso":60},
      {"nome":"Rosca Direta com Barra","series":4,"reps":"10-12","descanso":60},
      {"nome":"Rosca Alternada com Halteres","series":3,"reps":"10-12","descanso":45},
      {"nome":"Rosca Martelo","series":3,"reps":"12","descanso":45}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'Treino C — Pernas e Abdômen', 'Hipertrofia', 'Musculação', 3,
    '[
      {"nome":"Agachamento Livre","series":4,"reps":"8-10","descanso":120},
      {"nome":"Leg Press 45°","series":4,"reps":"10-12","descanso":90},
      {"nome":"Cadeira Extensora","series":3,"reps":"12-15","descanso":60},
      {"nome":"Mesa Flexora","series":3,"reps":"12-15","descanso":60},
      {"nome":"Cadeira Adutora","series":3,"reps":"15","descanso":45},
      {"nome":"Panturrilha em Pé","series":4,"reps":"15-20","descanso":45},
      {"nome":"Abdominal Supra","series":3,"reps":"20","descanso":30}
    ]'::jsonb);

  -- ===================== MUSCULAÇÃO — DIVISÃO ABCD (4x/semana) ================
  perform public._add_treino_padrao(p_academia_id,
    'ABCD · Treino A — Peito e Tríceps', 'Hipertrofia', 'Musculação', 4,
    '[
      {"nome":"Supino Reto com Barra","series":4,"reps":"8-10","descanso":90},
      {"nome":"Supino Inclinado com Halteres","series":4,"reps":"10","descanso":75},
      {"nome":"Crossover na Polia","series":3,"reps":"12-15","descanso":60},
      {"nome":"Tríceps Testa","series":4,"reps":"10-12","descanso":60},
      {"nome":"Tríceps Corda na Polia","series":3,"reps":"12-15","descanso":45},
      {"nome":"Tríceps Francês","series":3,"reps":"12","descanso":45}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'ABCD · Treino B — Costas e Bíceps', 'Hipertrofia', 'Musculação', 5,
    '[
      {"nome":"Barra Fixa / Puxada Frontal","series":4,"reps":"8-10","descanso":90},
      {"nome":"Remada Curvada com Barra","series":4,"reps":"8-10","descanso":90},
      {"nome":"Remada Cavalinho","series":3,"reps":"10-12","descanso":75},
      {"nome":"Rosca Direta com Barra","series":4,"reps":"10-12","descanso":60},
      {"nome":"Rosca Scott","series":3,"reps":"12","descanso":45},
      {"nome":"Rosca Martelo","series":3,"reps":"12","descanso":45}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'ABCD · Treino C — Pernas e Panturrilha', 'Hipertrofia', 'Musculação', 6,
    '[
      {"nome":"Agachamento Livre","series":4,"reps":"8-10","descanso":120},
      {"nome":"Leg Press 45°","series":4,"reps":"10-12","descanso":90},
      {"nome":"Cadeira Extensora","series":4,"reps":"12-15","descanso":60},
      {"nome":"Mesa Flexora","series":4,"reps":"12","descanso":60},
      {"nome":"Stiff com Barra","series":3,"reps":"10-12","descanso":75},
      {"nome":"Panturrilha em Pé","series":4,"reps":"15-20","descanso":45}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'ABCD · Treino D — Ombros e Abdômen', 'Hipertrofia', 'Musculação', 7,
    '[
      {"nome":"Desenvolvimento Militar com Halteres","series":4,"reps":"8-10","descanso":90},
      {"nome":"Elevação Lateral","series":4,"reps":"12-15","descanso":45},
      {"nome":"Elevação Frontal","series":3,"reps":"12","descanso":45},
      {"nome":"Crucifixo Invertido (Posterior)","series":3,"reps":"12-15","descanso":45},
      {"nome":"Abdominal Supra","series":4,"reps":"20","descanso":30},
      {"nome":"Prancha Isométrica","series":3,"reps":"40s","descanso":30}
    ]'::jsonb);

  -- ===================== INICIANTE — FULL BODY (2-3x/semana) ==================
  perform public._add_treino_padrao(p_academia_id,
    'Full Body A — Corpo Inteiro (Iniciante)', 'Adaptação / Iniciante', 'Musculação', 8,
    '[
      {"nome":"Leg Press 45°","series":3,"reps":"12-15","descanso":60},
      {"nome":"Supino Reto (Máquina)","series":3,"reps":"12","descanso":60},
      {"nome":"Puxada Frontal na Polia","series":3,"reps":"12","descanso":60},
      {"nome":"Desenvolvimento na Máquina","series":3,"reps":"12","descanso":60},
      {"nome":"Cadeira Extensora","series":2,"reps":"15","descanso":45},
      {"nome":"Abdominal Supra","series":3,"reps":"15","descanso":30}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'Full Body B — Corpo Inteiro (Iniciante)', 'Adaptação / Iniciante', 'Musculação', 9,
    '[
      {"nome":"Agachamento no Smith","series":3,"reps":"12","descanso":60},
      {"nome":"Remada Baixa (Triângulo)","series":3,"reps":"12","descanso":60},
      {"nome":"Crucifixo na Máquina (Peck Deck)","series":3,"reps":"12","descanso":60},
      {"nome":"Elevação Lateral","series":3,"reps":"15","descanso":45},
      {"nome":"Mesa Flexora","series":2,"reps":"15","descanso":45},
      {"nome":"Prancha Isométrica","series":3,"reps":"30s","descanso":30}
    ]'::jsonb);

  -- ===================== FUNCIONAL / CARDIO ==================================
  perform public._add_treino_padrao(p_academia_id,
    'Funcional HIIT — Queima de Gordura', 'Emagrecimento', 'Funcional', 10,
    '[
      {"nome":"Burpee","series":4,"reps":"12","descanso":30},
      {"nome":"Agachamento com Salto","series":4,"reps":"15","descanso":30},
      {"nome":"Mountain Climber","series":4,"reps":"30s","descanso":30},
      {"nome":"Polichinelo (Jumping Jack)","series":4,"reps":"40s","descanso":30},
      {"nome":"Prancha Isométrica","series":4,"reps":"40s","descanso":30},
      {"nome":"Abdominal Bicicleta","series":4,"reps":"20","descanso":30}
    ]'::jsonb);

  perform public._add_treino_padrao(p_academia_id,
    'Cardio Iniciante — Condicionamento', 'Condicionamento', 'Cardio', 11,
    '[
      {"nome":"Esteira (caminhada rápida/trote)","series":1,"reps":"20 min","descanso":0},
      {"nome":"Bicicleta Ergométrica","series":1,"reps":"15 min","descanso":60},
      {"nome":"Elíptico / Transport","series":1,"reps":"10 min","descanso":0},
      {"nome":"Abdominal Supra","series":3,"reps":"20","descanso":30}
    ]'::jsonb);
end;
$$;

-- Permite que o app (service role, usado na criação da academia) chame a função.
grant execute on function public._add_treino_padrao(uuid, text, text, text, int, jsonb) to service_role;
grant execute on function public.seed_treinos_padrao(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- BACKFILL: preenche todas as academias que já existem e ainda não têm
-- treinos-modelo. Roda uma vez; academias novas usam a função na criação.
-- ---------------------------------------------------------------------------
do $$
declare
  a record;
begin
  for a in select id from public.academias loop
    perform public.seed_treinos_padrao(a.id);
  end loop;
end;
$$;
