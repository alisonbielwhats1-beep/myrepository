-- =============================================================================
-- Migration 021 — Endurecimento: RLS por papel + integridade + anti-abuso.
--
-- Corrige achados da auditoria de segurança:
--
--   #1 (CRÍTICO) Broken Authorization: o RLS isolava por academia, mas NÃO
--      olhava o papel. Qualquer membro autenticado (recepção/instrutor) podia
--      ler/escrever financeiro, despesas e SALÁRIOS via chamada REST direta ao
--      Supabase, driblando o `requireSecao` do app (que só protege as telas).
--      Aqui replicamos as permissões de `lib/permissoes.ts` DENTRO do banco.
--
--   #5  Webhooks sem idempotência: reenvio do mesmo check-in duplicava acesso e
--      inflava o repasse. Adiciona `evento_externo_id` + índice único parcial.
--
--   #6  Feedback público sem limite: cria uma infra genérica de rate-limit por
--      chave (reutilizável) para o app barrar spam de avaliações.
--
--   #12 Integridade: CHECK de valor não-negativo em receitas/despesas/planos
--      (o app já validava; agora o banco também, mesmo via API direta).
--
-- As permissões seguem `lib/permissoes.ts`:
--   • financeiro (receitas/despesas)  -> dono (gerente também LÊ, p/ dashboard)
--   • funcionários (inclui salários)  -> dono, gerente
--   • loja vende como receita         -> recepção pode INSERIR/ESTORNAR venda_produto
--   • planos: todos LEEM (p/ matricular); só dono ESCREVE
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- Reaproveita `papel_do_usuario_atual()` (migration 014). Recria por segurança
-- (idempotente) caso a 014 não tenha sido aplicada neste banco.
create or replace function public.papel_do_usuario_atual()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select papel from public.perfis_admin where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RECEITAS — dono/gerente enxergam tudo; recepção só as vendas da loja.
-- ---------------------------------------------------------------------------
drop policy if exists "tenant_select_receitas" on public.receitas;
create policy "tenant_select_receitas" on public.receitas
  for select to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() in ('dono', 'gerente')
      or (public.papel_do_usuario_atual() = 'recepcao' and tipo = 'venda_produto')
    )
  );

drop policy if exists "tenant_insert_receitas" on public.receitas;
create policy "tenant_insert_receitas" on public.receitas
  for insert to authenticated
  with check (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() in ('dono', 'gerente')
      or (public.papel_do_usuario_atual() = 'recepcao' and tipo = 'venda_produto')
    )
  );

drop policy if exists "tenant_update_receitas" on public.receitas;
create policy "tenant_update_receitas" on public.receitas
  for update to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono')
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

drop policy if exists "tenant_delete_receitas" on public.receitas;
create policy "tenant_delete_receitas" on public.receitas
  for delete to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() = 'dono'
      or (public.papel_do_usuario_atual() in ('gerente', 'recepcao') and tipo = 'venda_produto')
    )
  );

-- ---------------------------------------------------------------------------
-- DESPESAS — leitura dono/gerente (dashboard); escrita só dono (financeiro).
-- ---------------------------------------------------------------------------
drop policy if exists "tenant_select_despesas" on public.despesas;
create policy "tenant_select_despesas" on public.despesas
  for select to authenticated
  using (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() in ('dono', 'gerente')
  );

drop policy if exists "tenant_insert_despesas" on public.despesas;
create policy "tenant_insert_despesas" on public.despesas
  for insert to authenticated
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

drop policy if exists "tenant_update_despesas" on public.despesas;
create policy "tenant_update_despesas" on public.despesas
  for update to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono')
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

drop policy if exists "tenant_delete_despesas" on public.despesas;
create policy "tenant_delete_despesas" on public.despesas
  for delete to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

-- ---------------------------------------------------------------------------
-- FUNCIONÁRIOS — inclui salário. Só dono e gerente (RH).
-- ---------------------------------------------------------------------------
drop policy if exists "tenant_select_funcionarios" on public.funcionarios;
create policy "tenant_select_funcionarios" on public.funcionarios
  for select to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() in ('dono', 'gerente'));

drop policy if exists "tenant_insert_funcionarios" on public.funcionarios;
create policy "tenant_insert_funcionarios" on public.funcionarios
  for insert to authenticated
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() in ('dono', 'gerente'));

drop policy if exists "tenant_update_funcionarios" on public.funcionarios;
create policy "tenant_update_funcionarios" on public.funcionarios
  for update to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() in ('dono', 'gerente'))
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() in ('dono', 'gerente'));

drop policy if exists "tenant_delete_funcionarios" on public.funcionarios;
create policy "tenant_delete_funcionarios" on public.funcionarios
  for delete to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() in ('dono', 'gerente'));

-- ---------------------------------------------------------------------------
-- PLANOS — todos LEEM (para matricular aluno); só dono ESCREVE (configurações).
-- (mantém o SELECT tenant-level já existente; substitui só a escrita)
-- ---------------------------------------------------------------------------
drop policy if exists "tenant_insert_planos" on public.planos;
create policy "tenant_insert_planos" on public.planos
  for insert to authenticated
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

drop policy if exists "tenant_update_planos" on public.planos;
create policy "tenant_update_planos" on public.planos
  for update to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono')
  with check (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

drop policy if exists "tenant_delete_planos" on public.planos;
create policy "tenant_delete_planos" on public.planos
  for delete to authenticated
  using (academia_id = public.academia_id_atual() and public.papel_do_usuario_atual() = 'dono');

-- =============================================================================
-- #12 — Integridade: valores não podem ser negativos.
-- (Adiciona só se ainda não existir; o app já garante > 0.)
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'receitas_valor_nao_negativo') then
    alter table public.receitas add constraint receitas_valor_nao_negativo check (valor >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'despesas_valor_nao_negativo') then
    alter table public.despesas add constraint despesas_valor_nao_negativo check (valor >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planos_valor_nao_negativo') then
    alter table public.planos add constraint planos_valor_nao_negativo check (valor_mensal >= 0);
  end if;
end$$;

-- =============================================================================
-- #5 — Idempotência de webhook (anti-replay de check-in).
-- A plataforma parceira manda um id de evento; guardamos e barramos duplicata.
-- =============================================================================
alter table public.acessos_catraca
  add column if not exists evento_externo_id text;

create unique index if not exists uidx_acessos_evento_externo
  on public.acessos_catraca (academia_id, origem, evento_externo_id)
  where evento_externo_id is not null;

-- =============================================================================
-- #6 — Rate-limit genérico por chave (usado pelo feedback público e reutilizável).
-- `acao_permitida(chave, max, janela_seg)` retorna true e conta +1 se ainda há
-- cota na janela; retorna false quando estourou. SECURITY DEFINER: acesso só
-- via a função, nunca à tabela direto.
-- =============================================================================
create table if not exists public.acao_rate_limit (
  chave         text        primary key,
  contador      int         not null default 0,
  janela_inicio timestamptz not null default now()
);

alter table public.acao_rate_limit enable row level security;

drop policy if exists "acao_rate_limit_service" on public.acao_rate_limit;
create policy "acao_rate_limit_service" on public.acao_rate_limit
  for all to service_role using (true) with check (true);

create or replace function public.acao_permitida(
  p_chave      text,
  p_max        int,
  p_janela_seg int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contador int;
begin
  insert into public.acao_rate_limit (chave, contador, janela_inicio)
    values (p_chave, 1, now())
  on conflict (chave) do update
    set contador = case
          when now() - acao_rate_limit.janela_inicio > make_interval(secs => p_janela_seg)
            then 1 else acao_rate_limit.contador + 1 end,
        janela_inicio = case
          when now() - acao_rate_limit.janela_inicio > make_interval(secs => p_janela_seg)
            then now() else acao_rate_limit.janela_inicio end
  returning contador into v_contador;

  return v_contador <= p_max;
end;
$$;

grant execute on function public.acao_permitida(text, int, int) to anon, authenticated;

-- =============================================================================
-- #7 — Baixa de estoque ATÔMICA (evita vender mais do que tem em corrida).
-- Antes o app lia o estoque, subtraía no JS e gravava: duas vendas simultâneas
-- liam o mesmo valor e vendiam a mais. Aqui a checagem e a baixa acontecem num
-- único UPDATE condicional no banco.
--
-- Retorna:
--   true  -> baixa efetuada OU produto não controla estoque (venda liberada)
--   false -> estoque insuficiente ou produto inexistente na academia
-- SECURITY DEFINER, mas SEMPRE filtrado por academia_id_atual() (isolamento).
-- =============================================================================
create or replace function public.baixar_estoque_venda(p_produto_id uuid, p_qtd int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok       boolean;
  v_sem_ctrl boolean;
begin
  update public.produtos
    set estoque = estoque - p_qtd
    where id = p_produto_id
      and academia_id = public.academia_id_atual()
      and estoque is not null
      and estoque >= p_qtd
  returning true into v_ok;

  if v_ok then
    return true;
  end if;

  -- Não baixou: ou o produto não controla estoque (estoque null) e a venda é
  -- livre, ou o estoque é insuficiente / o produto não existe nesta academia.
  select (estoque is null) into v_sem_ctrl
    from public.produtos
    where id = p_produto_id and academia_id = public.academia_id_atual();

  return coalesce(v_sem_ctrl, false);
end;
$$;

grant execute on function public.baixar_estoque_venda(uuid, int) to authenticated;
