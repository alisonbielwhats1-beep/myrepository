-- =============================================================================
-- Migration 019 — Imagens de demonstração nos treinos-modelo padrão.
--
-- A migration 018 criou os treinos-modelo sem imagem. Aqui:
--   1. img_exercicio_padrao(nome) — devolve a URL de imagem de cada exercício
--      (banco público free-exercise-db, as mesmas já usadas no catálogo).
--   2. Recria _add_treino_padrao para já gravar a imagem (academias novas).
--   3. Backfill: preenche a imagem dos treinos-modelo já existentes.
--
-- Só usa URLs comprovadamente válidas (já presentes no catálogo de exercícios).
-- Exercícios sem imagem garantida ficam sem foto — melhor do que link quebrado.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.img_exercicio_padrao(p_nome text)
returns text
language sql
immutable
as $$
  select case
    when m.folder is null then null
    else 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
         || m.folder || '/0.jpg'
  end
  from (
    select case p_nome
      when 'Supino Reto com Barra'                then 'Barbell_Bench_Press_-_Medium_Grip'
      when 'Supino Reto (Máquina)'                then 'Barbell_Bench_Press_-_Medium_Grip'
      when 'Supino Inclinado com Halteres'        then 'Incline_Dumbbell_Press'
      when 'Crucifixo na Máquina (Peck Deck)'     then 'Butterfly'
      when 'Crossover na Polia'                   then 'Cable_Crossover'
      when 'Puxada Frontal na Polia'              then 'Wide-Grip_Lat_Pulldown'
      when 'Barra Fixa / Puxada Frontal'          then 'Wide-Grip_Lat_Pulldown'
      when 'Remada Curvada com Barra'             then 'Bent_Over_Barbell_Row'
      when 'Remada Cavalinho'                     then 'Bent_Over_Barbell_Row'
      when 'Remada Baixa (Triângulo)'             then 'Seated_Cable_Rows'
      when 'Pulldown / Puxada Neutra'             then 'Close-Grip_Front_Lat_Pulldown'
      when 'Stiff com Barra'                      then 'Barbell_Deadlift'
      when 'Rosca Direta com Barra'               then 'Barbell_Curl'
      when 'Rosca Alternada com Halteres'         then 'Dumbbell_Alternate_Bicep_Curl'
      when 'Rosca Martelo'                        then 'Hammer_Curls'
      when 'Rosca Scott'                          then 'Preacher_Curl'
      when 'Tríceps Corda na Polia'               then 'Triceps_Pushdown_-_Rope_Attachment'
      when 'Tríceps Francês'                      then 'Standing_Overhead_Barbell_Triceps_Extension'
      when 'Tríceps Testa'                        then 'Lying_Triceps_Press'
      when 'Agachamento Livre'                    then 'Barbell_Squat'
      when 'Agachamento no Smith'                 then 'Barbell_Squat'
      when 'Leg Press 45°'                        then 'Leg_Press'
      when 'Cadeira Extensora'                    then 'Leg_Extensions'
      when 'Mesa Flexora'                         then 'Seated_Leg_Curl'
      when 'Cadeira Adutora'                      then 'Thigh_Abductor'
      when 'Desenvolvimento Militar com Halteres' then 'Dumbbell_Shoulder_Press'
      when 'Desenvolvimento na Máquina'           then 'Dumbbell_Shoulder_Press'
      when 'Elevação Lateral'                     then 'Side_Lateral_Raise'
      when 'Elevação Frontal'                     then 'Front_Dumbbell_Raise'
      when 'Abdominal Supra'                      then 'Crunches'
      when 'Prancha Isométrica'                   then 'Plank'
      when 'Panturrilha em Pé'                    then 'Standing_Calf_Raises'
      else null
    end as folder
  ) m;
$$;

-- Recria o helper: agora grava a imagem de cada exercício.
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
    (treino_id, nome_exercicio, series, repeticoes, descanso_segundos,
     imagem_demonstracao_url, ordem)
  select
    v_treino_id,
    e->>'nome',
    coalesce((e->>'series')::int, 3),
    coalesce(e->>'reps', '12'),
    coalesce((e->>'descanso')::int, 60),
    public.img_exercicio_padrao(e->>'nome'),
    ord::int
  from jsonb_array_elements(p_exercicios) with ordinality as t(e, ord);
end;
$$;

grant execute on function public.img_exercicio_padrao(text) to service_role;
grant execute on function public._add_treino_padrao(uuid, text, text, text, int, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- BACKFILL: preenche a imagem dos exercícios dos treinos-modelo já criados
-- (apenas onde ainda está sem imagem, para não sobrescrever ajustes do dono).
-- ---------------------------------------------------------------------------
update public.exercicios_treino et
   set imagem_demonstracao_url = public.img_exercicio_padrao(et.nome_exercicio)
  from public.treinos t
 where t.id = et.treino_id
   and t.aluno_id is null
   and et.imagem_demonstracao_url is null
   and public.img_exercicio_padrao(et.nome_exercicio) is not null;
