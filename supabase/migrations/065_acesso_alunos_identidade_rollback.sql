-- =============================================================================
-- Rollback da migration 065 — Identidade e acesso dos alunos.
--
-- Desfaz APENAS o que a 065 criou. NÃO toca em dados de negócio dos alunos.
-- As colunas novas em `alunos` (auth_user_id, status_cadastro) são removidas;
-- isso desfaz o VÍNCULO de login, nunca o cadastro nem o histórico.
--
-- Rode ANTES o rollback da 066 (funções), pois algumas dependem destas tabelas.
--
-- ATENÇÃO: dropar as tabelas apaga convites/vínculos/matrículas/logs criados.
-- Em base já ativada, exporte o que precisar antes. Seguro rodar mais de uma
-- vez.
-- =============================================================================

drop policy if exists membros_equipe_select on public.academia_membros;
drop policy if exists membros_equipe_update on public.academia_membros;
drop policy if exists membros_proprio_select on public.academia_membros;
drop policy if exists matriculas_equipe_all on public.matriculas;
drop policy if exists matriculas_aluno_select on public.matriculas;
drop policy if exists convites_equipe_all on public.convites_acesso;
drop policy if exists logs_acesso_select on public.logs_acesso;

do $$
declare tbl text;
begin
  foreach tbl in array array['academia_membros', 'matriculas', 'convites_acesso', 'logs_acesso']
  loop
    execute format('drop policy if exists service_role_total_%1$s on public.%1$s;', tbl);
  end loop;
end$$;

drop function if exists public.usuario_tem_acesso_aluno(uuid);

drop table if exists public.logs_acesso;
drop table if exists public.convites_acesso;
drop table if exists public.matriculas;
drop table if exists public.academia_membros;

drop index if exists public.uidx_alunos_auth_por_academia;
drop index if exists public.idx_alunos_auth_user_id;

alter table public.alunos drop constraint if exists alunos_status_cadastro_check;
alter table public.alunos drop column if exists status_cadastro;
alter table public.alunos drop column if exists auth_user_id;
