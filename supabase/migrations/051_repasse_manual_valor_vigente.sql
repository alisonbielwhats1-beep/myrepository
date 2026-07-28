-- =============================================================================
-- Migration 051 — Leitura do repasse vigente para o registro manual da
-- recepção (Correção cirúrgica: repasse, fuso e meta).
--
-- CAUSA:
--   O check-in manual da recepção (app/painel/[slug]/recepcao/actions.ts)
--   nunca consultava public.config_repasse_parceiros (migration 049) — usava
--   uma constante fixa no código (REPASSE_POR_ORIGEM: Gympass=12.5,
--   TotalPass=10), a mesma classe de bug já corrigida nos webhooks pela
--   migration 049. Resultado: TotalPass configurado em R$ 20 pelo dono
--   continuava gravando R$ 10 num acesso manual.
--
--   O Server Action de registro manual roda com o client de sessão do
--   usuário (dono OU recepção — requireSecao(slug, "recepcao") libera os
--   dois), nunca com service role (migration 049, item 8: "nenhuma service
--   role no fluxo comum"). A tabela config_repasse_parceiros só permite
--   SELECT para quem é papel='dono' (RLS da migration 049) — então a
--   recepção, sozinha, não consegue ler o valor configurado para montar o
--   INSERT.
--
--   Esta função resolve isso: SECURITY DEFINER, sem checagem de papel (ao
--   contrário de definir_valor_repasse_parceiro, que é só do dono) —
--   qualquer membro autenticado da academia pode CHAMAR, mas o valor nunca é
--   devolvido ao navegador: o Server Action usa o número só para montar o
--   INSERT em acessos_catraca e nunca o inclui na resposta ao cliente. Isso
--   preserva "recepção não recebe o valor financeiro no frontend" (migration
--   049) sem impedir a recepção de registrar o check-in com o valor certo.
--
-- Não altera a migration 049 (sem falha nela) nem nenhuma tabela existente.
-- Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.valor_repasse_vigente(p_plataforma text)
returns numeric
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select c.valor_por_checkin
  from public.config_repasse_parceiros c
  where c.academia_id = public.academia_id_atual()
    and c.plataforma = p_plataforma
    and c.ativo = true;
$$;

comment on function public.valor_repasse_vigente(text) is
  'Valor vigente (só se ativo=true) configurado pelo dono para repasse por check-in da plataforma informada; null se não configurado/inativo/plataforma inválida. Sem checagem de papel — qualquer membro autenticado da própria academia pode chamar (recepção precisa, para montar o INSERT do check-in manual), mas o valor nunca deve ser devolvido ao cliente pela Server Action que a chama. Escopado por academia_id_atual().';

revoke all on function public.valor_repasse_vigente(text) from public, anon;
grant execute on function public.valor_repasse_vigente(text) to authenticated;
