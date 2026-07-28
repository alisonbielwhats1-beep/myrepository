-- =============================================================================
-- Migration 048 — Receita recebida agrupada por forma de pagamento.
--
-- Pedido da primeira academia: ver, no período selecionado do Financeiro,
-- quanto entrou e quantos pagamentos aconteceram em cada forma (PIX, dinheiro,
-- cartão, boleto, transferência).
--
-- Segue exatamente o padrão da migration 031 (financeiro_resumo/dre/serie):
-- toda a agregação acontece no Postgres, escopada por `academia_id_atual()` —
-- a página do Financeiro nunca carrega o histórico detalhado de receitas.
--
-- REGRA DE "RECEBIDO" — a MESMA de `financeiro_resumo` (regime de caixa):
--     status = 'pago' AND data_pagamento BETWEEN p_inicio AND p_fim
-- Portanto NUNCA entram: pendentes, canceladas, previsões, nem pagas sem
-- data_pagamento (essas já são contadas à parte como "lançamentos
-- incompletos" pela 031).
--
-- `forma_pagamento` é texto livre (migration 027) e a interface grava o
-- RÓTULO escolhido no select (lib/types.ts#FORMAS_PAGAMENTO — "PIX",
-- "Dinheiro", "Cartão de débito", ...). Esta função agrupa pelo valor real
-- gravado, sem inventar categoria: normaliza só espaços em branco e rotula
-- explicitamente o que está vazio/nulo como 'Não informado'. Consolidar
-- valores legados em "Outros" é decisão de apresentação, feita na interface.
--
-- AUTORIZAÇÃO — dupla trava, dentro da própria função:
--   1. papel: `papel_do_usuario_atual() = 'dono'`, espelhando lib/permissoes.ts
--      (a seção "financeiro" é exclusiva do dono). Sem isso, um gerente,
--      recepcionista ou instrutor autenticado poderia chamar esta RPC
--      diretamente — fora da interface, que é guardada por
--      `requireSecao(slug, "financeiro")` no layout — e ler valores
--      financeiros da academia. Quem não é dono recebe conjunto VAZIO, não
--      um erro: nada é revelado, nem a existência de movimentação.
--   2. tenant: `academia_id_atual()`, como todas as funções da 031.
--
-- Nenhuma tabela é alterada. Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.financeiro_formas_pagamento(
  p_inicio date,
  p_fim date
)
returns table (
  forma      text,
  total      numeric,
  quantidade integer
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select
    coalesce(nullif(btrim(r.forma_pagamento), ''), 'Não informado') as forma,
    coalesce(sum(r.valor), 0)                                       as total,
    count(*)::integer                                               as quantidade
  from public.receitas r
  -- Trava de papel ANTES de qualquer filtro de dados: só o dono lê financeiro.
  where public.papel_do_usuario_atual() = 'dono'
    and r.academia_id = public.academia_id_atual()
    and r.status = 'pago'
    and r.data_pagamento between p_inicio and p_fim
  group by 1
  order by 2 desc;
$$;

comment on function public.financeiro_formas_pagamento(date, date) is
  'Receita RECEBIDA no período agrupada por forma de pagamento (valor e quantidade). Mesma regra de caixa de financeiro_resumo: status=pago e data_pagamento no intervalo — nunca pendente, cancelada ou previsão. Autorização dentro da função: exige papel_do_usuario_atual() = dono E escopa por academia_id_atual(); quem não é dono recebe conjunto vazio.';

revoke all on function public.financeiro_formas_pagamento(date, date) from public, anon;
grant execute on function public.financeiro_formas_pagamento(date, date) to authenticated;
