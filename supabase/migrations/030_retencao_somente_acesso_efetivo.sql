-- =============================================================================
-- Migration 030 — Retenção conta somente acesso efetivo
--
-- PROBLEMA na versão da migration 029:
--   A subquery de agregação filtrava apenas `aluno_id IS NOT NULL`, sem olhar
--   status_liberacao. Com isso, tentativas NEGADAS entravam no
--   MAX(data_hora_entrada) e na contagem de 30 dias.
--
--   Desde a Fase 5 (migration 028) a política de inadimplência grava acessos
--   com status 'negado'. O efeito era perverso: o aluno barrado na porta
--   registrava um "último acesso" e saía da lista de risco — exatamente quem
--   mais precisava de contato desaparecia do radar. Quanto mais a academia
--   bloqueasse, menos gente apareceria como sumida.
--
-- CORREÇÃO:
--   Contar só entrada que de fato aconteceu: status_liberacao IN
--   ('liberado', 'alerta'). 'alerta' é entrada PERMITIDA (aluno entrou devendo)
--   e continua contando. Ficam de fora 'negado', 'pendente' e visitante sem
--   aluno_id.
--
--   Aluno cujos únicos registros forem negados passa a não ter linha na
--   subquery: o LEFT JOIN devolve ultimo_acesso NULL e ele é tratado como
--   "nunca acessou", que é a leitura correta.
--
-- Toda a demais lógica da 029 é preservada: mesma assinatura, mesmas colunas
-- de retorno, mesma ordenação, mesmo COALESCE, mesmo isolamento por
-- academia_id_atual(). Apenas CREATE OR REPLACE — a 029 não é alterada.
-- Seguro rodar mais de uma vez.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.retencao_alunos(p_dias_frequencia integer DEFAULT 30)
RETURNS TABLE (
  aluno_id        uuid,
  nome            text,
  criado_em       timestamptz,
  ultimo_acesso   timestamptz,
  acessos_periodo integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.id,
    a.nome,
    a.criado_em,
    ac.ultimo_acesso,
    COALESCE(ac.acessos_periodo, 0)::integer
  FROM public.alunos a
  LEFT JOIN (
    SELECT
      c.aluno_id,
      MAX(c.data_hora_entrada) AS ultimo_acesso,
      COUNT(*) FILTER (
        WHERE c.data_hora_entrada >= now() - make_interval(days => p_dias_frequencia)
      ) AS acessos_periodo
    FROM public.acessos_catraca c
    WHERE c.academia_id = public.academia_id_atual()
      AND c.aluno_id IS NOT NULL
      -- Somente entrada efetiva. 'alerta' entrou (devendo); 'negado' e
      -- 'pendente' não entraram e não podem contar como frequência.
      AND c.status_liberacao IN ('liberado', 'alerta')
    GROUP BY c.aluno_id
  ) ac ON ac.aluno_id = a.id
  WHERE a.academia_id = public.academia_id_atual()
    AND a.status_matricula = 'ativa'
  ORDER BY a.nome;
$$;

GRANT EXECUTE ON FUNCTION public.retencao_alunos(integer) TO authenticated;
