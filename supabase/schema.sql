-- =============================================================================
-- GymFlow — Esquema completo do banco de dados (Supabase / PostgreSQL)
-- SaaS Multi-tenant para gestão de academias: alunos, planos, treinos,
-- exercícios e controle de catraca (acessos).
--
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Ordem: extensões -> tipos -> tabelas -> índices -> RLS -> seed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensões
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados (domínios de negócio)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_matricula_enum') then
    create type status_matricula_enum as enum ('ativa', 'inativa', 'trancada', 'pendente');
  end if;

  if not exists (select 1 from pg_type where typname = 'origem_acesso_enum') then
    create type origem_acesso_enum as enum ('Direto', 'Gympass', 'TotalPass');
  end if;

  if not exists (select 1 from pg_type where typname = 'status_liberacao_enum') then
    create type status_liberacao_enum as enum ('liberado', 'negado', 'pendente');
  end if;
end$$;

-- =============================================================================
-- 2. TABELAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 academias (Tenant raiz do multi-tenant)
-- -----------------------------------------------------------------------------
create table if not exists public.academias (
  id            uuid primary key default gen_random_uuid(),
  nome_fantasia text        not null,
  slug_url      text        not null unique,
  endereco      text,
  logo_url      text,
  cor_primaria  text        default '#adff42',
  telefone      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.academias is 'Tenant raiz. Cada academia isola seus próprios dados.';

-- -----------------------------------------------------------------------------
-- 2.2 alunos
-- -----------------------------------------------------------------------------
create table if not exists public.alunos (
  id                uuid                   primary key default gen_random_uuid(),
  academia_id       uuid                   not null references public.academias(id) on delete cascade,
  nome              text                   not null,
  cpf               text,
  email             text,
  telefone          text,
  foto_perfil_url   text,
  data_nascimento   date,
  status_matricula  status_matricula_enum  not null default 'ativa',
  plano_id          uuid,
  matricula_codigo  text,
  criado_em         timestamptz            not null default now(),
  atualizado_em     timestamptz            not null default now(),
  unique (academia_id, cpf)
);

comment on table public.alunos is 'Alunos vinculados a uma academia (tenant).';

-- -----------------------------------------------------------------------------
-- 2.3 planos
-- -----------------------------------------------------------------------------
create table if not exists public.planos (
  id                 uuid          primary key default gen_random_uuid(),
  academia_id        uuid          not null references public.academias(id) on delete cascade,
  nome               text          not null,
  descricao          text,
  valor_mensal       numeric(10,2) not null default 0,
  recorrencia_meses  integer       not null default 1,
  ativo              boolean       not null default true,
  criado_em          timestamptz   not null default now(),
  atualizado_em      timestamptz   not null default now()
);

comment on table public.planos is 'Planos de assinatura oferecidos por cada academia.';

-- FK de aluno -> plano (adicionada após criação de ambas as tabelas)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alunos_plano_id_fkey'
  ) then
    alter table public.alunos
      add constraint alunos_plano_id_fkey
      foreign key (plano_id) references public.planos(id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2.4 treinos (ficha de treino de um aluno)
-- -----------------------------------------------------------------------------
create table if not exists public.treinos (
  id            uuid        primary key default gen_random_uuid(),
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  aluno_id      uuid        not null references public.alunos(id)    on delete cascade,
  nome_treino   text        not null,   -- Ex: "Treino A - Peito e Tríceps"
  objetivo      text,                    -- Ex: "Hipertrofia"
  ordem         integer     not null default 0,
  ativo         boolean     not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.treinos is 'Fichas de treino (ex: Treino A, B, C) de cada aluno.';

-- -----------------------------------------------------------------------------
-- 2.5 exercicios_treino (exercícios dentro de uma ficha)
-- -----------------------------------------------------------------------------
create table if not exists public.exercicios_treino (
  id                        uuid          primary key default gen_random_uuid(),
  treino_id                 uuid          not null references public.treinos(id) on delete cascade,
  nome_exercicio            text          not null,
  series                    integer       not null default 3,
  repeticoes                text          not null default '12',  -- text: aceita "10-12", "até a falha"
  carga_kg                  numeric(10,2) default 0,
  descanso_segundos         integer       default 60,
  imagem_demonstracao_url   text,
  observacoes               text,
  ordem                     integer       not null default 0,
  criado_em                 timestamptz   not null default now()
);

comment on table public.exercicios_treino is 'Exercícios que compõem cada ficha de treino.';

-- -----------------------------------------------------------------------------
-- 2.6 acessos_catraca (log de entradas na catraca)
-- -----------------------------------------------------------------------------
create table if not exists public.acessos_catraca (
  id                 uuid                    primary key default gen_random_uuid(),
  academia_id        uuid                    not null references public.academias(id) on delete cascade,
  aluno_id           uuid                    references public.alunos(id) on delete set null,
  origem             origem_acesso_enum      not null default 'Direto',
  valor_repasse      numeric(10,2)           default 0,   -- repasse Gympass/TotalPass
  data_hora_entrada  timestamptz             not null default now(),
  status_liberacao   status_liberacao_enum   not null default 'liberado',
  observacao         text
);

comment on table public.acessos_catraca is 'Registro de acessos na catraca, com origem e repasse financeiro.';

-- =============================================================================
-- 3. ÍNDICES
-- =============================================================================
create index if not exists idx_alunos_academia            on public.alunos(academia_id);
create index if not exists idx_alunos_status               on public.alunos(status_matricula);
create index if not exists idx_planos_academia             on public.planos(academia_id);
create index if not exists idx_treinos_academia            on public.treinos(academia_id);
create index if not exists idx_treinos_aluno               on public.treinos(aluno_id);
create index if not exists idx_exercicios_treino           on public.exercicios_treino(treino_id);
create index if not exists idx_acessos_academia            on public.acessos_catraca(academia_id);
create index if not exists idx_acessos_aluno               on public.acessos_catraca(aluno_id);
create index if not exists idx_acessos_data                on public.acessos_catraca(data_hora_entrada);
create index if not exists idx_acessos_origem              on public.acessos_catraca(origem);

-- =============================================================================
-- 4. TRIGGERS — atualizar `atualizado_em`
-- =============================================================================
create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['academias','alunos','planos','treinos'] loop
    execute format(
      'drop trigger if exists trg_%1$s_upd on public.%1$s;
       create trigger trg_%1$s_upd before update on public.%1$s
       for each row execute function public.set_atualizado_em();', t);
  end loop;
end$$;

-- =============================================================================
-- 5. ROW LEVEL SECURITY (isolamento multi-tenant)
-- =============================================================================
alter table public.academias         enable row level security;
alter table public.alunos            enable row level security;
alter table public.planos            enable row level security;
alter table public.treinos           enable row level security;
alter table public.exercicios_treino enable row level security;
alter table public.acessos_catraca   enable row level security;

-- Política de demonstração: leitura pública (anon) para permitir a vitrine do PWA.
-- Em produção, restrinja por `auth.uid()` / claims de tenant do usuário logado.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'academias','alunos','planos','treinos','exercicios_treino','acessos_catraca'
  ] loop
    execute format('drop policy if exists "leitura_publica_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "leitura_publica_%1$s" on public.%1$s for select using (true);', tbl);

    execute format('drop policy if exists "escrita_service_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "escrita_service_%1$s" on public.%1$s
         for all to service_role using (true) with check (true);', tbl);
  end loop;
end$$;

-- =============================================================================
-- 6. SEED — dados de demonstração
-- =============================================================================
do $$
declare
  v_academia_id uuid;
  v_plano_black uuid;
  v_plano_fit   uuid;
  v_aluno1      uuid;
  v_aluno2      uuid;
  v_aluno3      uuid;
  v_treino_a    uuid;
  v_treino_b    uuid;
begin
  -- Academia (tenant)
  insert into public.academias (nome_fantasia, slug_url, endereco, telefone, cor_primaria)
  values ('IronPulse Academia', 'ironpulse', 'Av. Paulista, 1000 - São Paulo/SP', '(11) 99999-0000', '#adff42')
  on conflict (slug_url) do update set nome_fantasia = excluded.nome_fantasia
  returning id into v_academia_id;

  -- Planos
  insert into public.planos (academia_id, nome, descricao, valor_mensal, recorrencia_meses)
  values (v_academia_id, 'Black Anual', 'Acesso total + aulas + avaliação', 129.90, 12)
  returning id into v_plano_black;

  insert into public.planos (academia_id, nome, descricao, valor_mensal, recorrencia_meses)
  values (v_academia_id, 'Fit Mensal', 'Acesso à musculação', 89.90, 1)
  returning id into v_plano_fit;

  -- Alunos
  insert into public.alunos (academia_id, nome, cpf, email, telefone, foto_perfil_url, status_matricula, plano_id, matricula_codigo)
  values (v_academia_id, 'Marina Costa', '111.111.111-11', 'marina@exemplo.com', '(11) 98888-1111',
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'ativa', v_plano_black, 'IP-0001')
  returning id into v_aluno1;

  insert into public.alunos (academia_id, nome, cpf, email, telefone, foto_perfil_url, status_matricula, plano_id, matricula_codigo)
  values (v_academia_id, 'Rafael Nunes', '222.222.222-22', 'rafael@exemplo.com', '(11) 98888-2222',
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'ativa', v_plano_fit, 'IP-0002')
  returning id into v_aluno2;

  insert into public.alunos (academia_id, nome, cpf, email, telefone, foto_perfil_url, status_matricula, plano_id, matricula_codigo)
  values (v_academia_id, 'Juliana Alves', '333.333.333-33', 'juliana@exemplo.com', '(11) 98888-3333',
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80', 'pendente', v_plano_black, 'IP-0003')
  returning id into v_aluno3;

  -- Treinos da Marina
  insert into public.treinos (academia_id, aluno_id, nome_treino, objetivo, ordem)
  values (v_academia_id, v_aluno1, 'Treino A - Peito e Tríceps', 'Hipertrofia', 1)
  returning id into v_treino_a;

  insert into public.treinos (academia_id, aluno_id, nome_treino, objetivo, ordem)
  values (v_academia_id, v_aluno1, 'Treino B - Costas e Bíceps', 'Hipertrofia', 2)
  returning id into v_treino_b;

  -- Exercícios do Treino A
  insert into public.exercicios_treino (treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos, imagem_demonstracao_url, ordem) values
    (v_treino_a, 'Supino Reto com Barra',        4, '8-10', 60.0, 90, 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80', 1),
    (v_treino_a, 'Supino Inclinado Halteres',    3, '10-12', 24.0, 75, 'https://images.unsplash.com/photo-1584863231364-2edc166de576?w=600&q=80', 2),
    (v_treino_a, 'Crucifixo na Máquina',         3, '12-15', 35.0, 60, 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80', 3),
    (v_treino_a, 'Tríceps Corda',                4, '12',    30.0, 60, 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80', 4),
    (v_treino_a, 'Tríceps Francês',              3, '10-12', 18.0, 60, 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80', 5);

  -- Exercícios do Treino B
  insert into public.exercicios_treino (treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos, imagem_demonstracao_url, ordem) values
    (v_treino_b, 'Puxada Frontal',               4, '10-12', 55.0, 90, 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=600&q=80', 1),
    (v_treino_b, 'Remada Curvada',               4, '8-10',  50.0, 90, 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&q=80', 2),
    (v_treino_b, 'Rosca Direta Barra',           3, '10-12', 25.0, 60, 'https://images.unsplash.com/photo-1590487988256-9ed24133863e?w=600&q=80', 3),
    (v_treino_b, 'Rosca Alternada',              3, '12',    16.0, 60, 'https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=600&q=80', 4);

  -- Acessos na catraca (variados para o dashboard de BI)
  insert into public.acessos_catraca (academia_id, aluno_id, origem, valor_repasse, data_hora_entrada, status_liberacao) values
    (v_academia_id, v_aluno1, 'Direto',    0.00, now() - interval '2 hours',  'liberado'),
    (v_academia_id, v_aluno2, 'Gympass',   12.50, now() - interval '3 hours',  'liberado'),
    (v_academia_id, v_aluno1, 'Direto',    0.00, now() - interval '1 day',     'liberado'),
    (v_academia_id, v_aluno3, 'TotalPass', 10.00, now() - interval '5 hours',  'liberado'),
    (v_academia_id, v_aluno2, 'Gympass',   12.50, now() - interval '26 hours', 'liberado'),
    (v_academia_id, v_aluno3, 'Direto',    0.00, now() - interval '30 minutes','negado');
end$$;

-- =============================================================================
-- Fim do schema.
-- =============================================================================
