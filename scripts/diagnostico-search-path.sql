-- =============================================================================
-- Diagnóstico — funções SECURITY DEFINER sem search_path fixo — SOMENTE LEITURA
--
-- O Security Advisor apontou 4 funções com "search_path mutável". Uma função
-- SECURITY DEFINER sem `SET search_path` pode ser induzida a resolver um nome
-- (tabela/função) para um objeto plantado num schema controlado pelo chamador —
-- vetor clássico de escalonamento. As RPCs da comunidade (085) já fazem certo
-- (`set search_path = pg_catalog, public`) e servem de modelo.
--
-- Cole no SQL Editor do Supabase e Run. Não altera nada — só lista as funções
-- a corrigir. Me passe a lista (proname + args) que eu escrevo a migration
-- fixando o search_path de cada uma, sem mudar o corpo.
-- =============================================================================
select
  p.proname                                        as funcao,
  pg_get_function_identity_arguments(p.oid)        as argumentos,
  coalesce(array_to_string(p.proconfig, ', '), '(nenhum)') as config_atual
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef                                  -- SECURITY DEFINER
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
    where cfg like 'search_path=%'
  )
order by 1, 2;
