-- =============================================================================
-- Migration 066 — RPCs de convite, ativação e ciclo de acesso do aluno.
--
-- Todas as funções são SECURITY DEFINER com search_path FIXO (pg_catalog,
-- public) — evita hijack de resolução de nome e roda com privilégio do owner
-- para escrever nas tabelas de acesso ignorando RLS de forma controlada. Cada
-- função valida internamente QUEM pode chamar (equipe via academia_id_atual(),
-- ou o próprio aluno via auth.uid()).
--
-- O token BRUTO nunca entra aqui: o servidor (Node) gera o token, calcula o
-- sha-256 e passa apenas o HASH. Nenhuma função grava token/senha em log.
--
-- Depende da 065 (tabelas). Rollback em 066_acesso_alunos_rpcs_rollback.sql.
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. gerar_convite_acesso — a equipe gera um convite para UM aluno.
-- -----------------------------------------------------------------------------
-- Recebe o HASH do token (o bruto fica no servidor). Revoga/expira qualquer
-- convite vivo anterior do mesmo aluno (garante 1 convite vivo por aluno) e
-- cria o novo de forma atômica. Retorna o id do convite criado.
create or replace function public.gerar_convite_acesso(
  p_aluno_id   uuid,
  p_token_hash text,
  p_expira_em  timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
  v_convite  uuid;
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'token_invalido' using errcode = '22023';
  end if;
  if p_expira_em is null or p_expira_em <= now() then
    raise exception 'expiracao_invalida' using errcode = '22023';
  end if;

  -- O aluno precisa ser da academia do usuário logado (isolamento tenant).
  perform 1 from public.alunos
    where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  -- Revoga convites vivos anteriores deste aluno (mantém a invariante do
  -- índice único parcial uidx_convite_vivo_por_aluno).
  update public.convites_acesso
    set status = 'revogado', revogado_em = now()
    where aluno_id = p_aluno_id
      and status in ('gerado', 'enviado', 'aguardando_ativacao');

  insert into public.convites_acesso
    (academia_id, aluno_id, token_hash, status, expira_em, criado_por)
  values
    (v_academia, p_aluno_id, p_token_hash, 'gerado', p_expira_em, v_uid)
  returning id into v_convite;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, convite_id, metadados)
  values
    (v_academia, v_uid, 'equipe', 'convite_gerado', p_aluno_id, v_convite,
     jsonb_build_object('expira_em', p_expira_em));

  return v_convite;
end;
$$;

comment on function public.gerar_convite_acesso(uuid, text, timestamptz) is
  'Equipe gera um convite de ativação para um aluno da própria academia. Guarda só o hash. Revoga o convite vivo anterior. Retorna o id do convite.';

revoke all on function public.gerar_convite_acesso(uuid, text, timestamptz) from public;
grant execute on function public.gerar_convite_acesso(uuid, text, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. preview_convite_acesso — dados MÍNIMOS para o aluno reconhecer a academia.
-- -----------------------------------------------------------------------------
-- Chamada pela página de ativação (servidor calcula o hash a partir do token
-- do link). Não expõe dados privados (sem CPF/e-mail/telefone), não permite
-- enumeração (só responde a um hash de token de 256 bits) e não incrementa
-- nada. Retorna NULL para convite inexistente/expirado/consumido/revogado —
-- a UI mostra "convite inválido" sem revelar o motivo exato.
create or replace function public.preview_convite_acesso(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  v jsonb;
  r record;
begin
  select c.status, c.expira_em, ac.nome_fantasia, ac.slug_url, ac.logo_url,
         a.nome as aluno_nome
    into r
    from public.convites_acesso c
    join public.academias ac on ac.id = c.academia_id
    join public.alunos a on a.id = c.aluno_id
    where c.token_hash = p_token_hash;

  if not found then
    return null;
  end if;
  if r.status not in ('gerado', 'enviado', 'aguardando_ativacao') then
    return null;
  end if;
  if r.expira_em <= now() then
    return null;
  end if;

  -- Mascara o nome: primeiro nome + inicial do sobrenome ("Maria S."). O
  -- suficiente para reconhecer, sem expor o nome completo num link público.
  v := jsonb_build_object(
    'academia_nome', r.nome_fantasia,
    'academia_slug', r.slug_url,
    'academia_logo', r.logo_url,
    'aluno_nome_mascarado',
      split_part(r.aluno_nome, ' ', 1) ||
      case when position(' ' in r.aluno_nome) > 0
           then ' ' || left(split_part(r.aluno_nome, ' ', 2), 1) || '.'
           else '' end
  );
  return v;
end;
$$;

comment on function public.preview_convite_acesso(text) is
  'Dados mínimos e mascarados de um convite válido (nome da academia + nome do aluno abreviado), para a tela de ativação. NULL se inválido/expirado/consumido. Não expõe dados privados nem permite enumeração.';

revoke all on function public.preview_convite_acesso(text) from public;
grant execute on function public.preview_convite_acesso(text) to anon, authenticated;

-- Helper interno de rejeição (log). Definido ANTES de quem o chama. Não é
-- exposto por grant a anon/authenticated; só é invocado de dentro das funções
-- SECURITY DEFINER (mesmo owner).
create or replace function public._registrar_rejeicao_acesso(
  p_academia uuid, p_uid uuid, p_aluno uuid, p_convite uuid, p_motivo text
)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, convite_id, metadados)
  values
    (p_academia, p_uid, 'aluno', 'ativacao_rejeitada', p_aluno, p_convite,
     jsonb_build_object('motivo', p_motivo));
$$;

revoke all on function public._registrar_rejeicao_acesso(uuid, uuid, uuid, uuid, text) from public;

-- -----------------------------------------------------------------------------
-- 3. ativar_convite_acesso — o CORAÇÃO. Atômico, idempotente, seguro.
-- -----------------------------------------------------------------------------
-- Chamada DEPOIS de a conta estar autenticada (OAuth concluído ou e-mail
-- confirmado). Usa auth.uid() como identidade — nunca confia em id vindo do
-- cliente. Vincula a conta ao aluno do convite (não ao e-mail, não ao
-- provedor), cria/reativa o vínculo de acesso, consome o convite e audita —
-- tudo numa transação. Uso concorrente é serializado por SELECT ... FOR UPDATE.
create or replace function public.ativar_convite_acesso(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c          record;
  v_uid      uuid := auth.uid();
  v_membro   uuid;
begin
  -- IMPORTANTE: as rejeições ESPERADAS (convite inválido/expirado/usado,
  -- conflitos) NÃO usam RAISE — retornam um status. Isso é deliberado: RAISE
  -- faria rollback e apagaria o log de auditoria da rejeição e a marcação de
  -- 'expirado'. Só condições realmente excepcionais (não previstas) sobem como
  -- erro. O app mapeia o `status` para a mensagem amigável.
  if v_uid is null then
    return jsonb_build_object('status', 'sem_sessao');
  end if;

  -- Trava a linha do convite: duas ativações simultâneas do mesmo convite
  -- serializam aqui — a segunda encontra status já 'utilizado'.
  select * into c
    from public.convites_acesso
    where token_hash = p_token_hash
    for update;

  if not found then
    return jsonb_build_object('status', 'convite_invalido');
  end if;

  -- Idempotência: se ESTE mesmo usuário já consumiu este convite e o aluno já
  -- está vinculado a ele, é um no-op de sucesso (reload/replay/rede).
  if c.status = 'utilizado' and c.consumido_por_auth_user_id = v_uid then
    return jsonb_build_object(
      'aluno_id', c.aluno_id,
      'academia_slug', (select slug_url from public.academias where id = c.academia_id),
      'status', 'ja_ativado'
    );
  end if;

  if c.status = 'revogado' then
    perform public._registrar_rejeicao_acesso(c.academia_id, v_uid, c.aluno_id, c.id, 'convite_revogado');
    return jsonb_build_object('status', 'convite_revogado');
  end if;
  if c.status = 'utilizado' then
    perform public._registrar_rejeicao_acesso(c.academia_id, v_uid, c.aluno_id, c.id, 'convite_utilizado');
    return jsonb_build_object('status', 'convite_utilizado');
  end if;
  if c.expira_em <= now() then
    update public.convites_acesso set status = 'expirado' where id = c.id;
    perform public._registrar_rejeicao_acesso(c.academia_id, v_uid, c.aluno_id, c.id, 'convite_expirado');
    return jsonb_build_object('status', 'convite_expirado');
  end if;

  -- O aluno do convite já está vinculado a OUTRA conta? Conflito -> revisão
  -- manual, nunca merge automático.
  perform 1 from public.alunos
    where id = c.aluno_id and auth_user_id is not null and auth_user_id <> v_uid;
  if found then
    perform public._registrar_rejeicao_acesso(c.academia_id, v_uid, c.aluno_id, c.id, 'aluno_ja_vinculado');
    return jsonb_build_object('status', 'aluno_ja_vinculado');
  end if;

  -- Esta conta já é dona de OUTRO aluno na MESMA academia? Também conflito.
  perform 1 from public.alunos
    where academia_id = c.academia_id
      and auth_user_id = v_uid
      and id <> c.aluno_id;
  if found then
    perform public._registrar_rejeicao_acesso(c.academia_id, v_uid, c.aluno_id, c.id, 'conta_ja_vinculada_outro_aluno');
    return jsonb_build_object('status', 'conta_ja_vinculada_outro_aluno');
  end if;

  -- Vincula a conta ao cadastro EXISTENTE (não cria outro aluno).
  update public.alunos
    set auth_user_id = v_uid
    where id = c.aluno_id and (auth_user_id is null or auth_user_id = v_uid);

  -- Cria/reativa o vínculo de acesso (papel aluno).
  insert into public.academia_membros
    (academia_id, auth_user_id, aluno_id, papel, status_acesso, ativado_em)
  values
    (c.academia_id, v_uid, c.aluno_id, 'aluno', 'ativo', now())
  on conflict (academia_id, auth_user_id, papel)
    do update set status_acesso = 'ativo',
                  aluno_id = excluded.aluno_id,
                  ativado_em = coalesce(academia_membros.ativado_em, now()),
                  suspenso_em = null
  returning id into v_membro;

  -- Consome o convite (uso único).
  update public.convites_acesso
    set status = 'utilizado', utilizado_em = now(), consumido_por_auth_user_id = v_uid
    where id = c.id;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, convite_id, membro_id)
  values
    (c.academia_id, v_uid, 'aluno', 'conta_ativada', c.aluno_id, c.id, v_membro),
    (c.academia_id, v_uid, 'aluno', 'vinculo_criado', c.aluno_id, c.id, v_membro),
    (c.academia_id, v_uid, 'aluno', 'convite_consumido', c.aluno_id, c.id, v_membro);

  return jsonb_build_object(
    'aluno_id', c.aluno_id,
    'academia_slug', (select slug_url from public.academias where id = c.academia_id),
    'status', 'ativado'
  );
end;
$$;

comment on function public.ativar_convite_acesso(text) is
  'Consome um convite e vincula a conta autenticada (auth.uid()) ao aluno do convite. Atômico (FOR UPDATE), idempotente (reload/replay), e bloqueia merges perigosos (aluno já vinculado a outra conta / conta já vinculada a outro aluno). Nunca cria outro aluno.';

revoke all on function public.ativar_convite_acesso(text) from public;
grant execute on function public.ativar_convite_acesso(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. revogar_convite_acesso — equipe revoga um convite pendente.
-- -----------------------------------------------------------------------------
create or replace function public.revogar_convite_acesso(p_convite_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
  v_aluno    uuid;
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;

  update public.convites_acesso
    set status = 'revogado', revogado_em = now()
    where id = p_convite_id
      and academia_id = v_academia
      and status in ('gerado', 'enviado', 'aguardando_ativacao')
    returning aluno_id into v_aluno;

  if not found then
    raise exception 'convite_nao_revogavel' using errcode = '42501';
  end if;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, convite_id)
  values
    (v_academia, v_uid, 'equipe', 'convite_revogado', v_aluno, p_convite_id);
end;
$$;

comment on function public.revogar_convite_acesso(uuid) is
  'Equipe revoga um convite vivo da própria academia. Só afeta convites ainda não consumidos.';

revoke all on function public.revogar_convite_acesso(uuid) from public;
grant execute on function public.revogar_convite_acesso(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. suspender_acesso_aluno / reativar_acesso_aluno — equipe controla o acesso.
-- -----------------------------------------------------------------------------
-- Suspender: bloqueia o acesso do aluno ÀQUELA academia e invalida convites
-- pendentes. NÃO exclui a conta Auth nem afeta outras academias da conta.
create or replace function public.suspender_acesso_aluno(p_aluno_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;
  perform 1 from public.alunos where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  update public.academia_membros
    set status_acesso = 'suspenso', suspenso_em = now()
    where academia_id = v_academia and aluno_id = p_aluno_id and status_acesso = 'ativo';

  update public.convites_acesso
    set status = 'revogado', revogado_em = now()
    where academia_id = v_academia and aluno_id = p_aluno_id
      and status in ('gerado', 'enviado', 'aguardando_ativacao');

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, metadados)
  values
    (v_academia, v_uid, 'equipe', 'acesso_suspenso', p_aluno_id,
     case when p_motivo is null then null else jsonb_build_object('motivo', p_motivo) end);
end;
$$;

comment on function public.suspender_acesso_aluno(uuid, text) is
  'Suspende o acesso do aluno à academia atual e revoga convites pendentes. Não exclui a conta Auth nem afeta outras academias da mesma conta.';

revoke all on function public.suspender_acesso_aluno(uuid, text) from public;
grant execute on function public.suspender_acesso_aluno(uuid, text) to authenticated;

create or replace function public.reativar_acesso_aluno(p_aluno_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;
  perform 1 from public.alunos where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  update public.academia_membros
    set status_acesso = 'ativo', suspenso_em = null
    where academia_id = v_academia and aluno_id = p_aluno_id
      and status_acesso in ('suspenso', 'revogado');

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id)
  values
    (v_academia, v_uid, 'equipe', 'acesso_reativado', p_aluno_id);
end;
$$;

comment on function public.reativar_acesso_aluno(uuid) is
  'Reativa o acesso de um aluno previamente suspenso/revogado na academia atual.';

revoke all on function public.reativar_acesso_aluno(uuid) from public;
grant execute on function public.reativar_acesso_aluno(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. iniciar_matricula / encerrar_matricula — histórico temporal.
-- -----------------------------------------------------------------------------
-- Iniciar cria um NOVO período. A invariante "1 ativa por aluno" é garantida
-- pelo índice único parcial (065): tentar abrir uma segunda ativa falha.
create or replace function public.iniciar_matricula(
  p_aluno_id uuid, p_plano_id uuid default null, p_data_inicio date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
  v_mat      uuid;
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;
  perform 1 from public.alunos where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  insert into public.matriculas
    (academia_id, aluno_id, plano_id, data_inicio, status, responsavel_id)
  values
    (v_academia, p_aluno_id, p_plano_id, p_data_inicio, 'ativa', v_uid)
  returning id into v_mat;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, matricula_id)
  values
    (v_academia, v_uid, 'equipe', 'matricula_iniciada', p_aluno_id, v_mat);

  return v_mat;
end;
$$;

comment on function public.iniciar_matricula(uuid, uuid, date) is
  'Abre um novo período de matrícula (status ativa) para o aluno. A unicidade de "1 ativa por aluno" é garantida por índice parcial — abrir uma segunda ativa falha.';

revoke all on function public.iniciar_matricula(uuid, uuid, date) from public;
grant execute on function public.iniciar_matricula(uuid, uuid, date) to authenticated;

create or replace function public.encerrar_matricula(
  p_matricula_id uuid, p_status text default 'encerrada', p_motivo text default null,
  p_data_fim date default current_date
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_uid      uuid := auth.uid();
  v_aluno    uuid;
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;
  if p_status not in ('encerrada', 'cancelada', 'trancada') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;

  update public.matriculas
    set status = p_status,
        data_fim = case when p_status = 'trancada' then data_fim else p_data_fim end,
        motivo = p_motivo
    where id = p_matricula_id and academia_id = v_academia
    returning aluno_id into v_aluno;

  if not found then
    raise exception 'matricula_nao_encontrada' using errcode = '42501';
  end if;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, matricula_id, metadados)
  values
    (v_academia, v_uid, 'equipe',
     case when p_status = 'trancada' then 'matricula_suspensa' else 'matricula_encerrada' end,
     v_aluno, p_matricula_id,
     case when p_motivo is null then null else jsonb_build_object('motivo', p_motivo) end);
end;
$$;

comment on function public.encerrar_matricula(uuid, text, text, date) is
  'Encerra/cancela/tranca um período de matrícula, preservando o registro. Retornos futuros criam um NOVO período — o passado nunca é sobrescrito.';

revoke all on function public.encerrar_matricula(uuid, text, text, date) from public;
grant execute on function public.encerrar_matricula(uuid, text, text, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. auditar_migracao_alunos — dry-run seguro da migração dos ~60 alunos.
-- -----------------------------------------------------------------------------
-- Read-only. Não altera nada. Só a equipe da própria academia. Não devolve
-- dado sensível — apenas contagens e ids de conflito para revisão manual.
create or replace function public.auditar_migracao_alunos()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  v_academia uuid := public.academia_id_atual();
  v_total    int;
  v_vinc     int;
  v_pend     int;
  v_aptos    int;
  v_conflito int;
begin
  if v_academia is null then
    raise exception 'sem_academia' using errcode = '42501';
  end if;

  select count(*) into v_total
    from public.alunos where academia_id = v_academia and status_cadastro <> 'arquivado';

  select count(*) into v_vinc
    from public.alunos
    where academia_id = v_academia and auth_user_id is not null;

  -- "Pendentes": sem nome utilizável (dado insuficiente para convidar). Não
  -- bloqueia o cadastro — só sinaliza para revisão.
  select count(*) into v_pend
    from public.alunos
    where academia_id = v_academia and status_cadastro <> 'arquivado'
      and (nome is null or length(trim(nome)) = 0);

  -- "Conflito": mesma conta apontando para mais de um aluno na academia
  -- (não deveria existir por causa do índice único, mas auditamos dados
  -- pré-existentes antes de confiar na constraint).
  select count(*) into v_conflito
    from (
      select auth_user_id
        from public.alunos
        where academia_id = v_academia and auth_user_id is not null
        group by auth_user_id
        having count(*) > 1
    ) t;

  v_aptos := v_total - v_pend - v_vinc;
  if v_aptos < 0 then v_aptos := 0; end if;

  return jsonb_build_object(
    'academia_id', v_academia,
    'total', v_total,
    'ja_vinculados', v_vinc,
    'com_dados_pendentes', v_pend,
    'aptos_a_convidar', v_aptos,
    'conflitos_conta_duplicada', v_conflito
  );
end;
$$;

comment on function public.auditar_migracao_alunos() is
  'Dry-run read-only da migração de acesso dos alunos da academia atual: total, já vinculados, com dados pendentes, aptos a convidar e conflitos. Não altera dados nem expõe informação sensível.';

revoke all on function public.auditar_migracao_alunos() from public;
grant execute on function public.auditar_migracao_alunos() to authenticated;
