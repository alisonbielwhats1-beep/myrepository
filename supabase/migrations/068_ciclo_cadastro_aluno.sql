-- =============================================================================
-- Migration 068 — Ciclo do CADASTRO do aluno (arquivar / reativar).
--
-- Fase 4. Dá à academia o "Desativar/arquivar aluno" seguro que o prompt pede
-- no lugar do "Excluir" físico: preserva cadastro e histórico, bloqueia o
-- acesso e deixa tudo auditado — sem apagar nada.
--
-- arquivar_aluno faz, de forma atômica:
--   - status_cadastro = 'arquivado' (identidade/acesso — SEPARADO de
--     status_matricula, que é cobrança e continua sob o CRUD existente);
--   - suspende o vínculo de acesso (academia_membros);
--   - revoga convites pendentes;
--   - encerra a matrícula ATIVA (tabela matriculas, migration 065), se houver,
--     registrando o motivo — nunca reescreve o período, só o fecha;
--   - registra 'aluno_arquivado' em logs_acesso.
--
-- reativar_cadastro_aluno volta status_cadastro para 'ativo' e audita. NÃO
-- reativa o acesso nem cria matrícula automaticamente: isso é decisão
-- explícita (reativar_acesso_aluno / iniciar_matricula), como o prompt exige
-- ("crie uma NOVA matrícula quando representar um novo período").
--
-- SECURITY DEFINER + search_path fixo. Só a equipe da própria academia (via
-- academia_id_atual()). Depende da 065/066. Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.arquivar_aluno(p_aluno_id uuid, p_motivo text default null)
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

  update public.alunos
    set status_cadastro = 'arquivado'
    where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  -- Suspende o acesso (não exclui a conta Auth; não afeta outras academias).
  update public.academia_membros
    set status_acesso = 'suspenso', suspenso_em = now()
    where academia_id = v_academia and aluno_id = p_aluno_id and status_acesso = 'ativo';

  -- Revoga convites pendentes.
  update public.convites_acesso
    set status = 'revogado', revogado_em = now()
    where academia_id = v_academia and aluno_id = p_aluno_id
      and status in ('gerado', 'enviado', 'aguardando_ativacao');

  -- Encerra a matrícula ativa (preserva o período; não o reescreve).
  update public.matriculas
    set status = 'encerrada', data_fim = current_date, motivo = coalesce(p_motivo, motivo)
    where academia_id = v_academia and aluno_id = p_aluno_id and status = 'ativa';

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id, metadados)
  values
    (v_academia, v_uid, 'equipe', 'aluno_arquivado', p_aluno_id,
     case when p_motivo is null then null else jsonb_build_object('motivo', p_motivo) end);
end;
$$;

comment on function public.arquivar_aluno(uuid, text) is
  'Arquiva o CADASTRO do aluno (status_cadastro), suspende o acesso, revoga convites e encerra a matrícula ativa — preservando cadastro e histórico. Não exclui a conta Auth nem afeta outras academias. Audita em logs_acesso.';

revoke all on function public.arquivar_aluno(uuid, text) from public;
grant execute on function public.arquivar_aluno(uuid, text) to authenticated;

create or replace function public.reativar_cadastro_aluno(p_aluno_id uuid)
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

  update public.alunos
    set status_cadastro = 'ativo'
    where id = p_aluno_id and academia_id = v_academia;
  if not found then
    raise exception 'aluno_nao_encontrado' using errcode = '42501';
  end if;

  insert into public.logs_acesso
    (academia_id, ator_auth_user_id, ator_tipo, evento, aluno_id)
  values
    (v_academia, v_uid, 'equipe', 'aluno_reativado', p_aluno_id);
end;
$$;

comment on function public.reativar_cadastro_aluno(uuid) is
  'Reativa o cadastro arquivado (status_cadastro = ativo) e audita. NÃO reativa o acesso nem cria matrícula — isso é decisão explícita (reativar_acesso_aluno / iniciar_matricula).';

revoke all on function public.reativar_cadastro_aluno(uuid) from public;
grant execute on function public.reativar_cadastro_aluno(uuid) to authenticated;
