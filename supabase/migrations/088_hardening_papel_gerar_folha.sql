-- =============================================================================
-- Migration 088 — hardening de papel em gerar_folha_do_mes.
--
-- ACHADO (auditoria de produto, 2026-08-22 — mesma classe da migration 082):
--   lib/permissoes.ts restringe a seção "financeiro" ao papel "dono". A folha
--   salarial (gerar_folha_do_mes, migration 002) LANÇA DESPESAS na tabela
--   `despesas` — uma escrita de domínio financeiro — mas nunca verificou o
--   papel de quem chama, e está `grant execute ... to authenticated` desde a
--   002.
--
--   Duas consequências:
--     1) app/painel/[slug]/funcionarios/actions.ts chama a RPC como efeito
--        colateral de criar/atualizar funcionário. Essa seção ("funcionarios")
--        é acessível ao GERENTE — que não tem financeiro — então um gerente
--        gerava folha (despesas) pela tela de Funcionários.
--     2) Qualquer membro autenticado (recepção, instrutor) chamando a RPC
--        DIRETO via REST — sem passar pela tela — lançava a folha da academia.
--
--   A migration 082 corrigiu exatamente isto para gerar_mensalidades_do_mes e
--   sincronizar_cobrancas. A folha ficou de fora. Esta migration fecha a
--   lacuna com a MESMA técnica: CREATE OR REPLACE, mesma assinatura e mesmo
--   corpo, adicionando a checagem `v_papel <> 'dono' -> RAISE EXCEPTION` logo
--   após a checagem de contexto já existente. Nenhuma regra de folha muda.
--
--   Efeito no app: em funcionarios/actions.ts a geração de folha é
--   best-effort (o erro da RPC é ignorado, o funcionário é criado do mesmo
--   jeito). Depois desta migration, quando quem cria o funcionário NÃO é dono,
--   a folha simplesmente não é gerada naquele momento — o dono a gera pela
--   seção Financeiro, como manda a regra de papel. A criação do funcionário
--   segue funcionando para todos os papéis com acesso à seção.
--
-- Seguro rodar mais de uma vez. NÃO aplicar em produção sem autorização.
-- =============================================================================

create or replace function public.gerar_folha_do_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia   uuid    := public.academia_id_atual();
  v_papel      text    := public.papel_do_usuario_atual();
  v_comp       date    := date_trunc('month', p_competencia)::date;
  v_ultimo_dia integer := extract(day from (v_comp + interval '1 month - 1 day'));
  v_criadas    integer := 0;
  r            record;
  v_data       date;
begin
  if v_academia is null then
    raise exception 'Sem academia no contexto do usuário';
  end if;

  if v_papel <> 'dono' then
    raise exception 'Apenas o dono da academia pode gerar a folha de pagamento.';
  end if;

  for r in
    select id, nome, salario, dia_pagamento
    from public.funcionarios
    where academia_id = v_academia
      and status = 'ativo'
      and coalesce(salario, 0) > 0
      and dia_pagamento is not null
  loop
    v_data := make_date(
      extract(year from v_comp)::int,
      extract(month from v_comp)::int,
      least(greatest(r.dia_pagamento, 1), v_ultimo_dia)
    );

    insert into public.despesas
      (academia_id, descricao, categoria, valor, data, status, funcionario_id, competencia)
    values
      (v_academia, 'Salário - ' || r.nome, 'salarios', r.salario, v_data, 'pendente', r.id, v_comp)
    on conflict (funcionario_id, competencia) where funcionario_id is not null
    do nothing;

    if found then
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return v_criadas;
end;
$$;

grant execute on function public.gerar_folha_do_mes(date) to authenticated;
