-- 058b parte 2/3 — funcao responder_atendimento_aluno.
-- Amarra o ticket ao aluno do token: id de outro aluno levanta excecao.
-- Rode este arquivo sozinho, num editor vazio.

create or replace function public.responder_atendimento_aluno(
  p_token          uuid,
  p_slug           text,
  p_atendimento_id uuid,
  p_mensagem       text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno    uuid;
  v_academia uuid;
  v_nome     text;
  v_mensagem text := nullif(btrim(p_mensagem), '');
  v_ok       boolean := false;
begin
  -- Subquery escalar em vez de `select ... into` — ver comentário em
  -- abrir_atendimento sobre o parser do editor SQL do Supabase.
  v_aluno := (
    select a.id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  );

  if v_aluno is null then
    raise exception 'Acesso inválido';
  end if;
  if v_mensagem is null then
    raise exception 'Escreva uma mensagem.';
  end if;

  v_academia := (select a.academia_id from public.alunos a where a.id = v_aluno);
  v_nome     := (select a.nome        from public.alunos a where a.id = v_aluno);

  v_ok := exists (
    select 1
    from public.atendimentos t
    where t.id = p_atendimento_id
      and t.aluno_id = v_aluno
      and t.academia_id = v_academia
  );

  if not v_ok then
    raise exception 'Atendimento não encontrado';
  end if;

  insert into public.atendimento_mensagens
    (academia_id, atendimento_id, autor_tipo, autor_id, autor_nome, mensagem)
  values (v_academia, p_atendimento_id, 'aluno', null, v_nome, v_mensagem);

  -- Resposta do aluno devolve a bola para a academia. Ticket já resolvido não
  -- reabre sozinho: fica registrado, e a academia decide se reabre.
  update public.atendimentos
    set status = 'em_atendimento'
  where id = p_atendimento_id
    and status in ('novo', 'aguardando_aluno');

  return true;
end;
$$;

revoke all on function public.responder_atendimento_aluno(uuid, text, uuid, text) from public;
grant execute on function public.responder_atendimento_aluno(uuid, text, uuid, text) to anon, authenticated;
