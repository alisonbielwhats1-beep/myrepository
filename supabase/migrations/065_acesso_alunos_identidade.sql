-- =============================================================================
-- Migration 065 — Identidade e acesso dos alunos (Bloco de Acesso, Parte A).
--
-- Introduz a espinha dorsal para o PRIMEIRO ACESSO do aluno sem quebrar nada
-- do que já existe. Separa quatro conceitos que hoje estão implícitos ou
-- ausentes:
--
--   1. IDENTIDADE  -> auth.users (fonte de verdade; passa a valer para alunos
--      também, não só para a equipe em perfis_admin).
--   2. ACESSO      -> academia_membros (nova): vínculo conta<->academia com
--      papel e status de acesso. A EQUIPE continua em perfis_admin — esta
--      tabela é, por ora, o vínculo de ACESSO DO ALUNO (papel 'aluno').
--   3. CADASTRO    -> alunos ganha auth_user_id (nullable, ON DELETE SET NULL)
--      e status_cadastro. O aluno continua existindo sem conta até ativar.
--   4. MATRÍCULA   -> matriculas (nova): histórico temporal de períodos, sem
--      sobrescrever o passado.
--
-- E cria a base de convites e a trilha de auditoria de acesso:
--   5. CONVITE     -> convites_acesso (nova): token com hash, expiração, uso
--      único, revogação, ligado a UM aluno de UMA academia.
--   6. AUDITORIA   -> logs_acesso (nova): trilha append-only do ciclo de
--      acesso. Tabela separada de logs_auditoria (migration 040) de propósito:
--      lá o ator é sempre um membro de perfis_admin (a policy de INSERT exige
--      isso); aqui o ator legítimo pode ser o PRÓPRIO ALUNO — que nunca está
--      em perfis_admin. São domínios diferentes (edição de registro de negócio
--      x ciclo de identidade/acesso), não duas fontes de verdade do mesmo
--      conceito.
--
-- REGRAS DE SEGURANÇA DESTA MIGRATION:
--   - 100% aditiva: nenhuma coluna/tabela existente é removida ou renomeada.
--   - Idempotente: seguro rodar mais de uma vez (IF NOT EXISTS / DO $$ guards).
--   - Nenhuma conta Auth é criada. Nenhum e-mail fictício. Nenhum dado real é
--     alterado. Alunos existentes ficam com auth_user_id NULL até ativarem.
--   - alunos.email CONTINUA sendo o e-mail de CONTATO. O e-mail de LOGIN vive
--     em auth.users e nunca é copiado para cá como se fosse vínculo.
--   - Rollback dedicado em 065_acesso_alunos_identidade_rollback.sql.
--
-- As RPCs (gerar/preview/ativar convite) ficam na migration 066.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. alunos: vínculo opcional com a conta autenticada + status de cadastro
-- -----------------------------------------------------------------------------
-- auth_user_id é NULLABLE e ON DELETE SET NULL: excluir a conta Auth do aluno
-- NUNCA pode apagar em cascata o cadastro nem o histórico (treino, avaliação,
-- presença, mensalidade, matrícula). Apenas desfaz o vínculo de login.
alter table public.alunos
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- status_cadastro é SEPARADO de status_matricula (período) e do status de
-- acesso (academia_membros). Um aluno pode estar 'arquivado' no cadastro e
-- ainda assim ter histórico financeiro intacto.
alter table public.alunos
  add column if not exists status_cadastro text not null default 'ativo';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alunos_status_cadastro_check'
  ) then
    alter table public.alunos
      add constraint alunos_status_cadastro_check
      check (status_cadastro in ('ativo', 'inativo', 'suspenso', 'arquivado'));
  end if;
end$$;

comment on column public.alunos.auth_user_id is
  'Conta autenticada (auth.users) vinculada a este aluno APÓS a ativação. NULL enquanto o aluno não ativou o primeiro acesso. ON DELETE SET NULL: excluir a conta nunca apaga o aluno nem o histórico. O vínculo é pelo id imutável da conta, NUNCA pelo texto do e-mail.';
comment on column public.alunos.email is
  'E-mail de CONTATO cadastrado pela academia. NÃO é o e-mail de login — este vive em auth.users e é escolhido pelo aluno na ativação. Alterar o contato aqui nunca troca o login.';
comment on column public.alunos.status_cadastro is
  'Status do CADASTRO do aluno (ativo/inativo/suspenso/arquivado). Separado de status_matricula (período da matrícula) e do status de acesso (academia_membros).';

-- Uma mesma conta não pode ser vinculada a dois cadastros de aluno na MESMA
-- academia. Índice único parcial (só quando há conta) — audite duplicidades
-- antes de aplicar em base existente (a 066 traz uma função de auditoria).
create unique index if not exists uidx_alunos_auth_por_academia
  on public.alunos (academia_id, auth_user_id)
  where auth_user_id is not null;

-- Achar rápido o aluno pela conta (login do aluno resolvendo o próprio cadastro).
create index if not exists idx_alunos_auth_user_id
  on public.alunos (auth_user_id)
  where auth_user_id is not null;

-- -----------------------------------------------------------------------------
-- 2. academia_membros — vínculo conta<->academia (ACESSO DO ALUNO)
-- -----------------------------------------------------------------------------
create table if not exists public.academia_membros (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  -- ON DELETE CASCADE aqui é seguro: esta linha é um registro de ACESSO, não
  -- de domínio. Sumir com o vínculo quando a conta é excluída é o correto —
  -- o cadastro do aluno e o histórico vivem em outras tabelas e sobrevivem.
  auth_user_id   uuid        not null references auth.users(id) on delete cascade,
  -- aluno_id ON DELETE SET NULL: arquivar/remover um aluno não deve derrubar o
  -- registro de acesso da conta (que pode pertencer a outras academias).
  aluno_id       uuid        references public.alunos(id) on delete set null,
  papel          text        not null default 'aluno'
                   check (papel in ('proprietario', 'administrador', 'funcionario', 'professor', 'aluno')),
  status_acesso  text        not null default 'pendente'
                   check (status_acesso in ('pendente', 'ativo', 'suspenso', 'revogado', 'arquivado')),
  criado_em      timestamptz not null default now(),
  ativado_em     timestamptz,
  suspenso_em    timestamptz,
  atualizado_em  timestamptz not null default now()
);

comment on table public.academia_membros is
  'Vínculo entre uma conta autenticada (auth.users) e uma academia, com papel e status de acesso. Hoje usado para o ACESSO DO ALUNO (papel aluno); a EQUIPE continua em perfis_admin. Uma conta pode ter vínculos em várias academias: suspender numa não afeta as outras.';

-- Impede dois vínculos equivalentes (mesma conta + academia + papel).
create unique index if not exists uidx_membro_conta_academia_papel
  on public.academia_membros (academia_id, auth_user_id, papel);

create index if not exists idx_membros_academia
  on public.academia_membros (academia_id, status_acesso);
create index if not exists idx_membros_conta
  on public.academia_membros (auth_user_id);
create index if not exists idx_membros_aluno
  on public.academia_membros (aluno_id) where aluno_id is not null;

drop trigger if exists trg_membros_atualizado_em on public.academia_membros;
create trigger trg_membros_atualizado_em
  before update on public.academia_membros
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 3. matriculas — histórico temporal de períodos (separado do cadastro)
-- -----------------------------------------------------------------------------
create table if not exists public.matriculas (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  aluno_id       uuid        not null references public.alunos(id) on delete cascade,
  plano_id       uuid        references public.planos(id) on delete set null,
  data_inicio    date        not null default current_date,
  data_fim       date,
  status         text        not null default 'ativa'
                   check (status in ('pendente', 'ativa', 'trancada', 'encerrada', 'cancelada')),
  motivo         text,
  responsavel_id uuid,        -- auth.users que executou a ação (equipe), quando houver
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio)
);

comment on table public.matriculas is
  'Períodos reais de matrícula do aluno. Cada saída ENCERRA/SUSPENDE o período; cada retorno cria um NOVO período — o passado nunca é sobrescrito para parecer contínuo. Separada de alunos.status_matricula (estado corrente) e de historico_planos (troca de plano).';

-- No máximo uma matrícula 'ativa' por aluno (regra de negócio: um período
-- ativo por vez). Índice único parcial não bloqueia períodos encerrados.
create unique index if not exists uidx_matricula_ativa_por_aluno
  on public.matriculas (aluno_id) where status = 'ativa';

create index if not exists idx_matriculas_aluno
  on public.matriculas (aluno_id, data_inicio desc);
create index if not exists idx_matriculas_academia
  on public.matriculas (academia_id, status);

drop trigger if exists trg_matriculas_atualizado_em on public.matriculas;
create trigger trg_matriculas_atualizado_em
  before update on public.matriculas
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 4. convites_acesso — convite de ativação (token com hash, uso único)
-- -----------------------------------------------------------------------------
create table if not exists public.convites_acesso (
  id                        uuid        primary key default gen_random_uuid(),
  academia_id               uuid        not null references public.academias(id) on delete cascade,
  aluno_id                  uuid        not null references public.alunos(id) on delete cascade,
  finalidade                text        not null default 'ativacao_aluno'
                              check (finalidade in ('ativacao_aluno')),
  -- Guardamos SOMENTE o hash (sha-256 hex) do token. O token bruto é gerado no
  -- servidor, entregue no link/QR e NUNCA persiste no banco. Assim, vazamento
  -- do banco não permite ativar convites.
  token_hash                text        not null,
  status                    text        not null default 'gerado'
                              check (status in ('gerado', 'enviado', 'aguardando_ativacao', 'utilizado', 'expirado', 'revogado')),
  expira_em                 timestamptz not null,
  tentativas                integer     not null default 0,
  criado_por                uuid,       -- auth.users (equipe) que gerou
  consumido_por_auth_user_id uuid,      -- conta que ativou (auditoria)
  utilizado_em              timestamptz,
  revogado_em               timestamptz,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);

comment on table public.convites_acesso is
  'Convite de ativação de primeiro acesso, ligado a UM aluno de UMA academia. O convite DEFINE qual cadastro será ativado (não o e-mail, não o provedor). Guarda só o hash do token; uso único; expira; revogável; validado só no servidor.';

-- O hash é único (dois tokens não podem colidir).
create unique index if not exists uidx_convite_token_hash
  on public.convites_acesso (token_hash);

-- No máximo UM convite "vivo" por aluno. Gerar um novo revoga/expira o anterior
-- (feito na RPC da 066); o índice garante a invariante mesmo sob concorrência.
create unique index if not exists uidx_convite_vivo_por_aluno
  on public.convites_acesso (aluno_id)
  where status in ('gerado', 'enviado', 'aguardando_ativacao');

create index if not exists idx_convites_academia_status
  on public.convites_acesso (academia_id, status);
create index if not exists idx_convites_expira
  on public.convites_acesso (expira_em) where status in ('gerado', 'enviado', 'aguardando_ativacao');

drop trigger if exists trg_convites_atualizado_em on public.convites_acesso;
create trigger trg_convites_atualizado_em
  before update on public.convites_acesso
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 5. logs_acesso — trilha append-only do ciclo de acesso
-- -----------------------------------------------------------------------------
create table if not exists public.logs_acesso (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  ator_auth_user_id uuid,    -- quem executou (aluno, equipe) ou NULL (sistema)
  ator_tipo      text        not null default 'sistema'
                   check (ator_tipo in ('aluno', 'equipe', 'sistema')),
  evento         text        not null check (evento in (
    'convite_gerado', 'convite_reenviado', 'convite_revogado', 'convite_expirado',
    'convite_consumido', 'ativacao_rejeitada', 'conta_ativada',
    'vinculo_criado', 'vinculo_removido',
    'acesso_suspenso', 'acesso_reativado',
    'aluno_arquivado', 'aluno_reativado',
    'matricula_iniciada', 'matricula_suspensa', 'matricula_encerrada',
    'papel_alterado', 'exclusao_permanente_solicitada'
  )),
  aluno_id       uuid,
  convite_id     uuid,
  membro_id      uuid,
  matricula_id   uuid,
  -- NUNCA gravar token, senha, cookie ou segredo aqui.
  metadados      jsonb,
  criado_em      timestamptz not null default now()
);

comment on table public.logs_acesso is
  'Trilha append-only do ciclo de acesso do aluno (convite, ativação, vínculo, suspensão, matrícula). Escrita apenas por funções SECURITY DEFINER (066). Imutável: sem policy de UPDATE/DELETE. Nunca grava token/senha.';

create index if not exists idx_logs_acesso_academia
  on public.logs_acesso (academia_id, criado_em desc);
create index if not exists idx_logs_acesso_aluno
  on public.logs_acesso (aluno_id, criado_em desc);

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================
alter table public.academia_membros enable row level security;
alter table public.matriculas       enable row level security;
alter table public.convites_acesso  enable row level security;
alter table public.logs_acesso       enable row level security;

-- --- Helper: a conta autenticada tem acesso (ativo) a este aluno? -----------
-- Usado nas policies para o aluno ler o próprio cadastro/matrículas depois de
-- ativado. SECURITY DEFINER + search_path fixo (evita hijack de resolução).
create or replace function public.usuario_tem_acesso_aluno(p_aluno_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select exists (
    select 1
    from public.academia_membros m
    where m.aluno_id = p_aluno_id
      and m.auth_user_id = auth.uid()
      and m.status_acesso = 'ativo'
  );
$$;

comment on function public.usuario_tem_acesso_aluno(uuid) is
  'True se a conta autenticada tem vínculo de acesso ATIVO com o aluno informado. Base do RLS do lado autenticado do aluno.';

revoke all on function public.usuario_tem_acesso_aluno(uuid) from public;
grant execute on function public.usuario_tem_acesso_aluno(uuid) to authenticated;

-- --- academia_membros --------------------------------------------------------
-- A equipe (perfis_admin) enxerga/gerencia os vínculos da PRÓPRIA academia.
drop policy if exists membros_equipe_select on public.academia_membros;
create policy membros_equipe_select on public.academia_membros
  for select to authenticated
  using (academia_id = public.academia_id_atual());

drop policy if exists membros_equipe_update on public.academia_membros;
create policy membros_equipe_update on public.academia_membros
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

-- O próprio aluno enxerga o próprio vínculo (para saber se está suspenso etc.).
drop policy if exists membros_proprio_select on public.academia_membros;
create policy membros_proprio_select on public.academia_membros
  for select to authenticated
  using (auth_user_id = auth.uid());

-- INSERT/DELETE de vínculo: só via funções SECURITY DEFINER (ativação/gestão),
-- nunca por INSERT direto do cliente. Sem policy de insert/delete aqui.

-- --- matriculas --------------------------------------------------------------
drop policy if exists matriculas_equipe_all on public.matriculas;
create policy matriculas_equipe_all on public.matriculas
  for all to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

-- O aluno vê as próprias matrículas (leitura).
drop policy if exists matriculas_aluno_select on public.matriculas;
create policy matriculas_aluno_select on public.matriculas
  for select to authenticated
  using (public.usuario_tem_acesso_aluno(aluno_id));

-- --- convites_acesso ---------------------------------------------------------
-- Só a equipe da própria academia gerencia convites. O aluno NUNCA lê esta
-- tabela direto (o preview público é uma RPC SECURITY DEFINER na 066, que
-- devolve dados mínimos e não permite enumeração).
drop policy if exists convites_equipe_all on public.convites_acesso;
create policy convites_equipe_all on public.convites_acesso
  for all to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

-- --- logs_acesso -------------------------------------------------------------
-- Leitura só para dono/gerente da própria academia. Escrita: sem policy de
-- insert (as funções SECURITY DEFINER da 066 escrevem como owner, ignorando
-- RLS). Sem update/delete: imutável.
drop policy if exists logs_acesso_select on public.logs_acesso;
create policy logs_acesso_select on public.logs_acesso
  for select to authenticated
  using (
    exists (
      select 1 from public.perfis_admin p
      where p.id = auth.uid()
        and p.academia_id = logs_acesso.academia_id
        and p.papel in ('dono', 'gerente')
    )
  );

-- service_role total (operações administrativas do servidor).
do $$
declare tbl text;
begin
  foreach tbl in array array['academia_membros', 'matriculas', 'convites_acesso', 'logs_acesso']
  loop
    execute format('drop policy if exists service_role_total_%1$s on public.%1$s;', tbl);
    execute format(
      'create policy service_role_total_%1$s on public.%1$s
         for all to service_role using (true) with check (true);', tbl);
  end loop;
end$$;
