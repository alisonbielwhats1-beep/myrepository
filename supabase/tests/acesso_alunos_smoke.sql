-- =============================================================================
-- Smoke test do fluxo de acesso do aluno (migrations 065/066).
--
-- Valida, ponta a ponta, os critérios de aceite principais do prompt:
--   convite -> preview mascarado -> ativação (Google, e-mail diferente do
--   contato) -> vínculo único sem duplicar aluno -> idempotência -> conflitos
--   -> expiração -> auditoria persistida sem token.
--
-- COMO RODAR (ambiente local, NÃO produção): este teste impersona contas
-- setando o GUC `request.jwt.claim.sub` (o que o Supabase faz via JWT). Isso
-- só funciona num Postgres local com um stub de `auth.users` + `auth.uid()`
-- lendo esse GUC. NÃO rode em produção — lá a identidade vem do JWT real.
--
-- Cada bloco `do $$ ... $$` faz asserts com `raise exception` em caso de falha,
-- então o teste PARA no primeiro erro. Sucesso = roda até "SMOKE TEST OK".
-- =============================================================================

-- Limpeza idempotente do cenário (ids fixos deste teste).
delete from public.logs_acesso where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.convites_acesso where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.academia_membros where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.matriculas where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.alunos where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.perfis_admin where academia_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.academias where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');

insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','admin@geracao.com'),
  ('22222222-2222-2222-2222-222222222222','maria.pessoal@gmail.com'),
  ('33333333-3333-3333-3333-333333333333','intruso@gmail.com');

insert into public.academias(id,nome_fantasia,slug_url) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Academia Geração Saúde','geracao-saude');
insert into public.perfis_admin(id,academia_id,nome,email,papel) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Dona Ana','admin@geracao.com','dono');
insert into public.alunos(id,academia_id,nome,email) values
  ('a1111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Maria Silva','maria.contato-antigo@academia.com'),
  ('a2222222-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Joao Souza', null);

-- Helper local: hash sha-256 hex de um "token bruto".
create or replace function pg_temp.h(t text) returns text language sql as
  $$ select encode(digest(t,'sha256'),'hex') $$;

-- 1) Equipe gera convite para Maria.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.gerar_convite_acesso('a1111111-0000-0000-0000-000000000001', pg_temp.h('TOK_MARIA_000000000000000000000000000'), now()+interval '7 days');

-- 2) Preview anônimo mascara o nome.
do $$
declare v jsonb;
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub','',true);
  v := public.preview_convite_acesso(encode(digest('TOK_MARIA_000000000000000000000000000','sha256'),'hex'));
  reset role;
  if v->>'aluno_nome_mascarado' <> 'Maria S.' then raise exception 'FALHA preview mascarado: %', v; end if;
  if v->>'academia_nome' <> 'Academia Geração Saúde' then raise exception 'FALHA preview academia'; end if;
end$$;

-- 3) Maria ativa com Google (conta com e-mail diferente do contato).
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare r jsonb;
begin
  r := public.ativar_convite_acesso(encode(digest('TOK_MARIA_000000000000000000000000000','sha256'),'hex'));
  if r->>'status' <> 'ativado' then raise exception 'FALHA ativacao: %', r; end if;
end$$;

-- 4) Vínculo correto, sem duplicar, convite consumido.
do $$
begin
  if (select auth_user_id from public.alunos where id='a1111111-0000-0000-0000-000000000001')
       <> '22222222-2222-2222-2222-222222222222' then raise exception 'FALHA vinculo aluno'; end if;
  if (select count(*) from public.alunos where nome='Maria Silva') <> 1 then raise exception 'FALHA aluno duplicado'; end if;
  if (select status from public.convites_acesso where aluno_id='a1111111-0000-0000-0000-000000000001'
        order by criado_em desc limit 1) <> 'utilizado' then raise exception 'FALHA convite nao consumido'; end if;
  if (select status_acesso from public.academia_membros where aluno_id='a1111111-0000-0000-0000-000000000001')
       <> 'ativo' then raise exception 'FALHA membro nao ativo'; end if;
end$$;

-- 5) Idempotência: reexecutar -> ja_ativado, sem duplicar membro.
do $$
declare r jsonb;
begin
  r := public.ativar_convite_acesso(encode(digest('TOK_MARIA_000000000000000000000000000','sha256'),'hex'));
  if r->>'status' <> 'ja_ativado' then raise exception 'FALHA idempotencia: %', r; end if;
  if (select count(*) from public.academia_membros where aluno_id='a1111111-0000-0000-0000-000000000001') <> 1
    then raise exception 'FALHA membro duplicado'; end if;
end$$;

-- 6) Intruso tenta o convite já usado -> convite_utilizado (retorno, não erro).
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare r jsonb;
begin
  r := public.ativar_convite_acesso(encode(digest('TOK_MARIA_000000000000000000000000000','sha256'),'hex'));
  if r->>'status' <> 'convite_utilizado' then raise exception 'FALHA intruso: %', r; end if;
end$$;

-- 7) Conta já vinculada a outro aluno: novo convite p/ Joao, Maria tenta ativar.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.gerar_convite_acesso('a2222222-0000-0000-0000-000000000002', pg_temp.h('TOK_JOAO_1111111111111111111111111111'), now()+interval '7 days');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare r jsonb;
begin
  r := public.ativar_convite_acesso(encode(digest('TOK_JOAO_1111111111111111111111111111','sha256'),'hex'));
  if r->>'status' <> 'conta_ja_vinculada_outro_aluno' then raise exception 'FALHA conflito conta: %', r; end if;
end$$;

-- 8) Convite expirado -> convite_expirado, e passa a ficar 'expirado'.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.revogar_convite_acesso((select id from public.convites_acesso where aluno_id='a2222222-0000-0000-0000-000000000002' and status in ('gerado','enviado','aguardando_ativacao')));
insert into public.convites_acesso(academia_id,aluno_id,token_hash,status,expira_em)
  values('aaaaaaaa-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002', encode(digest('TOK_EXP_222222222222222222222222222','sha256'),'hex'),'gerado', now()-interval '1 day');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare r jsonb;
begin
  r := public.ativar_convite_acesso(encode(digest('TOK_EXP_222222222222222222222222222','sha256'),'hex'));
  if r->>'status' <> 'convite_expirado' then raise exception 'FALHA expirado: %', r; end if;
  if (select status from public.convites_acesso where token_hash=encode(digest('TOK_EXP_222222222222222222222222222','sha256'),'hex')) <> 'expirado'
    then raise exception 'FALHA convite nao marcado expirado (rollback indevido)'; end if;
end$$;

-- 9) Auditoria de rejeições PERSISTE e NUNCA contém token.
do $$
begin
  if (select count(*) from public.logs_acesso where evento='ativacao_rejeitada') < 3
    then raise exception 'FALHA auditoria de rejeicao nao persistiu'; end if;
  if (select count(*) from public.logs_acesso where metadados::text ilike '%TOK_%') > 0
    then raise exception 'FALHA token vazou no log'; end if;
  if (select count(*) from public.logs_acesso where evento='conta_ativada') <> 1
    then raise exception 'FALHA log de ativacao'; end if;
end$$;

-- 10) Matrícula: 1 ativa por aluno; segunda ativa falha por índice parcial.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.iniciar_matricula('a1111111-0000-0000-0000-000000000001', null, current_date);
do $$
declare ok boolean := false;
begin
  begin
    perform public.iniciar_matricula('a1111111-0000-0000-0000-000000000001', null, current_date);
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'FALHA permitiu duas matriculas ativas'; end if;
end$$;
-- Encerrar e reabrir cria período novo, preservando o anterior.
select public.encerrar_matricula((select id from public.matriculas where aluno_id='a1111111-0000-0000-0000-000000000001' and status='ativa'), 'encerrada', 'saiu', current_date);
select public.iniciar_matricula('a1111111-0000-0000-0000-000000000001', null, current_date);
do $$
begin
  if (select count(*) from public.matriculas where aluno_id='a1111111-0000-0000-0000-000000000001') <> 2
    then raise exception 'FALHA historico de matricula nao preservado'; end if;
end$$;

-- 11) Suspender acesso bloqueia o membro e revoga convites pendentes.
select public.gerar_convite_acesso('a2222222-0000-0000-0000-000000000002', pg_temp.h('TOK_JOAO2_33333333333333333333333333'), now()+interval '7 days');
select public.suspender_acesso_aluno('a1111111-0000-0000-0000-000000000001', 'inadimplencia');
do $$
begin
  if (select status_acesso from public.academia_membros where aluno_id='a1111111-0000-0000-0000-000000000001') <> 'suspenso'
    then raise exception 'FALHA suspensao'; end if;
end$$;

-- 12) auditar_migracao_alunos devolve contagens coerentes (2 alunos, 1 vinculado).
do $$
declare r jsonb;
begin
  r := public.auditar_migracao_alunos();
  if (r->>'total')::int <> 2 then raise exception 'FALHA total migracao: %', r; end if;
  if (r->>'ja_vinculados')::int <> 1 then raise exception 'FALHA vinculados migracao: %', r; end if;
end$$;

select '================ SMOKE TEST OK ================' as resultado;
