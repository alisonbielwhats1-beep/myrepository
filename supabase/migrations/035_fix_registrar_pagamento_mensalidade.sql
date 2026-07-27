-- =============================================================================
-- Migration 035 — Corrige registrar_pagamento_mensalidade (migration 034).
--
-- CAUSA EXATA:
--   `receitas.status` é do tipo `status_pagamento_enum` (schema.sql), não
--   `text`. A função declarava `RETURNS TABLE (..., status text, ...)` mas o
--   `RETURN QUERY UPDATE ... RETURNING r.status` devolvia o enum sem cast.
--   Postgres não tem cast implícito nem de assignment de enum para text, e
--   RETURN QUERY exige que os tipos batam exatamente (ou sejam coercíveis).
--   O resultado é um erro em tempo de execução ("structure of query does not
--   match function result type") DEPOIS que o UPDATE já rodou dentro da
--   mesma função — como a função inteira roda como uma transação implícita,
--   o erro desfaz o UPDATE junto. A cobrança nunca chegava a ficar "pago".
--
--   Do lado do app, marcarPago() já devolvia esse erro corretamente
--   (`{ erro: ... }`), mas o botão "Marcar pago" na ficha do aluno
--   (GestaoAlunos.tsx) descartava o retorno — por isso o erro nunca aparecia
--   e a tela só voltava ao estado "vencida" em silêncio.
--
-- CORREÇÃO:
--   Cast explícito `r.status::text` no RETURNING. Nenhuma outra coluna,
--   condição, papel ou permissão muda — mesma assinatura, mesmo corpo, só a
--   linha do RETURNING. CREATE OR REPLACE, seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.registrar_pagamento_mensalidade(
  p_receita_id      uuid,
  p_forma_pagamento text default null
)
returns table (
  id             uuid,
  status         text,
  data_pagamento date,
  forma_pagamento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel       text := public.papel_do_usuario_atual();
  v_hoje        date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_academia_id is null then
    raise exception 'Sessão inválida.';
  end if;

  if v_papel not in ('dono', 'recepcao') then
    raise exception 'Você não tem permissão para registrar pagamentos.';
  end if;

  -- UPDATE condicional: status <> 'pago' garante que duas chamadas
  -- concorrentes (ou um reenvio) não disputam, e que repetir a chamada numa
  -- cobrança já paga é idempotente (zero linhas, sem erro).
  return query
    update public.receitas r
    set status          = 'pago',
        data_pagamento  = v_hoje,
        forma_pagamento = nullif(trim(p_forma_pagamento), '')
    where r.id = p_receita_id
      and r.academia_id = v_academia_id
      and r.tipo = 'mensalidade'
      and r.status <> 'pago'
    returning r.id, r.status::text, r.data_pagamento, r.forma_pagamento;
end;
$$;

comment on function public.registrar_pagamento_mensalidade(uuid, text) is
  'Único caminho de escrita para dono/recepção quitarem uma mensalidade. '
  'Grava somente status, data_pagamento e forma_pagamento — valor, data, '
  'competência, aluno_id, descrição e tipo são imutáveis por aqui. '
  'Idempotente: cobrança já paga não gera erro, só não faz nada.';

grant execute on function public.registrar_pagamento_mensalidade(uuid, text) to authenticated;
