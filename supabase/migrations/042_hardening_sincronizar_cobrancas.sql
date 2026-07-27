-- =============================================================================
-- Migration 042 — hardening de sincronizar_cobrancas_todas (migration 032).
--
-- CORREÇÃO DE REGISTRO: uma revisão de segurança anterior (nesta mesma sessão
-- de trabalho) afirmou que sincronizar_cobrancas_todas "está hoje igualmente
-- exposta a authenticated/anon" que uma função sem proteção. Isso estava
-- ERRADO — a própria migration 032 (linhas 216-217) já faz:
--
--   REVOKE ALL ON FUNCTION public.sincronizar_cobrancas_todas(integer)
--     FROM public, anon, authenticated;
--   REVOKE ALL ON FUNCTION public.sincronizar_cobrancas_academia(uuid, integer)
--     FROM public, anon, authenticated;
--
-- logo após criar as duas funções. Isso já bloqueia authenticated e anon.
-- service_role nunca foi um dos três alvos nomeados nesse REVOKE, então
-- mantém o EXECUTE que todo papel ganha por padrão na criação da função —
-- resultado final idêntico a um GRANT explícito, só que por um mecanismo
-- (herança de PUBLIC nunca revogada) menos óbvio de ler do que um GRANT
-- direto. NÃO é uma vulnerabilidade real; não há nada para "corrigir" aqui.
--
-- Esta migration só torna esse resultado explícito (GRANT direto a
-- service_role, em vez de depender de "nunca foi revogado de PUBLIC") e
-- alinha o search_path ao padrão explícito agora usado em
-- gerar_notificacoes_diarias (migration 041). Toda referência no corpo de
-- sincronizar_cobrancas_todas já é qualificada com `public.` (inclusive a
-- chamada a sincronizar_cobrancas_academia), então pg_catalog, public é
-- seguro sem reescrever a função.
--
-- Não altera a lógica de cobranças, não recria as funções, não toca a
-- migration 032. Seguro rodar mais de uma vez.
-- =============================================================================

-- search_path explícito — equivalente ao já efetivo por padrão (pg_catalog é
-- sempre buscado primeiro mesmo quando não listado), só mais claro para quem
-- lê e sem depender do leitor saber essa regra implícita do Postgres.
alter function public.sincronizar_cobrancas_todas(integer)
  set search_path = pg_catalog, public;

alter function public.sincronizar_cobrancas_academia(uuid, integer)
  set search_path = pg_catalog, public;

-- Redundante com o REVOKE ALL de 032 (linhas 216-217) — repetido aqui só
-- para que esta migration seja autocontida e não dependa de ler 032 para
-- confirmar o estado final. Idempotente: revogar algo já revogado é no-op.
revoke execute on function public.sincronizar_cobrancas_todas(integer)
  from public, anon, authenticated;

-- Explicita o que já era verdade (service_role nunca foi revogado por 032) —
-- não muda nenhum comportamento em produção, só remove a dependência de
-- "nunca foi revogado de PUBLIC" para quem for auditar isto de novo no
-- futuro (inclusive eu mesmo, que li errado da primeira vez).
grant execute on function public.sincronizar_cobrancas_todas(integer)
  to service_role;
