-- =============================================================================
-- Migration 015 — Sequência atômica para matricula_codigo.
--
-- PROBLEMA (MÉDIO):
--   A geração de matricula_codigo usava SELECT COUNT(*) + 1, que tem race
--   condition: dois cadastros simultâneos produzem o mesmo código.
--
-- SOLUÇÃO:
--   Cria uma sequência por academia (via tabela auxiliar) com uma função
--   `nextval_matricula(p_academia_id uuid)` que retorna o próximo número
--   de forma atômica (FOR UPDATE) — garante unicidade mesmo sob carga.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- Tabela de contadores por academia (uma linha por academia)
create table if not exists public.matricula_sequencia (
  academia_id  uuid    primary key references public.academias(id) on delete cascade,
  proximo      bigint  not null default 1
);

alter table public.matricula_sequencia enable row level security;

-- Apenas service_role pode ler/escrever; a função abaixo usa SECURITY DEFINER
drop policy if exists "matricula_seq_service" on public.matricula_sequencia;
create policy "matricula_seq_service" on public.matricula_sequencia
  for all to service_role using (true) with check (true);

-- Função atômica: incrementa e retorna o próximo número formatado
create or replace function public.nextval_matricula(p_academia_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proximo bigint;
begin
  -- Insere o contador se for a primeira vez; caso contrário, incrementa
  insert into public.matricula_sequencia(academia_id, proximo)
    values (p_academia_id, 2)
  on conflict (academia_id) do update
    set proximo = matricula_sequencia.proximo + 1
  returning proximo - 1 into v_proximo;

  return 'AL-' || lpad(v_proximo::text, 4, '0');
end;
$$;

comment on function public.nextval_matricula(uuid) is
  'Retorna o próximo código de matrícula para a academia de forma atômica '
  '(sem race condition). Formato: AL-0001, AL-0002, etc.';

-- Inicializa a sequência para academias já existentes com base no count atual
insert into public.matricula_sequencia(academia_id, proximo)
  select id, coalesce((select count(*) from public.alunos where academia_id = a.id), 0) + 1
  from public.academias a
on conflict (academia_id) do nothing;
