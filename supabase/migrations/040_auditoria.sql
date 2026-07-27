-- =============================================================================
-- Migration 040 — Fase 14: auditoria e observabilidade.
--
-- Log central de ações críticas (aluno, plano, mensalidade, equipe) — o que
-- ainda não tinha nenhum registro de QUEM fez a ação. Não duplica o que já
-- existe:
--   - integração: já auditada por `log_integracoes` (migration 022, Fase 1),
--     com o mesmo desenho (RLS restrita ao dono, sem UPDATE/DELETE). Mantido
--     como está.
--   - acesso: já auditado por `acessos_catraca` (Fase 5), que grava aluno,
--     usuário (registrado_por), política aplicada, motivo, mensalidade
--     relacionada e horário. Já cobre o item "acesso" desta fase.
--
-- Tabela nova — não há dado existente para migrar nem checar compatibilidade.
-- Nunca grava senha, token, segredo ou dado sensível: os campos jsonb abaixo
-- guardam apenas o que já é necessário para investigação operacional
-- (nome, status, papel, valores de cobrança), nunca credenciais.
--
-- 'equipe' e 'funcionario' são entidades DIFERENTES, de propósito: 'equipe' é
-- login/permissão (tabela perfis_admin — dono, gerente, recepção, instrutor);
-- 'funcionario' é o registro de RH/folha (tabela funcionarios). Uma pessoa
-- pode existir em uma, na outra, nas duas ou em nenhuma — nunca são a mesma
-- linha, e por isso nunca compartilham o mesmo valor de entidade no log.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create table if not exists public.logs_auditoria (
  id              uuid        primary key default gen_random_uuid(),
  academia_id     uuid        not null references public.academias(id) on delete cascade,
  usuario_id      uuid        not null,
  -- Nome do usuário no momento da ação, congelado aqui — sobrevive à remoção
  -- do membro da equipe (ver removerMembroEquipe), que apagaria a única
  -- referência ao nome se dependêssemos de um JOIN.
  usuario_nome    text        not null,
  entidade        text        not null check (entidade in ('aluno', 'plano', 'mensalidade', 'equipe', 'funcionario')),
  entidade_id     uuid,
  acao            text        not null check (acao in (
    'aluno_criado', 'aluno_atualizado', 'aluno_excluido',
    'plano_alterado',
    'mensalidade_paga', 'mensalidade_cancelada',
    'equipe_criado', 'equipe_removido', 'equipe_papel_alterado',
    'funcionario_excluido'
  )),
  valor_anterior  jsonb,
  valor_novo      jsonb,
  metadados       jsonb,
  criado_em       timestamptz not null default now()
);

comment on table public.logs_auditoria is
  'Histórico de ações críticas (Fase 14): quem fez o quê, em qual academia, quando. Nunca grava senha/token/segredo. Imutável via RLS — nenhuma policy de UPDATE/DELETE, nem para o dono.';

create index if not exists idx_logs_auditoria_academia
  on public.logs_auditoria (academia_id, criado_em desc);

create index if not exists idx_logs_auditoria_entidade
  on public.logs_auditoria (academia_id, entidade, entidade_id);

alter table public.logs_auditoria enable row level security;

-- SELECT: somente o dono da própria academia consulta o log (mesmo critério
-- de log_integracoes, e consistente com a Fase 10: auditoria é área exclusiva
-- do dono/administrador).
create policy logs_auditoria_select on public.logs_auditoria
  for select to authenticated
  using (
    exists (
      select 1 from public.perfis_admin
      where perfis_admin.id = auth.uid()
        and perfis_admin.academia_id = logs_auditoria.academia_id
        and perfis_admin.papel = 'dono'
    )
  );

-- INSERT: qualquer membro autenticado da própria academia pode gravar — a
-- ação auditada (cadastrar aluno, dar baixa, etc.) já é permitida a papéis
-- além do dono; a auditoria acompanha quem realmente executou.
--
-- `usuario_id = auth.uid()` fecha a lacuna de que só o vínculo com a academia
-- era exigido: sem esta linha, qualquer membro da academia podia inserir uma
-- linha atribuindo a ação a OUTRO usuario_id da mesma academia, falsificando
-- de quem foi a ação. Agora o próprio Postgres garante que ninguém audita em
-- nome de outra pessoa — não depende só do código do app nunca aceitar
-- usuario_id do cliente (que já era o caso, mas só em nível de aplicação).
create policy logs_auditoria_insert on public.logs_auditoria
  for insert to authenticated
  with check (
    logs_auditoria.usuario_id = auth.uid()
    and exists (
      select 1 from public.perfis_admin
      where perfis_admin.id = auth.uid()
        and perfis_admin.academia_id = logs_auditoria.academia_id
    )
  );

-- UPDATE e DELETE: nenhuma policy → bloqueados por padrão pelo RLS para
-- todos, inclusive o dono. Um registro de auditoria não pode ser alterado
-- nem apagado por ninguém através da API pública.
