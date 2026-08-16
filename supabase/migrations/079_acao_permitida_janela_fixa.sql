-- =============================================================================
-- Migração 079 — Anti-spam com janela FIXA no servidor (fecha A4/P1-08)
--
-- PROBLEMA:
--   `acao_permitida(p_chave, p_max, p_janela_seg)` (migration 021) decidia
--   reiniciar o contador comparando com `make_interval(secs => p_janela_seg)`,
--   ou seja, usando a JANELA vinda do CHAMADOR. As ações públicas do aluno
--   (feedback, atendimento, troca de foto) chamam essa função com a anon key
--   (pública). Chamando direto no REST com `p_janela_seg = 0`, a janela expira
--   sempre → o contador zera a cada chamada → o anti-spam vira inócuo
--   (A4/P1-08 da auditoria).
--
-- CORREÇÃO:
--   A janela passa a ser uma CONSTANTE do servidor (300s), não mais derivada do
--   argumento. Todos os cinco chamadores já usavam exatamente 300s, então o
--   comportamento observável não muda. A assinatura (text,int,int) é preservada
--   para não quebrar os call sites nem exigir DROP/overload; o terceiro
--   argumento passa a ser ignorado (mantido só por compatibilidade).
--
-- Só reescreve a função (create or replace); nenhum dado é tocado. Idempotente.
-- O GRANT a anon/authenticated é mantido de propósito: diferente das funções de
-- login (migration 078), estas SÃO o fluxo público do aluno (sem sessão) e
-- precisam ser chamáveis pela anon key — a falha era a janela manipulável, não
-- quem chama. A chave inclui IP + token, então o limite é por usuário.
-- =============================================================================

create or replace function public.acao_permitida(
  p_chave      text,
  p_max        int,
  p_janela_seg int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contador int;
  -- Janela FIXA no servidor. Antes vinha de p_janela_seg (controlável pelo
  -- chamador via anon key), o que permitia zerar o anti-spam. Todos os
  -- chamadores usavam 300s; preservado como constante. p_janela_seg é ignorado.
  v_janela constant interval := interval '300 seconds';
begin
  insert into public.acao_rate_limit (chave, contador, janela_inicio)
    values (p_chave, 1, now())
  on conflict (chave) do update
    set contador = case
          when now() - acao_rate_limit.janela_inicio > v_janela
            then 1 else acao_rate_limit.contador + 1 end,
        janela_inicio = case
          when now() - acao_rate_limit.janela_inicio > v_janela
            then now() else acao_rate_limit.janela_inicio end
  returning contador into v_contador;

  return v_contador <= p_max;
end;
$$;

grant execute on function public.acao_permitida(text, int, int) to anon, authenticated;
