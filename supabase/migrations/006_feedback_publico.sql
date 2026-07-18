-- =============================================================================
-- Migration 006 — Feedback público (anônimo) por slug da academia.
--
-- Permite avaliação sem identificar o aluno: útil para um QR Code fixo (na
-- parede/recepção) que qualquer pessoa escaneia e avalia. Resolve a academia
-- pelo slug; grava com aluno_id null. Valida a nota (1–5).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================
create or replace function public.registrar_feedback_publico(
  p_slug       text,
  p_nota       integer,
  p_categoria  text,
  p_comentario text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academia uuid;
  v_id       uuid;
begin
  select id into v_academia from public.academias where slug_url = p_slug;
  if v_academia is null then
    raise exception 'Academia não encontrada';
  end if;
  if p_nota is null or p_nota < 1 or p_nota > 5 then
    raise exception 'Nota deve ser entre 1 e 5';
  end if;

  insert into public.feedbacks (academia_id, aluno_id, nota, categoria, comentario)
  values (v_academia, null, p_nota, nullif(trim(p_categoria), ''), nullif(trim(p_comentario), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.registrar_feedback_publico(text, integer, text, text) to anon, authenticated;
