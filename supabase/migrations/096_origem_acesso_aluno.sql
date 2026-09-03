-- =============================================================================
-- Migração 096 — Origem de acesso do aluno (parceiro ≠ periodicidade)
--
-- PEDIDO DO CLIENTE
--   "Hoje o cadastro mistura opções como 'nenhum', 'mensal' e 'trimestral'.
--   Isso mistura origem do acesso com periodicidade." E, sobre qualquer
--   mudança: "os dados não podem perder — se o cliente cadastrou um aluno e o
--   plano dele é mensal, isso não podemos perder".
--
-- O PROBLEMA REAL (não era só rótulo)
--   `public.alunos` só tinha `plano_id`. Não existia nenhum campo dizendo de
--   ONDE vem o direito de entrar na academia. Some-se a isso a regra de
--   app/painel/[slug]/alunos/actions.ts ("sem plano → sempre pendente", e
--   pendente não libera na catraca) e sobrava um único caminho para manter um
--   aluno Wellhub/TotalPass ativo: criar em `planos` um registro-fantasma
--   chamado "Wellhub". Esse registro então convivia com "Mensal"/"Trimestral"
--   no mesmo <select> — que é exatamente a mistura reclamada. A causa era a
--   falta da coluna, não a lista da tela.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   Acrescenta duas colunas em `alunos`:
--     • origem_acesso    — de onde vem o acesso (enum abaixo);
--     • parceiro_externo — nome do convênio, só quando 'outro_convenio'.
--   A periodicidade continua onde sempre esteve: em `planos.recorrencia_meses`.
--   Origem e periodicidade passam a ser dois eixos separados.
--
-- O QUE ESTA MIGRAÇÃO **NÃO** FAZ (garantia de não perder dado)
--   • Não apaga, não altera e não desativa NENHUMA linha de `planos` — nem os
--     planos-fantasma "Wellhub"/"TotalPass" que a academia teve de criar.
--   • Não mexe em `alunos.plano_id`: quem está no plano Mensal continua no
--     plano Mensal, com o mesmo id, o mesmo valor e a mesma recorrência.
--   • Não mexe em `alunos.status_matricula`, `dia_vencimento`, mensalidades,
--     `historico_planos`, treinos ou qualquer outra tabela.
--   • Nenhum DROP COLUMN, nenhum DELETE. Só ADD COLUMN + preenchimento das
--     colunas novas.
--   O bloco de verificação no fim compara uma IMPRESSÃO DIGITAL (md5 de
--   id+plano_id+status de todos os alunos) tirada antes e depois: qualquer
--   divergência derruba a migração inteira em rollback.
--
-- IDEMPOTENTE
--   A coluna nasce anulável e o preenchimento só toca linhas com NULL. Numa
--   segunda execução não há NULL, então nada é reescrito — inclusive uma
--   origem que o dono já tenha corrigido na mão fica preservada. O NOT NULL e
--   o DEFAULT entram só depois do preenchimento.
--
-- COMO OS ALUNOS DE HOJE SÃO CLASSIFICADOS
--   • sem plano                                → 'avulso'   (o que já eram)
--   • plano com "wellhub"/"gympass" no nome    → 'wellhub'
--   • plano com "totalpass"/"total pass"       → 'totalpass'
--   • qualquer outro plano                     → 'plano_academia'
--   Nos dois casos de parceiro o `plano_id` legado É MANTIDO de propósito: o
--   formulário passa a exibi-lo como vínculo legado, com a opção de desfazer
--   quando o dono quiser. Desvincular é decisão dele, nunca desta migração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum da origem.
--    NÃO reaproveita `origem_acesso_enum` (schema.sql, valores 'Direto',
--    'Gympass', 'TotalPass'): aquele descreve o EVENTO de catraca em
--    `acessos_catraca` — como a pessoa passou naquela entrada. Este descreve o
--    VÍNCULO do aluno. São coisas diferentes e devem evoluir separadas.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'origem_acesso_aluno_enum') then
    create type origem_acesso_aluno_enum as enum (
      'plano_academia',
      'wellhub',
      'totalpass',
      'avulso',
      'outro_convenio'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2. Colunas novas — anuláveis nesta etapa, para o preenchimento do passo 3
--    conseguir distinguir "ainda não classificado" de "classificado como
--    plano da academia". É isso que torna a migração reexecutável sem
--    atropelar ajuste manual.
-- -----------------------------------------------------------------------------
alter table public.alunos
  add column if not exists origem_acesso    origem_acesso_aluno_enum,
  add column if not exists parceiro_externo text;

comment on column public.alunos.origem_acesso is
  'De onde vem o direito de acesso do aluno. Não confundir com periodicidade '
  '(que vive em planos.recorrencia_meses) nem com acessos_catraca.origem '
  '(que descreve uma entrada específica).';
comment on column public.alunos.parceiro_externo is
  'Nome do convênio quando origem_acesso = ''outro_convenio''. Wellhub e '
  'TotalPass têm valor próprio no enum e não usam este campo.';

-- -----------------------------------------------------------------------------
-- 3. Preenchimento + verificação de que nada se perdeu.
-- -----------------------------------------------------------------------------
do $verificacao$
declare
  v_impressao_antes   text;
  v_impressao_depois  text;
  v_alunos_antes      bigint;
  v_alunos_depois     bigint;
  v_planos_antes      bigint;
  v_planos_depois     bigint;
  v_historico_antes   bigint;
  v_historico_depois  bigint;
  v_receitas_antes    bigint;
  v_receitas_depois   bigint;
  v_classificados     bigint;
  v_wellhub           bigint;
  v_totalpass         bigint;
  v_avulso            bigint;
  v_plano_academia    bigint;
begin
  -- 3.1 Fotografia do ANTES. A impressão digital cobre, aluno por aluno, o
  --     vínculo de plano e o status — exatamente o que o cliente não pode
  --     perder.
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

  -- 3.2 Aluno COM plano: classifica pelo nome do plano.
  update public.alunos a
     set origem_acesso = case
           when lower(p.nome) like '%wellhub%'    then 'wellhub'::origem_acesso_aluno_enum
           when lower(p.nome) like '%gympass%'    then 'wellhub'::origem_acesso_aluno_enum
           when lower(p.nome) like '%totalpass%'  then 'totalpass'::origem_acesso_aluno_enum
           when lower(p.nome) like '%total pass%' then 'totalpass'::origem_acesso_aluno_enum
           else 'plano_academia'::origem_acesso_aluno_enum
         end
    from public.planos p
   where p.id = a.plano_id
     and a.origem_acesso is null;

  -- 3.3 Aluno SEM plano: continua sem plano, agora nomeado — 'avulso' mantém
  --     exatamente o comportamento atual (sem plano da academia).
  update public.alunos
     set origem_acesso = 'avulso'::origem_acesso_aluno_enum
   where origem_acesso is null;

  -- 3.4 Fotografia do DEPOIS e comparação.
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
      'MIGRAÇÃO 096 ABORTADA: o vínculo de plano ou o status de algum aluno mudou. '
      'Impressão antes=% depois=%. Nenhuma alteração foi mantida.',
      v_impressao_antes, v_impressao_depois;
  end if;

  if v_alunos_antes    <> v_alunos_depois
     or v_planos_antes    <> v_planos_depois
     or v_historico_antes <> v_historico_depois
     or v_receitas_antes  <> v_receitas_depois then
    raise exception
      'MIGRAÇÃO 096 ABORTADA: contagem divergente. '
      'alunos %/%, planos %/%, historico_planos %/%, receitas %/% (antes/depois).',
      v_alunos_antes, v_alunos_depois,
      v_planos_antes, v_planos_depois,
      v_historico_antes, v_historico_depois,
      v_receitas_antes, v_receitas_depois;
  end if;

  if exists (select 1 from public.alunos where origem_acesso is null) then
    raise exception 'MIGRAÇÃO 096 ABORTADA: sobrou aluno sem origem_acesso.';
  end if;

  -- 3.5 Relatório do que foi classificado (aparece no log da aplicação).
  select
    count(*) filter (where origem_acesso = 'plano_academia'),
    count(*) filter (where origem_acesso = 'wellhub'),
    count(*) filter (where origem_acesso = 'totalpass'),
    count(*) filter (where origem_acesso = 'avulso'),
    count(*)
    into v_plano_academia, v_wellhub, v_totalpass, v_avulso, v_classificados
  from public.alunos;

  raise notice
    'Migração 096 OK — % alunos classificados: % plano da academia, % Wellhub, % TotalPass, % avulso. '
    'Nenhum plano, vínculo, status, histórico ou receita foi alterado.',
    v_classificados, v_plano_academia, v_wellhub, v_totalpass, v_avulso;
end
$verificacao$;

-- -----------------------------------------------------------------------------
-- 4. Só agora o default e o NOT NULL — com todas as linhas já preenchidas,
--    nenhum aluno pode nascer sem origem daqui em diante.
-- -----------------------------------------------------------------------------
alter table public.alunos
  alter column origem_acesso set default 'plano_academia'::origem_acesso_aluno_enum;

alter table public.alunos
  alter column origem_acesso set not null;

-- -----------------------------------------------------------------------------
-- 5. Integridade: nome de convênio só existe para 'outro_convenio'. Sem isso,
--    trocar a origem depois deixaria um nome órfão contradizendo o enum.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alunos_parceiro_externo_coerente'
      and conrelid = 'public.alunos'::regclass
  ) then
    alter table public.alunos
      add constraint alunos_parceiro_externo_coerente check (
        parceiro_externo is null or origem_acesso = 'outro_convenio'
      );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 6. RLS — nada a criar. `alunos` já tem RLS por academia_id e as policies são
--    de LINHA, não de coluna: as duas colunas novas herdam exatamente o mesmo
--    isolamento entre academias. A checagem abaixo só falha se alguém tiver
--    desligado RLS da tabela por fora.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.alunos'::regclass and relrowsecurity
  ) then
    raise exception 'MIGRAÇÃO 096 ABORTADA: RLS está desligada em public.alunos.';
  end if;
end$$;
