-- =============================================================================
-- CI — Inventário dos objetos do schema `public`.
--
-- Produz UMA LINHA POR OBJETO, em texto, para ser comparado entre dois bancos.
-- É a peça central da detecção de migration pendente (conferir-producao.yml):
-- o mesmo arquivo roda contra um Postgres efêmero (onde schema.sql + todas as
-- migrations acabaram de ser aplicadas) e contra produção. O que existir no
-- primeiro e faltar no segundo é, por definição, migration não aplicada.
--
-- POR QUE COMPARAR EM VEZ DE MANTER UMA LISTA
--   Uma lista de "objetos esperados" escrita à mão envelhece: quem adiciona a
--   migration 064 esquece de atualizá-la, e o detector passa a mentir. Aqui a
--   referência é gerada a partir dos próprios arquivos .sql, então ela nunca
--   fica desatualizada — se a migration existe no repositório, ela entra na
--   referência automaticamente.
--
-- SOMENTE LEITURA
--   Só consulta catálogos do Postgres (pg_class, pg_proc, pg_policies...).
--   Nenhum insert, update, delete ou DDL. É seguro rodar em produção — é
--   exatamente o que o workflow faz.
--
-- OBJETOS DE EXTENSÃO SÃO IGNORADOS
--   `pg_trgm` (usado pela busca por semelhança) instala dezenas de funções em
--   `public`. Elas pertencem à extensão, não ao projeto, e apareceriam como
--   diferença sempre que as duas pontas tivessem versões distintas do
--   Postgres. O filtro `pg_depend.deptype = 'e'` remove tudo que foi criado
--   por extensão.
-- =============================================================================

\pset tuples_only on
\pset format unaligned

select linha from (

  select 'tabela: ' || c.relname as linha
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not exists (
       select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e'
     )

  union all

  -- Coluna com o tipo: pega a migration aplicada pela metade, em que a tabela
  -- existe mas a coluna nova não (foi o caso de `dia_vencimento` na 024).
  select 'coluna: ' || table_name || '.' || column_name || ' ' || data_type
    from information_schema.columns
   where table_schema = 'public'

  union all

  -- Assinatura completa: `obter_ficha_aluno(uuid)` e
  -- `obter_ficha_aluno(uuid, text)` são funções DIFERENTES, e confundir as
  -- duas foi exatamente a falha P0-03.
  select 'funcao: ' || p.proname || '(' || pg_get_function_arguments(p.oid) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (
       select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
     )

  union all

  -- Policy ausente = tabela sem isolamento entre academias.
  select 'policy: ' || tablename || '.' || policyname
    from pg_policies
   where schemaname = 'public'

  union all

  select 'rls: ' || c.relname || ' = ' || c.relrowsecurity::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'

  union all

  -- Junta com pg_class em vez de usar `conrelid::regclass::text`: o cast
  -- depende do search_path da conexão e renderiza "alunos" num banco e
  -- "public.alunos" no outro — o que faria TODA constraint parecer diferente.
  select 'constraint: ' || c.relname || '.' || con.conname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
   where con.connamespace = 'public'::regnamespace

  union all

  select 'indice: ' || tablename || '.' || indexname
    from pg_indexes
   where schemaname = 'public'

) inventario
order by linha;
