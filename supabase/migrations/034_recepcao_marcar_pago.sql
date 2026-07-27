-- =============================================================================
-- Migration 034 — Recepção registra pagamento de mensalidade (revisão).
--
-- PROBLEMA original desta migration:
--   marcarPago() (ficha do aluno) exigia requireSecao(slug, "financeiro"),
--   exclusiva do dono — recepção não conseguia chamar a action. E mesmo
--   liberando a action, o RLS de `receitas` (migration 021) bloquearia:
--     • tenant_select_receitas só deixa recepção ler tipo = 'venda_produto',
--       então as mensalidades do aluno nem apareciam na ficha para ela.
--     • tenant_update_receitas só permitia UPDATE para o papel 'dono'.
--
-- REVISÃO (por que a primeira versão foi trocada):
--   A primeira versão desta migration also liberava UPDATE direto em
--   `receitas` para recepção quando tipo = 'mensalidade'. RLS de UPDATE
--   controla LINHA, não coluna: uma vez liberado o UPDATE na linha, nada no
--   Postgres impede a recepção de mandar, via REST direto (fora do app), um
--   PATCH trocando valor, vencimento (data), competência, aluno_id,
--   descrição ou até o próprio tipo da mensalidade. Curar essa entrada não
--   dá esse poder.
--
-- SOLUÇÃO:
--   1. Recepção continua podendo LER mensalidade (senão a ficha do aluno
--      fica vazia para ela e não há o que quitar).
--   2. UPDATE direto na tabela `receitas` volta a ser exclusivo do dono —
--      a extensão para recepção é REMOVIDA.
--   3. Criada a RPC `registrar_pagamento_mensalidade`, SECURITY DEFINER, que
--      é o único caminho de escrita da recepção: recebe só receita_id e
--      forma_pagamento, resolve a academia pela sessão (nunca por parâmetro),
--      exige papel dono/recepcao, exige tipo = 'mensalidade' e status <>
--      'pago', e grava SOMENTE status, data_pagamento (hoje em SP) e
--      forma_pagamento — valor, data, competência, aluno_id, descrição e tipo
--      são imutáveis por essa via. Idempotente: chamar de novo numa cobrança
--      já paga não é erro, só não faz nada.
--   4. marcarPago() (app) passa a chamar essa RPC em vez de fazer UPDATE
--      direto — nenhuma outra permissão muda.
--
-- Seguro rodar mais de uma vez. Não altera dados existentes.
-- =============================================================================

-- 1. Leitura: recepção enxerga mensalidade (necessário para a ficha do aluno
--    mostrar o que há para quitar). Igual à versão anterior desta migration.
drop policy if exists "tenant_select_receitas" on public.receitas;
create policy "tenant_select_receitas" on public.receitas
  for select to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() in ('dono', 'gerente')
      or (public.papel_do_usuario_atual() = 'recepcao' and tipo in ('venda_produto', 'mensalidade'))
    )
  );

-- 2. Escrita: UPDATE direto em `receitas` volta a ser só do dono. A extensão
--   para recepção da primeira versão desta migration é revertida aqui —
--   equivalente à policy original da migration 021.
drop policy if exists "tenant_update_receitas" on public.receitas;
create policy "tenant_update_receitas" on public.receitas
  for update to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono')
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

-- 3. Único caminho de escrita para dar baixa numa mensalidade sem ser dono.
--   SECURITY DEFINER porque a policy de UPDATE acima não deixaria a própria
--   recepção fazer o UPDATE — a função roda como owner do schema, mas só
--   depois de validar tudo abaixo, e só toca 3 colunas fixas.
create or replace function public.registrar_pagamento_mensalidade(
  p_receita_id      uuid,
  p_forma_pagamento text default null
)
returns table (
  id             uuid,
  status         text,
  data_pagamento date,
  forma_pagamento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel       text := public.papel_do_usuario_atual();
  v_hoje        date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_academia_id is null then
    raise exception 'Sessão inválida.';
  end if;

  if v_papel not in ('dono', 'recepcao') then
    raise exception 'Você não tem permissão para registrar pagamentos.';
  end if;

  -- UPDATE condicional: status <> 'pago' garante que duas chamadas
  -- concorrentes (ou um reenvio) não disputam, e que repetir a chamada numa
  -- cobrança já paga é idempotente (zero linhas, sem erro).
  return query
    update public.receitas r
    set status          = 'pago',
        data_pagamento  = v_hoje,
        forma_pagamento = nullif(trim(p_forma_pagamento), '')
    where r.id = p_receita_id
      and r.academia_id = v_academia_id
      and r.tipo = 'mensalidade'
      and r.status <> 'pago'
    returning r.id, r.status, r.data_pagamento, r.forma_pagamento;
end;
$$;

comment on function public.registrar_pagamento_mensalidade(uuid, text) is
  'Único caminho de escrita para dono/recepção quitarem uma mensalidade. '
  'Grava somente status, data_pagamento e forma_pagamento — valor, data, '
  'competência, aluno_id, descrição e tipo são imutáveis por aqui. '
  'Idempotente: cobrança já paga não gera erro, só não faz nada.';

grant execute on function public.registrar_pagamento_mensalidade(uuid, text) to authenticated;
