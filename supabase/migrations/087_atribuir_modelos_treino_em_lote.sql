-- =============================================================================
-- Migração 087 — Atribuir VÁRIOS modelos de treino a um aluno de uma vez
--
-- CONTEXTO (pedido do cliente real)
--   Ao montar a ficha de um aluno (divisão ABC = vários treinos), hoje é preciso
--   atribuir UM modelo por vez, salvando cada um. A recepção/professora pediu
--   "caixinhas" para marcar vários treinos e subir todos de uma vez.
--
-- DECISÃO (escala/controle/segurança)
--   Uma única RPC de LOTE que faz as N cópias na MESMA transação, reutilizando a
--   função canônica `atribuir_modelo_treino` (080) — mesma fidelidade de cópia e
--   as mesmas checagens de tenant/papel/aluno. Nada de loop de N chamadas do
--   cliente (que não escala e abre janela para estado parcial no meio do caminho).
--
--   • SEGURANÇA: tenant e papel vêm da SESSÃO (academia_id_atual/papel_...),
--     nunca de parâmetro. academia_id jamais é aceito do cliente. Recepção
--     continua barrada (só dono/gerente/instrutor).
--   • CONTROLE: cada item é copiado dentro de um bloco com EXCEPTION próprio
--     (savepoint) — um modelo inválido NÃO derruba os que deram certo, e o
--     resultado reporta por item o que entrou (criados), o que já existia
--     (ignorados) e o que falhou (falhas). Sem estado parcial silencioso.
--   • ESCALA: um único round-trip para o lote; teto de 20 modelos por chamada.
--   • PRATICIDADE: NÃO duplica um treino que o aluno já tem (mesmo
--     modelo_origem_id, ficha ativa) — ignora e avisa. A notificação
--     consolidada ao aluno é responsabilidade da camada de aplicação (um aviso
--     só, não um por treino), igual ao fluxo de 1 treino.
--
-- Idempotente (create or replace). NÃO aplicar em produção sem autorização.
-- =============================================================================

create or replace function public.atribuir_modelos_treino(
  p_aluno_id uuid,
  p_treino_modelo_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_academia_id uuid := public.academia_id_atual();
  v_papel text := public.papel_do_usuario_atual();
  v_ids uuid[];
  v_id uuid;
  v_novo uuid;
  v_nome text;
  v_ja_tem boolean;
  v_criados jsonb := '[]'::jsonb;
  v_ignorados jsonb := '[]'::jsonb;
  v_falhas jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_academia_id is null then
    raise exception 'Sessão inválida';
  end if;

  if v_papel not in ('dono', 'gerente', 'instrutor') then
    raise exception 'Seu perfil não pode atribuir treinos';
  end if;

  -- Aluno da academia com matrícula utilizável (ativa/pendente) — mesma regra da
  -- migration 080. Barra trancada/cancelada/inativa com mensagem explícita.
  if not exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.academia_id = v_academia_id
      and a.status_matricula in ('ativa', 'pendente')
  ) then
    raise exception 'Aluno não encontrado nesta academia ou com matrícula inativa (trancada/cancelada). Reative a matrícula para atribuir treinos.';
  end if;

  -- Normaliza a lista: descarta nulos e repetições, preservando a ordem em que
  -- os modelos chegaram (a ficha do aluno respeita essa ordem de seleção).
  select coalesce(array_agg(id order by ord), '{}'::uuid[])
    into v_ids
  from (
    select id, min(ord) as ord
    from unnest(p_treino_modelo_ids) with ordinality as u(id, ord)
    where id is not null
    group by id
  ) s;

  if array_length(v_ids, 1) is null then
    raise exception 'Selecione pelo menos um treino.';
  end if;

  if array_length(v_ids, 1) > 20 then
    raise exception 'Selecione no máximo 20 treinos por vez.';
  end if;

  foreach v_id in array v_ids loop
    -- Nome do modelo só para o relatório amigável. Restringe ao conjunto
    -- atribuível (própria academia ou modelo de plataforma); se não achar aqui,
    -- a chamada abaixo devolve o erro "modelo não encontrado" para este item.
    select t.nome_treino into v_nome
    from public.treinos t
    where t.id = v_id
      and (
        t.academia_id = v_academia_id
        or (t.academia_id is null and t.origem_tipo = 'gestacad')
      )
      and t.aluno_id is null;

    -- Já atribuído a este aluno? Ignora em vez de duplicar a ficha.
    select exists (
      select 1
      from public.treinos f
      where f.aluno_id = p_aluno_id
        and f.academia_id = v_academia_id
        and f.modelo_origem_id = v_id
        and f.ativo = true
    ) into v_ja_tem;

    if v_ja_tem then
      v_ignorados := v_ignorados || jsonb_build_object(
        'modelo_id', v_id,
        'nome', coalesce(v_nome, 'treino')
      );
      continue;
    end if;

    -- Copia reutilizando a RPC canônica (mesma cópia de exercícios e checagens).
    -- O bloco EXCEPTION isola cada item: uma falha vira relatório, não rollback
    -- do lote inteiro.
    begin
      v_novo := public.atribuir_modelo_treino(v_id, p_aluno_id, null);
      v_criados := v_criados || jsonb_build_object(
        'modelo_id', v_id,
        'treino_id', v_novo,
        'nome', coalesce(v_nome, 'treino')
      );
    exception
      when others then
        v_falhas := v_falhas || jsonb_build_object(
          'modelo_id', v_id,
          'nome', coalesce(v_nome, 'treino'),
          'motivo', sqlerrm
        );
    end;
  end loop;

  return jsonb_build_object(
    'criados', v_criados,
    'ignorados', v_ignorados,
    'falhas', v_falhas
  );
end;
$$;

comment on function public.atribuir_modelos_treino(uuid, uuid[]) is
  'Atribui em lote vários modelos de treino a um aluno da própria academia, numa transação. Reutiliza atribuir_modelo_treino por item (savepoint isolado). Tenant/papel da sessão; academia_id nunca é parâmetro. Ignora modelos já atribuídos; teto de 20 por chamada. Devolve {criados, ignorados, falhas}.';

revoke all on function public.atribuir_modelos_treino(uuid, uuid[]) from public, anon;
grant execute on function public.atribuir_modelos_treino(uuid, uuid[]) to authenticated;
