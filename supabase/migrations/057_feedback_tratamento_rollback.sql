-- =============================================================================
-- Reversão da migration 057 — tratamento de feedback.
--
-- ATENÇÃO: apaga as respostas já escritas pela academia. Exporte antes se
-- houver conteúdo que importe:
--
--   select id, status, resposta, respondido_em, respondido_por_nome
--   from public.feedbacks where resposta is not null;
--
-- Os feedbacks em si (nota, categoria, comentário, lido) NÃO são tocados —
-- só as colunas que a 054 acrescentou.
-- =============================================================================

drop function if exists public.obter_feedbacks_aluno(uuid, text);

drop trigger if exists trg_feedbacks_upd on public.feedbacks;

alter table public.feedbacks
  drop constraint if exists feedbacks_status_valido;

drop index if exists public.idx_feedbacks_status;

alter table public.feedbacks
  drop column if exists status,
  drop column if exists resposta,
  drop column if exists respondido_em,
  drop column if exists respondido_por,
  drop column if exists respondido_por_nome,
  drop column if exists atualizado_em;
