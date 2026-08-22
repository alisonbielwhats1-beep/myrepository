-- =============================================================================
-- CI — Isolamento e autorização do módulo Comunidade (migrations 085/089/090)
--
-- POR QUE ISSO EXISTE
--   A comunidade (feed, denúncia, moderação, auto-ocultar, restaurar, aviso ao
--   gestor) foi adicionada sem teste de banco. Este arquivo fecha a lacuna com
--   dois tenants (Alfa e Beta) e prova, empiricamente, que:
--     • o feed de um aluno só mostra a PRÓPRIA academia;
--     • denunciar/curtir um post de OUTRA academia é recusado (resolvido por
--       token+slug dentro das RPCs — nunca por id do cliente);
--     • moderar exige papel dono/gerente e é sempre da academia da sessão;
--     • restaurar reverte só remoção da MODERAÇÃO, nunca a exclusão do autor;
--     • o alerta de denúncia (categoria 'comunidade') só é visível a dono/gerente
--       da própria academia (RLS de notificacoes, migration 090).
--
--   Mesmo mecanismo do 20_teste_rls_multitenant.sql: "vira" cada usuário com
--   `set local role` + `request.jwt.claim.sub`. As RPCs do aluno são chamadas
--   como `anon` (o app do aluno usa a anon key + token). Tudo dentro de uma
--   transação com ROLLBACK — não deixa resíduo.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.checar(
  p_nome text, p_obtido bigint, p_esperado bigint
) returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception '[COM] FALHA: % — esperado %, obtido %', p_nome, p_esperado, p_obtido;
  end if;
  raise notice '  OK   %', p_nome;
end
$$;

-- rejeitou() roda uma expressão que DEVE falhar (rejeição da RPC). Retorna true
-- se falhou (correto) e false se passou (falha de segurança). Não usa exceção
-- própria para não se confundir com a exceção esperada.
create temporary table _c (chave text primary key, valor uuid);

do $$
declare
  v_ac_alfa uuid := gen_random_uuid();
  v_ac_beta uuid := gen_random_uuid();
  v_dono_alfa uuid := gen_random_uuid();
  v_ger_alfa  uuid := gen_random_uuid();
  v_rec_alfa  uuid := gen_random_uuid();
  v_dono_beta uuid := gen_random_uuid();
  v_al_alfa uuid := gen_random_uuid();
  v_al_beta uuid := gen_random_uuid();
  v_tok_alfa uuid := gen_random_uuid();
  v_tok_beta uuid := gen_random_uuid();
  v_post_alfa uuid := gen_random_uuid();
  v_post_beta uuid := gen_random_uuid();
  v_post_alfa_autor uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values
    (v_dono_alfa, 'dono.alfa@exemplo.invalido'),
    (v_ger_alfa,  'ger.alfa@exemplo.invalido'),
    (v_rec_alfa,  'rec.alfa@exemplo.invalido'),
    (v_dono_beta, 'dono.beta@exemplo.invalido');

  insert into public.academias (id, nome_fantasia, slug_url) values
    (v_ac_alfa, 'Comunidade Alfa (teste)', 'com-alfa-teste'),
    (v_ac_beta, 'Comunidade Beta (teste)', 'com-beta-teste');

  insert into public.perfis_admin (id, academia_id, nome, email, papel) values
    (v_dono_alfa, v_ac_alfa, 'Dono Alfa', 'dono.alfa@exemplo.invalido', 'dono'),
    (v_ger_alfa,  v_ac_alfa, 'Gerente Alfa', 'ger.alfa@exemplo.invalido', 'gerente'),
    (v_rec_alfa,  v_ac_alfa, 'Recepcao Alfa', 'rec.alfa@exemplo.invalido', 'recepcao'),
    (v_dono_beta, v_ac_beta, 'Dono Beta', 'dono.beta@exemplo.invalido', 'dono');

  insert into public.alunos (id, academia_id, nome, token_acesso_publico) values
    (v_al_alfa, v_ac_alfa, 'Aluno Alfa', v_tok_alfa),
    (v_al_beta, v_ac_beta, 'Aluno Beta', v_tok_beta);

  insert into public.comunidade_posts (id, academia_id, aluno_id, legenda) values
    (v_post_alfa, v_ac_alfa, v_al_alfa, 'Post Alfa'),
    (v_post_beta, v_ac_beta, v_al_beta, 'Post Beta');

  -- Post já excluído PELO AUTOR (para provar que restaurar não o reverte).
  insert into public.comunidade_posts (id, academia_id, aluno_id, legenda, removido_em, removido_por)
  values (v_post_alfa_autor, v_ac_alfa, v_al_alfa, 'Post Alfa do autor', now(), 'autor');

  insert into _c values
    ('ac_alfa', v_ac_alfa), ('ac_beta', v_ac_beta),
    ('dono_alfa', v_dono_alfa), ('ger_alfa', v_ger_alfa), ('rec_alfa', v_rec_alfa),
    ('dono_beta', v_dono_beta),
    ('tok_alfa', v_tok_alfa), ('tok_beta', v_tok_beta),
    ('post_alfa', v_post_alfa), ('post_beta', v_post_beta),
    ('post_alfa_autor', v_post_alfa_autor);
end
$$;

-- =============================================================================
-- T1 — Feed do aluno Alfa mostra só a Alfa (chamado como anon + token).
-- =============================================================================
do $$
declare
  v_tok_alfa uuid := (select valor from _c where chave = 'tok_alfa');
  v_feed jsonb;
  n bigint;
begin
  raise notice 'T1 — feed isolado por academia';
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;

  v_feed := public.obter_feed_comunidade(v_tok_alfa, 'com-alfa-teste');
  perform pg_temp.checar('feed Alfa tem 1 post (o post do autor, excluído, não conta)',
    jsonb_array_length(v_feed), 1);

  n := case when v_feed::text like '%Post Beta%' then 1 else 0 end;
  perform pg_temp.checar('feed Alfa NÃO contém post da Beta', n, 0);

  reset role;
end
$$;

-- =============================================================================
-- T2 — Aluno Alfa não denuncia nem curte post da Beta (cross-tenant).
-- =============================================================================
do $$
declare
  v_tok_alfa uuid := (select valor from _c where chave = 'tok_alfa');
  v_post_beta uuid := (select valor from _c where chave = 'post_beta');
  v_r jsonb;
  n bigint;
begin
  raise notice 'T2 — denunciar/curtir cross-tenant negado';
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;

  v_r := public.denunciar_post_comunidade(v_tok_alfa, 'com-alfa-teste', v_post_beta, 'teste');
  perform pg_temp.checar('denunciar post da Beta com token Alfa = null',
    case when v_r is null then 0 else 1 end, 0);

  v_r := public.curtir_post_comunidade(v_tok_alfa, 'com-alfa-teste', v_post_beta);
  perform pg_temp.checar('curtir post da Beta com token Alfa = null',
    case when v_r is null then 0 else 1 end, 0);

  reset role;

  -- Nenhuma denúncia/curtida foi gravada no post da Beta (verifica como owner).
  select count(*) into n from public.comunidade_denuncias where post_id = v_post_beta;
  perform pg_temp.checar('post da Beta segue sem denúncia', n, 0);
  select count(*) into n from public.comunidade_curtidas where post_id = v_post_beta;
  perform pg_temp.checar('post da Beta segue sem curtida', n, 0);
end
$$;

-- =============================================================================
-- T3 — Moderação: papel + tenant. Recepção não modera; Beta não modera Alfa;
--       dono Alfa remove o post da Alfa.
-- =============================================================================
do $$
declare
  v_rec_alfa uuid := (select valor from _c where chave = 'rec_alfa');
  v_dono_beta uuid := (select valor from _c where chave = 'dono_beta');
  v_dono_alfa uuid := (select valor from _c where chave = 'dono_alfa');
  v_post_alfa uuid := (select valor from _c where chave = 'post_alfa');
  v_rejeitou boolean;
  v_por text;
begin
  raise notice 'T3 — autorização de moderação';

  -- Recepção Alfa NÃO pode moderar.
  perform set_config('request.jwt.claim.sub', v_rec_alfa::text, true);
  set local role authenticated;
  v_rejeitou := false;
  begin perform public.remover_post_moderacao(v_post_alfa);
  exception when others then v_rejeitou := true; end;
  reset role;
  perform pg_temp.checar('recepção NÃO modera', case when v_rejeitou then 0 else 1 end, 0);

  -- Dono da Beta NÃO remove post da Alfa (tenant errado).
  perform set_config('request.jwt.claim.sub', v_dono_beta::text, true);
  set local role authenticated;
  v_rejeitou := false;
  begin perform public.remover_post_moderacao(v_post_alfa);
  exception when others then v_rejeitou := true; end;
  reset role;
  perform pg_temp.checar('dono da Beta NÃO remove post da Alfa', case when v_rejeitou then 0 else 1 end, 0);

  -- Dono da Alfa remove o próprio post.
  perform set_config('request.jwt.claim.sub', v_dono_alfa::text, true);
  set local role authenticated;
  perform public.remover_post_moderacao(v_post_alfa);
  reset role;

  select removido_por into v_por from public.comunidade_posts where id = v_post_alfa;
  perform pg_temp.checar('post da Alfa removido pela moderação',
    case when v_por = 'moderacao' then 1 else 0 end, 1);
end
$$;

-- =============================================================================
-- T4 — Restaurar: dono reverte remoção da moderação, mas NÃO a exclusão do autor.
-- =============================================================================
do $$
declare
  v_dono_alfa uuid := (select valor from _c where chave = 'dono_alfa');
  v_post_alfa uuid := (select valor from _c where chave = 'post_alfa');
  v_post_autor uuid := (select valor from _c where chave = 'post_alfa_autor');
  v_removido timestamptz;
  v_rejeitou boolean;
begin
  raise notice 'T4 — restaurar (moderação sim, autor não)';

  perform set_config('request.jwt.claim.sub', v_dono_alfa::text, true);
  set local role authenticated;

  -- Restaura o post removido pela moderação (T3).
  perform public.restaurar_post_moderacao(v_post_alfa);

  -- Exclusão do autor NÃO é restaurável pela moderação.
  v_rejeitou := false;
  begin perform public.restaurar_post_moderacao(v_post_autor);
  exception when others then v_rejeitou := true; end;

  reset role;

  select removido_em into v_removido from public.comunidade_posts where id = v_post_alfa;
  perform pg_temp.checar('post da moderação foi restaurado (removido_em nulo)',
    case when v_removido is null then 1 else 0 end, 1);

  perform pg_temp.checar('exclusão do autor NÃO é restaurável',
    case when v_rejeitou then 0 else 1 end, 0);

  select removido_em into v_removido from public.comunidade_posts where id = v_post_autor;
  perform pg_temp.checar('post do autor continua removido',
    case when v_removido is not null then 1 else 0 end, 1);
end
$$;

-- =============================================================================
-- T5 — Aviso de denúncia (categoria 'comunidade') só para dono/gerente da
--       própria academia (RLS de notificacoes, migration 090).
-- =============================================================================
do $$
declare
  v_ac_alfa uuid := (select valor from _c where chave = 'ac_alfa');
  v_post_alfa uuid := (select valor from _c where chave = 'post_alfa');
  v_dono_alfa uuid := (select valor from _c where chave = 'dono_alfa');
  v_ger_alfa uuid := (select valor from _c where chave = 'ger_alfa');
  v_rec_alfa uuid := (select valor from _c where chave = 'rec_alfa');
  v_dono_beta uuid := (select valor from _c where chave = 'dono_beta');
  n bigint;
begin
  raise notice 'T5 — RLS do alerta de denúncia (categoria comunidade)';

  -- Cria o alerta como owner (o INSERT real acontece via SECURITY DEFINER).
  insert into public.notificacoes
    (academia_id, categoria, tipo, prioridade, titulo, mensagem,
     entidade, entidade_id, data_referencia, dedupe_key)
  values (v_ac_alfa, 'comunidade', 'comunidade_denuncia', 'media',
    'Publicação denunciada', 'Revise na Moderação.', 'post', v_post_alfa,
    current_date, 'post:' || v_post_alfa::text || ':denuncia');

  perform set_config('request.jwt.claim.sub', v_rec_alfa::text, true);
  set local role authenticated;
  select count(*) into n from public.notificacoes where categoria = 'comunidade';
  reset role;
  perform pg_temp.checar('recepção NÃO vê alerta de comunidade', n, 0);

  perform set_config('request.jwt.claim.sub', v_dono_alfa::text, true);
  set local role authenticated;
  select count(*) into n from public.notificacoes where categoria = 'comunidade';
  reset role;
  perform pg_temp.checar('dono vê o alerta de comunidade = 1', n, 1);

  perform set_config('request.jwt.claim.sub', v_ger_alfa::text, true);
  set local role authenticated;
  select count(*) into n from public.notificacoes where categoria = 'comunidade';
  reset role;
  perform pg_temp.checar('gerente vê o alerta de comunidade = 1', n, 1);

  perform set_config('request.jwt.claim.sub', v_dono_beta::text, true);
  set local role authenticated;
  select count(*) into n from public.notificacoes where categoria = 'comunidade';
  reset role;
  perform pg_temp.checar('dono da Beta NÃO vê alerta da Alfa', n, 0);
end
$$;

select '== Teste de comunidade (isolamento + moderação) passou ==' as resultado;

rollback;
