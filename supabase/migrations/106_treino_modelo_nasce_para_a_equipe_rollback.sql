-- =============================================================================
-- Rollback da migração 106 — treino-modelo volta a nascer 'privado' e os que a
-- 106 abriu voltam a ser privados.
--
-- Reversão EXATA, não um chute: só mexe nas linhas que carregam a marca
-- `metadados->>'visibilidade_antes_106'` gravada pela 106 E que ainda estão em
-- 'equipe'. Se depois da migração alguém mudou o treino para 'academia' ou
-- 'selecionado' de propósito, essa escolha é preservada — o rollback só tira a
-- marca dessas linhas.
--
-- Idempotente: rodar de novo não encontra mais nenhuma marca.
-- =============================================================================

-- 1. Devolve o nível anterior nas linhas intocadas desde a 106.
update public.treinos t
set visibilidade = t.metadados->>'visibilidade_antes_106',
    metadados = t.metadados - 'visibilidade_antes_106'
where (t.metadados -> 'visibilidade_antes_106') is not null
  and t.visibilidade = 'equipe'
  and t.metadados->>'visibilidade_antes_106' = 'privado';

-- 2. Linhas que a 106 marcou mas que alguém mudou depois: só tira a marca,
--    mantendo o nível que a pessoa escolheu.
update public.treinos t
set metadados = t.metadados - 'visibilidade_antes_106'
where (t.metadados -> 'visibilidade_antes_106') is not null;

-- 3. Volta o DEFAULT — é ele que a 106 usa como trava de idempotência, então
--    sem este passo a 106 se recusaria a rodar de novo.
alter table public.treinos alter column visibilidade set default 'privado';

comment on column public.treinos.visibilidade is
  'Nível de visibilidade do treino-modelo (migration 077): privado (só o criador; dono/gerente também), equipe (dono/gerente/instrutor/recepção) ou academia (todo o tenant). Fichas de aluno ignoram o campo. A ORIGEM fica em origem_tipo.';
