-- Rollback da migração 108 — remove a conexão com a API oficial da TotalPass.
-- Apaga as place_api_keys guardadas; as academias precisarão conectar de novo.
-- Antes de rodar, garanta que não há linhas de log com as ações novas (ou
-- apague-as), senão a constraint antiga não volta.

delete from public.log_integracoes
 where acao in ('conectar_api', 'desconectar_api', 'alterar_validacao_automatica');

alter table public.log_integracoes drop constraint if exists log_integracoes_acao_check;
alter table public.log_integracoes add constraint log_integracoes_acao_check
  check (acao in ('rotacao_secret', 'atualizar_status', 'definir_valor_repasse'));

drop table if exists public.integracao_totalpass;
