-- 058b parte 1/3 — funcao abrir_atendimento.
-- Resolve aluno e academia por token+slug dentro do banco.
-- Rode este arquivo sozinho, num editor vazio.

create or replace function public.abrir_atendimento(
  p_token     uuid,
  p_slug      text,
  p_categoria text,
  p_assunto   text,
  p_mensagem  text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_aluno    uuid;
  v_academia uuid;
  v_nome     text;
  v_assunto  text := nullif(btrim(p_assunto), '');
  v_mensagem text := nullif(btrim(p_mensagem), '');
  v_id       uuid;
begin
  -- Atribuição por subquery escalar em vez de `select ... into`: o editor SQL
  -- do Supabase interpreta `SELECT ... INTO nome` como criação de tabela
  -- (o que é verdade em SQL puro, mas não dentro de plpgsql), corta o corpo da
  -- função no primeiro ';' e injeta um ALTER TABLE no meio dela — quebrando
  -- o arquivo com "unterminated dollar-quoted string".
  -- (Sem citar o delimitador aqui: dentro do corpo ele fecharia a string.)
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

  v_academia := (select a.academia_id from public.alunos a where a.id = v_aluno);
  v_nome     := (select a.nome        from public.alunos a where a.id = v_aluno);
  if v_assunto is null or v_mensagem is null then
    raise exception 'Informe o assunto e a mensagem.';
  end if;
  if p_categoria not in ('financeiro','plano','treino','horarios','cadastro','estrutura','outros') then
    raise exception 'Categoria inválida';
  end if;

  insert into public.atendimentos (academia_id, aluno_id, categoria, assunto, status)
  values (v_academia, v_aluno, p_categoria, v_assunto, 'novo')
  returning id into v_id;

  insert into public.atendimento_mensagens
    (academia_id, atendimento_id, autor_tipo, autor_id, autor_nome, mensagem)
  values (v_academia, v_id, 'aluno', null, v_nome, v_mensagem);

  return v_id;
end;
$$;

revoke all on function public.abrir_atendimento(uuid, text, text, text, text) from public;
grant execute on function public.abrir_atendimento(uuid, text, text, text, text) to anon, authenticated;
