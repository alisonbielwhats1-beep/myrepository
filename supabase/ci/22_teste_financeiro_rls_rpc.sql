-- =============================================================================
-- CI — Integração RLS/RPC do módulo Financeiro (Lote 1)
--
-- POR QUE ISSO EXISTE
--   tests/financeiro.test.cjs, tests/cobrancas.test.cjs e tests/vencimento.test.mjs
--   cobrem só as funções TypeScript puras (o "espelho testável" da regra). A
--   segurança de verdade mora no banco: RLS de receitas/despesas por papel
--   (migration 021) e as RPCs security-definer que escrevem financeiro. Nunca
--   houve teste empírico disso — este arquivo fecha essa lacuna, no mesmo
--   padrão de 20_/21_ (dois tenants reais, `set local role` + JWT claim,
--   transação com ROLLBACK — não deixa resíduo).
--
--   ACHADO que motivou este arquivo (mapeamento de cobertura de testes,
--   confirmado antes de corrigir): sincronizar_cobrancas(integer) e
--   gerar_mensalidades_do_mes(date) tinham GRANT ... TO authenticated sem
--   nenhuma checagem de papel — qualquer membro da equipe (recepção,
--   instrutor) conseguia gerar mensalidades chamando a RPC direto via REST,
--   mesmo lib/permissoes.ts restringindo a seção "financeiro" ao dono. A
--   migration 082 corrigiu isso; T8/T9 abaixo travam a regressão.
--
--   Cobre:
--     • isolamento entre academias (receitas/despesas);
--     • RLS de receitas/despesas por papel, incluindo a exceção de
--       recepção/gerente para tipo='venda_produto';
--     • registrar_pagamento_mensalidade: quem pode, e idempotência;
--     • sincronizar_cobrancas / gerar_mensalidades_do_mes: só dono (082),
--       dono permitido, idempotência de gerar_mensalidades_do_mes.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

create temporary table _ids (chave text primary key, valor uuid);

-- -----------------------------------------------------------------------------
-- Massa de teste (como owner, bypassa RLS na preparação). 100% fictícia.
-- -----------------------------------------------------------------------------
do $$
declare
  v_acadA   uuid := gen_random_uuid();
  v_acadB   uuid := gen_random_uuid();
  v_donoA   uuid := gen_random_uuid();
  v_gerA    uuid := gen_random_uuid();
  v_recA    uuid := gen_random_uuid();
  v_instA   uuid := gen_random_uuid();
  v_donoB   uuid := gen_random_uuid();
  v_planoA  uuid := gen_random_uuid();
  v_alA     uuid := gen_random_uuid();
  v_recMens uuid := gen_random_uuid(); -- receita mensalidade pendente (aluno A1)
  v_recVenda uuid := gen_random_uuid(); -- receita venda_produto (academia A)
  v_recOutra uuid := gen_random_uuid(); -- receita 'outra' (academia A)
  v_despA   uuid := gen_random_uuid();
  v_recB    uuid := gen_random_uuid(); -- receita da academia B (isolamento)
  v_despB   uuid := gen_random_uuid(); -- despesa da academia B (isolamento)
begin
  insert into auth.users(id,email) values
    (v_donoA,'donoA-fin@ex.invalido'),(v_gerA,'gerA-fin@ex.invalido'),
    (v_recA,'recA-fin@ex.invalido'),(v_instA,'instA-fin@ex.invalido'),
    (v_donoB,'donoB-fin@ex.invalido');

  insert into public.academias(id,nome_fantasia,slug_url) values
    (v_acadA,'Academia A Financeiro (teste)','acad-a-fin-teste'),
    (v_acadB,'Academia B Financeiro (teste)','acad-b-fin-teste');

  insert into public.perfis_admin(id,academia_id,nome,email,papel) values
    (v_donoA,v_acadA,'Dono A','donoA-fin@ex.invalido','dono'),
    (v_gerA,v_acadA,'Gerente A','gerA-fin@ex.invalido','gerente'),
    (v_recA,v_acadA,'Recepcao A','recA-fin@ex.invalido','recepcao'),
    (v_instA,v_acadA,'Instrutor A','instA-fin@ex.invalido','instrutor'),
    (v_donoB,v_acadB,'Dono B','donoB-fin@ex.invalido','dono');

  insert into public.planos(id,academia_id,nome,valor_mensal,recorrencia_meses,cobranca_recorrente) values
    (v_planoA,v_acadA,'Mensal (teste)',100.00,1,true);

  insert into public.alunos(id,academia_id,nome,status_matricula,plano_id) values
    (v_alA,v_acadA,'Aluno A1','ativa',v_planoA);

  insert into public.receitas(id,academia_id,aluno_id,tipo,descricao,valor,data,status,competencia) values
    (v_recMens,v_acadA,v_alA,'mensalidade','Mensalidade - Aluno A1',100.00,current_date,'pendente',date_trunc('month',current_date)::date),
    (v_recVenda,v_acadA,null,'venda_produto','Venda balcao (teste)',50.00,current_date,'pendente',date_trunc('month',current_date)::date),
    (v_recOutra,v_acadA,null,'outra','Receita diversa (teste)',30.00,current_date,'pendente',date_trunc('month',current_date)::date),
    (v_recB,v_acadB,null,'outra','Receita da B (teste)',10.00,current_date,'pendente',date_trunc('month',current_date)::date);

  insert into public.despesas(id,academia_id,descricao,categoria,valor,data,status) values
    (v_despA,v_acadA,'Despesa A (teste)','outros',20.00,current_date,'pendente'),
    (v_despB,v_acadB,'Despesa da B (teste)','outros',15.00,current_date,'pendente');

  insert into _ids values
    ('acadA',v_acadA),('acadB',v_acadB),('donoA',v_donoA),('gerA',v_gerA),
    ('recA',v_recA),('instA',v_instA),('donoB',v_donoB),('planoA',v_planoA),
    ('alA',v_alA),('recMens',v_recMens),('recVenda',v_recVenda),
    ('recOutra',v_recOutra),('despA',v_despA),('recB',v_recB),('despB',v_despB);
end $$;

-- Helpers de asserção (mesmo padrão de 20_/21_ — cada arquivo é autocontido).
create or replace function pg_temp.checar(p_nome text, p_obtido bigint, p_esperado bigint)
returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception '[FINANCEIRO] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end $$;

create or replace function pg_temp.checarb(p_nome text, p_obtido boolean, p_esperado boolean)
returns void language plpgsql as $$
begin
  if coalesce(p_obtido, not p_esperado) is distinct from p_esperado then
    raise exception '[FINANCEIRO] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end $$;

create or replace function pg_temp.vira(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $$;

-- Executa p_sql sob o papel indicado e confirma que LEVANTA EXCEÇÃO — tanto
-- faz se por RLS (INSERT cujo WITH CHECK falha, sqlstate 42501) ou por
-- RAISE EXCEPTION dentro da própria RPC (sqlstate P0001, migration 082):
-- qualquer exceção aqui É a prova de bloqueio. NÃO serve para UPDATE/DELETE
-- restritos por USING — esses não erram, só afetam 0 linhas em silêncio (ver
-- T5/T6, que verificam o dado em vez de esperar exceção).
create or replace function pg_temp.espera_bloqueio(p_user uuid, p_nome_caso text, p_sql text)
returns void language plpgsql as $$
begin
  perform pg_temp.vira(p_user);
  begin
    execute p_sql;
    raise exception '[FINANCEIRO] FALHA: % — deveria ter sido bloqueado', p_nome_caso;
  exception when others then
    -- Distingue "não foi bloqueado" (o RAISE EXCEPTION duas linhas acima,
    -- cuja mensagem sempre começa com o prefixo abaixo) de "foi bloqueado de
    -- verdade" (qualquer OUTRA exceção — RLS 42501/23514 ou RAISE EXCEPTION
    -- da própria RPC, migration 082). No primeiro caso repropaga a falha; no
    -- segundo, é exatamente o resultado esperado.
    if position('[FINANCEIRO] FALHA' in sqlerrm) = 1 then
      raise;
    end if;
    raise notice '  OK   %', p_nome_caso;
  end;
  reset role;
end $$;

-- =============================================================================
-- T1 — Isolamento entre academias: dono A não vê nada da B, e vice-versa.
-- =============================================================================
do $$
declare n bigint;
  v_recB uuid := (select valor from _ids where chave='recB');
  v_despB uuid := (select valor from _ids where chave='despB');
begin
  raise notice 'T1 — isolamento entre academias';
  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  select count(*) into n from public.receitas where id = v_recB;
  perform pg_temp.checar('dono A nao ve receita da B', n, 0);
  select count(*) into n from public.despesas where id = v_despB;
  perform pg_temp.checar('dono A nao ve despesa da B', n, 0);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='donoB'));
  select count(*) into n from public.receitas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('dono B nao ve receita da A', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T2 — RLS SELECT em receitas, por papel.
--       dono/gerente veem os 3 tipos; recepção só venda_produto; instrutor 0.
-- =============================================================================
do $$
declare n bigint;
begin
  raise notice 'T2 — SELECT receitas por papel';

  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  select count(*) into n from public.receitas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('dono ve as 3 receitas da A', n, 3);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='gerA'));
  select count(*) into n from public.receitas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('gerente ve as 3 receitas da A', n, 3);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  select count(*) into n from public.receitas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('recepcao ve só a receita de venda_produto', n, 1);
  select count(*) into n from public.receitas where id = (select valor from _ids where chave='recMens');
  perform pg_temp.checar('recepcao nao ve mensalidade', n, 0);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='instA'));
  select count(*) into n from public.receitas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('instrutor nao ve nenhuma receita', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T3 — RLS SELECT em despesas: dono/gerente veem; recepção/instrutor não veem nada.
-- =============================================================================
do $$
declare n bigint;
begin
  raise notice 'T3 — SELECT despesas por papel';

  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  select count(*) into n from public.despesas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('dono ve despesa da A', n, 1);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='gerA'));
  select count(*) into n from public.despesas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('gerente ve despesa da A', n, 1);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  select count(*) into n from public.despesas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('recepcao nao ve despesa', n, 0);
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='instA'));
  select count(*) into n from public.despesas where academia_id = (select valor from _ids where chave='acadA');
  perform pg_temp.checar('instrutor nao ve despesa', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T4 — RLS INSERT em receitas: dono/gerente inserem qualquer tipo; recepção só
--       venda_produto (tenta 'outra' e é barrada); instrutor não insere nada.
-- =============================================================================
do $$
declare v_acadA uuid := (select valor from _ids where chave='acadA');
begin
  raise notice 'T4 — INSERT receitas por papel';

  perform pg_temp.vira((select valor from _ids where chave='gerA'));
  insert into public.receitas(academia_id,tipo,descricao,valor,data,status)
    values (v_acadA,'outra','Gerente insere (teste)',5,current_date,'pendente');
  raise notice '  OK   gerente insere receita tipo outra';
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  insert into public.receitas(academia_id,tipo,descricao,valor,data,status)
    values (v_acadA,'venda_produto','Recepcao venda (teste)',5,current_date,'pendente');
  raise notice '  OK   recepcao insere venda_produto';
  reset role;
end $$;

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='recA'),
  'recepcao NAO insere receita tipo outra',
  format('insert into public.receitas(academia_id,tipo,descricao,valor,data,status)
          values (%L,''outra'',''Recepcao tenta outra (teste)'',5,current_date,''pendente'')',
         (select valor from _ids where chave='acadA'))
);

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='instA'),
  'instrutor NAO insere nenhuma receita',
  format('insert into public.receitas(academia_id,tipo,descricao,valor,data,status)
          values (%L,''outra'',''Instrutor tenta (teste)'',5,current_date,''pendente'')',
         (select valor from _ids where chave='acadA'))
);

-- =============================================================================
-- T5 — RLS UPDATE em receitas: só dono (recepção NÃO tem exceção aqui, nem
--       para venda_produto — é o motivo de existir a RPC registrar_pagamento_mensalidade).
--
--       UPDATE restrito por USING não levanta exceção quando a linha fica de
--       fora — só afeta 0 linhas em silêncio. Por isso aqui verificamos o
--       dado depois, em vez de esperar erro (diferente de INSERT, cujo WITH
--       CHECK falho SIM levanta exceção — ver T4/T7).
-- =============================================================================
do $$
declare v_recVenda uuid := (select valor from _ids where chave='recVenda');
  v_obs text;
begin
  raise notice 'T5 — UPDATE receitas por papel';

  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  update public.receitas set observacoes = 'editado pelo dono' where id = v_recVenda;
  raise notice '  OK   dono atualiza receita';
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='gerA'));
  update public.receitas set observacoes = 'tentativa gerente' where id = v_recVenda;
  reset role;
  select observacoes into v_obs from public.receitas where id = v_recVenda;
  perform pg_temp.checarb('gerente NAO consegue atualizar receita (RLS silenciosa)',
    v_obs is distinct from 'tentativa gerente', true);

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  update public.receitas set observacoes = 'tentativa recepcao' where id = v_recVenda;
  reset role;
  select observacoes into v_obs from public.receitas where id = v_recVenda;
  perform pg_temp.checarb('recepcao NAO consegue atualizar nem a propria venda_produto',
    v_obs is distinct from 'tentativa recepcao', true);
end $$;

-- =============================================================================
-- T6 — RLS DELETE em receitas: dono deleta qualquer uma; gerente/recepção só
--       venda_produto; instrutor não deleta nada.
--
--       Mesmo caso do T5: DELETE restrito por USING não levanta exceção
--       quando a linha fica de fora, só afeta 0 linhas — verificamos que a
--       linha continua existindo, em vez de esperar erro.
-- =============================================================================
do $$
declare v_id uuid; v_n int;
  v_recOutra uuid := (select valor from _ids where chave='recOutra');
begin
  raise notice 'T6 — DELETE receitas por papel';

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  select id into v_id from public.receitas
    where academia_id = (select valor from _ids where chave='acadA') and tipo = 'venda_produto' limit 1;
  delete from public.receitas where id = v_id;
  raise notice '  OK   recepcao deleta a propria venda_produto';
  reset role;

  perform pg_temp.vira((select valor from _ids where chave='instA'));
  delete from public.receitas where id = v_recOutra;
  reset role;
  select count(*) into v_n from public.receitas where id = v_recOutra;
  perform pg_temp.checar('instrutor NAO deleta receita (RLS silenciosa, linha continua)', v_n, 1);
end $$;

-- =============================================================================
-- T7 — RLS em despesas (escrita): só dono insere/atualiza/deleta.
-- =============================================================================
select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='gerA'),
  'gerente NAO insere despesa (só le)',
  format('insert into public.despesas(academia_id,descricao,categoria,valor,data,status)
          values (%L,''Gerente tenta (teste)'',''outros'',5,current_date,''pendente'')',
         (select valor from _ids where chave='acadA'))
);

do $$
begin
  raise notice 'T7 — escrita em despesas por papel';
  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  update public.despesas set observacoes = 'editado' where id = (select valor from _ids where chave='despA');
  raise notice '  OK   dono atualiza despesa';
  reset role;
end $$;

-- =============================================================================
-- T8 — registrar_pagamento_mensalidade: dono/recepção conseguem; gerente e
--       instrutor são bloqueados PELA PRÓPRIA FUNÇÃO; idempotente.
-- =============================================================================
do $$
declare v_rec record; v_n int;
  v_recMens uuid := (select valor from _ids where chave='recMens');
begin
  raise notice 'T8 — registrar_pagamento_mensalidade';

  perform pg_temp.vira((select valor from _ids where chave='recA'));
  select * into v_rec from public.registrar_pagamento_mensalidade(v_recMens, 'pix');
  perform pg_temp.checarb('recepcao registra pagamento', v_rec.status = 'pago', true);
  reset role;

  -- Idempotente: segunda chamada (agora como dono) não erra e não retorna linha.
  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  select count(*) into v_n from public.registrar_pagamento_mensalidade(v_recMens, 'pix');
  perform pg_temp.checar('2a chamada e idempotente (0 linhas, sem erro)', v_n, 0);
  reset role;
end $$;

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='gerA'),
  'gerente NAO registra pagamento (bloqueado na RPC)',
  format('select * from public.registrar_pagamento_mensalidade(%L, ''pix'')',
         (select valor from _ids where chave='recOutra'))
);

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='instA'),
  'instrutor NAO registra pagamento (bloqueado na RPC)',
  format('select * from public.registrar_pagamento_mensalidade(%L, ''pix'')',
         (select valor from _ids where chave='recOutra'))
);

-- =============================================================================
-- T9 — sincronizar_cobrancas: só dono (migration 082 — regressão do achado P0).
-- =============================================================================
do $$
declare v_r record;
begin
  raise notice 'T9 — sincronizar_cobrancas (só dono, migration 082)';
  perform pg_temp.vira((select valor from _ids where chave='donoA'));
  select * into v_r from public.sincronizar_cobrancas(7);
  perform pg_temp.checarb('dono chama sincronizar_cobrancas com sucesso', v_r is not null, true);
  reset role;
end $$;

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='gerA'),
  'gerente NAO chama sincronizar_cobrancas',
  'select * from public.sincronizar_cobrancas(7)'
);
select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='recA'),
  'recepcao NAO chama sincronizar_cobrancas',
  'select * from public.sincronizar_cobrancas(7)'
);
select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='instA'),
  'instrutor NAO chama sincronizar_cobrancas',
  'select * from public.sincronizar_cobrancas(7)'
);

-- =============================================================================
-- T10 — gerar_mensalidades_do_mes: só dono (migration 082); idempotente.
-- =============================================================================
do $$
declare v_criadas int; v_criadas2 int;
begin
  raise notice 'T10 — gerar_mensalidades_do_mes (só dono, migration 082; idempotência)';
  perform pg_temp.vira((select valor from _ids where chave='donoA'));

  -- A mensalidade da competência atual já existe (fixture) -> 0 criadas.
  select public.gerar_mensalidades_do_mes(current_date) into v_criadas;
  perform pg_temp.checar('dono chama sem erro (mensalidade da competencia ja existe)', v_criadas, 0);

  -- Chamar de novo é idempotente: continua 0, nunca duplica.
  select public.gerar_mensalidades_do_mes(current_date) into v_criadas2;
  perform pg_temp.checar('2a chamada idempotente (nao duplica)', v_criadas2, 0);
  reset role;
end $$;

select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='gerA'),
  'gerente NAO chama gerar_mensalidades_do_mes',
  'select public.gerar_mensalidades_do_mes(current_date)'
);
select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='recA'),
  'recepcao NAO chama gerar_mensalidades_do_mes',
  'select public.gerar_mensalidades_do_mes(current_date)'
);
select pg_temp.espera_bloqueio(
  (select valor from _ids where chave='instA'),
  'instrutor NAO chama gerar_mensalidades_do_mes',
  'select public.gerar_mensalidades_do_mes(current_date)'
);

select '== Integração RLS/RPC de Financeiro passou ==' as resultado;

rollback;
