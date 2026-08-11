-- =============================================================================
-- Migration 063 — Auditoria do financeiro.
--
-- A LACUNA QUE ISTO FECHA
--   Até aqui a auditoria (migration 040) registrava baixa e cancelamento de
--   mensalidade, cadastro/edição/exclusão de aluno e mudanças na equipe. Não
--   registrava NADA sobre receitas e despesas — inclusive a exclusão delas.
--
--   Numa academia que recebe dinheiro vivo, era a assimetria errada: excluir um
--   ALUNO deixava rastro; excluir uma RECEITA, não. Lançar um pagamento em
--   espécie, marcar como pago e depois apagar a receita fazia a cobrança
--   desaparecer inteira — sem valor pendente e sem valor pago, nada para o dono
--   estranhar no fechamento do mês.
--
--   Isso protege os dois lados: sem registro, qualquer diferença de caixa vira
--   suspeita sobre quem estava no balcão, sem ninguém conseguir provar nada em
--   nenhuma direção. Com registro, um lançamento apagado por engano fica
--   visivelmente diferente de um apagado às 22h de sábado.
--
-- O QUE MUDA AQUI
--   Só os CHECKs de `entidade` e `acao` de logs_auditoria, para aceitar os
--   novos valores. A tabela, os índices e as policies continuam iguais — em
--   especial, continua sem UPDATE e sem DELETE para ninguém: registro de
--   auditoria não se altera nem se apaga pela API.
--
--   Nenhuma linha existente é lida ou alterada. Os valores antigos continuam
--   todos válidos.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- Os CHECKs da 040 foram declarados inline, então o Postgres os nomeou
-- automaticamente (`logs_auditoria_entidade_check` / `_acao_check`). Derrubar
-- pelo nome automático e recriar nomeado deixa a próxima alteração explícita.
alter table public.logs_auditoria
  drop constraint if exists logs_auditoria_entidade_check;
alter table public.logs_auditoria
  drop constraint if exists chk_logs_auditoria_entidade;

alter table public.logs_auditoria
  add constraint chk_logs_auditoria_entidade
  check (entidade in (
    'aluno', 'plano', 'mensalidade', 'equipe', 'funcionario',
    -- Novas: o lançamento financeiro em si, separado de 'mensalidade' (que é a
    -- cobrança do aluno). Uma despesa de aluguel não é mensalidade de ninguém.
    'receita', 'despesa',
    -- Configuração da academia que afeta o caixa (saldo inicial).
    'financeiro'
  ));

alter table public.logs_auditoria
  drop constraint if exists logs_auditoria_acao_check;
alter table public.logs_auditoria
  drop constraint if exists chk_logs_auditoria_acao;

alter table public.logs_auditoria
  add constraint chk_logs_auditoria_acao
  check (acao in (
    -- Já existiam (migration 040).
    'aluno_criado', 'aluno_atualizado', 'aluno_excluido',
    'plano_alterado',
    'mensalidade_paga', 'mensalidade_cancelada',
    'equipe_criado', 'equipe_removido', 'equipe_papel_alterado',
    'funcionario_excluido',

    -- Dinheiro que entra.
    'receita_criada', 'receita_atualizada', 'receita_excluida',
    -- Dinheiro que sai.
    'despesa_criada', 'despesa_atualizada', 'despesa_excluida',
    -- Venda da loja desfeita: apaga a receita e devolve o estoque.
    'venda_estornada',
    -- Preenche a data de um pagamento que já constava como pago.
    'pagamento_retroativo',
    -- Muda o ponto de partida de todo o fluxo de caixa da academia.
    'saldo_inicial_definido'
  ));

comment on table public.logs_auditoria is
  'Histórico de ações críticas: quem fez o quê, em qual academia, quando. Cobre aluno, plano, equipe, funcionário e — desde a migration 063 — todo lançamento de receita e despesa, incluindo exclusões. Nunca grava senha/token/segredo. Imutável via RLS — nenhuma policy de UPDATE/DELETE, nem para o dono.';
