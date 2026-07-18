-- =============================================================================
-- Migração 003 — Melhorias
--   • Catálogo de exercícios por grupo muscular (montagem rápida de treino)
--   • Progresso do aluno (peso, medidas, fotos ao longo do tempo)
--   • Mini-site público da academia (planos + WhatsApp)
--
-- Idempotente: pode rodar de novo sem quebrar nada. Rode inteiro no SQL
-- Editor do Supabase depois de já ter rodado schema.sql (e a migração 002,
-- se você começou antes dela existir).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Grupo muscular (para o catálogo de exercícios)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'grupo_muscular_enum') then
    create type grupo_muscular_enum as enum (
      'peito', 'costas', 'perna', 'ombro', 'biceps', 'triceps',
      'abdomen', 'gluteos', 'panturrilha', 'cardio', 'outro'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2. Catálogo de exercícios — biblioteca GLOBAL (compartilhada por todas as
--    academias), usada para montar treinos com 1 clique por grupo muscular.
--    Não tem academia_id: é conteúdo de referência, não dado de tenant.
-- -----------------------------------------------------------------------------
create table if not exists public.catalogo_exercicios (
  id                       uuid                    primary key default gen_random_uuid(),
  grupo_muscular           grupo_muscular_enum     not null,
  nome                     text                    not null,
  series_padrao            integer                 not null default 3,
  repeticoes_padrao        text                    not null default '12',
  imagem_demonstracao_url  text,
  video_demonstracao_url   text,
  ordem                    integer                 not null default 0,
  criado_em                timestamptz             not null default now()
);

create index if not exists idx_catalogo_grupo on public.catalogo_exercicios(grupo_muscular);

alter table public.catalogo_exercicios enable row level security;

drop policy if exists "catalogo_leitura_autenticados" on public.catalogo_exercicios;
create policy "catalogo_leitura_autenticados" on public.catalogo_exercicios
  for select to authenticated using (true);

drop policy if exists "catalogo_service_role" on public.catalogo_exercicios;
create policy "catalogo_service_role" on public.catalogo_exercicios
  for all to service_role using (true) with check (true);

-- Seed (idempotente por nome+grupo). Fotos reais de
-- github.com/yuhonas/free-exercise-db (licença Unlicense/domínio público).
insert into public.catalogo_exercicios
  (grupo_muscular, nome, series_padrao, repeticoes_padrao, imagem_demonstracao_url, ordem)
select * from (values
  ('peito'::grupo_muscular_enum, 'Supino Reto com Barra', 4, '8-10', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg', 1),
  ('peito', 'Supino Inclinado Halteres', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg', 2),
  ('peito', 'Crucifixo na Máquina', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Butterfly/0.jpg', 3),
  ('peito', 'Flexão de Braço', 3, 'até a falha', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg', 4),
  ('peito', 'Crossover no Cabo', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg', 5),
  ('costas', 'Puxada Frontal', 4, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg', 1),
  ('costas', 'Remada Curvada', 4, '8-10', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg', 2),
  ('costas', 'Remada Baixa (Cabo)', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg', 3),
  ('costas', 'Puxada Supinada', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg', 4),
  ('costas', 'Levantamento Terra', 3, '6-8', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg', 5),
  ('biceps', 'Rosca Direta Barra', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg', 1),
  ('biceps', 'Rosca Alternada', 3, '12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Alternate_Bicep_Curl/0.jpg', 2),
  ('biceps', 'Rosca Scott', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Preacher_Curl/0.jpg', 3),
  ('biceps', 'Rosca Martelo', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg', 4),
  ('triceps', 'Tríceps Corda', 4, '12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg', 1),
  ('triceps', 'Tríceps Francês', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Overhead_Barbell_Triceps_Extension/0.jpg', 2),
  ('triceps', 'Tríceps Testa', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Triceps_Press/0.jpg', 3),
  ('triceps', 'Mergulho no Banco', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Dips/0.jpg', 4),
  ('perna', 'Agachamento Livre', 4, '8-10', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg', 1),
  ('perna', 'Leg Press 45°', 4, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg', 2),
  ('perna', 'Cadeira Extensora', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg', 3),
  ('perna', 'Cadeira Flexora', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg', 4),
  ('perna', 'Afundo (Passada)', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Walking_Lunge/0.jpg', 5),
  ('ombro', 'Desenvolvimento com Halteres', 4, '8-10', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg', 1),
  ('ombro', 'Elevação Lateral', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg', 2),
  ('ombro', 'Elevação Frontal', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Dumbbell_Raise/0.jpg', 3),
  ('ombro', 'Remada Alta', 3, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Upright_Barbell_Row/0.jpg', 4),
  ('abdomen', 'Abdominal Supra', 3, '15-20', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg', 1),
  ('abdomen', 'Prancha', 3, '30-60s', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg', 2),
  ('abdomen', 'Elevação de Pernas', 3, '15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg', 3),
  ('gluteos', 'Elevação Pélvica', 4, '10-12', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg', 1),
  ('gluteos', 'Cadeira Abdutora', 3, '12-15', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Thigh_Abductor/0.jpg', 2),
  ('panturrilha', 'Panturrilha em Pé', 4, '15-20', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg', 1),
  ('cardio', 'Esteira', 1, '20-30 min', null, 1),
  ('cardio', 'Bicicleta Ergométrica', 1, '20-30 min', null, 2)
) as v(grupo_muscular, nome, series_padrao, repeticoes_padrao, imagem_demonstracao_url, ordem)
where not exists (
  select 1 from public.catalogo_exercicios c
  where c.grupo_muscular = v.grupo_muscular and c.nome = v.nome
);

-- -----------------------------------------------------------------------------
-- 3. Progresso do aluno — peso, medidas e fotos ao longo do tempo.
-- -----------------------------------------------------------------------------
create table if not exists public.progresso_aluno (
  id                  uuid          primary key default gen_random_uuid(),
  academia_id         uuid          not null references public.academias(id) on delete cascade,
  aluno_id            uuid          not null references public.alunos(id)    on delete cascade,
  data                date          not null default current_date,
  peso_kg             numeric(5,2),
  percentual_gordura  numeric(4,1),
  peito_cm            numeric(5,1),
  cintura_cm          numeric(5,1),
  quadril_cm          numeric(5,1),
  braco_cm            numeric(5,1),
  coxa_cm             numeric(5,1),
  foto_url            text,
  observacoes         text,          -- nota interna do professor (não exposta na RPC pública)
  criado_em           timestamptz   not null default now()
);

create index if not exists idx_progresso_academia on public.progresso_aluno(academia_id);
create index if not exists idx_progresso_aluno     on public.progresso_aluno(aluno_id);
create index if not exists idx_progresso_data       on public.progresso_aluno(data);

alter table public.progresso_aluno enable row level security;

drop policy if exists "tenant_select_progresso_aluno" on public.progresso_aluno;
create policy "tenant_select_progresso_aluno" on public.progresso_aluno
  for select to authenticated using (academia_id = public.academia_id_atual());

drop policy if exists "tenant_insert_progresso_aluno" on public.progresso_aluno;
create policy "tenant_insert_progresso_aluno" on public.progresso_aluno
  for insert to authenticated with check (academia_id = public.academia_id_atual());

drop policy if exists "tenant_update_progresso_aluno" on public.progresso_aluno;
create policy "tenant_update_progresso_aluno" on public.progresso_aluno
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

drop policy if exists "tenant_delete_progresso_aluno" on public.progresso_aluno;
create policy "tenant_delete_progresso_aluno" on public.progresso_aluno
  for delete to authenticated using (academia_id = public.academia_id_atual());

drop policy if exists "service_role_total_progresso_aluno" on public.progresso_aluno;
create policy "service_role_total_progresso_aluno" on public.progresso_aluno
  for all to service_role using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 4. Mini-site público: WhatsApp da academia.
-- -----------------------------------------------------------------------------
alter table public.academias add column if not exists whatsapp text;

-- -----------------------------------------------------------------------------
-- 5. RPCs públicas atualizadas/novas
-- -----------------------------------------------------------------------------

-- 5.1 obter_ficha_aluno agora também traz o histórico de progresso (sem a
--     coluna `observacoes`, que é nota interna do professor).
create or replace function public.obter_ficha_aluno(p_aluno_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'aluno', (
      select jsonb_build_object(
        'id', a.id,
        'nome', a.nome,
        'foto_perfil_url', a.foto_perfil_url,
        'status_matricula', a.status_matricula,
        'matricula_codigo', a.matricula_codigo,
        'plano_nome', p.nome
      )
      from public.alunos a
      left join public.planos p on p.id = a.plano_id
      where a.id = p_aluno_id
    ),
    'academia', (
      select jsonb_build_object(
        'id', ac.id,
        'nome_fantasia', ac.nome_fantasia,
        'slug_url', ac.slug_url
      )
      from public.academias ac
      join public.alunos a on a.academia_id = ac.id
      where a.id = p_aluno_id
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
      where t.aluno_id = p_aluno_id and t.ativo = true
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
      where pr.aluno_id = p_aluno_id
    ), '[]'::jsonb)
  )
  where exists (select 1 from public.alunos where id = p_aluno_id);
$$;

grant execute on function public.obter_ficha_aluno(uuid) to anon, authenticated;

-- 5.2 obter_academia_publica agora inclui whatsapp e endereço (mini-site).
create or replace function public.obter_academia_publica(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', id,
    'nome_fantasia', nome_fantasia,
    'slug_url', slug_url,
    'cor_primaria', cor_primaria,
    'logo_url', logo_url,
    'endereco', endereco,
    'whatsapp', whatsapp
  )
  from public.academias where slug_url = p_slug;
$$;

grant execute on function public.obter_academia_publica(text) to anon, authenticated;

-- 5.3 Planos públicos (mini-site) — só os campos comerciais, sem dado interno.
create or replace function public.obter_planos_publicos(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pl.id,
    'nome', pl.nome,
    'descricao', pl.descricao,
    'valor_mensal', pl.valor_mensal,
    'recorrencia_meses', pl.recorrencia_meses
  ) order by pl.valor_mensal), '[]'::jsonb)
  from public.planos pl
  join public.academias ac on ac.id = pl.academia_id
  where ac.slug_url = p_slug and pl.ativo = true;
$$;

grant execute on function public.obter_planos_publicos(text) to anon, authenticated;

-- =============================================================================
-- Fim da migração 003.
-- =============================================================================
