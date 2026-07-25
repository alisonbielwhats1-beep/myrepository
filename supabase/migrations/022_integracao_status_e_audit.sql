-- Fase 1 — Segurança das integrações
-- Adiciona colunas de status (7 estados) à tabela academias e cria tabela
-- de auditoria de ações nas integrações. Nunca armazena o valor do segredo.

ALTER TABLE academias
  ADD COLUMN IF NOT EXISTS gympass_status TEXT
    NOT NULL DEFAULT 'nao_configurada'
    CHECK (gympass_status IN (
      'nao_configurada', 'aguardando_configuracao', 'aguardando_homologacao',
      'em_testes', 'ativa', 'com_erro', 'desativada'
    )),
  ADD COLUMN IF NOT EXISTS totalpass_status TEXT
    NOT NULL DEFAULT 'nao_configurada'
    CHECK (totalpass_status IN (
      'nao_configurada', 'aguardando_configuracao', 'aguardando_homologacao',
      'em_testes', 'ativa', 'com_erro', 'desativada'
    ));

-- Academias que já têm segredo configurado passam para aguardando_homologacao
UPDATE academias
  SET gympass_status = 'aguardando_homologacao'
  WHERE gympass_webhook_secret IS NOT NULL AND gympass_webhook_secret <> '';

UPDATE academias
  SET totalpass_status = 'aguardando_homologacao'
  WHERE totalpass_webhook_secret IS NOT NULL AND totalpass_webhook_secret <> '';

-- Tabela de auditoria de ações nas integrações
-- Nunca armazena o valor do segredo — apenas metadados da ação
CREATE TABLE IF NOT EXISTS log_integracoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id  UUID        NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  usuario_id   UUID        NOT NULL,
  plataforma   TEXT        NOT NULL CHECK (plataforma IN ('gympass', 'totalpass')),
  acao         TEXT        NOT NULL CHECK (acao IN ('rotacao_secret', 'atualizar_status')),
  status_anterior TEXT,
  status_novo  TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_integracoes_academia
  ON log_integracoes(academia_id, criado_em DESC);

ALTER TABLE log_integracoes ENABLE ROW LEVEL SECURITY;

-- SELECT: somente dono da própria academia pode consultar o log
CREATE POLICY log_integracoes_select ON log_integracoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis_admin
      WHERE perfis_admin.id = auth.uid()
        AND perfis_admin.academia_id = log_integracoes.academia_id
        AND perfis_admin.papel = 'dono'
    )
  );

-- INSERT: somente dono da própria academia pode gravar no log
CREATE POLICY log_integracoes_insert ON log_integracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfis_admin
      WHERE perfis_admin.id = auth.uid()
        AND perfis_admin.academia_id = log_integracoes.academia_id
        AND perfis_admin.papel = 'dono'
    )
  );

-- UPDATE e DELETE: sem policy → bloqueados por padrão pelo RLS
