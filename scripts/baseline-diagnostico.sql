-- =============================================================================
-- Diagnóstico de baseline — SOMENTE LEITURA
--
-- Cole e execute no SQL Editor do Supabase (produção). NÃO altera nada: só
-- reporta o estado real do banco para você seguir docs/migrations-baseline-
-- producao.md com segurança. Nenhum INSERT, UPDATE, DROP ou repair aqui.
--
-- Objetivo: responder três perguntas antes de qualquer baseline/repair:
--   1) O histórico de migrations está mesmo vazio?
--   2) Os hardenings de segurança que a auditoria destacou estão em produção?
--   3) O inventário bate com o conjunto local de migrations?
-- =============================================================================

-- 1) Histórico de migrations -------------------------------------------------
select 'schema_migrations' as verificacao,
       count(*)            as linhas
from   supabase_migrations.schema_migrations;
-- (Se a tabela não existir, o próprio erro já confirma o achado do briefing.)

-- 2) Hardenings críticos presentes? ------------------------------------------
--    Cada linha deve retornar `presente = true`. Um `false` = delta prioritário
--    a aplicar (a migration correspondente NÃO está em produção).
with checks(item, presente) as (
  values
  -- 088: gerar_folha_do_mes checa papel 'dono'
  ('088 folha exige dono',
   exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='gerar_folha_do_mes'
       and position('papel_do_usuario_atual' in pg_get_functiondef(p.oid)) > 0
   )),
  -- 082: gerar_mensalidades_do_mes checa papel
  ('082 mensalidades exige dono',
   exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='gerar_mensalidades_do_mes'
       and position('<> ''dono''' in pg_get_functiondef(p.oid)) > 0
   )),
  -- 085: RPCs da comunidade existem
  ('085 comunidade (obter_feed_comunidade)',
   exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='obter_feed_comunidade'
   )),
  -- 085: tabelas da comunidade existem e têm RLS
  ('085 comunidade_posts com RLS',
   exists (
     select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='comunidade_posts' and c.relrowsecurity
   )),
  -- 086: bucket de storage da comunidade
  ('086 bucket comunidade',
   exists (select 1 from storage.buckets where id='comunidade')),
  -- 037/075: ficha do aluno multi-tenant (2 args), a de 1 arg NÃO deve existir
  ('037 obter_ficha_aluno(uuid,text) presente',
   exists (
     select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='obter_ficha_aluno' and p.pronargs=2
   )),
  ('037 obter_ficha_aluno(uuid) 1-arg AUSENTE (deve ser true)',
   not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='obter_ficha_aluno' and p.pronargs=1
   ))
)
select item, presente,
       case when presente then 'OK' else '>>> DELTA — aplicar migration' end as acao
from checks
order by presente, item;

-- 3) Inventário: contagens gerais --------------------------------------------
select 'tabelas public'      as objeto, count(*) from pg_tables  where schemaname='public'
union all
select 'funcoes public',     count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all
select 'policies public',    count(*) from pg_policies where schemaname='public'
union all
select 'tabelas sem RLS',    count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 4) Tabelas com RLS e SEM policy (esperado: só as deny-all intencionais) -----
--    Esperado hoje: logs_erros, sessoes_treino, backup_padronizacao_060,
--    comunidade_curtidas. Qualquer OUTRA aqui = investigar (tela vazia sem erro).
select c.relname as tabela_rls_sem_policy
from   pg_class c join pg_namespace n on n.oid=c.relnamespace
where  n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
order by 1;

-- 5) Higiene: backup interno ainda no schema public? -------------------------
select 'backup_padronizacao_060 presente' as verificacao,
       exists (select 1 from pg_tables where schemaname='public' and tablename='backup_padronizacao_060') as presente;
