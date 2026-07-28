-- =============================================================================
-- Migration 050 — Corrige "column reference \"plataforma\" is ambiguous" em
-- public.definir_valor_repasse_parceiro() (migration 049).
--
-- CAUSA EXATA:
--   A função é LANGUAGE PLPGSQL com `RETURNS TABLE (plataforma text,
--   valor_por_checkin numeric, ativo boolean)`. Em PL/pgSQL, cada coluna de
--   RETURNS TABLE vira um parâmetro OUT — ou seja, uma variável chamada
--   `plataforma` (e outra `ativo`, outra `valor_por_checkin`) passa a existir
--   no escopo inteiro da função, com o MESMO nome de colunas reais de
--   `public.config_repasse_parceiros`.
--
--   A linha exata que dispara o erro é:
--
--       insert into public.config_repasse_parceiros
--         (academia_id, plataforma, valor_por_checkin, ativo, atualizado_em, atualizado_por)
--       values
--         (v_academia, p_plataforma, p_valor, coalesce(p_ativo, false), now(), auth.uid())
--       on conflict (academia_id, plataforma) do update              -- <<< AQUI
--         set valor_por_checkin = excluded.valor_por_checkin, ...
--
--   Especificamente `on conflict (academia_id, plataforma)`: a lista de
--   colunas do alvo do ON CONFLICT é resolvida pelo mesmo mecanismo que o
--   PL/pgSQL usa para decidir se um identificador é variável da função ou
--   coluna de tabela. Como existe uma variável OUT chamada `plataforma` no
--   escopo, o identificador bare `plataforma` dentro de `on conflict (...)`
--   fica igualmente candidato a "variável da função" e a "coluna da tabela
--   alvo do INSERT" — com `plpgsql.variable_conflict` no padrão (`error`,
--   que não alteramos e não vamos alterar), o Postgres recusa a ambiguidade
--   em vez de adivinhar qual dos dois você quis dizer.
--
-- CORREÇÃO:
--   Recria SOMENTE public.definir_valor_repasse_parceiro(), preservando
--   assinatura, retorno, validação de dono, isolamento por academia,
--   comportamento e grants — idênticos à migration 049. A única mudança é
--   eliminar toda referência bare a `plataforma`/`ativo`/`valor_por_checkin`
--   que pudesse colidir com as variáveis OUT:
--     • alias explícito `crp` no INSERT (`insert into
--       public.config_repasse_parceiros as crp (...)`), o que também
--       permite qualificar com `crp.` dentro do DO UPDATE se necessário;
--     • `on conflict on constraint
--       config_repasse_parceiros_academia_id_plataforma_key` no lugar de
--       `on conflict (academia_id, plataforma)` — nome padrão que o Postgres
--       dá a um `unique (academia_id, plataforma)` declarado sem nome
--       explícito na migration 049 (convenção `<tabela>_<col1>_<col2>_key`,
--       tabela e colunas inalteradas por esta migration);
--     • todo SELECT/WHERE/RETURN QUERY qualificado com o alias `crp`.
--   Nada de `plpgsql.variable_conflict` — isso esconderia o problema em vez
--   de corrigi-lo, e o pedido explicitamente veta essa saída.
--
--   Não altera a migration 049 nem a tabela public.config_repasse_parceiros.
--   Não toca em public.repasses_parceiros_resumo() (LANGUAGE SQL, sem escopo
--   de variável PL/pgSQL — não sofre desta ambiguidade).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.definir_valor_repasse_parceiro(
  p_plataforma text,
  p_valor      numeric,
  p_ativo      boolean
)
returns table (
  plataforma        text,
  valor_por_checkin numeric,
  ativo             boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia uuid := public.academia_id_atual();
begin
  -- Validação de dono — idêntica à migration 049: quem não é dono não
  -- recebe erro descritivo, só nenhuma linha.
  if public.papel_do_usuario_atual() is distinct from 'dono' then
    return;
  end if;

  -- Isolamento por academia — idêntico à migration 049.
  if v_academia is null then
    return;
  end if;

  if p_plataforma not in ('gympass', 'totalpass') then
    raise exception 'Plataforma inválida.';
  end if;

  if p_valor is not null and (p_valor < 0 or p_valor > 500) then
    raise exception 'Valor fora da faixa permitida (0 a 500).';
  end if;

  -- Alias explícito `crp` no INSERT: elimina qualquer leitura de
  -- `plataforma`/`ativo`/`valor_por_checkin` como as variáveis OUT da
  -- função. `on conflict on constraint` substitui a lista de colunas
  -- literal, que era a origem real da ambiguidade.
  insert into public.config_repasse_parceiros as crp
    (academia_id, plataforma, valor_por_checkin, ativo, atualizado_em, atualizado_por)
  values
    (v_academia, p_plataforma, p_valor, coalesce(p_ativo, false), now(), auth.uid())
  on conflict on constraint config_repasse_parceiros_academia_id_plataforma_key do update
    set valor_por_checkin = excluded.valor_por_checkin,
        ativo             = excluded.ativo,
        atualizado_em     = now(),
        atualizado_por    = auth.uid();

  return query
    select crp.plataforma, crp.valor_por_checkin, crp.ativo
    from public.config_repasse_parceiros as crp
    where crp.academia_id = v_academia
      and crp.plataforma = p_plataforma;
end;
$$;

comment on function public.definir_valor_repasse_parceiro(text, numeric, boolean) is
  'Único caminho de escrita para o valor estimado de repasse por check-in (TotalPass/Gympass). Só o dono da própria academia — verificado dentro da função (retorna vazio, sem erro, para quem não é dono). Valor null = "não configurado", nunca inventa um padrão. Corrigida na migration 050: ON CONFLICT usava lista de colunas que colidia com as variáveis OUT de RETURNS TABLE, gerando "column reference \"plataforma\" is ambiguous".';

-- Grants idênticos à migration 049 — CREATE OR REPLACE não os altera, mas
-- reafirmamos por clareza e para o caso de a função ter sido recriada do
-- zero em algum ambiente.
revoke all on function public.definir_valor_repasse_parceiro(text, numeric, boolean) from public, anon;
grant execute on function public.definir_valor_repasse_parceiro(text, numeric, boolean) to authenticated;
