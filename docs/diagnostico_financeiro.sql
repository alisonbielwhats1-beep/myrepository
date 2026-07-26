-- =============================================================================
-- Diagnóstico financeiro — Fase 7A
--
-- Execute no Supabase SQL Editor. TODAS as consultas são somente leitura:
-- nenhuma altera, apaga ou corrige registro. Rode bloco a bloco.
--
-- Substitua o filtro de academia se você administra mais de um tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Receitas possivelmente duplicadas
--    Mesmo aluno/produto, mesmo valor, mesma data e mesmo tipo, mais de uma vez.
--    Candidato clássico de duplo clique em "Lançar receita" ou em venda.
-- -----------------------------------------------------------------------------
SELECT
  r.academia_id, r.tipo, r.aluno_id, r.produto_id, r.data, r.valor,
  COUNT(*)                AS ocorrencias,
  ARRAY_AGG(r.id)         AS receita_ids,
  ARRAY_AGG(r.criado_em)  AS criado_em
FROM public.receitas r
WHERE r.status <> 'cancelada'
GROUP BY r.academia_id, r.tipo, r.aluno_id, r.produto_id, r.data, r.valor
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, r.data DESC;

-- -----------------------------------------------------------------------------
-- 2. Mensalidades duplicadas na mesma competência
--    O índice uidx_mensalidade_aluno_comp deveria impedir. Se aparecer algo,
--    são linhas anteriores ao índice ou com competencia nula.
-- -----------------------------------------------------------------------------
SELECT
  r.academia_id, r.aluno_id, a.nome, r.competencia,
  COUNT(*)        AS ocorrencias,
  SUM(r.valor)    AS total,
  ARRAY_AGG(r.id) AS receita_ids
FROM public.receitas r
LEFT JOIN public.alunos a ON a.id = r.aluno_id
WHERE r.tipo = 'mensalidade'
  AND r.aluno_id IS NOT NULL
GROUP BY r.academia_id, r.aluno_id, a.nome, r.competencia
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- -----------------------------------------------------------------------------
-- 3. Receitas PAGAS sem data_pagamento
--    Ficam de fora do regime de caixa. O Financeiro avisa a quantidade.
-- -----------------------------------------------------------------------------
SELECT r.academia_id, r.id, r.tipo, r.descricao, r.valor, r.data, r.competencia, r.criado_em
FROM public.receitas r
WHERE r.status = 'pago' AND r.data_pagamento IS NULL
ORDER BY r.data DESC;

-- -----------------------------------------------------------------------------
-- 4. Receitas PAGAS sem forma_pagamento
--    Não afeta totais; afeta conciliação e fechamento por forma.
-- -----------------------------------------------------------------------------
SELECT r.academia_id, r.id, r.tipo, r.descricao, r.valor, r.data_pagamento
FROM public.receitas r
WHERE r.status = 'pago' AND (r.forma_pagamento IS NULL OR btrim(r.forma_pagamento) = '')
ORDER BY r.data_pagamento DESC NULLS LAST;

-- -----------------------------------------------------------------------------
-- 5. Despesas PAGAS sem data_pagamento
--    Coluna criada na migration 031 sem backfill: o histórico inteiro cai aqui
--    até ser preenchido manualmente. Ficam fora do regime de caixa.
-- -----------------------------------------------------------------------------
SELECT d.academia_id, d.id, d.categoria, d.descricao, d.valor, d.data, d.competencia
FROM public.despesas d
WHERE d.status = 'pago' AND d.data_pagamento IS NULL
ORDER BY d.data DESC;

-- -----------------------------------------------------------------------------
-- 6. Despesas PAGAS sem forma_pagamento
-- -----------------------------------------------------------------------------
SELECT d.academia_id, d.id, d.categoria, d.descricao, d.valor, d.data_pagamento
FROM public.despesas d
WHERE d.status = 'pago' AND (d.forma_pagamento IS NULL OR btrim(d.forma_pagamento) = '')
ORDER BY d.data_pagamento DESC NULLS LAST;

-- -----------------------------------------------------------------------------
-- 7. Canceladas que poderiam entrar em indicadores
--    Após a Fase 7A elas são excluídas de caixa, DRE, pendências e projeção.
--    Esta consulta mostra o volume que estava sendo somado antes.
-- -----------------------------------------------------------------------------
SELECT
  r.academia_id,
  date_trunc('month', COALESCE(r.competencia, r.data))::date AS mes,
  COUNT(*)     AS canceladas,
  SUM(r.valor) AS total_cancelado
FROM public.receitas r
WHERE r.status = 'cancelada'
GROUP BY r.academia_id, date_trunc('month', COALESCE(r.competencia, r.data))
ORDER BY mes DESC;

-- -----------------------------------------------------------------------------
-- 8. Receitas sem aluno, sem produto e sem origem identificável
--    Lançamento manual solto: não dá para conciliar com ninguém.
-- -----------------------------------------------------------------------------
SELECT r.academia_id, r.id, r.tipo, r.descricao, r.valor, r.data, r.status
FROM public.receitas r
WHERE r.aluno_id IS NULL
  AND r.produto_id IS NULL
  AND r.tipo NOT IN ('mensalidade', 'venda_produto')
ORDER BY r.data DESC;

-- -----------------------------------------------------------------------------
-- 9. Salários duplicados no mesmo mês
--    uidx_despesa_salario_unica (funcionario_id, competencia) deveria impedir.
-- -----------------------------------------------------------------------------
SELECT
  d.academia_id, d.funcionario_id, f.nome, d.competencia,
  COUNT(*)        AS ocorrencias,
  SUM(d.valor)    AS total,
  ARRAY_AGG(d.id) AS despesa_ids
FROM public.despesas d
LEFT JOIN public.funcionarios f ON f.id = d.funcionario_id
WHERE d.categoria = 'salarios' AND d.funcionario_id IS NOT NULL
GROUP BY d.academia_id, d.funcionario_id, f.nome, d.competencia
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- -----------------------------------------------------------------------------
-- 10. Repasses ligados a acessos NEGADOS
--     Corrigido na escrita a partir da Fase 5, mas registros anteriores ainda
--     carregam valor. Repasse não vira receita hoje, então isso não contamina
--     o DRE — contamina os indicadores de repasse da Recepção e do Dashboard.
-- -----------------------------------------------------------------------------
SELECT
  ac.academia_id, ac.origem,
  COUNT(*)              AS acessos_negados_com_repasse,
  SUM(ac.valor_repasse) AS repasse_indevido
FROM public.acessos_catraca ac
WHERE ac.status_liberacao = 'negado'
  AND COALESCE(ac.valor_repasse, 0) > 0
GROUP BY ac.academia_id, ac.origem
ORDER BY repasse_indevido DESC;
