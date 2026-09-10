-- =============================================================================
-- Migração 107 — Última EXECUÇÃO por exercício (carga + esforço + concluído)
--                para a sugestão de progressão de carga
--
-- O QUE FALTAVA
--   Desde a migração 093 o aluno registra, a cada exercício, a carga que usou E
--   o esforço percebido (leve / médio / pesado). Mas a RPC que devolve esse
--   histórico — `obter_ultima_carga_aluno` — devolve SÓ o número da carga.
--   Com isso dá para dizer "última vez: 40 kg" e nada mais.
--
--   Para sugerir a próxima carga com segurança, o esforço é o dado essencial:
--   subir peso de quem marcou "pesado" é o conselho errado para uma pessoa
--   sozinha na sala. Esta RPC entrega carga, esforço e se o exercício foi
--   concluído, tudo da mesma (última) sessão finalizada.
--
-- ADITIVA — NÃO altera `obter_ultima_carga_aluno`
--   A função antiga continua existindo, intacta, e o app segue usando ela para
--   o pré-preenchimento. Esta é uma função NOVA, ao lado. Consequência prática:
--   enquanto esta migração não for aplicada, a chamada falha, a aplicação
--   trata como "sem histórico" e simplesmente não mostra sugestão nenhuma —
--   nada mais na tela muda. Aplicar depois do deploy é seguro; aplicar antes
--   também.
--
-- Mesmo desenho de segurança das irmãs (059/093): resolve o aluno por token
-- pessoal + slug DENTRO do banco, nunca por aluno_id vindo do cliente, e só lê
-- `sessoes_treino`. Idempotente (create or replace).
-- =============================================================================

create or replace function public.obter_ultima_execucao_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  ),
  execucoes as (
    select
      (p->>'exercicio_id')::uuid                       as exercicio_id,
      (p->>'carga_realizada_kg')::numeric              as carga,
      nullif(p->>'esforco', '')                        as esforco,
      coalesce((p->>'concluido')::boolean, false)      as concluido,
      coalesce(s.finalizado_em, s.iniciado_em)         as quando
    from public.sessoes_treino s
    cross join lateral jsonb_array_elements(s.progresso) as p
    where s.aluno_id = (select aluno_id from aluno_resolvido)
      and (select aluno_id from aluno_resolvido) is not null
      and s.status = 'finalizada'
      and jsonb_typeof(p->'exercicio_id') = 'string'
      and jsonb_typeof(p->'carga_realizada_kg') = 'number'
  ),
  ultima as (
    select distinct on (exercicio_id)
      exercicio_id, carga, esforco, concluido
    from execucoes
    where carga > 0
    order by exercicio_id, quando desc
  )
  select coalesce(
    jsonb_object_agg(
      exercicio_id::text,
      jsonb_build_object(
        'carga', carga,
        'esforco', esforco,
        'concluido', concluido
      )
    ),
    '{}'::jsonb
  )
  from ultima;
$$;

comment on function public.obter_ultima_execucao_aluno(uuid, text) is
  'Última execução por exercício (carga, esforço percebido e se concluiu) da sessão finalizada mais recente do próprio aluno, resolvido por token pessoal + slug. Alimenta a sugestão de progressão de carga. Só leitura de sessoes_treino. Não substitui obter_ultima_carga_aluno (migration 093), que segue em uso.';

revoke all on function public.obter_ultima_execucao_aluno(uuid, text) from public;
grant execute on function public.obter_ultima_execucao_aluno(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Conferência (rodar depois, no SQL Editor) — troque o token e o slug por um
-- aluno real que já finalizou pelo menos um treino:
--
--   select public.obter_ultima_execucao_aluno(
--     '00000000-0000-0000-0000-000000000000'::uuid, 'sua-academia'
--   );
--
-- Deve devolver um objeto por exercício, no formato:
--   { "<exercicio_id>": { "carga": 40, "esforco": "leve", "concluido": true } }
-- -----------------------------------------------------------------------------
