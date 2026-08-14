-- =============================================================================
-- Migração 069 — Biblioteca padrão GestAcad (treinos-modelo de plataforma)
--
-- Semeia treinos-modelo no nível PLATAFORMA (academia_id NULL,
-- visibilidade='plataforma'), visíveis para todas as academias na aba
-- "Padrão GestAcad". Cada academia usa/duplica; ninguém do tenant edita o
-- original (gerenciado só por migração/service_role).
--
-- Pré-requisito estrutural: hoje treinos.academia_id é NOT NULL, o que impedia
-- qualquer treino de plataforma. Liberamos o NULL só para este caso e travamos
-- com um CHECK de coerência (NULL só é permitido para modelo de plataforma).
--
-- Mídia: os exercícios entram SEM vídeo/imagem — a fonte de vídeos curtos
-- licenciada será definida e anexada numa migração posterior (a pedido do
-- cliente, nada de URL sem licença confirmada).
--
-- Idempotente: remove os modelos 'gestacad-%' de plataforma e recria.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permitir treino de plataforma (academia_id NULL) com integridade.
-- ----------------------------------------------------------------------------
alter table public.treinos alter column academia_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'treinos_plataforma_coerente'
      and conrelid = 'public.treinos'::regclass
  ) then
    alter table public.treinos
      add constraint treinos_plataforma_coerente check (
        academia_id is not null
        or (visibilidade = 'plataforma' and aluno_id is null)
      );
  end if;
end$$;

create unique index if not exists uidx_treinos_plataforma_codigo
  on public.treinos(codigo_importacao)
  where academia_id is null and codigo_importacao is not null;

-- ----------------------------------------------------------------------------
-- 2. Semear a biblioteca padrão.
-- ----------------------------------------------------------------------------
do $seed$
declare
  v_payload jsonb := $json$
{
  "templates": [
    {"codigo":"gestacad-adaptacao-fullbody","nome":"Adaptação — Full Body","nivel":"Iniciante","publico_alvo":"Iniciantes","modalidade":"Musculação","objetivo":"Adaptação","exercicios":[
      {"nome":"Leg Press 45°","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Cadeira Extensora","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Mesa Flexora","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Supino Máquina","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"peito"},
      {"nome":"Puxada Frontal","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Desenvolvimento Máquina","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"ombro"},
      {"nome":"Abdominal Supra","series":3,"repeticoes":"20","descanso_segundos":45,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-iniciante-ab-a","nome":"Iniciante AB · Treino A (Superiores)","nivel":"Iniciante","publico_alvo":"Iniciantes","modalidade":"Musculação","objetivo":"Condicionamento","exercicios":[
      {"nome":"Supino Reto Máquina","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"peito"},
      {"nome":"Puxada Frontal","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Remada Sentada","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Desenvolvimento com Halteres","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"ombro"},
      {"nome":"Rosca Direta","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"biceps"},
      {"nome":"Tríceps Corda","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"triceps"}
    ]},
    {"codigo":"gestacad-iniciante-ab-b","nome":"Iniciante AB · Treino B (Inferiores)","nivel":"Iniciante","publico_alvo":"Iniciantes","modalidade":"Musculação","objetivo":"Condicionamento","exercicios":[
      {"nome":"Agachamento Livre","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Leg Press 45°","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Cadeira Extensora","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Mesa Flexora","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Cadeira Adutora","series":3,"repeticoes":"15","descanso_segundos":45,"grupo":"perna"},
      {"nome":"Panturrilha em Pé","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"panturrilha"},
      {"nome":"Abdominal Infra","series":3,"repeticoes":"20","descanso_segundos":45,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-hipertrofia-abc-a","nome":"Hipertrofia ABC · Treino A (Peito, Ombro e Tríceps)","nivel":"Intermediário","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Supino Reto com Barra","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"peito"},
      {"nome":"Supino Inclinado com Halteres","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"peito"},
      {"nome":"Crucifixo na Máquina","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"peito"},
      {"nome":"Desenvolvimento com Halteres","series":4,"repeticoes":"10","descanso_segundos":60,"grupo":"ombro"},
      {"nome":"Elevação Lateral","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"ombro"},
      {"nome":"Tríceps Testa","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"triceps"},
      {"nome":"Tríceps Corda","series":3,"repeticoes":"15","descanso_segundos":45,"grupo":"triceps"}
    ]},
    {"codigo":"gestacad-hipertrofia-abc-b","nome":"Hipertrofia ABC · Treino B (Costas e Bíceps)","nivel":"Intermediário","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Puxada Frontal","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"costas"},
      {"nome":"Remada Curvada","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"costas"},
      {"nome":"Remada Baixa","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Pulldown","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Rosca Direta com Barra","series":4,"repeticoes":"10","descanso_segundos":45,"grupo":"biceps"},
      {"nome":"Rosca Alternada","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"biceps"},
      {"nome":"Rosca Martelo","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"biceps"}
    ]},
    {"codigo":"gestacad-hipertrofia-abc-c","nome":"Hipertrofia ABC · Treino C (Pernas e Abdômen)","nivel":"Intermediário","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Agachamento Livre","series":4,"repeticoes":"10","descanso_segundos":90,"grupo":"perna"},
      {"nome":"Leg Press 45°","series":4,"repeticoes":"12","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Cadeira Extensora","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Mesa Flexora","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Stiff","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Panturrilha em Pé","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"panturrilha"},
      {"nome":"Abdominal Supra","series":3,"repeticoes":"20","descanso_segundos":45,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-avancado-abcd-a","nome":"Avançado ABCD · Treino A (Peito e Tríceps)","nivel":"Avançado","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Supino Reto com Barra","series":4,"repeticoes":"8","descanso_segundos":90,"grupo":"peito"},
      {"nome":"Supino Inclinado com Barra","series":4,"repeticoes":"8","descanso_segundos":90,"grupo":"peito"},
      {"nome":"Crucifixo com Halteres","series":3,"repeticoes":"10","descanso_segundos":60,"grupo":"peito"},
      {"nome":"Crossover","series":3,"repeticoes":"12","descanso_segundos":60,"grupo":"peito"},
      {"nome":"Tríceps Testa","series":4,"repeticoes":"10","descanso_segundos":45,"grupo":"triceps"},
      {"nome":"Tríceps Pulley","series":4,"repeticoes":"12","descanso_segundos":45,"grupo":"triceps"},
      {"nome":"Mergulho no Banco","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"triceps"}
    ]},
    {"codigo":"gestacad-avancado-abcd-b","nome":"Avançado ABCD · Treino B (Costas e Bíceps)","nivel":"Avançado","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Barra Fixa","series":4,"repeticoes":"8","descanso_segundos":90,"grupo":"costas"},
      {"nome":"Puxada Frontal","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"costas"},
      {"nome":"Remada Curvada com Barra","series":4,"repeticoes":"8","descanso_segundos":90,"grupo":"costas"},
      {"nome":"Remada Unilateral","series":3,"repeticoes":"10","descanso_segundos":60,"grupo":"costas"},
      {"nome":"Rosca Direta com Barra","series":4,"repeticoes":"10","descanso_segundos":45,"grupo":"biceps"},
      {"nome":"Rosca Scott","series":3,"repeticoes":"10","descanso_segundos":45,"grupo":"biceps"},
      {"nome":"Rosca Martelo","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"biceps"}
    ]},
    {"codigo":"gestacad-avancado-abcd-c","nome":"Avançado ABCD · Treino C (Pernas)","nivel":"Avançado","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Agachamento Livre","series":4,"repeticoes":"8","descanso_segundos":120,"grupo":"perna"},
      {"nome":"Leg Press 45°","series":4,"repeticoes":"10","descanso_segundos":90,"grupo":"perna"},
      {"nome":"Hack","series":4,"repeticoes":"10","descanso_segundos":90,"grupo":"perna"},
      {"nome":"Cadeira Extensora","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Mesa Flexora","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Stiff","series":4,"repeticoes":"10","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Panturrilha em Pé","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"panturrilha"}
    ]},
    {"codigo":"gestacad-avancado-abcd-d","nome":"Avançado ABCD · Treino D (Ombro e Abdômen)","nivel":"Avançado","publico_alvo":"Geral","modalidade":"Musculação","objetivo":"Hipertrofia","exercicios":[
      {"nome":"Desenvolvimento Militar","series":4,"repeticoes":"8","descanso_segundos":75,"grupo":"ombro"},
      {"nome":"Elevação Lateral","series":4,"repeticoes":"12","descanso_segundos":45,"grupo":"ombro"},
      {"nome":"Elevação Frontal","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"ombro"},
      {"nome":"Crucifixo Inverso","series":3,"repeticoes":"12","descanso_segundos":45,"grupo":"ombro"},
      {"nome":"Encolhimento","series":4,"repeticoes":"15","descanso_segundos":45,"grupo":"ombro"},
      {"nome":"Abdominal Supra","series":3,"repeticoes":"20","descanso_segundos":40,"grupo":"abdomen"},
      {"nome":"Prancha Isométrica","series":3,"repeticoes":"40s","descanso_segundos":40,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-gluteos-abc-a","nome":"Glúteos & Pernas · Treino A","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","objetivo":"Glúteos e pernas","exercicios":[
      {"nome":"Agachamento Sumô","series":4,"repeticoes":"12","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Leg Press 45°","series":4,"repeticoes":"15","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Cadeira Abdutora","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"gluteos"},
      {"nome":"Elevação Pélvica","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"gluteos"},
      {"nome":"Cadeira Extensora","series":3,"repeticoes":"15","descanso_segundos":45,"grupo":"perna"},
      {"nome":"Panturrilha em Pé","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"panturrilha"}
    ]},
    {"codigo":"gestacad-gluteos-abc-b","nome":"Glúteos & Pernas · Treino B","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","objetivo":"Glúteos e pernas","exercicios":[
      {"nome":"Stiff","series":4,"repeticoes":"12","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Mesa Flexora","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Cadeira Flexora","series":3,"repeticoes":"15","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Glúteo no Cabo","series":4,"repeticoes":"15","descanso_segundos":45,"grupo":"gluteos"},
      {"nome":"Abdução no Cabo","series":4,"repeticoes":"15","descanso_segundos":45,"grupo":"gluteos"},
      {"nome":"Abdominal Infra","series":3,"repeticoes":"20","descanso_segundos":40,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-gluteos-abc-c","nome":"Glúteos & Pernas · Treino C","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","objetivo":"Glúteos e pernas","exercicios":[
      {"nome":"Agachamento Búlgaro","series":4,"repeticoes":"12","descanso_segundos":75,"grupo":"perna"},
      {"nome":"Avanço","series":4,"repeticoes":"12","descanso_segundos":60,"grupo":"perna"},
      {"nome":"Elevação Pélvica","series":4,"repeticoes":"15","descanso_segundos":60,"grupo":"gluteos"},
      {"nome":"Cadeira Adutora","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"perna"},
      {"nome":"Panturrilha Sentado","series":4,"repeticoes":"20","descanso_segundos":45,"grupo":"panturrilha"},
      {"nome":"Prancha Isométrica","series":3,"repeticoes":"40s","descanso_segundos":40,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-emagrecimento-circuito","nome":"Emagrecimento — Circuito Metabólico","nivel":"Iniciante","publico_alvo":"Geral","modalidade":"Emagrecimento","objetivo":"Emagrecimento","exercicios":[
      {"nome":"Agachamento com Peso","series":3,"repeticoes":"15","descanso_segundos":30,"grupo":"perna"},
      {"nome":"Leg Press 45°","series":3,"repeticoes":"15","descanso_segundos":30,"grupo":"perna"},
      {"nome":"Supino Máquina","series":3,"repeticoes":"15","descanso_segundos":30,"grupo":"peito"},
      {"nome":"Puxada Frontal","series":3,"repeticoes":"15","descanso_segundos":30,"grupo":"costas"},
      {"nome":"Desenvolvimento Máquina","series":3,"repeticoes":"15","descanso_segundos":30,"grupo":"ombro"},
      {"nome":"Abdominal Supra","series":3,"repeticoes":"20","descanso_segundos":30,"grupo":"abdomen"},
      {"nome":"Polichinelo","series":3,"repeticoes":"30s","descanso_segundos":30,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-terceira-idade","nome":"3ª Idade — Mobilidade e Força","nivel":"Iniciante","publico_alvo":"Idosos","modalidade":"Funcional","objetivo":"Mobilidade e força","exercicios":[
      {"nome":"Leg Press 45° (leve)","series":2,"repeticoes":"15","descanso_segundos":90,"grupo":"perna"},
      {"nome":"Cadeira Extensora (leve)","series":2,"repeticoes":"15","descanso_segundos":90,"grupo":"perna"},
      {"nome":"Remada Sentada","series":2,"repeticoes":"15","descanso_segundos":90,"grupo":"costas"},
      {"nome":"Supino Máquina (leve)","series":2,"repeticoes":"15","descanso_segundos":90,"grupo":"peito"},
      {"nome":"Elevação Lateral (leve)","series":2,"repeticoes":"12","descanso_segundos":60,"grupo":"ombro"},
      {"nome":"Panturrilha em Pé","series":2,"repeticoes":"15","descanso_segundos":60,"grupo":"panturrilha"},
      {"nome":"Abdominal Supra","series":2,"repeticoes":"12","descanso_segundos":60,"grupo":"abdomen"}
    ]},
    {"codigo":"gestacad-funcional-hiit","nome":"Funcional / HIIT","nivel":"Intermediário","publico_alvo":"Geral","modalidade":"Funcional","objetivo":"Condicionamento","exercicios":[
      {"nome":"Burpee","series":4,"repeticoes":"30s","descanso_segundos":30,"grupo":"peito"},
      {"nome":"Agachamento com Salto","series":4,"repeticoes":"30s","descanso_segundos":30,"grupo":"perna"},
      {"nome":"Mountain Climber","series":4,"repeticoes":"30s","descanso_segundos":30,"grupo":"abdomen"},
      {"nome":"Prancha Isométrica","series":4,"repeticoes":"40s","descanso_segundos":30,"grupo":"abdomen"},
      {"nome":"Afundo Alternado","series":4,"repeticoes":"20","descanso_segundos":30,"grupo":"perna"},
      {"nome":"Polichinelo","series":4,"repeticoes":"40s","descanso_segundos":20,"grupo":"panturrilha"}
    ]}
  ],
  "importado_em":"2026-08-14"
}
$json$::jsonb;
  v_template jsonb;
  v_treino_id uuid;
  v_ordem integer := 0;
begin
  -- Idempotência: limpa a biblioteca padrão anterior (cascata apaga exercícios).
  delete from public.treinos
  where academia_id is null and codigo_importacao like 'gestacad-%';

  for v_template in
    select value from jsonb_array_elements(v_payload->'templates')
  loop
    v_ordem := v_ordem + 1;

    insert into public.treinos (
      academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem,
      ativo, publico, criado_por, profissional_nome, nivel, publico_alvo,
      origem, visibilidade, codigo_importacao, metadados
    )
    values (
      null,
      null,
      v_template->>'nome',
      v_template->>'objetivo',
      v_template->>'modalidade',
      v_ordem,
      true,
      false,
      null,
      'GestAcad',
      v_template->>'nivel',
      v_template->>'publico_alvo',
      'plataforma',
      'plataforma',
      v_template->>'codigo',
      jsonb_build_object('biblioteca', 'padrao-gestacad', 'importado_em', v_payload->>'importado_em')
    )
    returning id into v_treino_id;

    insert into public.exercicios_treino (
      treino_id, nome_exercicio, series, repeticoes, carga_kg,
      descanso_segundos, observacoes, ordem, configuracao
    )
    select
      v_treino_id,
      e.value->>'nome',
      (e.value->>'series')::integer,
      e.value->>'repeticoes',
      0,
      (e.value->>'descanso_segundos')::integer,
      null,
      e.ordinality::integer,
      jsonb_build_object('grupo_muscular', e.value->>'grupo', 'origem', 'padrao-gestacad')
    from jsonb_array_elements(v_template->'exercicios') with ordinality e(value, ordinality);
  end loop;
end
$seed$;
