-- =============================================================================
-- Migration 007 — Mensalidade recorrente, vínculo de venda ao produto e
-- estoque mínimo (alerta de reposição).
--
-- Adiciona:
--   • receitas.competencia  — mês de referência da mensalidade (dia 1).
--   • receitas.produto_id   — vincula a venda ao produto (relatório da loja).
--   • índice único que evita duplicar a mensalidade do mesmo aluno no mês.
--   • produtos.estoque_minimo — limite para alerta de reposição.
--   • RPC gerar_mensalidades_do_mes(competencia) — cria a mensalidade pendente
--     de cada aluno ativo com plano, respeitando a recorrência do plano
--     (mensal todo mês; trimestral/anual só quando fecha o ciclo).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

alter table public.receitas add column if not exists competencia date;
alter table public.receitas
  add column if not exists produto_id uuid references public.produtos(id) on delete set null;

create index if not exists idx_receitas_produto on public.receitas(produto_id);
create index if not exists idx_receitas_competencia on public.receitas(competencia);

-- Não deixa gerar duas mensalidades do mesmo aluno para a mesma competência.
create unique index if not exists uidx_mensalidade_aluno_comp
  on public.receitas (aluno_id, competencia)
  where tipo = 'mensalidade' and aluno_id is not null and competencia is not null;

alter table public.produtos
  add column if not exists estoque_minimo integer not null default 5;

-- Liga/desliga a cobrança recorrente por plano. Planos "à vista / pago na hora"
-- ficam com false e não geram mensalidade automática; recorrentes ficam true.
alter table public.planos
  add column if not exists cobranca_recorrente boolean not null default true;

-- -----------------------------------------------------------------------------
-- RPC: gera as mensalidades do mês para a academia do admin logado.
-- Idempotente (índice único acima). Retorna quantas mensalidades criou.
-- -----------------------------------------------------------------------------
create or replace function public.gerar_mensalidades_do_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia   uuid := public.academia_id_atual();
  v_comp       date := date_trunc('month', p_competencia)::date;
  v_ultimo_dia integer := extract(day from (v_comp + interval '1 month - 1 day'));
  v_criadas    integer := 0;
  r            record;
  v_data       date;
  v_dia        integer;
  v_meses      integer;
begin
  if v_academia is null then
    raise exception 'Sem academia no contexto do usuário';
  end if;

  for r in
    select a.id, a.nome, a.criado_em, p.valor_mensal, p.recorrencia_meses
    from public.alunos a
    join public.planos p on p.id = a.plano_id
    where a.academia_id = v_academia
      and a.status_matricula = 'ativa'
      and coalesce(p.valor_mensal, 0) > 0
      and p.cobranca_recorrente = true
  loop
    -- Só cobra quando a competência fecha um ciclo do plano (mensal = sempre).
    v_meses := (extract(year from v_comp)::int * 12 + extract(month from v_comp)::int)
             - (extract(year from r.criado_em)::int * 12 + extract(month from r.criado_em)::int);
    if v_meses < 0 or (r.recorrencia_meses > 0 and (v_meses % r.recorrencia_meses) <> 0) then
      continue;
    end if;

    -- Vencimento = dia da matrícula, limitado ao último dia do mês.
    v_dia := least(greatest(extract(day from r.criado_em)::int, 1), v_ultimo_dia);
    v_data := make_date(extract(year from v_comp)::int, extract(month from v_comp)::int, v_dia);

    insert into public.receitas
      (academia_id, aluno_id, tipo, descricao, valor, data, status, competencia)
    values
      (v_academia, r.id, 'mensalidade', 'Mensalidade - ' || r.nome,
       r.valor_mensal, v_data, 'pendente', v_comp)
    on conflict (aluno_id, competencia)
      where tipo = 'mensalidade' and aluno_id is not null and competencia is not null
    do nothing;

    if found then
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return v_criadas;
end;
$$;

grant execute on function public.gerar_mensalidades_do_mes(date) to authenticated;
