-- =============================================================================
-- CI — Teste de isolamento multi-tenant (duas academias)
--
-- POR QUE ISSO EXISTE
--   A auditoria de 03/08/2026 concluiu que o isolamento entre academias parece
--   correto por leitura do codigo (`academia_id_atual()` resolve de
--   perfis_admin via auth.uid(), nada vem do cliente), mas classificou o
--   achado como DEPENDE DE TESTE: nunca houve teste empirico com dois tenants.
--   As 8 suites em tests/ cobrem apenas funcoes puras de TypeScript; nenhuma
--   toca no banco. Este arquivo fecha essa lacuna.
--
-- COMO FUNCIONA
--   Cria duas academias completas (Alfa e Beta), cada uma com seu usuario
--   administrador, aluno, treino e receita. Depois "vira" cada usuario com
--       set local role authenticated;
--       set local request.jwt.claim.sub = '<uuid>';
--   — o mesmo mecanismo que o PostgREST usa em producao (ver 00_bootstrap.sql)
--   — e verifica que cada um ve exatamente os seus dados e nada do outro.
--
--   Roda inteiro dentro de uma transacao com ROLLBACK no final: nao deixa
--   residuo, mesmo se executado num banco que ja tenha dados.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- -----------------------------------------------------------------------------
-- Massa de teste. Como owner (bypassa RLS na preparacao).
-- Dados 100% ficticios — nenhum dado real de cliente, por politica.
-- -----------------------------------------------------------------------------
create temporary table _ids (chave text primary key, valor uuid);

do $$
declare
  v_ac_alfa uuid := gen_random_uuid();
  v_ac_beta uuid := gen_random_uuid();
  v_us_alfa uuid := gen_random_uuid();
  v_us_beta uuid := gen_random_uuid();
  v_al_alfa uuid := gen_random_uuid();
  v_al_beta uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values
    (v_us_alfa, 'dono.alfa@exemplo.invalido'),
    (v_us_beta, 'dono.beta@exemplo.invalido');

  insert into public.academias (id, nome_fantasia, slug_url) values
    (v_ac_alfa, 'Academia Alfa (teste)', 'academia-alfa-teste'),
    (v_ac_beta, 'Academia Beta (teste)', 'academia-beta-teste');

  insert into public.perfis_admin (id, academia_id, nome, email, papel) values
    (v_us_alfa, v_ac_alfa, 'Dono Alfa', 'dono.alfa@exemplo.invalido', 'dono'),
    (v_us_beta, v_ac_beta, 'Dono Beta', 'dono.beta@exemplo.invalido', 'dono');

  insert into public.alunos (id, academia_id, nome) values
    (v_al_alfa, v_ac_alfa, 'Aluno Alfa'),
    (v_al_beta, v_ac_beta, 'Aluno Beta');

  insert into public.treinos (academia_id, aluno_id, nome_treino) values
    (v_ac_alfa, v_al_alfa, 'Treino Alfa'),
    (v_ac_beta, v_al_beta, 'Treino Beta');

  insert into public.receitas (academia_id, aluno_id, tipo, descricao, valor, status) values
    (v_ac_alfa, v_al_alfa, 'mensalidade', 'Mensalidade Alfa', 111.11, 'pago'),
    (v_ac_beta, v_al_beta, 'mensalidade', 'Mensalidade Beta', 222.22, 'pago');

  insert into _ids values
    ('ac_alfa', v_ac_alfa), ('ac_beta', v_ac_beta),
    ('us_alfa', v_us_alfa), ('us_beta', v_us_beta),
    ('al_alfa', v_al_alfa), ('al_beta', v_al_beta);
end
$$;

-- -----------------------------------------------------------------------------
-- Helper de assercao: compara um valor esperado com o obtido.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.checar(
  p_nome     text,
  p_obtido   bigint,
  p_esperado bigint
) returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception '[RLS] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end
$$;

-- =============================================================================
-- T1 — O dono da Alfa vê só a Alfa
-- =============================================================================
do $$
declare
  v_us_alfa uuid := (select valor from _ids where chave = 'us_alfa');
  v_ac_beta uuid := (select valor from _ids where chave = 'ac_beta');
  n bigint;
begin
  raise notice 'T1 — dono da Alfa autenticado';
  perform set_config('request.jwt.claim.sub', v_us_alfa::text, true);
  set local role authenticated;

  select count(*) into n from public.alunos;
  perform pg_temp.checar('alunos visiveis = 1 (so o da Alfa)', n, 1);

  select count(*) into n from public.alunos where nome = 'Aluno Beta';
  perform pg_temp.checar('aluno da Beta invisivel', n, 0);

  select count(*) into n from public.treinos;
  perform pg_temp.checar('treinos visiveis = 1', n, 1);

  select count(*) into n from public.receitas;
  perform pg_temp.checar('receitas visiveis = 1', n, 1);

  select count(*) into n from public.receitas where valor = 222.22;
  perform pg_temp.checar('receita da Beta invisivel (financeiro isolado)', n, 0);

  select count(*) into n from public.academias;
  perform pg_temp.checar('academias visiveis = 1', n, 1);

  -- Tentativa de leitura direcionada por id conhecido (IDOR): mesmo sabendo
  -- o uuid da outra academia, o RLS tem de negar.
  select count(*) into n from public.academias where id = v_ac_beta;
  perform pg_temp.checar('IDOR: academia da Beta por id explicito', n, 0);

  reset role;
end
$$;

-- =============================================================================
-- T2 — O dono da Beta vê só a Beta (prova que T1 não passou por acidente)
-- =============================================================================
do $$
declare
  v_us_beta uuid := (select valor from _ids where chave = 'us_beta');
  n bigint;
begin
  raise notice 'T2 — dono da Beta autenticado';
  perform set_config('request.jwt.claim.sub', v_us_beta::text, true);
  set local role authenticated;

  select count(*) into n from public.alunos;
  perform pg_temp.checar('alunos visiveis = 1 (so o da Beta)', n, 1);

  select count(*) into n from public.alunos where nome = 'Aluno Beta';
  perform pg_temp.checar('ve o proprio aluno', n, 1);

  select count(*) into n from public.receitas where valor = 111.11;
  perform pg_temp.checar('receita da Alfa invisivel', n, 0);

  reset role;
end
$$;

-- =============================================================================
-- T3 — Escrita cross-tenant é negada
-- =============================================================================
do $$
declare
  v_us_alfa uuid := (select valor from _ids where chave = 'us_alfa');
  v_al_beta uuid := (select valor from _ids where chave = 'al_beta');
  v_ac_beta uuid := (select valor from _ids where chave = 'ac_beta');
  n bigint;
begin
  raise notice 'T3 — escrita cross-tenant';
  perform set_config('request.jwt.claim.sub', v_us_alfa::text, true);
  set local role authenticated;

  -- UPDATE no aluno da outra academia: RLS filtra, 0 linhas afetadas.
  update public.alunos set nome = 'INVADIDO' where id = v_al_beta;
  get diagnostics n = row_count;
  perform pg_temp.checar('UPDATE em aluno da Beta afeta 0 linhas', n, 0);

  -- DELETE no aluno da outra academia.
  delete from public.alunos where id = v_al_beta;
  get diagnostics n = row_count;
  perform pg_temp.checar('DELETE em aluno da Beta afeta 0 linhas', n, 0);

  -- INSERT forjando academia_id da outra academia: o with_check tem de barrar.
  begin
    insert into public.alunos (academia_id, nome) values (v_ac_beta, 'Forjado');
    raise exception '[RLS] FALHA: INSERT com academia_id forjado foi ACEITO';
  exception
    when insufficient_privilege then
      raise notice '  OK   INSERT com academia_id da Beta negado pelo RLS';
  end;

  reset role;
end
$$;

-- =============================================================================
-- T4 — Anônimo (sem JWT) não lê nada de nenhum tenant
-- =============================================================================
do $$
declare
  n bigint;
begin
  raise notice 'T4 — anonimo sem token';
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;

  select count(*) into n from public.alunos;
  perform pg_temp.checar('anon nao le alunos', n, 0);

  select count(*) into n from public.receitas;
  perform pg_temp.checar('anon nao le receitas', n, 0);

  select count(*) into n from public.perfis_admin;
  perform pg_temp.checar('anon nao le perfis_admin', n, 0);

  reset role;
end
$$;

-- =============================================================================
-- T5 — Escalada de privilégio: não-dono não pode mudar o próprio papel
--       (regressao da migration 014 / P0-03b)
-- =============================================================================
do $$
declare
  v_ac_alfa uuid := (select valor from _ids where chave = 'ac_alfa');
  v_us_rec  uuid := gen_random_uuid();
  v_papel   text;
begin
  raise notice 'T5 — escalada de privilegio (recepcao -> dono)';

  insert into auth.users (id, email) values (v_us_rec, 'recepcao.alfa@exemplo.invalido');
  insert into public.perfis_admin (id, academia_id, nome, email, papel)
    values (v_us_rec, v_ac_alfa, 'Recepcao Alfa', 'recepcao.alfa@exemplo.invalido', 'recepcao');

  perform set_config('request.jwt.claim.sub', v_us_rec::text, true);
  set local role authenticated;

  -- Pode falhar por RLS (0 linhas) ou ser aceito (falha de seguranca).
  begin
    update public.perfis_admin set papel = 'dono' where id = v_us_rec;
  exception when insufficient_privilege then
    null; -- negado por with_check: comportamento correto
  end;

  reset role;

  select papel into v_papel from public.perfis_admin where id = v_us_rec;
  if v_papel = 'dono' then
    raise exception
      E'[RLS] FALHA CRITICA: recepcao conseguiu se promover a dono.\n'
      '  Regressao da migration 014 — ver P0-03b. Com isso o Financeiro fica exposto.';
  end if;
  raise notice '  OK   recepcao continua como "%" apos tentar virar dono', v_papel;
end
$$;

select '== Teste de isolamento multi-tenant passou ==' as resultado;

-- Nada e persistido.
rollback;
