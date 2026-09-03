-- =============================================================================
-- Migração 097 — Corrige a classificação de "aluno sem plano" feita pela 096
--
-- O QUE A 096 ASSUMIU ERRADO
--   A 096 classificou todo aluno sem `plano_id` como 'avulso'. O raciocínio
--   era "sem plano hoje, sem plano no rótulo". Só que, na base real, a grande
--   maioria desses alunos é OUTRA COISA: cadastro iniciado pela recepção que
--   ainda não teve o plano escolhido. O dono confirmou: "cadastrou um aluno
--   mas não colocou o plano ainda; depois provavelmente vai colocar".
--
-- POR QUE ISSO IMPORTA (não é só rótulo)
--   'avulso' significa "não precisa de plano da academia". Com esse valor:
--     • a trava que segura o aluno em "pendente" enquanto falta plano deixa
--       de valer para ele;
--     • o formulário ESCONDE o select de plano — a recepção não conseguiria
--       terminar o cadastro sem antes trocar a origem, que é justo o oposto
--       do que ela precisa fazer.
--   'plano_academia' sem plano definido é o estado certo: mantém exatamente o
--   comportamento de hoje (pendente até escolher o plano) e deixa o campo de
--   plano à vista, que é onde a recepção vai completar o cadastro.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   Devolve para 'plano_academia' os alunos que a 096 marcou 'avulso' e que
--   continuam sem plano e sem convênio. 'avulso' passa a ser o que sempre
--   deveria ter sido: escolha explícita do dono (diária, cortesia, uso
--   pontual), nunca um palpite de migração.
--
-- O QUE ELA **NÃO** FAZ
--   Não toca em plano_id, status_matricula, dia_vencimento, planos,
--   historico_planos nem receitas — a mesma impressão digital da 096 é
--   conferida antes e depois e a migração ABORTA em rollback se divergir.
--   Não mexe em aluno COM plano, nem em quem tem parceiro_externo preenchido,
--   nem nas origens de parceiro.
--
-- JANELA DE SEGURANÇA
--   Rode ANTES de publicar a tela nova. Enquanto o formulário com o campo de
--   origem não estiver no ar, ninguém conseguiu escolher 'avulso' de
--   propósito — logo, todo 'avulso' sem plano hoje veio da 096 e é seguro
--   reverter. Depois do deploy, uma escolha manual do dono seria desfeita
--   por esta migração, e por isso ela reporta quantas linhas mudou.
--
-- IDEMPOTENTE: rodar de novo não encontra mais nada para corrigir.
-- =============================================================================

do $verificacao$
declare
  v_impressao_antes  text;
  v_impressao_depois text;
  v_alunos_antes     bigint;
  v_alunos_depois    bigint;
  v_planos_antes     bigint;
  v_planos_depois    bigint;
  v_historico_antes  bigint;
  v_historico_depois bigint;
  v_receitas_antes   bigint;
  v_receitas_depois  bigint;
  v_corrigidos       bigint;
  v_restam_avulso    bigint;
begin
  -- Mesma impressão digital da 096: vínculo de plano + status, aluno a aluno.
  select
    coalesce(md5(string_agg(
      a.id::text || '|' || coalesce(a.plano_id::text, 'sem-plano') || '|' || a.status_matricula::text,
      ',' order by a.id
    )), 'base-vazia'),
    count(*)
    into v_impressao_antes, v_alunos_antes
  from public.alunos a;

  select count(*) into v_planos_antes    from public.planos;
  select count(*) into v_historico_antes from public.historico_planos;
  select count(*) into v_receitas_antes  from public.receitas;

  -- A correção. `parceiro_externo is null` protege quem já foi marcado à mão.
  with corrigidos as (
    update public.alunos
       set origem_acesso = 'plano_academia'::origem_acesso_aluno_enum
     where origem_acesso = 'avulso'::origem_acesso_aluno_enum
       and plano_id is null
       and parceiro_externo is null
    returning 1
  )
  select count(*) into v_corrigidos from corrigidos;

  select
    coalesce(md5(string_agg(
      a.id::text || '|' || coalesce(a.plano_id::text, 'sem-plano') || '|' || a.status_matricula::text,
      ',' order by a.id
    )), 'base-vazia'),
    count(*)
    into v_impressao_depois, v_alunos_depois
  from public.alunos a;

  select count(*) into v_planos_depois    from public.planos;
  select count(*) into v_historico_depois from public.historico_planos;
  select count(*) into v_receitas_depois  from public.receitas;

  if v_impressao_antes is distinct from v_impressao_depois then
    raise exception
      'MIGRAÇÃO 097 ABORTADA: o vínculo de plano ou o status de algum aluno mudou. '
      'Impressão antes=% depois=%. Nenhuma alteração foi mantida.',
      v_impressao_antes, v_impressao_depois;
  end if;

  if v_alunos_antes    <> v_alunos_depois
     or v_planos_antes    <> v_planos_depois
     or v_historico_antes <> v_historico_depois
     or v_receitas_antes  <> v_receitas_depois then
    raise exception
      'MIGRAÇÃO 097 ABORTADA: contagem divergente. '
      'alunos %/%, planos %/%, historico_planos %/%, receitas %/% (antes/depois).',
      v_alunos_antes, v_alunos_depois,
      v_planos_antes, v_planos_depois,
      v_historico_antes, v_historico_depois,
      v_receitas_antes, v_receitas_depois;
  end if;

  select count(*) into v_restam_avulso
    from public.alunos where origem_acesso = 'avulso'::origem_acesso_aluno_enum;

  raise notice
    'Migração 097 OK — % alunos voltaram de "avulso" para "plano da academia" '
    '(cadastro sem plano definido, continuam pendentes até o plano ser escolhido). '
    'Restam % como avulso de propósito. Nenhum plano, vínculo, status, histórico '
    'ou receita foi alterado.',
    v_corrigidos, v_restam_avulso;
end
$verificacao$;
