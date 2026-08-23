-- =============================================================================
-- Migração 091 — Cada dia da semana é um "slot" exclusivo por aluno
--
-- PEDIDO DO USUÁRIO
--   "Eu tenho várias opções de poder ter treinos repetidos, de modelos
--   diferentes. Como eu posso garantir que isso vai se minimizar, pra não
--   lançar dois ou três treinos iguais/parecidos no mesmo dia?" — pediu algo
--   parecido com o Trainerize: lá, cada dia da semana só pode ter UM programa;
--   atribuir um programa novo a uma segunda-feira automaticamente tira
--   qualquer outro programa daquele dia.
--
-- ANTES
--   `dias_semana` (migration 083) era só um array por ficha, sem nenhuma
--   regra entre fichas do MESMO aluno — nada impedia (nem avisava) que duas
--   fichas diferentes fossem atribuídas à mesma segunda-feira. O dono só
--   percebia o conflito manualmente, olhando ficha por ficha.
--
-- REGRA NOVA
--   `definir_dias_treino` é o ÚNICO ponto de escrita de `dias_semana` no
--   sistema inteiro (atribuição inicial E edição depois passam por aqui —
--   ver comentário original na migration 083). Ao gravar os dias de uma
--   ficha, qualquer OUTRA ficha ATIVA do MESMO aluno que já ocupava algum
--   desses dias perde exatamente os dias em conflito (nunca os outros que
--   ela também tiver, e a ficha em si NUNCA é apagada/desativada — só fica
--   sem aquele dia específico; se ficar sem nenhum dia, continua existindo e
--   aparece em "Todos" pro aluno, igual a uma ficha que nunca teve dia).
--
--   A função devolve, além do de sempre, um array `realocados` com
--   `{id, nome_treino, dias_perdidos}` de cada ficha afetada — a aplicação
--   usa isso pra avisar o instrutor na hora ("Segunda foi realocada de
--   'Treino A' pra esse treino"), em vez de só acontecer silenciosamente.
--
-- Idempotente (create or replace function). NÃO aplicar em produção sem
-- autorização.
-- =============================================================================

create or replace function public.definir_dias_treino(
  p_treino_id uuid,
  p_dias smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_dias smallint[];
  v_id uuid;
  v_aluno_id uuid;
  v_realocados jsonb;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor') then
    raise exception 'Seu perfil não pode alterar treinos';
  end if;

  v_dias := public._normalizar_dias_semana(p_dias);

  update public.treinos
    set dias_semana = v_dias,
        atualizado_em = now()
    where id = p_treino_id
      and academia_id = v_academia_id
      and aluno_id is not null
    returning id, aluno_id into v_id, v_aluno_id;

  if v_id is null then
    raise exception 'Treino não encontrado nesta academia';
  end if;

  -- Cada dia pertence a UMA ficha por vez, igual a um slot de agenda: tira o
  -- dia de qualquer outra ficha do mesmo aluno que colidia com o que acabou
  -- de ser gravado acima. `alvo` captura o valor ANTES da troca (necessário
  -- porque RETURNING de um UPDATE sempre mostra o estado DEPOIS da escrita —
  -- sem isso, "dias_perdidos" sempre daria vazio).
  with alvo as (
    select id, nome_treino, dias_semana
    from public.treinos
    where academia_id = v_academia_id
      and aluno_id = v_aluno_id
      and id <> v_id
      and ativo = true
      and dias_semana && v_dias
  ),
  atualizado as (
    update public.treinos t
      set dias_semana = (
            select coalesce(array_agg(d order by d), '{}'::smallint[])
            from unnest(t.dias_semana) as d
            where d <> all(v_dias)
          ),
          atualizado_em = now()
      from alvo
      where t.id = alvo.id
      returning t.id, alvo.nome_treino, alvo.dias_semana as dias_antes
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'nome_treino', nome_treino,
           'dias_perdidos', to_jsonb(
             (select coalesce(array_agg(d order by d), '{}'::smallint[])
              from unnest(dias_antes) as d
              where d = any(v_dias))
           )
         )), '[]'::jsonb)
  into v_realocados
  from atualizado;

  return jsonb_build_object(
    'id', v_id,
    'dias_semana', to_jsonb(v_dias),
    'realocados', v_realocados
  );
end;
$$;

comment on function public.definir_dias_treino(uuid, smallint[]) is
  'Define os dias da semana (1=seg … 7=dom) de uma ficha de aluno da própria academia. Cada dia é um slot exclusivo por aluno: gravar aqui tira o dia de qualquer outra ficha ativa do mesmo aluno que já o usava (devolvido em "realocados"). Papel dono/gerente/instrutor. Academia sempre da sessão.';

revoke all on function public.definir_dias_treino(uuid, smallint[]) from public, anon;
grant execute on function public.definir_dias_treino(uuid, smallint[]) to authenticated;
