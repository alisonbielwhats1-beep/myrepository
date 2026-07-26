-- =============================================================================
-- Migration 027 — Data e forma de pagamento como colunas próprias
--
-- Antes: "Pago agora" sobrescrevia receitas.data com a data do pagamento
-- (perdendo o vencimento) e a forma de pagamento era texto solto em
-- observacoes, impossível de consultar ou somar por forma.
--
-- Depois:
--   • receitas.data            → continua sendo SEMPRE o vencimento.
--   • receitas.data_pagamento  → quando foi efetivamente pago (null se não pago).
--   • receitas.forma_pagamento → pix, dinheiro, cartão, etc. (null se não pago).
--
-- Ambas nullable e aditivas. Nenhum dado existente é alterado: receitas já
-- pagas ficam com data_pagamento null (a data real é desconhecida e não seria
-- honesto inferi-la a partir do vencimento).
-- =============================================================================

ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS data_pagamento  date,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

-- Consultas por forma de pagamento no fechamento do mês.
CREATE INDEX IF NOT EXISTS idx_receitas_forma_pagamento
  ON public.receitas(forma_pagamento)
  WHERE forma_pagamento IS NOT NULL;
