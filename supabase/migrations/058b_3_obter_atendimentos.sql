-- 058b parte 3/3 — funcao obter_atendimentos_aluno.
-- Lista os atendimentos do aluno com o historico de mensagens.
-- Rode este arquivo sozinho, num editor vazio.

create or replace function public.obter_atendimentos_aluno(p_token uuid, p_slug text)
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'categoria', t.categoria,
    'assunto', t.assunto,
    'status', t.status,
    'criado_em', t.criado_em,
    'atualizado_em', t.atualizado_em,
    'mensagens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'autor_tipo', m.autor_tipo,
        'autor_nome', m.autor_nome,
        'mensagem', m.mensagem,
        'criado_em', m.criado_em
      ) order by m.criado_em), '[]'::jsonb)
      from public.atendimento_mensagens m
      where m.atendimento_id = t.id
    )
  ) order by t.atualizado_em desc), '[]'::jsonb)
  from public.atendimentos t
  where t.aluno_id = (select aluno_id from aluno_resolvido)
    and (select aluno_id from aluno_resolvido) is not null;
$$;

revoke all on function public.obter_atendimentos_aluno(uuid, text) from public;
grant execute on function public.obter_atendimentos_aluno(uuid, text) to anon, authenticated;
