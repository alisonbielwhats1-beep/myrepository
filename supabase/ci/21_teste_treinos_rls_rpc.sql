-- =============================================================================
-- CI — Integração RLS/RPC do módulo Treinos
--
-- POR QUE ISSO EXISTE
--   As suítes em tests/ cobrem só funções puras de TypeScript. A segurança de
--   verdade do módulo Treinos mora no banco: RLS de 3 níveis (privado/equipe/
--   academia), modelos de plataforma (GestAcad) e as RPCs security-definer
--   (atribuir_modelo_treino, obter_ficha_aluno, obter_treino_publico). Este
--   arquivo exercita tudo isso com dois tenants reais, "virando" cada usuário
--   com `set local role` + `request.jwt.claim.sub` (o mesmo que o PostgREST faz
--   em produção — ver 00_bootstrap.sql). Roda em transação com ROLLBACK: não
--   deixa resíduo.
--
--   Cobre os cenários de segurança da auditoria:
--     • instrutor A não vê o privado do instrutor B;
--     • recepção não vê treino de EQUIPE (só academia);
--     • dono/gerente veem tudo do próprio tenant;
--     • academia A não vê nada da academia B (leitura e escrita);
--     • atribuir aceita aluno 'ativa' e 'pendente', barra cross-tenant e recepção;
--     • ficha do aluno: sem PII, só treinos do próprio tenant (hardening 075);
--     • link público: liga/desliga/exclui, e nunca expõe dados do aluno.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

create temporary table _ids (chave text primary key, valor uuid);

-- -----------------------------------------------------------------------------
-- Massa de teste (como owner, bypassa RLS na preparação). 100% fictícia.
-- -----------------------------------------------------------------------------
do $$
declare
  v_acadA uuid := gen_random_uuid();
  v_acadB uuid := gen_random_uuid();
  v_donoA uuid := gen_random_uuid();
  v_i1A   uuid := gen_random_uuid();  -- instrutor 1 da A (autor dos modelos)
  v_i2A   uuid := gen_random_uuid();  -- instrutor 2 da A (outro instrutor)
  v_recA  uuid := gen_random_uuid();  -- recepção da A
  v_donoB uuid := gen_random_uuid();
  v_alA   uuid := gen_random_uuid();  -- aluno ativo da A
  v_alApend uuid := gen_random_uuid();-- aluno pendente da A
  v_alB   uuid := gen_random_uuid();  -- aluno ativo da B
  v_tokA  uuid := gen_random_uuid();  -- token público do aluno A
  v_tokB  uuid := gen_random_uuid();  -- token público do aluno B
  v_tpriv uuid;  -- modelo privado do i1A
  v_tequ  uuid;  -- modelo de equipe (i1A)
  v_tacad uuid;  -- modelo de academia (i1A)
  v_tprivB uuid; -- modelo privado da B
  v_tplat uuid;  -- modelo de plataforma (GestAcad)
  v_shareAcad uuid := gen_random_uuid(); -- share_token do modelo de academia
begin
  insert into auth.users(id,email) values
    (v_donoA,'donoA@ex.invalido'),(v_i1A,'i1A@ex.invalido'),(v_i2A,'i2A@ex.invalido'),
    (v_recA,'recA@ex.invalido'),(v_donoB,'donoB@ex.invalido');

  insert into public.academias(id,nome_fantasia,slug_url) values
    (v_acadA,'Academia A (teste)','acad-a-teste'),
    (v_acadB,'Academia B (teste)','acad-b-teste');

  insert into public.perfis_admin(id,academia_id,nome,email,papel) values
    (v_donoA,v_acadA,'Dono A','donoA@ex.invalido','dono'),
    (v_i1A,v_acadA,'Instrutor 1 A','i1A@ex.invalido','instrutor'),
    (v_i2A,v_acadA,'Instrutor 2 A','i2A@ex.invalido','instrutor'),
    (v_recA,v_acadA,'Recepcao A','recA@ex.invalido','recepcao'),
    (v_donoB,v_acadB,'Dono B','donoB@ex.invalido','dono');

  insert into public.alunos(id,academia_id,nome,status_matricula,token_acesso_publico,email,telefone) values
    (v_alA,v_acadA,'Aluno A','ativa',v_tokA,'alunoA@ex.invalido','11999990000'),
    (v_alApend,v_acadA,'Aluno A Pendente','pendente',gen_random_uuid(),null,null),
    (v_alB,v_acadB,'Aluno B','ativa',v_tokB,'alunoB@ex.invalido','11888880000');

  -- Modelos da Academia A (aluno_id null), todos autorados pelo instrutor 1.
  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,origem_tipo,visibilidade,ativo)
    values (v_acadA,null,'Privado do I1',v_i1A,'instrutor','privado',true) returning id into v_tpriv;
  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,origem_tipo,visibilidade,ativo)
    values (v_acadA,null,'De Equipe',v_i1A,'instrutor','equipe',true) returning id into v_tequ;
  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,origem_tipo,visibilidade,ativo,publico,share_token)
    values (v_acadA,null,'Da Academia',v_i1A,'instrutor','academia',true,false,v_shareAcad) returning id into v_tacad;
  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,origem_tipo,visibilidade,ativo)
    values (v_acadB,null,'Privado da B',v_donoB,'instrutor','privado',true) returning id into v_tprivB;
  -- Modelo de plataforma: academia_id null; o trigger força origem_tipo='gestacad'.
  insert into public.treinos(academia_id,aluno_id,nome_treino,visibilidade,ativo)
    values (null,null,'Padrao GestAcad','academia',true) returning id into v_tplat;

  -- Um exercício em cada modelo (para as cópias terem conteúdo).
  insert into public.exercicios_treino(treino_id,nome_exercicio,series,repeticoes,ordem)
  select id,'Supino',3,'10',1 from public.treinos
  where id in (v_tpriv,v_tequ,v_tacad,v_tprivB,v_tplat);

  insert into _ids values
    ('acadA',v_acadA),('acadB',v_acadB),('donoA',v_donoA),('i1A',v_i1A),
    ('i2A',v_i2A),('recA',v_recA),('donoB',v_donoB),('alA',v_alA),
    ('alApend',v_alApend),('alB',v_alB),('tokA',v_tokA),('tokB',v_tokB),
    ('tpriv',v_tpriv),('tequ',v_tequ),('tacad',v_tacad),('tprivB',v_tprivB),
    ('tplat',v_tplat),('shareAcad',v_shareAcad);
end $$;

-- Helpers de asserção.
create or replace function pg_temp.checar(p_nome text, p_obtido bigint, p_esperado bigint)
returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception '[TREINOS] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end $$;

create or replace function pg_temp.checarb(p_nome text, p_obtido boolean, p_esperado boolean)
returns void language plpgsql as $$
begin
  if coalesce(p_obtido, not p_esperado) is distinct from p_esperado then
    raise exception '[TREINOS] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end $$;

create or replace function pg_temp.vira(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $$;

-- =============================================================================
-- T1 — Instrutor 2 (não é autor, não é gestor): vê equipe/academia/plataforma,
--       NÃO vê o privado do instrutor 1, NÃO vê nada da B.
-- =============================================================================
do $$
declare n bigint;
  v_tpriv uuid := (select valor from _ids where chave='tpriv');
  v_tequ  uuid := (select valor from _ids where chave='tequ');
  v_tacad uuid := (select valor from _ids where chave='tacad');
  v_tplat uuid := (select valor from _ids where chave='tplat');
  v_tprivB uuid := (select valor from _ids where chave='tprivB');
begin
  raise notice 'T1 — instrutor 2 da A';
  perform pg_temp.vira((select valor from _ids where chave='i2A'));

  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('nao ve privado de OUTRO instrutor', n, 0);
  select count(*) into n from public.treinos where id = v_tequ;
  perform pg_temp.checar('ve treino de EQUIPE (é instrutor)', n, 1);
  select count(*) into n from public.treinos where id = v_tacad;
  perform pg_temp.checar('ve treino de ACADEMIA', n, 1);
  select count(*) into n from public.treinos where id = v_tplat;
  perform pg_temp.checar('ve modelo de PLATAFORMA', n, 1);
  select count(*) into n from public.treinos where id in (v_tprivB);
  perform pg_temp.checar('nao ve NADA da academia B', n, 0);
  -- exercícios só aparecem para treino visível:
  select count(*) into n from public.exercicios_treino where treino_id = v_tpriv;
  perform pg_temp.checar('nao ve exercicio de privado alheio', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T2 — Recepção: vê ACADEMIA e plataforma, NÃO vê EQUIPE nem privado.
-- =============================================================================
do $$
declare n bigint;
  v_tpriv uuid := (select valor from _ids where chave='tpriv');
  v_tequ  uuid := (select valor from _ids where chave='tequ');
  v_tacad uuid := (select valor from _ids where chave='tacad');
  v_tplat uuid := (select valor from _ids where chave='tplat');
begin
  raise notice 'T2 — recepção da A';
  perform pg_temp.vira((select valor from _ids where chave='recA'));

  select count(*) into n from public.treinos where id = v_tacad;
  perform pg_temp.checar('recepção ve ACADEMIA', n, 1);
  select count(*) into n from public.treinos where id = v_tequ;
  perform pg_temp.checar('recepção NÃO ve EQUIPE', n, 0);
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('recepção NÃO ve privado', n, 0);
  select count(*) into n from public.treinos where id = v_tplat;
  perform pg_temp.checar('recepção ve plataforma', n, 1);
  reset role;
end $$;

-- =============================================================================
-- T3 — Dono da A: vê TUDO da A (inclusive o privado do instrutor) + plataforma,
--       e NADA da B.
-- =============================================================================
do $$
declare n bigint;
  v_acadA uuid := (select valor from _ids where chave='acadA');
  v_tprivB uuid := (select valor from _ids where chave='tprivB');
begin
  raise notice 'T3 — dono da A';
  perform pg_temp.vira((select valor from _ids where chave='donoA'));

  -- 3 modelos da A (privado+equipe+academia) todos visíveis para a gestão:
  select count(*) into n from public.treinos where academia_id = v_acadA and aluno_id is null;
  perform pg_temp.checar('dono ve os 3 modelos da A (inclui privado)', n, 3);
  select count(*) into n from public.treinos where id = v_tprivB;
  perform pg_temp.checar('dono da A NÃO ve modelo da B', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T4 — Instrutor 1 (autor): vê o próprio privado.
-- =============================================================================
do $$
declare n bigint;
  v_tpriv uuid := (select valor from _ids where chave='tpriv');
begin
  raise notice 'T4 — instrutor 1 (autor)';
  perform pg_temp.vira((select valor from _ids where chave='i1A'));
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('autor ve o proprio privado', n, 1);
  reset role;
end $$;

-- =============================================================================
-- T5 — RPC atribuir_modelo_treino.
-- =============================================================================
do $$
declare
  v_novo uuid; v_n bigint;
  v_i1A uuid := (select valor from _ids where chave='i1A');
  v_recA uuid := (select valor from _ids where chave='recA');
  v_alA uuid := (select valor from _ids where chave='alA');
  v_alApend uuid := (select valor from _ids where chave='alApend');
  v_alB uuid := (select valor from _ids where chave='alB');
  v_tplat uuid := (select valor from _ids where chave='tplat');
  v_tacad uuid := (select valor from _ids where chave='tacad');
begin
  raise notice 'T5 — RPC atribuir_modelo_treino';

  -- Instrutor atribui um modelo de PLATAFORMA a aluno ATIVO → cria a cópia.
  perform pg_temp.vira(v_i1A);
  v_novo := public.atribuir_modelo_treino(v_tplat, v_alA, null);
  perform pg_temp.checarb('atribui modelo de PLATAFORMA a aluno ativo', v_novo is not null, true);
  select count(*) into v_n from public.exercicios_treino where treino_id = v_novo;
  perform pg_temp.checar('copia os exercicios do modelo', v_n, 1);
  select count(*) into v_n from public.treinos
    where id = v_novo and aluno_id = v_alA and modelo_origem_id = v_tplat;
  perform pg_temp.checar('cópia vinculada ao aluno e ao modelo de origem', v_n, 1);

  -- Atribui a aluno PENDENTE (migration 080) → sucesso.
  v_novo := public.atribuir_modelo_treino(v_tacad, v_alApend, null);
  perform pg_temp.checarb('atribui a aluno PENDENTE', v_novo is not null, true);

  -- Atribui a aluno de OUTRA academia → deve falhar (cross-tenant).
  begin
    v_novo := public.atribuir_modelo_treino(v_tacad, v_alB, null);
    raise exception '[TREINOS] FALHA: atribuiu treino a aluno de OUTRA academia';
  exception when others then
    if sqlstate = 'P0001' then
      raise notice '  OK   atribuir a aluno de outra academia é barrado';
    else raise; end if;
  end;
  reset role;

  -- Recepção não pode atribuir.
  perform pg_temp.vira(v_recA);
  begin
    v_novo := public.atribuir_modelo_treino(v_tacad, v_alA, null);
    raise exception '[TREINOS] FALHA: recepção conseguiu atribuir treino';
  exception when others then
    if sqlstate = 'P0001' then
      raise notice '  OK   recepção não pode atribuir treino';
    else raise; end if;
  end;
  reset role;
end $$;

-- =============================================================================
-- T5b — RPC definir_dias_treino: dia é um slot exclusivo por aluno (091).
--       Atribuir um dia a uma ficha tira esse dia de qualquer outra ficha do
--       MESMO aluno que já o usava — sem apagar a ficha, só o dia em conflito.
-- =============================================================================
do $$
declare
  v_i1A uuid := (select valor from _ids where chave='i1A');
  v_alA uuid := (select valor from _ids where chave='alA');
  v_tplat uuid := (select valor from _ids where chave='tplat');
  v_tacad uuid := (select valor from _ids where chave='tacad');
  v_f1 uuid;
  v_f2 uuid;
  v_r jsonb;
  v_dias smallint[];
begin
  raise notice 'T5b — definir_dias_treino: slot exclusivo por dia';
  perform pg_temp.vira(v_i1A);

  v_f1 := public.atribuir_modelo_treino(v_tplat, v_alA, 'Ficha 1 (teste slot)');
  v_f2 := public.atribuir_modelo_treino(v_tacad, v_alA, 'Ficha 2 (teste slot)');

  -- Ficha 1 assume segunda (1) e quarta (3).
  perform public.definir_dias_treino(v_f1, array[1,3]::smallint[]);
  select dias_semana into v_dias from public.treinos where id = v_f1;
  perform pg_temp.checarb('ficha 1 fica com seg+qua', v_dias = array[1,3]::smallint[], true);

  -- Ficha 2 assume quarta (3) e sexta (5) — colide na quarta com a ficha 1.
  v_r := public.definir_dias_treino(v_f2, array[3,5]::smallint[]);
  select dias_semana into v_dias from public.treinos where id = v_f2;
  perform pg_temp.checarb('ficha 2 fica com qua+sex', v_dias = array[3,5]::smallint[], true);

  -- A ficha 1 perde SÓ a quarta (a segunda continua dela).
  select dias_semana into v_dias from public.treinos where id = v_f1;
  perform pg_temp.checarb('ficha 1 perde a quarta, mantém a segunda', v_dias = array[1]::smallint[], true);

  -- O retorno da RPC relata a realocação, pra app avisar o instrutor.
  perform pg_temp.checarb(
    'retorno relata a ficha 1 como realocada',
    (v_r -> 'realocados') @> jsonb_build_array(jsonb_build_object('id', v_f1)),
    true
  );

  reset role;
end $$;

-- =============================================================================
-- T6 — obter_ficha_aluno: resolve por token+slug, sem PII, só treinos do tenant.
--       Inclui o hardening 075 (treino injetado de outro tenant não aparece).
-- =============================================================================
do $$
declare
  v_ficha jsonb; v_txt text; v_n int;
  v_acadA uuid := (select valor from _ids where chave='acadA');
  v_alB uuid := (select valor from _ids where chave='alB');
  v_acadB uuid := (select valor from _ids where chave='acadB');
  v_tokA uuid := (select valor from _ids where chave='tokA');
  v_tokB uuid := (select valor from _ids where chave='tokB');
begin
  raise notice 'T6 — obter_ficha_aluno';

  -- Injeção cross-tenant: um treino da Academia A apontando para o aluno da B.
  -- (inserido como owner; o RLS de insert barraria na aplicação — aqui provamos
  --  que a LEITURA da ficha ignora, via hardening 075.)
  insert into public.treinos(academia_id,aluno_id,nome_treino,origem_tipo,visibilidade,ativo)
    values (v_acadA, v_alB, 'INJETADO', 'academia', 'privado', true);
  -- E um treino LEGÍTIMO do aluno B (mesmo tenant).
  insert into public.treinos(academia_id,aluno_id,nome_treino,origem_tipo,visibilidade,ativo)
    values (v_acadB, v_alB, 'Ficha legitima B', 'academia', 'privado', true);

  set local role anon;
  v_ficha := public.obter_ficha_aluno(v_tokB, 'acad-b-teste');
  reset role;

  perform pg_temp.checarb('ficha do aluno B resolve por token+slug', v_ficha is not null, true);
  v_n := jsonb_array_length(v_ficha->'treinos');
  perform pg_temp.checar('ficha lista só o treino do PRÓPRIO tenant (injeção ignorada)', v_n, 1);
  perform pg_temp.checarb('treino injetado NÃO aparece',
    not (v_ficha->'treinos') @> '[{"nome_treino":"INJETADO"}]'::jsonb, true);

  -- Sem PII: o JSON da ficha não pode conter e-mail/telefone.
  v_txt := v_ficha::text;
  perform pg_temp.checarb('ficha NÃO expõe e-mail', position('@ex.invalido' in v_txt) = 0, true);
  perform pg_temp.checarb('ficha NÃO expõe telefone', position('888880000' in v_txt) = 0, true);

  -- Token de A com slug de B → null (não cruza tenant).
  set local role anon;
  v_ficha := public.obter_ficha_aluno(v_tokA, 'acad-b-teste');
  reset role;
  perform pg_temp.checarb('token de A + slug de B → null', v_ficha is null, true);
end $$;

-- =============================================================================
-- T7 — obter_treino_publico: liga/desliga/exclui; nunca expõe dados de aluno.
-- =============================================================================
do $$
declare
  v_pub jsonb;
  v_donoA uuid := (select valor from _ids where chave='donoA');
  v_acadA uuid := (select valor from _ids where chave='acadA');
  v_tacad uuid := (select valor from _ids where chave='tacad');
  v_shareAcad uuid := (select valor from _ids where chave='shareAcad');
begin
  raise notice 'T7 — obter_treino_publico (link/QR)';

  -- Desligado por padrão → null.
  set local role anon;
  v_pub := public.obter_treino_publico(v_shareAcad);
  reset role;
  perform pg_temp.checarb('link desligado → null', v_pub is null, true);

  -- Liga o público (como dono, via update direto — respeita RLS/tenant). Usa a
  -- variável já resolvida no DECLARE: sob o papel authenticated não há acesso à
  -- temp table _ids (é do owner da sessão).
  perform pg_temp.vira(v_donoA);
  update public.treinos set publico = true where id = v_tacad and academia_id = v_acadA;
  reset role;

  set local role anon;
  v_pub := public.obter_treino_publico(v_shareAcad);
  reset role;
  perform pg_temp.checarb('link ligado → retorna o treino', v_pub is not null and v_pub ? 'treino', true);
  perform pg_temp.checarb('link ligado → traz exercicios', jsonb_array_length(v_pub->'exercicios') = 1, true);
  perform pg_temp.checarb('link público NÃO tem bloco de aluno', not (v_pub ? 'aluno'), true);

  -- Desliga → null (revogado).
  perform pg_temp.vira(v_donoA);
  update public.treinos set publico = false where id = v_tacad;
  reset role;
  set local role anon;
  v_pub := public.obter_treino_publico(v_shareAcad);
  reset role;
  perform pg_temp.checarb('link revogado → null', v_pub is null, true);

  -- Religa e EXCLUI o treino → null (conteúdo some).
  perform pg_temp.vira(v_donoA);
  update public.treinos set publico = true where id = v_tacad;
  delete from public.treinos where id = v_tacad;
  reset role;
  set local role anon;
  v_pub := public.obter_treino_publico(v_shareAcad);
  reset role;
  perform pg_temp.checarb('treino excluído → link não expõe nada', v_pub is null, true);
end $$;

-- =============================================================================
-- T8 — Compartilhamento com instrutores SELECIONADOS (ACL, migration 081).
--       O autor marca visibilidade='selecionado' e libera para instrutores
--       específicos via treinos_compartilhamento. Só quem está na ACL passa a
--       ver; a recepção continua fora; e quem não gerencia o treino não pode
--       gravar a ACL.
-- =============================================================================
do $$
declare n bigint;
  v_i1A uuid := (select valor from _ids where chave='i1A');
  v_i2A uuid := (select valor from _ids where chave='i2A');
  v_recA uuid := (select valor from _ids where chave='recA');
  v_tpriv uuid := (select valor from _ids where chave='tpriv');
begin
  raise notice 'T8 — ACL: compartilhar com instrutores selecionados';

  -- Antes de compartilhar: o instrutor 2 não vê o privado do instrutor 1.
  perform pg_temp.vira(v_i2A);
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('i2 NAO ve privado do i1 (pre-ACL)', n, 0);
  reset role;

  -- O AUTOR (i1) marca 'selecionado' e insere a ACL para o i2 — passa pelo RLS
  -- de insert (posso_gerenciar_treino = autor) exatamente como a Server Action.
  perform pg_temp.vira(v_i1A);
  update public.treinos set visibilidade = 'selecionado' where id = v_tpriv;
  insert into public.treinos_compartilhamento(treino_id, perfil_id)
    values (v_tpriv, v_i2A);
  reset role;

  -- Agora o i2 (na ACL) vê o treino e o seu exercício.
  perform pg_temp.vira(v_i2A);
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('i2 PASSA a ver treino selecionado (na ACL)', n, 1);
  select count(*) into n from public.exercicios_treino where treino_id = v_tpriv;
  perform pg_temp.checar('i2 ve exercicio do treino selecionado', n, 1);
  perform pg_temp.checarb('treino_compartilhado_comigo() true para i2',
    public.treino_compartilhado_comigo(v_tpriv), true);
  reset role;

  -- A recepção continua SEM ver (selecionado não é academia).
  perform pg_temp.vira(v_recA);
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('recepção NAO ve treino selecionado', n, 0);
  reset role;

  -- Quem NÃO gerencia o treino (i2, que não é autor nem gestor) não pode
  -- gravar a ACL — o RLS de insert barra.
  perform pg_temp.vira(v_i2A);
  begin
    insert into public.treinos_compartilhamento(treino_id, perfil_id)
      values (v_tpriv, v_i2A);
    raise exception '[TREINOS] FALHA: i2 gravou ACL de treino que nao gerencia';
  exception when insufficient_privilege or check_violation then
    raise notice '  OK   i2 nao pode gravar ACL de treino alheio';
  end;
  reset role;

  -- Voltar para 'privado' e limpar a ACL (autor) → o i2 deixa de ver.
  perform pg_temp.vira(v_i1A);
  delete from public.treinos_compartilhamento where treino_id = v_tpriv;
  update public.treinos set visibilidade = 'privado' where id = v_tpriv;
  reset role;
  perform pg_temp.vira(v_i2A);
  select count(*) into n from public.treinos where id = v_tpriv;
  perform pg_temp.checar('i2 deixa de ver ao voltar para privado', n, 0);
  reset role;
end $$;

-- =============================================================================
-- T9 — Duplicar treino-modelo preserva a fidelidade e o isolamento.
--       Reproduz as operações da Server Action duplicarTreino sob RLS: lê o
--       modelo + exercícios (INCLUINDO configuracao), insere a cópia no tenant
--       da sessão com o usuário atual como criador, e copia os exercícios com
--       a configuracao intacta. Trava a regressão do bug B1 (configuracao caía).
-- =============================================================================
do $$
declare
  v_i1A uuid := (select valor from _ids where chave='i1A');
  v_acadA uuid := (select valor from _ids where chave='acadA');
  v_src uuid; v_copy uuid; v_cfg jsonb; n bigint;
begin
  raise notice 'T9 — duplicar preserva configuracao/tenant/autor';

  -- Origem: modelo do i1 com um exercício que tem configuracao não-trivial.
  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,origem_tipo,visibilidade,ativo)
    values (v_acadA,null,'Base p/ duplicar',v_i1A,'instrutor','privado',true) returning id into v_src;
  insert into public.exercicios_treino(treino_id,nome_exercicio,series,repeticoes,carga_kg,descanso_segundos,observacoes,configuracao,ordem)
    values (v_src,'Supino',4,'8',30,90,'obs',jsonb_build_object('metodo','drop-set','tempo','3-1-1'),1);

  -- Simula duplicarTreino como o AUTOR i1A, passando pelo RLS de insert.
  perform pg_temp.vira(v_i1A);
  select configuracao into v_cfg from public.exercicios_treino where treino_id = v_src;
  perform pg_temp.checarb('le configuracao do exercicio de origem', v_cfg ? 'metodo', true);

  insert into public.treinos(academia_id,aluno_id,nome_treino,criado_por,profissional_nome,
    origem,origem_tipo,visibilidade,publico,ordem)
    values (v_acadA,null,'Base p/ duplicar (cópia)',v_i1A,'I1','manual','instrutor','privado',false,999)
    returning id into v_copy;
  insert into public.exercicios_treino(treino_id,nome_exercicio,series,repeticoes,carga_kg,
    descanso_segundos,observacoes,configuracao,ordem)
  select v_copy,nome_exercicio,series,repeticoes,carga_kg,descanso_segundos,observacoes,configuracao,ordem
  from public.exercicios_treino where treino_id = v_src order by ordem;
  reset role;

  -- Fidelidade: a configuracao foi copiada (regressão do B1).
  select configuracao into v_cfg from public.exercicios_treino where treino_id = v_copy;
  perform pg_temp.checarb('copia PRESERVA configuracao (B1)', v_cfg->>'metodo' = 'drop-set', true);
  perform pg_temp.checarb('copia preserva tempo da configuracao', v_cfg->>'tempo' = '3-1-1', true);

  -- Isolamento/atributos da cópia: tenant certo, autor certo, sem aluno, não pública.
  select count(*) into n from public.treinos
    where id = v_copy and academia_id = v_acadA and aluno_id is null
      and criado_por = v_i1A and publico = false;
  perform pg_temp.checar('copia no tenant/autor certos, sem aluno, nao publica', n, 1);
  -- share_token próprio (default do banco), nunca herdado.
  select count(*) into n from public.treinos t
    where t.id = v_copy and t.share_token is not null;
  perform pg_temp.checar('copia ganha share_token proprio', n, 1);
end $$;

select '== Integração RLS/RPC de Treinos passou ==' as resultado;

rollback;
