-- =============================================================================
-- Dados de demonstração (~2 anos de histórico) para a primeira academia
-- cadastrada no banco. Objetivo: popular a aplicação com um cenário realista
-- para você navegar e avaliar (dashboard, financeiro, treinos, alertas,
-- progresso, mini-site) — não é dado gigante, é uma base pequena e coerente.
--
-- Seguro rodar só UMA vez. Se já existirem alunos com código "DEMO-%" para
-- a academia, o script para sem alterar nada (ver bloco de verificação).
--
-- Para gerar os dados para uma academia específica (se você tiver mais de
-- uma), troque a linha "v_slug text := null;" abaixo por, por exemplo,
-- "v_slug text := 'academia-saude-e-vida';".
-- =============================================================================

-- Tudo roda em uma única transação: se qualquer parte falhar, nada fica
-- registrado pela metade.
begin;

-- -----------------------------------------------------------------------------
-- 0. Resolve a academia-alvo e trava o script se já houver dados demo.
-- -----------------------------------------------------------------------------
do $$
declare
  v_slug text := null;
  v_academia_id uuid;
begin
  if v_slug is not null then
    select id into v_academia_id from public.academias where slug_url = v_slug;
  else
    select id into v_academia_id from public.academias order by criado_em asc limit 1;
  end if;

  if v_academia_id is null then
    raise exception 'Nenhuma academia encontrada. Crie a academia primeiro (npm run criar-academia ou pelo dashboard) antes de rodar este script.';
  end if;

  if exists (
    select 1 from public.alunos
    where academia_id = v_academia_id and matricula_codigo like 'DEMO-%'
  ) then
    raise exception 'Dados de demonstração já existem para esta academia. Nada foi alterado. Se quiser gerar de novo, use antes o script 004b_remover_dados_demo.sql para limpar.';
  end if;

  perform set_config('acadflow.demo_academia_id', v_academia_id::text, false);
  raise notice 'Gerando dados de demonstração para a academia %', v_academia_id;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Planos (só cria se a academia ainda não tiver nenhum).
-- -----------------------------------------------------------------------------
insert into public.planos (academia_id, nome, descricao, valor_mensal, recorrencia_meses, ativo)
select (current_setting('acadflow.demo_academia_id')::uuid), v.nome, v.descricao, v.valor, v.rec, true
from (values
  ('Mensal',      'Acesso completo à academia, renovação mensal',        99.90,  1),
  ('Trimestral',  'Acesso completo, plano trimestral com desconto',     269.90,  3),
  ('Anual',       'Acesso completo, plano anual com o melhor preço',    899.90, 12)
) as v(nome, descricao, valor, rec)
where not exists (
  select 1 from public.planos
  where academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
);

-- -----------------------------------------------------------------------------
-- 2. Funcionários (~4), admitidos em datas espalhadas nos últimos ~20 meses.
-- -----------------------------------------------------------------------------
create temporary table tmp_funcionarios (
  idx integer, nome text, cargo text, meses_atras integer, salario numeric, dia_pag integer
) on commit drop;

insert into tmp_funcionarios (idx, nome, cargo, meses_atras, salario, dia_pag) values
(1, 'Carlos Eduardo Souza', 'Instrutor de musculação', 19, 2200.00, 5),
(2, 'Renata Alves',         'Recepcionista',           14, 1600.00, 5),
(3, 'Felipe Nascimento',    'Personal trainer',        10, 2500.00, 10),
(4, 'Juliana Reis',         'Auxiliar de limpeza',      6, 1450.00, 5);

insert into public.funcionarios (
  academia_id, nome, cargo, telefone, email, cpf, data_admissao, salario, dia_pagamento, status, criado_em, atualizado_em
)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  t.nome,
  t.cargo,
  '(11) 9' || lpad((7000 + t.idx * 11)::text, 4, '0') || '-' || lpad((3000 + t.idx * 13)::text, 4, '0'),
  'funcionario' || t.idx || '@exemplo.com',
  'DEMO-EMP-' || lpad(t.idx::text, 2, '0'),
  (date_trunc('month', now()) - (t.meses_atras || ' months')::interval)::date,
  t.salario,
  t.dia_pag,
  'ativo',
  now(),
  now()
from tmp_funcionarios t;

-- -----------------------------------------------------------------------------
-- 3. Alunos (~18), matriculados em datas espalhadas nos últimos ~24 meses.
--    3 propositalmente com mensalidade em atraso (para o alerta de
--    inadimplência) e 3 sem check-in recente (para o alerta de "sumidos").
-- -----------------------------------------------------------------------------
create temporary table tmp_alunos (
  idx integer, nome text, meses_atras integer, status public.status_matricula_enum, plano_idx integer
) on commit drop;

insert into tmp_alunos (idx, nome, meses_atras, status, plano_idx) values
(1,  'Marina Costa',         23, 'ativa',    1),
(2,  'Lucas Almeida',        21, 'ativa',    1),
(3,  'Beatriz Ramos',        19, 'ativa',    2),
(4,  'Pedro Henrique Silva', 17, 'ativa',    1),
(5,  'Camila Ferreira',      16, 'ativa',    1),
(6,  'Rafael Souza',         14, 'ativa',    2),
(7,  'Juliana Martins',      13, 'ativa',    1),
(8,  'Gabriel Oliveira',     11, 'ativa',    1),
(9,  'Larissa Rocha',        10, 'ativa',    3),
(10, 'Thiago Pereira',        9, 'ativa',    1),
(11, 'Fernanda Lima',         8, 'ativa',    2),
(12, 'Bruno Carvalho',        7, 'ativa',    1),
(13, 'Amanda Nogueira',       6, 'ativa',    1),
(14, 'Diego Santos',          5, 'inativa',  1),
(15, 'Patrícia Gomes',        4, 'inativa',  2),
(16, 'Rodrigo Barbosa',       3, 'ativa',    1),
(17, 'Vanessa Teixeira',      2, 'trancada', 1),
(18, 'Eduardo Cardoso',       1, 'ativa',    1);

insert into public.alunos (
  academia_id, nome, cpf, email, telefone, data_nascimento,
  status_matricula, plano_id, matricula_codigo, criado_em, atualizado_em
)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  t.nome,
  lpad((11100000000 + t.idx)::text, 11, '0'),
  'aluno' || t.idx || '@exemplo.com',
  '(11) 9' || lpad((8100 + t.idx * 3)::text, 4, '0') || '-' || lpad((1200 + t.idx * 7)::text, 4, '0'),
  (date '1988-03-01' + (t.idx * 431) * interval '1 day')::date,
  t.status,
  pl.id,
  'DEMO-' || lpad(t.idx::text, 3, '0'),
  date_trunc('month', now()) - (t.meses_atras || ' months')::interval + ((t.idx * 2) || ' days')::interval,
  now()
from tmp_alunos t
join lateral (
  select id from public.planos
  where academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
  order by valor_mensal
  offset (t.plano_idx - 1) limit 1
) pl on true;

-- -----------------------------------------------------------------------------
-- 4. Receitas — mensalidade recorrente (respeitando a recorrência do plano),
--    matrícula na entrada e algumas vendas de produto avulsas.
-- -----------------------------------------------------------------------------

-- 4.1 Matrícula (uma vez, no dia do cadastro).
insert into public.receitas (academia_id, aluno_id, tipo, descricao, valor, data, status, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  a.id,
  'matricula',
  'Taxa de matrícula - ' || a.nome,
  60.00,
  a.criado_em::date,
  'pago',
  '[DEMO]',
  now()
from public.alunos a
where a.academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
  and a.matricula_codigo like 'DEMO-%';

-- 4.2 Mensalidades recorrentes por ciclo de cobrança do plano.
with base as (
  select
    a.id as aluno_id,
    a.nome,
    a.status_matricula,
    a.criado_em::date as data_matricula,
    pl.valor_mensal,
    pl.recorrencia_meses,
    ((extract(year from age(current_date, a.criado_em)) * 12
      + extract(month from age(current_date, a.criado_em)))::int
      / pl.recorrencia_meses) as ciclos_passados
  from public.alunos a
  join public.planos pl on pl.id = a.plano_id
  where a.academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
    and a.matricula_codigo like 'DEMO-%'
),
base2 as (
  select b.*,
    case when b.status_matricula = 'ativa' then b.ciclos_passados + 1
         else greatest(b.ciclos_passados - 2, 0)
    end as ciclo_max
  from base b
),
ciclos as (
  select b2.*, g.n
  from base2 b2
  cross join lateral generate_series(0, b2.ciclo_max) as g(n)
)
insert into public.receitas (academia_id, aluno_id, tipo, descricao, valor, data, status, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  c.aluno_id,
  'mensalidade',
  'Mensalidade - ' || c.nome,
  c.valor_mensal,
  (c.data_matricula + (c.n * c.recorrencia_meses || ' months')::interval)::date,
  case
    when (c.data_matricula + (c.n * c.recorrencia_meses || ' months')::interval)::date > current_date
      then 'pendente'::public.status_pagamento_enum
    when c.nome in ('Lucas Almeida', 'Camila Ferreira', 'Bruno Carvalho') and c.n = c.ciclo_max - 1
      then 'pendente'::public.status_pagamento_enum
    else 'pago'::public.status_pagamento_enum
  end,
  '[DEMO]',
  now()
from ciclos c;

-- 4.3 Algumas vendas de produto avulsas (loja da academia).
insert into public.receitas (academia_id, aluno_id, tipo, descricao, valor, data, status, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  a.aluno_id,
  'venda_produto',
  a.produto,
  a.valor,
  a.data,
  'pago',
  '[DEMO]',
  now()
from (
  select
    (select id from public.alunos where academia_id = (current_setting('acadflow.demo_academia_id')::uuid) and matricula_codigo = 'DEMO-003') as aluno_id,
    'Whey Protein 900g' as produto, 149.90 as valor, (current_date - interval '2 months')::date as data
  union all
  select
    (select id from public.alunos where academia_id = (current_setting('acadflow.demo_academia_id')::uuid) and matricula_codigo = 'DEMO-007'),
    'Camiseta dry-fit', 69.90, (current_date - interval '5 months')::date
  union all
  select
    (select id from public.alunos where academia_id = (current_setting('acadflow.demo_academia_id')::uuid) and matricula_codigo = 'DEMO-010'),
    'Coqueteleira', 35.00, (current_date - interval '9 months')::date
  union all
  select
    (select id from public.alunos where academia_id = (current_setting('acadflow.demo_academia_id')::uuid) and matricula_codigo = 'DEMO-013'),
    'Luva de treino', 59.90, (current_date - interval '1 months')::date
  union all
  select
    (select id from public.alunos where academia_id = (current_setting('acadflow.demo_academia_id')::uuid) and matricula_codigo = 'DEMO-016'),
    'Whey Protein 900g', 149.90, (current_date - interval '15 days')::date
) a;

-- -----------------------------------------------------------------------------
-- 5. Despesas — contas fixas recorrentes nos últimos 24 meses + folha
--    salarial dos funcionários desde a admissão de cada um.
-- -----------------------------------------------------------------------------

-- 5.1 Contas fixas mensais.
with meses as (
  select generate_series(0, 23) as n
),
categorias as (
  select * from (values
    ('aluguel'::public.categoria_despesa_enum,          'Aluguel do espaço',        2800.00),
    ('energia_eletrica'::public.categoria_despesa_enum, 'Conta de energia',          650.00),
    ('agua'::public.categoria_despesa_enum,              'Conta de água',            180.00),
    ('internet'::public.categoria_despesa_enum,          'Internet e telefonia',     220.00),
    ('produtos_limpeza'::public.categoria_despesa_enum,  'Produtos de limpeza',      140.00)
  ) as v(categoria, descricao, valor)
)
insert into public.despesas (academia_id, descricao, categoria, valor, data, status, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  c.descricao,
  c.categoria,
  -- pequena variação de valor por mês, pra não ficar tudo igual
  round((c.valor * (0.94 + ((m.n * 7) % 13) / 100.0))::numeric, 2),
  (date_trunc('month', now()) - (m.n || ' months')::interval + interval '4 days')::date,
  case when m.n = 0 then 'pendente'::public.status_pagamento_enum else 'pago'::public.status_pagamento_enum end,
  '[DEMO]',
  now()
from meses m
cross join categorias c;

-- 5.2 Manutenção e equipamentos: eventos esporádicos, não todo mês.
insert into public.despesas (academia_id, descricao, categoria, valor, data, status, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  v.descricao, v.categoria, v.valor, v.data, v.status, '[DEMO]', now()
from (values
  ('manutencao'::public.categoria_despesa_enum,   'Manutenção de esteiras',       420.00, (current_date - interval '3 months')::date,  'pago'::public.status_pagamento_enum),
  ('equipamentos'::public.categoria_despesa_enum, 'Reposição de anilhas',         890.00, (current_date - interval '8 months')::date,  'pago'),
  ('manutencao'::public.categoria_despesa_enum,   'Manutenção do ar-condicionado',350.00, (current_date - interval '13 months')::date, 'pago'),
  ('equipamentos'::public.categoria_despesa_enum, 'Bicicleta ergométrica nova',  2200.00, (current_date - interval '18 months')::date, 'pago'),
  ('impostos'::public.categoria_despesa_enum,     'Simples Nacional (guia mensal)', 480.00, (current_date - interval '1 months')::date, 'pago'),
  ('impostos'::public.categoria_despesa_enum,     'Simples Nacional (guia mensal)', 480.00, current_date::date,                          'pendente'),
  ('outros'::public.categoria_despesa_enum,       'Divulgação em redes sociais',  200.00, (current_date - interval '2 months')::date,  'pago')
) as v(categoria, descricao, valor, data, status);

-- 5.3 Folha salarial (uma despesa por funcionário/mês, desde a admissão).
with f as (
  select
    id, nome, salario, dia_pagamento,
    ((extract(year from age(current_date, data_admissao)) * 12
      + extract(month from age(current_date, data_admissao)))::int) as meses_desde_admissao
  from public.funcionarios
  where academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
    and cpf like 'DEMO-EMP-%'
),
folha as (
  select f.*, g.n
  from f
  cross join lateral generate_series(0, f.meses_desde_admissao) as g(n)
)
insert into public.despesas (academia_id, descricao, categoria, valor, data, status, funcionario_id, competencia, observacoes, criado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  'Salário - ' || fo.nome,
  'salarios',
  fo.salario,
  (date_trunc('month', now()) - (fo.n || ' months')::interval + ((fo.dia_pagamento - 1) || ' days')::interval)::date,
  case when fo.n = 0 then 'pendente'::public.status_pagamento_enum else 'pago'::public.status_pagamento_enum end,
  fo.id,
  (date_trunc('month', now()) - (fo.n || ' months')::interval)::date,
  '[DEMO]',
  now()
from folha fo;

-- -----------------------------------------------------------------------------
-- 6. Acessos de catraca — check-ins recentes (últimas ~8 semanas) para os
--    alunos ativos, exceto 3 propositalmente sem acesso (viram "sumidos").
-- -----------------------------------------------------------------------------
with elegiveis as (
  select id, nome
  from public.alunos
  where academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
    and matricula_codigo like 'DEMO-%'
    and status_matricula = 'ativa'
    and nome not in ('Gabriel Oliveira', 'Fernanda Lima', 'Rodrigo Barbosa') -- ficam "sumidos"
),
dias as (
  select generate_series(0, 55) as n -- últimos ~8 semanas
),
checkins as (
  select e.id as aluno_id, d.n
  from elegiveis e
  cross join dias d
  -- ritmo de ~3x por semana por aluno, variando o dia por aluno
  where (d.n + (('x' || substr(md5(e.id::text), 1, 4))::bit(16)::int)) % 7 < 3
)
insert into public.acessos_catraca (academia_id, aluno_id, origem, data_hora_entrada, status_liberacao)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  c.aluno_id,
  'Direto',
  (current_date - (c.n || ' days')::interval) + time '07:30' + ((c.n * 37) % 720 || ' minutes')::interval,
  'liberado'
from checkins c;

-- -----------------------------------------------------------------------------
-- 7. Treinos — fichas prontas para alguns alunos, usando o catálogo por
--    grupo muscular. Um treino fica público (compartilhável por QR).
-- -----------------------------------------------------------------------------
create temporary table tmp_treinos (
  matricula text, nome_treino text, objetivo text, modalidade text, publico boolean
) on commit drop;

insert into tmp_treinos (matricula, nome_treino, objetivo, modalidade, publico) values
('DEMO-001', 'Treino A - Peito e Tríceps', 'Hipertrofia', 'Musculação', true),
('DEMO-002', 'Treino B - Costas e Bíceps', 'Hipertrofia', 'Musculação', false),
('DEMO-004', 'Treino C - Pernas',          'Força',        'Musculação', false),
('DEMO-009', 'Treino Full Body',           'Emagrecimento','Funcional',  true);

insert into public.treinos (academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem, ativo, publico, criado_em, atualizado_em)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  a.id,
  t.nome_treino, t.objetivo, t.modalidade, 1, true, t.publico, now(), now()
from tmp_treinos t
join public.alunos a
  on a.matricula_codigo = t.matricula
  and a.academia_id = (current_setting('acadflow.demo_academia_id')::uuid);

-- Exercícios de cada treino, puxados do catálogo pelo grupo muscular certo.
insert into public.exercicios_treino (
  treino_id, nome_exercicio, series, repeticoes, carga_kg, descanso_segundos,
  imagem_demonstracao_url, video_demonstracao_url, ordem
)
select
  tr.id, ce.nome, ce.series_padrao, ce.repeticoes_padrao, v.carga, 60,
  ce.imagem_demonstracao_url, ce.video_demonstracao_url, ce.ordem
from public.treinos tr
join public.alunos a on a.id = tr.aluno_id and a.academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
join (values
  ('DEMO-001', 'peito'::public.grupo_muscular_enum, 20.0),
  ('DEMO-001', 'triceps'::public.grupo_muscular_enum, 15.0),
  ('DEMO-002', 'costas'::public.grupo_muscular_enum, 25.0),
  ('DEMO-002', 'biceps'::public.grupo_muscular_enum, 12.0),
  ('DEMO-004', 'perna'::public.grupo_muscular_enum, 40.0),
  ('DEMO-009', 'abdomen'::public.grupo_muscular_enum, 0.0),
  ('DEMO-009', 'cardio'::public.grupo_muscular_enum, 0.0)
) as v(matricula, grupo, carga) on v.matricula = a.matricula_codigo
join public.catalogo_exercicios ce on ce.grupo_muscular = v.grupo
where a.academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
  and ce.ordem <= 3; -- até 3 exercícios por grupo, pra não lotar a ficha

-- -----------------------------------------------------------------------------
-- 8. Progresso do aluno — peso e medidas ao longo do tempo, para 3 alunos.
-- -----------------------------------------------------------------------------
with alvo as (
  select id, matricula_codigo,
    case matricula_codigo
      when 'DEMO-001' then 78.0
      when 'DEMO-004' then 92.0
      when 'DEMO-009' then 68.0
    end as peso_inicial
  from public.alunos
  where academia_id = (current_setting('acadflow.demo_academia_id')::uuid)
    and matricula_codigo in ('DEMO-001', 'DEMO-004', 'DEMO-009')
),
serie as (
  select generate_series(0, 5) as n -- 6 medições, uma a cada mês
)
insert into public.progresso_aluno (academia_id, aluno_id, data, peso_kg, percentual_gordura, peito_cm, cintura_cm, quadril_cm, braco_cm, coxa_cm, observacoes)
select
  (current_setting('acadflow.demo_academia_id')::uuid),
  a.id,
  (date_trunc('month', now()) - ((5 - s.n) || ' months')::interval)::date,
  -- tendência leve (emagrecendo ou ganhando massa, dependendo do aluno)
  round((a.peso_inicial - (case when a.matricula_codigo = 'DEMO-009' then s.n * 1.1 else -s.n * 0.6 end))::numeric, 1),
  round((22 - s.n * 0.4)::numeric, 1),
  round((a.peso_inicial * 1.28)::numeric, 1),
  round((a.peso_inicial * 0.95 - s.n * 0.5)::numeric, 1),
  round((a.peso_inicial * 1.15)::numeric, 1),
  round((a.peso_inicial * 0.42)::numeric, 1),
  round((a.peso_inicial * 0.72)::numeric, 1),
  'Avaliação de rotina'
from alvo a
cross join serie s;

commit;

-- =============================================================================
-- Fim. Resumo do que foi gerado: 3 planos (se não existiam), 4 funcionários,
-- 18 alunos (matriculados nos últimos 24 meses), mensalidades + matrículas +
-- vendas avulsas, despesas fixas recorrentes + folha salarial, check-ins de
-- catraca (~8 semanas), 4 fichas de treino com exercícios reais do catálogo,
-- e progresso (peso/medidas) para 3 alunos.
-- =============================================================================
