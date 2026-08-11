-- =============================================================================
-- CI — Assertivas de segurança do banco
--
-- Cada bloco abaixo corresponde a um achado real da auditoria de 03/08/2026 e
-- levanta exceção (quebrando o build) se a falha estiver presente. O objetivo
-- não é auditar de novo, é IMPEDIR REGRESSÃO: uma vez corrigido, nunca volta
-- sem o CI apontar.
--
-- Roda depois de aplicar bootstrap -> schema.sql -> migrations 002..055.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- A1 (P0-03a) — obter_ficha_aluno não pode existir na versão de 1 argumento.
--
-- A migration 037 substituiu obter_ficha_aluno(uuid) por
-- obter_ficha_aluno(uuid, text) — token + slug — e removeu a antiga com
-- `drop function`. A versão de 1 argumento não valida tenant nenhum: quem tem
-- um aluno_id lê a ficha completa de qualquer academia. Ela ainda está
-- declarada em schema.sql:641 e concedida a anon em :723, então re-executar
-- aquele arquivo a traz de volta.
-- -----------------------------------------------------------------------------
do $$
declare
  v_assinaturas text;
begin
  select string_agg(format('%s(%s)', p.proname, pg_get_function_arguments(p.oid)), ', ')
    into v_assinaturas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'obter_ficha_aluno'
     and p.pronargs = 1;

  if v_assinaturas is not null then
    raise exception
      E'[A1/P0-03a] VAZAMENTO CROSS-TENANT: obter_ficha_aluno com 1 argumento existe.\n'
      '  Encontrado: %\n'
      '  Essa versao nao valida token nem slug — qualquer aluno_id le a ficha de qualquer academia.\n'
      '  A migration 037 a removeu; schema.sql:641 a recria e :723 a concede a anon.\n'
      '  Corrija schema.sql (ou pare de re-executa-lo) e rode: drop function public.obter_ficha_aluno(uuid);',
      v_assinaturas;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- A2 (P0-03b) — perfis_admin não pode ter UPDATE que permita trocar o papel.
--
-- A migration 014 derrubou a policy `perfil_equipe_update` por escalada de
-- privilegio: com ela, `recepcao`/`instrutor` faz PATCH no proprio registro
-- definindo papel='dono' e ganha o Financeiro. schema.sql:531-535 a recria.
--
-- A assertiva e conservadora: falha se existir QUALQUER policy de UPDATE em
-- perfis_admin cuja expressao nao mencione `papel`. Uma policy legitima tem
-- que restringir o papel de alguma forma (ex.: exigir que o autor seja dono).
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'perfis_admin'
       and cmd in ('UPDATE', 'ALL')
  loop
    if position('papel' in lower(r.expr)) = 0 then
      raise exception
        E'[A2/P0-03b] ESCALADA DE PRIVILEGIO: policy "%" permite UPDATE em perfis_admin sem restringir `papel`.\n'
        '  Expressao: %\n'
        '  Um recepcao/instrutor pode se promover a dono e abrir o Financeiro.\n'
        '  A migration 014 removeu essa policy; schema.sql:531-535 a recria.',
        r.policyname, r.expr;
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- A3 (P1-04) — o rate limit de login não pode ser manipulável por anônimo.
--
-- 017_rate_limit_login.sql:111 faz `delete from login_rate_limit where
-- chave = p_chave` e :116 concede a funcao a anon. Com a anon key (publica),
-- qualquer um zera o contador entre tentativas -> brute force ilimitado; e
-- `login_registrar_falha` a anon permite travar o login de uma equipe inteira
-- pelo IP de saida (NAT). Essas funcoes devem ser exclusivas de service_role.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('login_registrar_sucesso', 'login_registrar_falha')
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise exception
      E'[A3/P1-04] RATE LIMIT ANULAVEL: %() esta concedida a anon.\n'
      '  A anon key e publica; qualquer um zera/infla o contador de qualquer chave.\n'
      '  Corrija com: revoke execute on function public.%(text) from anon, authenticated;',
      r.proname, r.proname;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- A4 (P1-08) — acao_permitida não pode aceitar a janela do chamador.
--
-- 021:201-229 usa `p_janela_seg`, vindo do cliente, na decisao de reiniciar o
-- contador. Chamar acao_permitida('<chave>', 1, 0) zera o anti-spam de upload
-- de foto e de feedback. A janela precisa ser constante dentro da funcao.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fonte text;
begin
  select pg_get_functiondef(p.oid) into v_fonte
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'acao_permitida'
   limit 1;

  if v_fonte is not null
     and position('p_janela_seg' in v_fonte) > 0
     and position('make_interval(secs => p_janela_seg)' in v_fonte) > 0
  then
    raise exception
      E'[A4/P1-08] ANTI-SPAM ZERAVEL: acao_permitida() usa p_janela_seg (parametro do chamador) para decidir reiniciar o contador.\n'
      '  Chamar acao_permitida(chave, 1, 0) zera o limite de upload/feedback.\n'
      '  Fixe a janela dentro da funcao em vez de aceita-la como argumento.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- A5 — toda tabela de `public` precisa ter RLS habilitada.
--
-- Hoje isso esta correto (28/28 verificadas na auditoria). A assertiva existe
-- para que uma tabela nova criada sem `enable row level security` nao passe.
-- -----------------------------------------------------------------------------
do $$
declare
  v_tabelas text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_tabelas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  if v_tabelas is not null then
    raise exception
      E'[A5] TABELA SEM RLS: %\n'
      '  Em um app multi-tenant, tabela sem RLS e vazamento entre academias.\n'
      '  Adicione: alter table public.<tabela> enable row level security;',
      v_tabelas;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- A6 — toda tabela com RLS precisa ter ao menos uma policy.
--
-- RLS habilitada sem policy nenhuma nega tudo para anon/authenticated. Nao e
-- falha de seguranca, e falha funcional: a tela fica vazia sem erro visivel —
-- exatamente o modo de falha silenciosa do P2-13 (instrutor e `receitas`).
-- -----------------------------------------------------------------------------
do $$
declare
  v_tabelas text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_tabelas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and not exists (
       select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
     );

  if v_tabelas is not null then
    raise exception
      E'[A6] RLS SEM POLICY (nega tudo silenciosamente): %', v_tabelas;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- A7 — valores monetários têm de ser numeric, nunca float.
--
-- Hoje esta correto: numeric(10,2) em planos.valor_mensal, receitas.valor,
-- despesas.valor, historico_planos.valor, acessos_catraca.valor_repasse.
-- A assertiva impede que uma coluna de dinheiro nova entre como float/real/
-- double precision, que arredonda errado.
-- -----------------------------------------------------------------------------
do $$
declare
  v_colunas text;
begin
  select string_agg(format('%s.%s (%s)', table_name, column_name, data_type), ', ')
    into v_colunas
    from information_schema.columns
   where table_schema = 'public'
     and data_type in ('real', 'double precision')
     and (column_name ~ '(valor|preco|salario|total|saldo|custo)' );

  if v_colunas is not null then
    raise exception
      E'[A7] DINHEIRO EM PONTO FLUTUANTE: %\n'
      '  Use numeric(10,2). float arredonda errado em soma de dinheiro.',
      v_colunas;
  end if;
end
$$;

select '== Todas as assertivas de seguranca passaram ==' as resultado;
