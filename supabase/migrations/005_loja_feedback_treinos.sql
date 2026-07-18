-- =============================================================================
-- Migration 005 — Loja de produtos, Feedback dos alunos e Treinos-modelo.
--
-- Adiciona:
--   • produtos  — catálogo de loja da academia (whey, luvas, garrafas...),
--     editável pelo dono, com foto, preço, categoria e estoque opcional.
--   • feedbacks — opiniões/avaliações dos alunos (nota 1–5 + comentário),
--     enviadas sem login pela tela do aluno via RPC pública.
--   • RPCs públicas: obter_produtos_publicos(slug) e registrar_feedback(...).
--   • Seed idempotente: produtos-exemplo e treinos-modelo (biblioteca) para
--     cada academia que ainda não tiver os seus — só para facilitar o começo.
--
-- Seguro rodar mais de uma vez (tudo é "if not exists" / "on conflict" /
-- guardado por "not exists").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'categoria_produto_enum') then
    create type categoria_produto_enum as enum (
      'suplemento', 'acessorio', 'vestuario', 'bebida', 'equipamento', 'outro'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2. Tabela produtos (loja) — dado de tenant.
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
-- 3. Tabela feedbacks — dado de tenant. Aluno opcional (pode ser anônimo).
-- -----------------------------------------------------------------------------
create table if not exists public.feedbacks (
  id            uuid          primary key default gen_random_uuid(),
  academia_id   uuid          not null references public.academias(id) on delete cascade,
  aluno_id      uuid          references public.alunos(id) on delete set null,
  nota          integer       not null check (nota between 1 and 5),
  categoria     text,          -- geral, estrutura, atendimento, limpeza, equipamentos, aulas
  comentario    text,
  lido          boolean       not null default false,
  criado_em     timestamptz   not null default now()
);

comment on table public.feedbacks is 'Opiniões/avaliações dos alunos sobre a academia.';

create index if not exists idx_feedbacks_academia on public.feedbacks(academia_id);
create index if not exists idx_feedbacks_lido      on public.feedbacks(lido);
create index if not exists idx_feedbacks_criado    on public.feedbacks(criado_em);

-- -----------------------------------------------------------------------------
-- 4. Trigger de atualizado_em em produtos.
-- -----------------------------------------------------------------------------
drop trigger if exists trg_produtos_upd on public.produtos;
create trigger trg_produtos_upd before update on public.produtos
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 5. RLS — produtos e feedbacks isolados por tenant (admin autenticado).
--    A inserção de feedback pelo aluno (sem login) é feita pela RPC
--    SECURITY DEFINER mais abaixo, então não precisa de policy para anon.
-- -----------------------------------------------------------------------------
alter table public.produtos  enable row level security;
alter table public.feedbacks enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['produtos', 'feedbacks'] loop
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

    execute format('drop policy if exists "service_role_total_%1$s" on public.%1$s;', tbl);
    execute format(
      'create policy "service_role_total_%1$s" on public.%1$s
         for all to service_role using (true) with check (true);', tbl);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- 6. RPC pública — produtos ativos da academia (loja do mini-site / aluno).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 7. RPC pública — registrar feedback do aluno (sem login).
--    Resolve a academia a partir do aluno, validando o vínculo. Retorna
--    o id do feedback criado (ou levanta erro se o aluno não existir).
-- -----------------------------------------------------------------------------
create or replace function public.registrar_feedback(
  p_aluno_id  uuid,
  p_nota      integer,
  p_categoria text,
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
-- 8. SEED — produtos-exemplo para cada academia que ainda não tem nenhum.
--    Imagens do Unsplash (uso livre); se alguma não carregar, a interface cai
--    num placeholder por categoria. O dono edita/troca tudo depois.
-- =============================================================================
insert into public.produtos (academia_id, nome, descricao, categoria, preco, imagem_url, estoque, destaque, ordem)
select a.id, v.nome, v.descricao, v.categoria, v.preco, v.imagem_url, v.estoque, v.destaque, v.ordem
from public.academias a
cross join (values
  ('Whey Protein 900g',       'Proteína isolada e concentrada, sabor baunilha.',        'suplemento'::categoria_produto_enum, 149.90, 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600&q=80', 20, true,  1),
  ('Creatina 300g',           'Creatina monohidratada pura para força e volume.',       'suplemento'::categoria_produto_enum,  89.90, 'https://images.unsplash.com/photo-1622484211148-c0b8f0f0b3f2?w=600&q=80', 15, true,  2),
  ('Pré-treino 300g',         'Energia e foco para treinos intensos.',                  'suplemento'::categoria_produto_enum,  99.90, 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80', 10, false, 3),
  ('Luva de Treino',          'Proteção e aderência para levantamento de peso.',        'acessorio'::categoria_produto_enum,   59.90, 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=80', 30, false, 4),
  ('Garrafa / Coqueteleira 700ml', 'Coqueteleira com misturador, livre de BPA.',        'bebida'::categoria_produto_enum,      39.90, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80', 40, true,  5),
  ('Camiseta Dry-Fit',        'Tecido leve que absorve o suor. Vários tamanhos.',       'vestuario'::categoria_produto_enum,   69.90, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', 25, false, 6),
  ('Toalha de Treino',        'Toalha de microfibra, secagem rápida.',                  'acessorio'::categoria_produto_enum,   29.90, 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80', 50, false, 7),
  ('Barra de Proteína',       'Snack proteico, ideal pós-treino. Unidade.',             'suplemento'::categoria_produto_enum,   12.90, 'https://images.unsplash.com/photo-1571748982800-fa51082c2224?w=600&q=80', 100, false, 8)
) as v(nome, descricao, categoria, preco, imagem_url, estoque, destaque, ordem)
where not exists (
  select 1 from public.produtos p where p.academia_id = a.id
);

-- =============================================================================
-- 9. SEED — treinos-modelo (biblioteca) para cada academia sem biblioteca.
--    Usa os exercícios do catálogo global por grupo muscular. São modelos
--    reutilizáveis prontos "para facilitar" — o dono edita/duplica à vontade.
-- =============================================================================

-- 9.1 Cria os treinos-modelo (aluno_id null = biblioteca).
insert into public.treinos (academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem, ativo, publico)
select a.id, null, m.nome, m.objetivo, m.modalidade, m.ordem, true, false
from public.academias a
cross join (values
  ('Treino A - Peito e Tríceps',   'Hipertrofia',    'Musculação', 1),
  ('Treino B - Costas e Bíceps',   'Hipertrofia',    'Musculação', 2),
  ('Treino C - Pernas e Glúteos',  'Força',          'Musculação', 3),
  ('Treino D - Ombro e Abdômen',   'Definição',      'Musculação', 4),
  ('Treino Full Body Iniciante',   'Condicionamento','Iniciante',  5)
) as m(nome, objetivo, modalidade, ordem)
where not exists (
  select 1 from public.treinos t where t.academia_id = a.id and t.aluno_id is null
);

-- 9.2 Preenche os exercícios de cada treino-modelo a partir do catálogo.
--     Só mexe em treinos-modelo que ainda estão sem exercícios (idempotente).
insert into public.exercicios_treino (
  treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos,
  imagem_demonstracao_url, video_demonstracao_url, ordem
)
select
  tr.id, ce.nome, ce.series_padrao, ce.repeticoes_padrao, 0, 60,
  ce.imagem_demonstracao_url, ce.video_demonstracao_url,
  row_number() over (partition by tr.id order by g.grupo_ordem, ce.ordem)
from public.treinos tr
join (values
  ('Treino A - Peito e Tríceps',  'peito'::grupo_muscular_enum,    1, 3),
  ('Treino A - Peito e Tríceps',  'triceps'::grupo_muscular_enum,  2, 3),
  ('Treino B - Costas e Bíceps',  'costas'::grupo_muscular_enum,   1, 3),
  ('Treino B - Costas e Bíceps',  'biceps'::grupo_muscular_enum,   2, 3),
  ('Treino C - Pernas e Glúteos', 'perna'::grupo_muscular_enum,    1, 4),
  ('Treino C - Pernas e Glúteos', 'gluteos'::grupo_muscular_enum,  2, 2),
  ('Treino D - Ombro e Abdômen',  'ombro'::grupo_muscular_enum,    1, 3),
  ('Treino D - Ombro e Abdômen',  'abdomen'::grupo_muscular_enum,  2, 3),
  ('Treino Full Body Iniciante',  'peito'::grupo_muscular_enum,    1, 1),
  ('Treino Full Body Iniciante',  'costas'::grupo_muscular_enum,   2, 1),
  ('Treino Full Body Iniciante',  'perna'::grupo_muscular_enum,    3, 1),
  ('Treino Full Body Iniciante',  'ombro'::grupo_muscular_enum,    4, 1),
  ('Treino Full Body Iniciante',  'abdomen'::grupo_muscular_enum,  5, 1)
) as g(nome_treino, grupo, grupo_ordem, max_ex) on g.nome_treino = tr.nome_treino
join public.catalogo_exercicios ce
  on ce.grupo_muscular = g.grupo and ce.ordem <= g.max_ex
where tr.aluno_id is null
  and not exists (
    select 1 from public.exercicios_treino e where e.treino_id = tr.id
  );

-- =============================================================================
-- Fim da migration 005.
-- =============================================================================
