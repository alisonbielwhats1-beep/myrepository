-- =============================================================================
-- GymFlow — Esquema completo do banco de dados (Supabase / PostgreSQL)
-- SaaS Multi-tenant para gestão de academias: autenticação de administradores,
-- alunos, planos, treinos, exercícios, catraca, financeiro e funcionários.
--
-- Execute este arquivo inteiro no SQL Editor do Supabase (projeto novo).
-- Ordem: extensões -> tipos -> tabelas -> índices -> triggers -> RLS -> RPC.
--
-- Este script NÃO cria nenhum usuário de login. Depois de rodá-lo, crie a
-- primeira academia + administrador com `npm run criar-academia` (ver
-- scripts/criar-academia.mjs e o README).
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

  if not exists (select 1 from pg_type where typname = 'status_funcionario_enum') then
    create type status_funcionario_enum as enum ('ativo', 'inativo');
  end if;

  if not exists (select 1 from pg_type where typname = 'tipo_receita_enum') then
    create type tipo_receita_enum as enum ('mensalidade', 'matricula', 'venda_produto', 'outra');
  end if;

  if not exists (select 1 from pg_type where typname = 'categoria_despesa_enum') then
    create type categoria_despesa_enum as enum (
      'energia_eletrica', 'agua', 'internet', 'aluguel', 'salarios',
      'manutencao', 'equipamentos', 'impostos', 'produtos_limpeza', 'outros'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'status_pagamento_enum') then
    create type status_pagamento_enum as enum ('pago', 'pendente');
  end if;

  if not exists (select 1 from pg_type where typname = 'grupo_muscular_enum') then
    create type grupo_muscular_enum as enum (
      'peito', 'costas', 'perna', 'ombro', 'biceps', 'triceps',
      'abdomen', 'gluteos', 'panturrilha', 'cardio', 'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'categoria_produto_enum') then
    create type categoria_produto_enum as enum (
      'suplemento', 'acessorio', 'vestuario', 'bebida', 'equipamento', 'outro'
    );
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
  whatsapp      text,        -- número usado no mini-site público (botão WhatsApp)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.academias is 'Tenant raiz. Cada academia isola seus próprios dados.';

-- -----------------------------------------------------------------------------
-- 2.2 perfis_admin — vínculo 1:1 entre um usuário do Supabase Auth e a
-- academia que ele administra. É a chave de todo o isolamento multi-tenant:
-- toda política de RLS abaixo resolve `academia_id_atual()` a partir daqui.
-- -----------------------------------------------------------------------------
create table if not exists public.perfis_admin (
  id            uuid        primary key references auth.users(id) on delete cascade,
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  nome          text        not null,
  email         text        not null,
  criado_em     timestamptz not null default now()
);

comment on table public.perfis_admin is
  'Vincula um usuário autenticado (auth.users) à academia que ele administra.';

create index if not exists idx_perfis_admin_academia on public.perfis_admin(academia_id);

-- -----------------------------------------------------------------------------
-- 2.3 alunos
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
-- 2.4 planos
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
-- 2.5 treinos (ficha de treino de um aluno)
-- -----------------------------------------------------------------------------
create table if not exists public.treinos (
  id            uuid        primary key default gen_random_uuid(),
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  aluno_id      uuid        references public.alunos(id) on delete cascade, -- null = treino da biblioteca (modelo)
  nome_treino   text        not null,   -- Ex: "Treino A - Peito e Tríceps"
  objetivo      text,                    -- Ex: "Hipertrofia"
  modalidade    text,                    -- Ex: "Musculação", "Funcional", "Crossfit"
  ordem         integer     not null default 0,
  ativo         boolean     not null default true,
  publico       boolean     not null default false, -- se true, abre pelo link/QR público
  share_token   uuid        not null default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists uidx_treinos_share_token on public.treinos(share_token);

comment on table public.treinos is 'Fichas de treino (ex: Treino A, B, C) de cada aluno.';

-- -----------------------------------------------------------------------------
-- 2.6 exercicios_treino (exercícios dentro de uma ficha)
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
  video_demonstracao_url    text,   -- clipe curto (<= 10s), loop mudo, estado original
  observacoes               text,
  ordem                     integer       not null default 0,
  criado_em                 timestamptz   not null default now()
);

comment on table public.exercicios_treino is 'Exercícios que compõem cada ficha de treino.';

-- -----------------------------------------------------------------------------
-- 2.7 acessos_catraca (log de entradas na catraca)
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

-- -----------------------------------------------------------------------------
-- 2.8 funcionarios
-- -----------------------------------------------------------------------------
create table if not exists public.funcionarios (
  id              uuid                      primary key default gen_random_uuid(),
  academia_id     uuid                      not null references public.academias(id) on delete cascade,
  nome            text                      not null,
  cargo           text                      not null,
  telefone        text,
  email           text,
  cpf             text,
  foto_url        text,
  data_admissao   date,
  salario         numeric(10,2)             default 0,
  dia_pagamento   integer,                  -- 1..31: dia do mês em que o salário é pago
  status          status_funcionario_enum   not null default 'ativo',
  criado_em       timestamptz               not null default now(),
  atualizado_em   timestamptz               not null default now(),
  unique (academia_id, cpf)
);

comment on table public.funcionarios is 'Funcionários de cada academia.';

create index if not exists idx_funcionarios_academia on public.funcionarios(academia_id);
create index if not exists idx_funcionarios_status    on public.funcionarios(status);

-- -----------------------------------------------------------------------------
-- 2.9 receitas — mensalidades, matrículas, venda de produtos, outras receitas
-- -----------------------------------------------------------------------------
create table if not exists public.receitas (
  id            uuid                    primary key default gen_random_uuid(),
  academia_id   uuid                    not null references public.academias(id) on delete cascade,
  aluno_id      uuid                    references public.alunos(id) on delete set null,
  tipo          tipo_receita_enum       not null default 'outra',
  descricao     text                    not null,
  valor         numeric(10,2)           not null default 0,
  data          date                    not null default current_date,
  status        status_pagamento_enum   not null default 'pendente',
  observacoes   text,
  criado_em     timestamptz             not null default now(),
  atualizado_em timestamptz             not null default now()
);

comment on table public.receitas is
  'Receitas da academia: mensalidades, matrículas, venda de produtos e outras.';

create index if not exists idx_receitas_academia on public.receitas(academia_id);
create index if not exists idx_receitas_data      on public.receitas(data);
create index if not exists idx_receitas_status    on public.receitas(status);
create index if not exists idx_receitas_tipo      on public.receitas(tipo);
create index if not exists idx_receitas_aluno     on public.receitas(aluno_id);

-- -----------------------------------------------------------------------------
-- 2.10 despesas
-- -----------------------------------------------------------------------------
create table if not exists public.despesas (
  id             uuid                     primary key default gen_random_uuid(),
  academia_id    uuid                     not null references public.academias(id) on delete cascade,
  descricao      text                     not null,
  categoria      categoria_despesa_enum   not null default 'outros',
  valor          numeric(10,2)            not null default 0,
  data           date                     not null default current_date,
  status         status_pagamento_enum    not null default 'pendente',
  observacoes    text,
  funcionario_id uuid                     references public.funcionarios(id) on delete set null,
  competencia    date,                    -- mês de referência (dia 1) da folha salarial
  criado_em      timestamptz              not null default now(),
  atualizado_em  timestamptz              not null default now()
);

comment on table public.despesas is 'Despesas operacionais de cada academia.';

create index if not exists idx_despesas_academia  on public.despesas(academia_id);
create index if not exists idx_despesas_data       on public.despesas(data);
create index if not exists idx_despesas_status     on public.despesas(status);
create index if not exists idx_despesas_categoria  on public.despesas(categoria);
create unique index if not exists uidx_despesa_salario_unica
  on public.despesas (funcionario_id, competencia)
  where funcionario_id is not null;

-- -----------------------------------------------------------------------------
-- 2.11 catalogo_exercicios — biblioteca GLOBAL (não é dado de tenant) usada
-- para montar treinos com 1 clique por grupo muscular (Peito, Costas...).
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

-- -----------------------------------------------------------------------------
-- 2.12 progresso_aluno — peso, medidas e fotos ao longo do tempo.
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

-- -----------------------------------------------------------------------------
-- 2.13 produtos — loja de cada academia (suplementos, acessórios...).
-- -----------------------------------------------------------------------------
create table if not exists public.produtos (
  id            uuid                     primary key default gen_random_uuid(),
  academia_id   uuid                     not null references public.academias(id) on delete cascade,
  nome          text                     not null,
  descricao     text,
  categoria     categoria_produto_enum   not null default 'outro',
  preco         numeric(10,2)            not null default 0,
  imagem_url    text,
  estoque       integer,                 -- null = não controla estoque
  destaque      boolean                  not null default false,
  ativo         boolean                  not null default true,
  ordem         integer                  not null default 0,
  criado_em     timestamptz              not null default now(),
  atualizado_em timestamptz              not null default now()
);

comment on table public.produtos is 'Produtos da loja de cada academia (suplementos, acessórios, etc.).';

create index if not exists idx_produtos_academia  on public.produtos(academia_id);
create index if not exists idx_produtos_ativo      on public.produtos(ativo);
create index if not exists idx_produtos_categoria  on public.produtos(categoria);

-- -----------------------------------------------------------------------------
-- 2.14 feedbacks — opiniões/avaliações dos alunos (nota 1–5 + comentário).
-- -----------------------------------------------------------------------------
create table if not exists public.feedbacks (
  id            uuid          primary key default gen_random_uuid(),
  academia_id   uuid          not null references public.academias(id) on delete cascade,
  aluno_id      uuid          references public.alunos(id) on delete set null,
  nota          integer       not null check (nota between 1 and 5),
  categoria     text,
  comentario    text,
  lido          boolean       not null default false,
  criado_em     timestamptz   not null default now()
);

comment on table public.feedbacks is 'Opiniões/avaliações dos alunos sobre a academia.';

create index if not exists idx_feedbacks_academia on public.feedbacks(academia_id);
create index if not exists idx_feedbacks_lido      on public.feedbacks(lido);
create index if not exists idx_feedbacks_criado    on public.feedbacks(criado_em);

-- =============================================================================
-- 3. ÍNDICES (tabelas originais)
-- =============================================================================
create index if not exists idx_alunos_academia    on public.alunos(academia_id);
create index if not exists idx_alunos_status       on public.alunos(status_matricula);
create index if not exists idx_planos_academia     on public.planos(academia_id);
create index if not exists idx_treinos_academia    on public.treinos(academia_id);
create index if not exists idx_treinos_aluno       on public.treinos(aluno_id);
create index if not exists idx_exercicios_treino   on public.exercicios_treino(treino_id);
create index if not exists idx_acessos_academia    on public.acessos_catraca(academia_id);
create index if not exists idx_acessos_aluno       on public.acessos_catraca(aluno_id);
create index if not exists idx_acessos_data        on public.acessos_catraca(data_hora_entrada);
create index if not exists idx_acessos_origem      on public.acessos_catraca(origem);

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
  foreach t in array array[
    'academias', 'alunos', 'planos', 'treinos', 'funcionarios', 'receitas', 'despesas', 'produtos'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_upd on public.%1$s;
       create trigger trg_%1$s_upd before update on public.%1$s
       for each row execute function public.set_atualizado_em();', t);
  end loop;
end$$;

-- =============================================================================
-- 5. FUNÇÃO DE ISOLAMENTO MULTI-TENANT
--
-- Resolve a academia do usuário autenticado atual. SECURITY DEFINER para
-- poder ler `perfis_admin` mesmo com RLS habilitado ali (evita recursão).
-- Toda política de tenant abaixo usa esta função — nunca compare academia_id
-- diretamente com uma coluna vinda do cliente.
-- =============================================================================
create or replace function public.academia_id_atual()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select academia_id from public.perfis_admin where id = auth.uid();
$$;

comment on function public.academia_id_atual() is
  'Academia do administrador autenticado (via perfis_admin). Base de todo o RLS multi-tenant.';

-- =============================================================================
-- 6. ROW LEVEL SECURITY (isolamento multi-tenant)
-- =============================================================================
alter table public.academias         enable row level security;
alter table public.perfis_admin      enable row level security;
alter table public.alunos            enable row level security;
alter table public.planos            enable row level security;
alter table public.treinos           enable row level security;
alter table public.exercicios_treino enable row level security;
alter table public.acessos_catraca   enable row level security;
alter table public.funcionarios      enable row level security;
alter table public.receitas          enable row level security;
alter table public.despesas          enable row level security;
alter table public.progresso_aluno   enable row level security;
alter table public.produtos          enable row level security;
alter table public.feedbacks         enable row level security;
alter table public.catalogo_exercicios enable row level security;

-- catalogo_exercicios: biblioteca global, leitura para qualquer autenticado
-- (não tem academia_id — não é dado de tenant, é conteúdo de referência).
drop policy if exists "catalogo_leitura_autenticados" on public.catalogo_exercicios;
create policy "catalogo_leitura_autenticados" on public.catalogo_exercicios
  for select to authenticated using (true);

drop policy if exists "catalogo_service_role" on public.catalogo_exercicios;
create policy "catalogo_service_role" on public.catalogo_exercicios
  for all to service_role using (true) with check (true);

-- 6.1 perfis_admin: cada admin só enxerga o próprio perfil.
drop policy if exists "perfil_proprio_select" on public.perfis_admin;
create policy "perfil_proprio_select" on public.perfis_admin
  for select to authenticated using (id = auth.uid());

-- 6.2 academias: o admin só vê/edita a própria academia.
drop policy if exists "academia_tenant_select" on public.academias;
create policy "academia_tenant_select" on public.academias
  for select to authenticated using (id = public.academia_id_atual());

drop policy if exists "academia_tenant_update" on public.academias;
create policy "academia_tenant_update" on public.academias
  for update to authenticated
  using (id = public.academia_id_atual())
  with check (id = public.academia_id_atual());

-- 6.3 Tabelas com coluna academia_id direta: select/insert/update/delete
-- restritos ao tenant do admin autenticado.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'alunos', 'planos', 'treinos', 'acessos_catraca',
    'funcionarios', 'receitas', 'despesas', 'progresso_aluno',
    'produtos', 'feedbacks'
  ] loop
    execute format('drop policy if exists "tenant_select_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "tenant_select_%1$s" on public.%1$s
         for select to authenticated using (academia_id = public.academia_id_atual());', tbl);

    execute format('drop policy if exists "tenant_insert_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "tenant_insert_%1$s" on public.%1$s
         for insert to authenticated with check (academia_id = public.academia_id_atual());', tbl);

    execute format('drop policy if exists "tenant_update_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "tenant_update_%1$s" on public.%1$s
         for update to authenticated
         using (academia_id = public.academia_id_atual())
         with check (academia_id = public.academia_id_atual());', tbl);

    execute format('drop policy if exists "tenant_delete_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "tenant_delete_%1$s" on public.%1$s
         for delete to authenticated using (academia_id = public.academia_id_atual());', tbl);

    execute format('drop policy if exists "leitura_publica_%1$s" on public.%1$s;', tbl);
    execute format('drop policy if exists "escrita_service_%1$s" on public.%1$s;', tbl);
  end loop;
end$$;

-- 6.4 exercicios_treino não tem academia_id direta: resolve via treinos.
drop policy if exists "leitura_publica_exercicios_treino" on public.exercicios_treino;
drop policy if exists "escrita_service_exercicios_treino" on public.exercicios_treino;

drop policy if exists "tenant_select_exercicios_treino" on public.exercicios_treino;
create policy "tenant_select_exercicios_treino" on public.exercicios_treino
  for select to authenticated using (
    treino_id in (select id from public.treinos where academia_id = public.academia_id_atual())
  );

drop policy if exists "tenant_insert_exercicios_treino" on public.exercicios_treino;
create policy "tenant_insert_exercicios_treino" on public.exercicios_treino
  for insert to authenticated with check (
    treino_id in (select id from public.treinos where academia_id = public.academia_id_atual())
  );

drop policy if exists "tenant_update_exercicios_treino" on public.exercicios_treino;
create policy "tenant_update_exercicios_treino" on public.exercicios_treino
  for update to authenticated
  using (treino_id in (select id from public.treinos where academia_id = public.academia_id_atual()))
  with check (treino_id in (select id from public.treinos where academia_id = public.academia_id_atual()));

drop policy if exists "tenant_delete_exercicios_treino" on public.exercicios_treino;
create policy "tenant_delete_exercicios_treino" on public.exercicios_treino
  for delete to authenticated using (
    treino_id in (select id from public.treinos where academia_id = public.academia_id_atual())
  );

-- 6.5 service_role sempre tem acesso total (usado pelo script de provisionamento
-- e por rotinas administrativas server-side).
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'academias', 'perfis_admin', 'alunos', 'planos', 'treinos', 'exercicios_treino',
    'acessos_catraca', 'funcionarios', 'receitas', 'despesas', 'progresso_aluno',
    'produtos', 'feedbacks', 'catalogo_exercicios'
  ] loop
    execute format('drop policy if exists "service_role_total_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "service_role_total_%1$s" on public.%1$s
         for all to service_role using (true) with check (true);', tbl);
  end loop;
end$$;

-- =============================================================================
-- 7. RPC PÚBLICA — ficha do aluno sem login
--
-- O aluno ainda não tem autenticação própria (item 3 do escopo). Em vez de
-- liberar leitura pública direta nas tabelas (o que vazaria todos os alunos
-- de todas as academias), expomos apenas esta função: dado um `aluno_id`
-- (link único, não listável, compartilhado pela recepção/QR), ela retorna só
-- os campos necessários para a tela do aluno — nunca CPF, e-mail ou telefone.
-- =============================================================================
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

comment on function public.obter_ficha_aluno(uuid) is
  'Leitura pública e restrita (sem CPF/e-mail/telefone) da ficha de um aluno, para a tela do aluno sem login.';

grant execute on function public.obter_ficha_aluno(uuid) to anon, authenticated;

-- 7.1 Lookup público mínimo de academia por slug — dados do mini-site.
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

-- 7.1b Planos públicos do mini-site (só campos comerciais).
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

-- 7.2 Folha salarial automática: cria uma despesa (categoria 'salarios') para
-- cada funcionário ativo com salário e dia de pagamento, no mês informado.
-- Idempotente (índice único funcionario_id+competencia). Usa a academia do
-- admin logado. Retorna quantas despesas foram criadas.
create or replace function public.gerar_folha_do_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia   uuid := public.academia_id_atual();
  v_comp       date := date_trunc('month', p_competencia)::date;
  v_ultimo_dia integer := extract(day from (v_comp + interval '1 month - 1 day'));
  v_criadas    integer := 0;
  r            record;
  v_data       date;
begin
  if v_academia is null then
    raise exception 'Sem academia no contexto do usuário';
  end if;

  for r in
    select id, nome, salario, dia_pagamento
    from public.funcionarios
    where academia_id = v_academia
      and status = 'ativo'
      and coalesce(salario, 0) > 0
      and dia_pagamento is not null
  loop
    v_data := make_date(
      extract(year from v_comp)::int,
      extract(month from v_comp)::int,
      least(greatest(r.dia_pagamento, 1), v_ultimo_dia)
    );

    insert into public.despesas
      (academia_id, descricao, categoria, valor, data, status, funcionario_id, competencia)
    values
      (v_academia, 'Salário - ' || r.nome, 'salarios', r.salario, v_data, 'pendente', r.id, v_comp)
    on conflict (funcionario_id, competencia) where funcionario_id is not null
    do nothing;

    if found then
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return v_criadas;
end;
$$;

grant execute on function public.gerar_folha_do_mes(date) to authenticated;

-- 7.3 RPC pública: treino compartilhado por QR (só se `publico = true`).
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
      'nome_fantasia', ac.nome_fantasia,
      'slug_url', ac.slug_url
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
  join public.academias ac on ac.id = t.academia_id
  where t.share_token = p_token and t.publico = true;
$$;

grant execute on function public.obter_treino_publico(uuid) to anon, authenticated;

-- 7.4 RPC pública — produtos ativos da academia (loja do mini-site / aluno).
create or replace function public.obter_produtos_publicos(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pr.id,
    'nome', pr.nome,
    'descricao', pr.descricao,
    'categoria', pr.categoria,
    'preco', pr.preco,
    'imagem_url', pr.imagem_url,
    'destaque', pr.destaque
  ) order by pr.destaque desc, pr.ordem, pr.nome), '[]'::jsonb)
  from public.produtos pr
  join public.academias ac on ac.id = pr.academia_id
  where ac.slug_url = p_slug and pr.ativo = true;
$$;

grant execute on function public.obter_produtos_publicos(text) to anon, authenticated;

-- 7.5 RPC pública — registrar feedback do aluno (sem login). Resolve a
-- academia a partir do aluno e valida a nota (1–5).
create or replace function public.registrar_feedback(
  p_aluno_id   uuid,
  p_nota       integer,
  p_categoria  text,
  p_comentario text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia uuid;
  v_id       uuid;
begin
  select academia_id into v_academia from public.alunos where id = p_aluno_id;
  if v_academia is null then
    raise exception 'Aluno não encontrado';
  end if;
  if p_nota is null or p_nota < 1 or p_nota > 5 then
    raise exception 'Nota deve ser entre 1 e 5';
  end if;

  insert into public.feedbacks (academia_id, aluno_id, nota, categoria, comentario)
  values (v_academia, p_aluno_id, p_nota, nullif(trim(p_categoria), ''), nullif(trim(p_comentario), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.registrar_feedback(uuid, integer, text, text) to anon, authenticated;

-- =============================================================================
-- 8. SEED do catálogo de exercícios (biblioteca global, não é dado de tenant).
-- Idempotente por nome+grupo — seguro rodar de novo. Fotos reais de
-- github.com/yuhonas/free-exercise-db (licença Unlicense/domínio público).
-- =============================================================================
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

-- =============================================================================
-- Fim do schema. Nenhum dado de demonstração é inserido por este script
-- (o catálogo de exercícios acima é biblioteca de referência, não dado de
-- tenant). Use `npm run criar-academia` para provisionar a primeira
-- academia + admin.
-- =============================================================================
