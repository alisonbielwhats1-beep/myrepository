-- =============================================================================
-- Migration 046 — Hardening de regenerar_token_aluno (token_acesso_publico).
--
-- Mesma classe de gap já fechada em regenerar_token_qr_acesso (migration 044):
-- a função original (migration 037) só validava a academia
-- (`academia_id = academia_id_atual()`), sem exigir papel "dono" dentro do
-- próprio banco — essa regra vivia só na Server Action
-- (app/painel/[slug]/alunos/actions.ts#regenerarTokenAluno). Um gerente,
-- recepção ou instrutor autenticado da MESMA academia, chamando a RPC
-- diretamente (fora da interface), conseguiria regenerar o link de acesso —
-- e, por consequência, também as mutações de treino (migration 045, que usa
-- o mesmo token_acesso_publico) — de qualquer aluno da academia.
--
-- Esta migration recria a função com CREATE OR REPLACE, preservando
-- assinatura, tipo de retorno e comportamento (gera novo UUID, atualiza
-- token_acesso_publico, restrito à própria academia): só adiciona a
-- exigência de papel "dono" dentro do banco e aperta o search_path.
--
-- Não altera a migration 037, 044 ou 045.
-- Seguro rodar mais de uma vez.
-- =============================================================================

create or replace function public.regenerar_token_aluno(p_aluno_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_novo_token uuid := gen_random_uuid();
  v_linhas integer;
begin
  -- Checagem de papel DENTRO da função — mesmo padrão do hardening já
  -- aplicado a regenerar_token_qr_acesso (migration 044): a regra "só o
  -- dono regenera" passa a valer mesmo para quem chamar esta RPC
  -- diretamente, não só quem passar pela Server Action.
  if public.papel_do_usuario_atual() is distinct from 'dono' then
    return null;
  end if;

  update public.alunos
    set token_acesso_publico = v_novo_token
    where id = p_aluno_id
      and academia_id = public.academia_id_atual();

  get diagnostics v_linhas = row_count;

  if v_linhas = 0 then
    return null;
  end if;

  return v_novo_token;
end;
$$;

comment on function public.regenerar_token_aluno(uuid) is
  'Gera um novo token_acesso_publico para o aluno (revoga o link antigo imediatamente — inclusive as mutações de sessão de treino da migration 045, que usam o mesmo token). Só o dono autenticado da própria academia pode chamar, verificado dentro da função (migration 046), não só na Server Action. Nunca altera token_qr_acesso (credencial separada, migration 044).';

revoke all on function public.regenerar_token_aluno(uuid) from public, anon;
grant execute on function public.regenerar_token_aluno(uuid) to authenticated;
