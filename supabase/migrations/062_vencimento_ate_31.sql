-- =============================================================================
-- Migration 062 — Dia de vencimento de 1 a 31 (era 1 a 28).
--
-- PEDIDO DO CLIENTE (2026-08-11)
--   A academia cobra parte dos alunos no último dia do mês e não conseguia
--   registrar isso: o cadastro só aceitava até o dia 28.
--
-- POR QUE ERA 28
--   A migration 024 limitou em 28 para nunca produzir uma data inexistente
--   (30/02). Era a solução segura, mas cara: impedia o caso real de negócio.
--
-- POR QUE 31 É SEGURO AGORA
--   O dia gravado no aluno é o PRETENDIDO. A data de cada cobrança já é
--   calculada como `LEAST(dia_vencimento, último dia daquele mês)` pelas
--   funções `gerar_mensalidades_do_mes` (migration 025, linha 121) e
--   `sincronizar_cobrancas` (migration 032) — as duas fazem essa conta desde
--   sempre. Quem escolhe 31 vence em 28/02 (29 em ano bissexto), 30/04 e 31/03.
--
--   Nenhuma função do banco precisa mudar: elas já estavam preparadas para um
--   dia maior que o mês. O que mudou nesta data foi o lado da aplicação
--   (lib/vencimento.ts), que tinha um `Math.min(dia, 28)` discordando do banco.
--
-- IMPACTO NOS DADOS
--   Nenhum. Isto só AFROUXA uma restrição: todo valor hoje válido (1..28)
--   continua válido. Nenhuma linha é lida ou alterada.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

alter table public.alunos
  drop constraint if exists chk_alunos_dia_vencimento;

alter table public.alunos
  add constraint chk_alunos_dia_vencimento
  check (dia_vencimento is null or (dia_vencimento >= 1 and dia_vencimento <= 31));

comment on column public.alunos.dia_vencimento is
  'Dia pretendido de vencimento da mensalidade (1 a 31). A data real de cada cobrança é LEAST(este dia, último dia do mês) — 31 significa, na prática, "último dia do mês".';
