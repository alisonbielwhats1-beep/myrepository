-- =============================================================================
-- Migration 038 — Fase 13: performance e escala
--
-- Objetivo: suportar milhares de alunos e vários anos de histórico sem
-- degradar. Fecha pendências de escala da Fase 3 (índices compostos já
-- cobriam academia_id+data; faltava academia_id+status e busca textual) e
-- endereça um ponto específico da Recepção (Fase 8): getUltimosAcessosPorAluno
-- lia os 1000 acessos mais recentes da ACADEMIA inteira e ficava com o último
-- acesso de cada aluno via `if (!ultimos[id])`. Com mais de ~1000 check-ins
-- recentes (comum em academias grandes, mesmo em poucos dias), alunos que não
-- aparecem nesses 1000 registros mostravam "nunca acessou" mesmo já tendo
-- vindo — não é truncamento de exibição, é dado ERRADO indo pra tela da
-- Recepção. A RPC abaixo agrega no banco (DISTINCT ON), sem limite nenhum.
--
-- Aditiva e idempotente. Nenhum dado existente é alterado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Índice academia_id + status_matricula.
--
-- Antes só existia idx_alunos_academia_criado (academia_id, criado_em desc).
-- Serve bem "listar por mais recente", mas não ajuda contagem/filtro por
-- status ("quantos ativos", "só trancados"), usado pelo Dashboard (contagem
-- de ativos) e pelo novo filtro por status da tela de Alunos.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alunos_academia_status
  ON public.alunos (academia_id, status_matricula);

-- ---------------------------------------------------------------------------
-- 2. Busca por nome/matrícula/telefone no servidor (tela de Alunos, Fase 13).
--
-- ILIKE '%termo%' não usa índice B-tree comum (o coringa à esquerda impede
-- busca por prefixo). pg_trgm com índice GIN cobre "contém" em qualquer
-- posição, que é o comportamento que a busca já tinha no cliente antes desta
-- fase (Array.includes em nome/matrícula/telefone).
--
-- telefone_digitos é uma coluna gerada (nunca gravada diretamente) que
-- normaliza o telefone para só dígitos, do mesmo jeito que a função
-- apenasDigitos() do cliente já fazia — permite buscar "11999999999" e achar
-- "(11) 99999-9999" sem STRIP em tempo de consulta (o que impediria o uso de
-- índice).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS telefone_digitos text
  GENERATED ALWAYS AS (regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_alunos_nome_trgm
  ON public.alunos USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alunos_matricula_trgm
  ON public.alunos USING gin (matricula_codigo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alunos_telefone_digitos_trgm
  ON public.alunos USING gin (telefone_digitos gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Último acesso por aluno — agregação real, sem limite de linhas.
--
-- Substitui a leitura de "as N linhas mais recentes da academia, fica com a
-- primeira ocorrência de cada aluno_id" (lib/data.ts, getUltimosAcessosPorAluno)
-- por uma agregação DISTINCT ON no próprio Postgres, usando o índice composto
-- (academia_id, aluno_id, data_hora_entrada desc) já criado na migration 029.
-- Mesmo critério de "acesso efetivo" da migration 030 (retencao_alunos):
-- só liberado/alerta contam como presença.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ultimos_acessos_por_aluno()
RETURNS TABLE (
  aluno_id      uuid,
  ultimo_acesso timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ON (c.aluno_id)
    c.aluno_id,
    c.data_hora_entrada AS ultimo_acesso
  FROM public.acessos_catraca c
  WHERE c.academia_id = public.academia_id_atual()
    AND c.aluno_id IS NOT NULL
    AND c.status_liberacao IN ('liberado', 'alerta')
  ORDER BY c.aluno_id, c.data_hora_entrada DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ultimos_acessos_por_aluno() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Aniversariantes do mês — só as colunas necessárias, sem trazer a ficha
--    inteira de cada aluno da academia (Retenção usava getAlunos completo
--    só para ler data_nascimento). Mesmo filtro de hoje: nenhum recorte por
--    status_matricula (a tela de Retenção já não filtrava por status aqui).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aniversariantes_do_mes(p_mes integer)
RETURNS TABLE (
  id             uuid,
  nome           text,
  data_nascimento date
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.id, a.nome, a.data_nascimento
  FROM public.alunos a
  WHERE a.academia_id = public.academia_id_atual()
    AND a.data_nascimento IS NOT NULL
    AND extract(month FROM a.data_nascimento) = p_mes;
$$;

GRANT EXECUTE ON FUNCTION public.aniversariantes_do_mes(integer) TO authenticated;
