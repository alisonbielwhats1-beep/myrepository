-- =============================================================================
-- Migration 057 — Tratamento de feedback pela academia.
--
-- Feedback continua sendo feedback (elogio, sugestão, reclamação, avaliação):
-- NÃO vira chat. O que muda é que a academia passa a poder trabalhar a fila —
-- analisar, responder uma vez e concluir:
--
--   novo -> em_analise -> respondido -> concluido
--
-- Conversa com ida e volta é o módulo ATENDIMENTO (migration 058), separado
-- de propósito.
--
-- A coluna `lido` (migration 005) fica como está e continua funcionando: quem
-- já usa o botão "marcar como lido" não perde nada. `status` é a dimensão nova
-- e independente; linhas existentes nascem em 'novo'.
--
-- Puramente ADITIVA: só acrescenta colunas em feedbacks, não altera nem apaga
-- nada. Idempotente — seguro rodar mais de uma vez.
-- Reversão: 057_feedback_tratamento_rollback.sql
-- =============================================================================

alter table public.feedbacks
  add column if not exists status text not null default 'novo',
  add column if not exists resposta text,
  add column if not exists respondido_em timestamptz,
  add column if not exists respondido_por uuid
    references public.perfis_admin(id) on delete set null,
  -- Nome desnormalizado: se o funcionário sair da equipe e o perfil for
  -- removido, o histórico continua dizendo quem respondeu.
  add column if not exists respondido_por_nome text,
  add column if not exists atualizado_em timestamptz not null default now();

-- Constraint nomeada e criada à parte para o arquivo continuar idempotente
-- (`add column if not exists` pularia um check inline numa segunda execução).
--
-- Dois statements planos em vez de um DO block: o editor SQL do dashboard
-- quebra statements nos ';' mesmo dentro do corpo de um bloco, e o resultado
-- é o mesmo — drop-then-add é idempotente por construção.
alter table public.feedbacks
  drop constraint if exists feedbacks_status_valido;

alter table public.feedbacks
  add constraint feedbacks_status_valido
  check (status in ('novo', 'em_analise', 'respondido', 'concluido'));

comment on column public.feedbacks.status is
  'Fila de tratamento: novo -> em_analise -> respondido -> concluido. Independente de `lido`.';
comment on column public.feedbacks.resposta is
  'Resposta única da academia, visível para o aluno na área dele. Feedback não é chat.';

create index if not exists idx_feedbacks_status
  on public.feedbacks(academia_id, status);

drop trigger if exists trg_feedbacks_upd on public.feedbacks;
create trigger trg_feedbacks_upd
  before update on public.feedbacks
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- Leitura pelo ALUNO — mesmo padrão das demais telas da área do aluno
-- (migration 037): SECURITY DEFINER resolvendo o aluno por token + slug, nunca
-- por aluno_id vindo do cliente. Devolve só os feedbacks do próprio aluno.
--
-- Feedback anônimo (aluno_id null, migration 006) não aparece aqui: sem dono,
-- não há a quem mostrar. Devolver seria vazamento entre alunos.
-- -----------------------------------------------------------------------------
create or replace function public.obter_feedbacks_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'nota', f.nota,
    'categoria', f.categoria,
    'comentario', f.comentario,
    'status', f.status,
    'resposta', f.resposta,
    'respondido_em', f.respondido_em,
    'criado_em', f.criado_em
  ) order by f.criado_em desc), '[]'::jsonb)
  from public.feedbacks f
  where f.aluno_id = (select aluno_id from aluno_resolvido)
    and (select aluno_id from aluno_resolvido) is not null;
$$;

comment on function public.obter_feedbacks_aluno(uuid, text) is
  'Feedbacks de UM aluno com a resposta da academia, resolvido por token pessoal + slug (nunca aluno_id). Não devolve feedback anônimo nem de outro aluno.';

revoke all on function public.obter_feedbacks_aluno(uuid, text) from public;
grant execute on function public.obter_feedbacks_aluno(uuid, text) to anon, authenticated;
