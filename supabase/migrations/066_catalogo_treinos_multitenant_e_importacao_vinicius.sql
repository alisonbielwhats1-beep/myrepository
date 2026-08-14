-- =============================================================================
-- Migração 066 — Catálogo flexível de treinos por academia/profissional
--                  + importação idempotente da planilha TREINO VINICIUS.xlsx
--
-- Regras de segurança:
--   • conteúdo personalizado sempre pertence à academia da sessão;
--   • catálogo global existente continua somente leitura;
--   • instrutor edita o que criou; dono/gerente administram o catálogo local;
--   • a importação aborta se Geração Saúde ou Vinicius forem ambíguos/ausentes;
--   • codigo_importacao impede duplicidade ao reaplicar a migração.
-- =============================================================================

-- Metadados do modelo de treino. Campos de classificação são texto livre para
-- aceitar metodologias diferentes sem criar enum/migração para cada profissional.
alter table public.treinos
  add column if not exists criado_por uuid references public.perfis_admin(id) on delete set null,
  add column if not exists profissional_nome text,
  add column if not exists nivel text,
  add column if not exists publico_alvo text,
  add column if not exists origem text not null default 'manual',
  add column if not exists codigo_importacao text,
  add column if not exists metadados jsonb not null default '{}'::jsonb;

create index if not exists idx_treinos_criado_por
  on public.treinos(criado_por) where criado_por is not null;

create unique index if not exists uidx_treinos_importacao_tenant
  on public.treinos(academia_id, codigo_importacao)
  where codigo_importacao is not null;

-- Protocolo extensível: tempo, distância, cadência, método, RPE/RIR e campos de
-- sistemas futuros podem entrar no JSON sem perder os campos básicos atuais.
alter table public.exercicios_treino
  add column if not exists configuracao jsonb not null default '{}'::jsonb;

-- O catálogo passa a ter duas camadas: sistema (academia_id null) e academia.
alter table public.catalogo_exercicios
  add column if not exists academia_id uuid references public.academias(id) on delete cascade,
  add column if not exists criado_por uuid references public.perfis_admin(id) on delete set null,
  add column if not exists visibilidade text not null default 'sistema',
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists metadados jsonb not null default '{}'::jsonb;

update public.catalogo_exercicios
set visibilidade = 'sistema'
where academia_id is null and visibilidade is distinct from 'sistema';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalogo_visibilidade_valida'
      and conrelid = 'public.catalogo_exercicios'::regclass
  ) then
    alter table public.catalogo_exercicios
      add constraint catalogo_visibilidade_valida
      check (
        (academia_id is null and visibilidade = 'sistema')
        or
        (academia_id is not null and visibilidade = 'academia')
      );
  end if;
end$$;

create index if not exists idx_catalogo_academia
  on public.catalogo_exercicios(academia_id) where academia_id is not null;
create index if not exists idx_catalogo_criado_por
  on public.catalogo_exercicios(criado_por) where criado_por is not null;
create unique index if not exists uidx_catalogo_academia_nome
  on public.catalogo_exercicios(academia_id, lower(nome))
  where academia_id is not null;

alter table public.catalogo_exercicios enable row level security;

drop policy if exists "catalogo_leitura_autenticados" on public.catalogo_exercicios;
drop policy if exists "catalogo_leitura_sistema_e_tenant" on public.catalogo_exercicios;
create policy "catalogo_leitura_sistema_e_tenant" on public.catalogo_exercicios
  for select to authenticated
  using (academia_id is null or academia_id = public.academia_id_atual());

drop policy if exists "catalogo_inserir_tenant" on public.catalogo_exercicios;
create policy "catalogo_inserir_tenant" on public.catalogo_exercicios
  for insert to authenticated
  with check (
    academia_id = public.academia_id_atual()
    and criado_por = auth.uid()
    and visibilidade = 'academia'
    and public.papel_do_usuario_atual() in ('dono', 'gerente', 'instrutor')
  );

drop policy if exists "catalogo_atualizar_tenant" on public.catalogo_exercicios;
create policy "catalogo_atualizar_tenant" on public.catalogo_exercicios
  for update to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  )
  with check (
    academia_id = public.academia_id_atual()
    and visibilidade = 'academia'
    and (
      criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  );

drop policy if exists "catalogo_excluir_tenant" on public.catalogo_exercicios;
create policy "catalogo_excluir_tenant" on public.catalogo_exercicios
  for delete to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      criado_por = auth.uid()
      or public.papel_do_usuario_atual() in ('dono', 'gerente')
    )
  );

-- ----------------------------------------------------------------------------
-- Importação da planilha. O JSON é mantido em
-- data/importacoes/geracao-saude/treino-vinicius.json para auditoria.
-- ----------------------------------------------------------------------------
do $importacao$
declare
  v_payload jsonb := $json$
{"academia":"Geração Saúde","profissional":"Vinicius","origem":"TREINO VINICIUS.xlsx","templates":[{"codigo":"vinicius-intermediario-mulheres-a","nome":"Intermediário Mulheres · Treino A","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Adutor","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Adutor","grupo_muscular":"perna"},{"nome":"Cadeira Extensora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Cadeira Extensora","grupo_muscular":"perna"},{"nome":"Leg Press","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg Press","grupo_muscular":"perna"},{"nome":"Hack","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Hack","grupo_muscular":"perna"},{"nome":"Afundo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Afundo","grupo_muscular":"perna"},{"nome":"Panturrilha em Pé","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos Em Pe","grupo_muscular":"panturrilha"},{"nome":"Panturrilha na Cadeira","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos Cadeira","grupo_muscular":"panturrilha"}]},{"codigo":"vinicius-intermediario-mulheres-b","nome":"Intermediário Mulheres · Treino B","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Supino Reto","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Reto","grupo_muscular":"peito"},{"nome":"Supino Inclinado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Inclinado","grupo_muscular":"peito"},{"nome":"Peck Deck","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Peck Deck","grupo_muscular":"peito"},{"nome":"Supino Sentado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Sentado","grupo_muscular":"peito"},{"nome":"Tríceps Pulley","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Pulley","grupo_muscular":"triceps"},{"nome":"Tríceps Corda","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Corda","grupo_muscular":"triceps"},{"nome":"Tríceps Testa com Halteres","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Testa Com Halteres","grupo_muscular":"triceps"},{"nome":"Elevação Lateral","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Elevação Lateral","grupo_muscular":"ombro"}]},{"codigo":"vinicius-intermediario-mulheres-c","nome":"Intermediário Mulheres · Treino C","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Mesa Flexora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Mesa Flexora","grupo_muscular":"perna"},{"nome":"Cadeira Flexora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Cadeira Flexora","grupo_muscular":"perna"},{"nome":"Leg Press 90°","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg 90","grupo_muscular":"perna"},{"nome":"Cadeira Abdutora","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Abdutor","grupo_muscular":"gluteos"},{"nome":"Agachamento Sumô","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Agachamento Sumo","grupo_muscular":"perna"},{"nome":"Glúteo no Solo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Gluteo Solo","grupo_muscular":"gluteos"},{"nome":"Elevação Pélvica","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Elevação Pelvica","grupo_muscular":"gluteos"},{"nome":"Abdominal no Solo","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Abdomen Solo","grupo_muscular":"abdomen"}]},{"codigo":"vinicius-intermediario-mulheres-d","nome":"Intermediário Mulheres · Treino D","nivel":"Intermediário","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Pulley Frente Aberto","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Aberto","grupo_muscular":"costas"},{"nome":"Pulley Frente Fechado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Fechado","grupo_muscular":"costas"},{"nome":"Remada Sentado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Sentado","grupo_muscular":"costas"},{"nome":"Remada Unilateral","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Unilateral","grupo_muscular":"costas"},{"nome":"Hiperextensão Lombar","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Hiperextensão Lombar","grupo_muscular":"costas"},{"nome":"Rosca Cross","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Cross","grupo_muscular":"biceps"},{"nome":"Rosca Alternada","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Alternada","grupo_muscular":"biceps"},{"nome":"Rosca Scott com Halteres","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Scott Com Halt","grupo_muscular":"biceps"}]},{"codigo":"vinicius-avancado-mulheres-a","nome":"Avançado Mulheres · Treino A","nivel":"Avançado","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Adutor","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Adutor","grupo_muscular":"perna"},{"nome":"Agachamento Smith","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Agachamento Smith","grupo_muscular":"perna"},{"nome":"Cadeira Extensora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Cadeira Extensora","grupo_muscular":"perna"},{"nome":"Leg Press","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg Press","grupo_muscular":"perna"},{"nome":"Avanço","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Avanço","grupo_muscular":"perna"},{"nome":"Panturrilha em Pé","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos Em Pe","grupo_muscular":"panturrilha"},{"nome":"Panturrilha no Leg Press","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos No Leg","grupo_muscular":"panturrilha"}]},{"codigo":"vinicius-avancado-mulheres-b","nome":"Avançado Mulheres · Treino B","nivel":"Avançado","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Supino Reto com Halteres","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Reto Com Halte","grupo_muscular":"peito"},{"nome":"Supino Inclinado Smith","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Inclinado Smith","grupo_muscular":"peito"},{"nome":"Peck Deck","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Peck Deck","grupo_muscular":"peito"},{"nome":"Pullover","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pull Over","grupo_muscular":"peito"},{"nome":"Tríceps Testa no Cabo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Testa Cabo","grupo_muscular":"triceps"},{"nome":"Tríceps Pulley","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Pulley","grupo_muscular":"triceps"},{"nome":"Tríceps Supinado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Supinado","grupo_muscular":"triceps"},{"nome":"Série de Abdominais","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Series Abdomen","grupo_muscular":"abdomen"}]},{"codigo":"vinicius-avancado-mulheres-c","nome":"Avançado Mulheres · Treino C","nivel":"Avançado","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Mesa Flexora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Mesa Flexora","grupo_muscular":"perna"},{"nome":"Stiff","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Stiff","grupo_muscular":"perna"},{"nome":"Leg Press 90°","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg 90","grupo_muscular":"perna"},{"nome":"Agachamento Búlgaro","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Bulgaro","grupo_muscular":"perna"},{"nome":"Abdução no Cabo","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Abdutor Cabo","grupo_muscular":"gluteos"},{"nome":"Elevação Pélvica","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Elevação Pelvica","grupo_muscular":"gluteos"},{"nome":"Glúteo no Cabo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Gluteo Cabo","grupo_muscular":"gluteos"},{"nome":"Panturrilha na Cadeira","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Gemeos Cadeira","grupo_muscular":"panturrilha"}]},{"codigo":"vinicius-avancado-mulheres-d","nome":"Avançado Mulheres · Treino D","nivel":"Avançado","publico_alvo":"Mulheres","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Pulley Frente Articulado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Ariculad","grupo_muscular":"costas"},{"nome":"Remada Curvada no Cabo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Curvada Cabo","grupo_muscular":"costas"},{"nome":"Pulldown","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pull Down","grupo_muscular":"costas"},{"nome":"Pulley Frente Fechado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Fechado","grupo_muscular":"costas"},{"nome":"Rosca Direta Barra","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Direta Barra","grupo_muscular":"biceps"},{"nome":"Rosca Martelo no Cabo","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Martelo Cabo","grupo_muscular":"biceps"},{"nome":"Rosca 21","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca 21","grupo_muscular":"biceps"},{"nome":"Série de Abdominais","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Series De Abdomen","grupo_muscular":"abdomen"}]},{"codigo":"vinicius-intermediario-homens-a","nome":"Intermediário Homens · Treino A","nivel":"Intermediário","publico_alvo":"Homens","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Supino Reto","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Reto","grupo_muscular":"peito"},{"nome":"Supino Inclinado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Inclinado","grupo_muscular":"peito"},{"nome":"Peck Deck","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Peck Deck","grupo_muscular":"peito"},{"nome":"Supino Sentado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Supino Sentado","grupo_muscular":"peito"},{"nome":"Tríceps Pulley","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Pulley","grupo_muscular":"triceps"},{"nome":"Tríceps Corda","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Triceps Corda","grupo_muscular":"triceps"},{"nome":"Tríceps Francês","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Frances","grupo_muscular":"triceps"},{"nome":"Panturrilha em Pé","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos Em Pe","grupo_muscular":"panturrilha"}]},{"codigo":"vinicius-intermediario-homens-b","nome":"Intermediário Homens · Treino B","nivel":"Intermediário","publico_alvo":"Homens","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Pulley Frente Aberto","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Aberto","grupo_muscular":"costas"},{"nome":"Pulley Frente Fechado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Pulley Frente Fechado","grupo_muscular":"costas"},{"nome":"Remada Sentado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Sentado","grupo_muscular":"costas"},{"nome":"Remada Unilateral","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Unilateral","grupo_muscular":"costas"},{"nome":"Hiperextensão Lombar","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Hiperextensão Lombar","grupo_muscular":"costas"},{"nome":"Rosca Cross","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Cross","grupo_muscular":"biceps"},{"nome":"Rosca Alternada","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Alternada","grupo_muscular":"biceps"},{"nome":"Rosca Scott","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Rosca Scott","grupo_muscular":"biceps"}]},{"codigo":"vinicius-intermediario-homens-c","nome":"Intermediário Homens · Treino C","nivel":"Intermediário","publico_alvo":"Homens","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Adutor","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Adutor","grupo_muscular":"perna"},{"nome":"Cadeira Abdutora","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Abdutor","grupo_muscular":"gluteos"},{"nome":"Mesa Flexora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Mesa Flexora","grupo_muscular":"perna"},{"nome":"Cadeira Flexora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Cadeira Flexora","grupo_muscular":"perna"},{"nome":"Leg Press 90°","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg 90","grupo_muscular":"perna"},{"nome":"Cadeira Extensora","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Cadeira Extensora","grupo_muscular":"perna"},{"nome":"Leg Press","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Leg Press","grupo_muscular":"perna"},{"nome":"Hack","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Hack","grupo_muscular":"perna"}]},{"codigo":"vinicius-intermediario-homens-d","nome":"Intermediário Homens · Treino D","nivel":"Intermediário","publico_alvo":"Homens","modalidade":"Musculação","profissional":"Vinicius","exercicios":[{"nome":"Elevação Lateral","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Elevação Lateral","grupo_muscular":"ombro"},{"nome":"Elevação Frontal","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Elevação Frontal","grupo_muscular":"ombro"},{"nome":"Desenvolvimento Articulado","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Desenvolvimento Art","grupo_muscular":"ombro"},{"nome":"Desenvolvimento com Halteres","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Desenvolvimento Hal","grupo_muscular":"ombro"},{"nome":"Remada Alta","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Remada Alta","grupo_muscular":"ombro"},{"nome":"Encolhimento","series":4,"repeticoes":"10","descanso_segundos":60,"nome_original":"Encolhimento","grupo_muscular":"ombro"},{"nome":"Panturrilha em Pé","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Gemeos Em Pe","grupo_muscular":"panturrilha"},{"nome":"Série de Abdominais","series":3,"repeticoes":"20","descanso_segundos":60,"nome_original":"Series De Abdomen","grupo_muscular":"abdomen"}]}],"importado_em":"2026-08-14"}
  $json$::jsonb;
  v_academia_id uuid;
  v_profissional_id uuid;
  v_profissional_nome text;
  v_quantidade integer;
  v_template jsonb;
  v_exercicio jsonb;
  v_treino_id uuid;
  v_ordem_base integer;
begin
  -- O payload completo é preenchido abaixo por uma atualização gerada a partir
  -- do arquivo de auditoria; este marcador nunca deve chegar ao banco vazio.
  if jsonb_array_length(v_payload->'templates') = 0 then
    raise exception 'Payload da importação de Vinicius não foi incorporado à migração';
  end if;

  select count(*) into v_quantidade
  from public.academias a
  where regexp_replace(
    translate(lower(a.nome_fantasia), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '', 'g'
  ) = 'geracaosaude';

  if v_quantidade <> 1 then
    raise exception 'Importação cancelada: esperado 1 tenant Geração Saúde, encontrado %', v_quantidade;
  end if;

  select a.id into v_academia_id
  from public.academias a
  where regexp_replace(
    translate(lower(a.nome_fantasia), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '', 'g'
  ) = 'geracaosaude';

  select count(*) into v_quantidade
  from public.perfis_admin p
  where p.academia_id = v_academia_id
    and regexp_replace(
      translate(lower(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9]+', '', 'g'
    ) like '%vinicius%';

  if v_quantidade <> 1 then
    raise exception 'Importação cancelada: esperado 1 profissional Vinicius na Geração Saúde, encontrado %', v_quantidade;
  end if;

  select p.id, p.nome into v_profissional_id, v_profissional_nome
  from public.perfis_admin p
  where p.academia_id = v_academia_id
    and regexp_replace(
      translate(lower(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9]+', '', 'g'
    ) like '%vinicius%';

  -- Exercícios exclusivos da academia. Se já existirem, preserva mídia e apenas
  -- complementa aliases/metadados da origem.
  for v_exercicio in
    select distinct on (e->>'nome') e
    from jsonb_array_elements(v_payload->'templates') t
    cross join lateral jsonb_array_elements(t->'exercicios') e
    order by e->>'nome'
  loop
    insert into public.catalogo_exercicios (
      academia_id, criado_por, visibilidade, grupo_muscular, nome,
      series_padrao, repeticoes_padrao, ordem, aliases, metadados
    )
    values (
      v_academia_id,
      v_profissional_id,
      'academia',
      (v_exercicio->>'grupo_muscular')::public.grupo_muscular_enum,
      v_exercicio->>'nome',
      (v_exercicio->>'series')::integer,
      v_exercicio->>'repeticoes',
      0,
      case
        when v_exercicio->>'nome_original' is distinct from v_exercicio->>'nome'
          then array[v_exercicio->>'nome_original']
        else '{}'::text[]
      end,
      jsonb_build_object('origem', v_payload->>'origem', 'profissional', v_profissional_nome)
    )
    on conflict (academia_id, (lower(nome))) where academia_id is not null
    do update set
      aliases = coalesce((
        select array_agg(distinct valor)
        from unnest(public.catalogo_exercicios.aliases || excluded.aliases) valor
      ), '{}'::text[]),
      metadados = public.catalogo_exercicios.metadados || excluded.metadados;
  end loop;

  select coalesce(max(t.ordem), 0) into v_ordem_base
  from public.treinos t
  where t.academia_id = v_academia_id and t.aluno_id is null;

  for v_template in
    select value
    from jsonb_array_elements(v_payload->'templates')
  loop
    v_ordem_base := v_ordem_base + 1;

    insert into public.treinos (
      academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem,
      ativo, publico, criado_por, profissional_nome, nivel, publico_alvo,
      origem, codigo_importacao, metadados
    )
    values (
      v_academia_id,
      null,
      v_template->>'nome',
      concat('Musculação ', lower(v_template->>'nivel'), ' · ', v_template->>'publico_alvo'),
      v_template->>'modalidade',
      v_ordem_base,
      true,
      false,
      v_profissional_id,
      v_profissional_nome,
      v_template->>'nivel',
      v_template->>'publico_alvo',
      'planilha',
      v_template->>'codigo',
      jsonb_build_object('arquivo', v_payload->>'origem', 'importado_em', v_payload->>'importado_em')
    )
    on conflict (academia_id, codigo_importacao) where codigo_importacao is not null
    do update set
      nome_treino = excluded.nome_treino,
      objetivo = excluded.objetivo,
      modalidade = excluded.modalidade,
      criado_por = excluded.criado_por,
      profissional_nome = excluded.profissional_nome,
      nivel = excluded.nivel,
      publico_alvo = excluded.publico_alvo,
      origem = excluded.origem,
      metadados = excluded.metadados,
      atualizado_em = now()
    returning id into v_treino_id;

    delete from public.exercicios_treino where treino_id = v_treino_id;

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
      jsonb_build_object(
        'origem', v_payload->>'origem',
        'nome_original', e.value->>'nome_original',
        'grupo_muscular', e.value->>'grupo_muscular'
      )
    from jsonb_array_elements(v_template->'exercicios') with ordinality e(value, ordinality);
  end loop;
end
$importacao$;
