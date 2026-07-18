-- =============================================================================
-- Migração 002 — Melhorias
--   • Funcionários: foto + dia de pagamento
--   • Salário vira DESPESA automática (folha salarial mensal)
--   • Treinos: modalidade + compartilhamento público por QR
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase (é idempotente: pode
-- rodar de novo sem quebrar nada). Necessário só quem já rodou o schema.sql
-- antes desta atualização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funcionários: foto e dia de pagamento
-- -----------------------------------------------------------------------------
alter table public.funcionarios
  add column if not exists foto_url      text,
  add column if not exists dia_pagamento integer;

-- -----------------------------------------------------------------------------
-- 2. Despesas: vínculo com funcionário + competência (mês de referência),
--    para a folha salarial automática não duplicar.
-- -----------------------------------------------------------------------------
alter table public.despesas
  add column if not exists funcionario_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists competencia    date;

-- Evita duas despesas de salário para o mesmo funcionário no mesmo mês.
create unique index if not exists uidx_despesa_salario_unica
  on public.despesas (funcionario_id, competencia)
  where funcionario_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Função: gerar a folha salarial de um mês (idempotente).
--    Cria uma despesa (categoria 'salarios') para cada funcionário ATIVO com
--    salário > 0 e dia de pagamento definido, na data do pagamento do mês.
--    Usa a academia do admin logado — não é possível gerar folha de outra
--    academia. Retorna quantas despesas foram criadas.
-- -----------------------------------------------------------------------------
create or replace function public.gerar_folha_do_mes(p_competencia date)
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
begin
  if v_academia is null then
    raise exception 'Sem academia no contexto do usuário';
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

-- -----------------------------------------------------------------------------
-- 4. Treinos: modalidade e compartilhamento público por QR.
--    `publico` liga/desliga o link; `share_token` é o código único da URL.
-- -----------------------------------------------------------------------------
alter table public.treinos
  add column if not exists modalidade  text,
  add column if not exists publico     boolean not null default false,
  add column if not exists share_token uuid    not null default gen_random_uuid();

-- Permite treinos "da biblioteca" (modelo), sem aluno vinculado.
alter table public.treinos alter column aluno_id drop not null;

create unique index if not exists uidx_treinos_share_token
  on public.treinos (share_token);

-- RPC pública: dado o token, devolve o treino (sem expor dados do aluno).
-- Só retorna se o treino estiver marcado como público.
create or replace function public.obter_treino_publico(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'treino', jsonb_build_object(
      'id', t.id,
      'nome_treino', t.nome_treino,
      'objetivo', t.objetivo,
      'modalidade', t.modalidade,
      'ordem', t.ordem
    ),
    'academia', jsonb_build_object(
      'nome_fantasia', ac.nome_fantasia,
      'slug_url', ac.slug_url
    ),
    'exercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'treino_id', e.treino_id,
        'nome_exercicio', e.nome_exercicio,
        'series', e.series,
        'repeticoes', e.repeticoes,
        'carga_kg', e.carga_kg,
        'descanso_segundos', e.descanso_segundos,
        'imagem_demonstracao_url', e.imagem_demonstracao_url,
        'video_demonstracao_url', e.video_demonstracao_url,
        'observacoes', e.observacoes,
        'ordem', e.ordem,
        'criado_em', e.criado_em
      ) order by e.ordem)
      from public.exercicios_treino e
      where e.treino_id = t.id
    ), '[]'::jsonb)
  )
  from public.treinos t
  join public.academias ac on ac.id = t.academia_id
  where t.share_token = p_token and t.publico = true;
$$;

grant execute on function public.obter_treino_publico(uuid) to anon, authenticated;

-- =============================================================================
-- Fim da migração 002.
-- =============================================================================
