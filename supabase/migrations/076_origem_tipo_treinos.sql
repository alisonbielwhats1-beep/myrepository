-- =============================================================================
-- Migração 076 — Separa ORIGEM de VISIBILIDADE nos treinos (Fase 1: aditiva)
--
-- CONTEXTO (achado da auditoria — inconsistência de negócio):
--   A coluna `visibilidade` (migration 068) misturava dois eixos ortogonais:
--     • ORIGEM      — quem é dono do modelo (GestAcad / Academia / Instrutor);
--     • VISIBILIDADE — quem enxerga (Privado / Equipe / Academia).
--   O valor `plataforma` é ORIGEM, enquanto `academia`/`instrutor` misturavam
--   origem com visibilidade. Além disso o frontend derivava "é da plataforma"
--   de DUAS fontes (`academia_id IS NULL` OU `visibilidade='plataforma'`).
--
-- ESTA MIGRAÇÃO (Fase 1 — não-destrutiva, reversível):
--   • adiciona `origem_tipo` (gestacad/academia/instrutor) como eixo dedicado
--     de ORIGEM, com DEFAULT 'academia' (o caso comum: fichas e modelos do
--     tenant) para que todo INSERT existente continue válido sem alteração;
--   • faz backfill a partir dos dados atuais, preservando a informação;
--   • trava a coerência com um CHECK (gestacad ⟺ academia_id NULL);
--   • NÃO toca em `visibilidade`, no RLS, nas RPCs nem em CHECKs anteriores —
--     nada de comportamento muda no banco. A leitura passa a preferir
--     `origem_tipo` na aplicação (lib/treinos.ts), com fallback para a regra
--     antiga enquanto convivem os dois.
--
-- FASES SEGUINTES (fora deste arquivo, exigem decisão de produto):
--   • Fase 2 — migrar todas as leituras para `origem_tipo` (feito na app);
--   • Fase 3 — renomear/aposentar o valor `plataforma` em `visibilidade`
--     (mexe em RLS e no CHECK `treinos_plataforma_coerente`); só depois de
--     tudo migrado, sem drop de coluna antes disso.
--
-- Idempotente: `add column if not exists` + backfill condicional + CHECK
-- criado só se ainda não existir.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coluna dedicada de ORIGEM. DEFAULT 'academia' mantém todo INSERT atual
--    válido (fichas de aluno e modelos do tenant). Modelos de instrutor e de
--    plataforma gravam o valor certo explicitamente (aplicação / seeds).
-- ----------------------------------------------------------------------------
alter table public.treinos
  add column if not exists origem_tipo text not null default 'academia';

-- ----------------------------------------------------------------------------
-- 2. Backfill preservando a informação hoje codificada em academia_id +
--    aluno_id + visibilidade. Só reescreve linhas ainda no default herdado,
--    para ser seguro em reaplicação (não sobrescreve um valor já ajustado).
-- ----------------------------------------------------------------------------
-- A ORIGEM é a AUTORIA, independente de o modelo estar ou não compartilhado:
-- todo modelo de um tenant foi autorado por um profissional (origem 'instrutor');
-- compartilhar com a equipe é VISIBILIDADE, não muda a origem. As fichas de
-- aluno são cópias que pertencem à academia ('academia').
update public.treinos
set origem_tipo = case
    when academia_id is null then 'gestacad'    -- Padrão GestAcad (plataforma)
    when aluno_id is not null then 'academia'   -- ficha do aluno: pertence à academia
    else 'instrutor'                             -- modelo do tenant: autorado por um profissional
  end
where origem_tipo = 'academia';

-- ----------------------------------------------------------------------------
-- 3. Coerência: 'gestacad' se e somente se não há academia (modelo global);
--    'academia'/'instrutor' sempre pertencem a um tenant. Fecha drift futuro.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'treinos_origem_tipo_valida'
      and conrelid = 'public.treinos'::regclass
  ) then
    alter table public.treinos
      add constraint treinos_origem_tipo_valida check (
        (origem_tipo = 'gestacad' and academia_id is null)
        or (origem_tipo in ('academia', 'instrutor') and academia_id is not null)
      );
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- 4. Índice para os recortes por origem na biblioteca (mesma dupla do índice
--    de visibilidade da 068), útil quando a leitura passar a filtrar por origem.
-- ----------------------------------------------------------------------------
create index if not exists idx_treinos_origem_tipo
  on public.treinos(academia_id, origem_tipo)
  where aluno_id is null;

-- ----------------------------------------------------------------------------
-- 5. Trigger de coerência: todo modelo de plataforma (sem academia) recebe
--    origem_tipo='gestacad' automaticamente. Blinda a coluna contra INSERTs
--    que não a informam — inclusive um replay idempotente dos seeds da
--    biblioteca padrão (migration 069), que inserem com academia_id NULL e não
--    conhecem esta coluna. Linhas de tenant (academia_id não nulo) não são
--    tocadas: mantêm o valor informado ou o DEFAULT 'academia'.
-- ----------------------------------------------------------------------------
create or replace function public.treinos_origem_tipo_coerente()
returns trigger
language plpgsql
as $$
begin
  if new.academia_id is null then
    new.origem_tipo := 'gestacad';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_treinos_origem_tipo on public.treinos;
create trigger trg_treinos_origem_tipo
  before insert on public.treinos
  for each row execute function public.treinos_origem_tipo_coerente();

comment on column public.treinos.origem_tipo is
  'ORIGEM do treino (migration 076), eixo ortogonal à visibilidade: gestacad (plataforma, academia_id NULL), academia (tenant, inclui fichas) ou instrutor (autorado por um profissional). Fonte de verdade da classificação de origem; visibilidade responde só por privado/equipe/academia.';
