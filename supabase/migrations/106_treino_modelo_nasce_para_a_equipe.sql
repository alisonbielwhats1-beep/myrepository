-- =============================================================================
-- Migração 106 — Treino-modelo nasce visível para a EQUIPE (fim do retrabalho
--                da recepção)
--
-- PEDIDO DO CLIENTE (09/09/2026)
--   Na Geração Saúde a recepcionista estava RECADASTRANDO à mão os treinos dos
--   instrutores (Vinícius e Rodrigo) — treinos que já existiam no sistema. Ela
--   simplesmente não os enxergava na biblioteca.
--
-- POR QUE ELA NÃO VIA
--   Desde a migration 077 a coluna `visibilidade` nasce 'privado', e 'privado'
--   significa "só o autor (mais dono/gerente)". Ou seja: TODO treino cadastrado
--   por um instrutor ficava invisível para a recepção e para os OUTROS
--   instrutores. A migration 095 já tinha colocado a recepção dentro do nível
--   'equipe' — mas nenhum treino nascia nesse nível, então na prática nada
--   mudou para ela. O padrão errado anulava a liberação.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1. Backfill: os treinos-MODELO da academia que estão 'privado' passam para
--      'equipe' (dono, gerente, instrutores e recepção). Guarda o valor
--      anterior em `metadados->>'visibilidade_antes_106'` para o rollback ser
--      exato, e não um chute.
--   2. Muda o DEFAULT da coluna para 'equipe', para o problema não voltar.
--
-- O QUE ELA NÃO TOCA (de propósito)
--   • fichas de aluno (`aluno_id is not null`) — nunca leram `visibilidade`;
--   • modelos da plataforma (`academia_id is null`) — não são de ninguém;
--   • nível 'selecionado' (migration 081) — é uma ACL explícita, escolhida a
--     dedo pelo autor; mexer nela seria desfazer uma decisão consciente;
--   • nível 'academia' — já é mais aberto que 'equipe'.
--
-- REVERSIBILIDADE
--   `106_treino_modelo_nasce_para_a_equipe_rollback.sql` devolve ao estado
--   anterior linha a linha, usando a marca gravada em `metadados`.
--
-- IDEMPOTENTE
--   O backfill é guardado pelo DEFAULT da própria coluna: rodar de novo não faz
--   nada. Isso importa mais do que parece — sem a trava, uma segunda execução
--   abriria treinos que alguém marcou como "Só eu" DEPOIS da migração, ou seja,
--   desfaria uma escolha deliberada.
--
-- ORDEM EM RELAÇÃO AO DEPLOY: indiferente.
--   O app já grava 'equipe' explicitamente ao criar/duplicar/importar
--   (lib/treinos.ts → VISIBILIDADE_PADRAO_MODELO), então treino NOVO já nasce
--   certo mesmo sem esta migração. O que só esta migração resolve é o passivo:
--   os treinos que os instrutores JÁ cadastraram e ninguém mais vê.
--
-- NÃO aplicar em produção sem autorização.
-- =============================================================================

do $$
declare
  v_default text;
  v_afetados integer := 0;
begin
  select column_default into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'treinos'
    and column_name = 'visibilidade';

  -- Já rodou (o default é a marca): não repete o backfill.
  if v_default is not null and v_default like '%equipe%' then
    raise notice 'Migração 106 já aplicada (default = %). Nada a fazer.', v_default;
    return;
  end if;

  -- 1. Passivo: modelos privados da academia passam a ser da equipe.
  update public.treinos t
  set visibilidade = 'equipe',
      metadados = coalesce(t.metadados, '{}'::jsonb)
                  || jsonb_build_object('visibilidade_antes_106', t.visibilidade)
  where t.academia_id is not null
    and t.aluno_id is null
    and t.visibilidade = 'privado';

  get diagnostics v_afetados = row_count;

  -- 2. Daqui em diante, nasce no nível certo mesmo se algo inserir sem informar.
  alter table public.treinos alter column visibilidade set default 'equipe';

  raise notice 'Migração 106: % treino(s)-modelo passaram de privado para equipe.', v_afetados;
end $$;

comment on column public.treinos.visibilidade is
  'Nível de visibilidade do treino-modelo: privado (só o criador; dono/gerente também), selecionado (ACL da migration 081), equipe (dono, gerente, instrutor e recepção — DEFAULT desde a migration 106) ou academia (todo o tenant). Fichas de aluno ignoram o campo. A ORIGEM fica em origem_tipo.';

-- -----------------------------------------------------------------------------
-- Conferência (rodar depois, no SQL Editor):
--
--   select visibilidade, count(*)
--   from public.treinos
--   where academia_id is not null and aluno_id is null
--   group by visibilidade order by 2 desc;
--
--   -- quantos treinos cada profissional tem visíveis para a equipe:
--   select coalesce(profissional_nome, '(sem autor)') as profissional,
--          count(*) filter (where visibilidade <> 'privado') as visiveis,
--          count(*) filter (where visibilidade  = 'privado') as privados
--   from public.treinos
--   where academia_id is not null and aluno_id is null
--   group by 1 order by 2 desc;
-- -----------------------------------------------------------------------------
