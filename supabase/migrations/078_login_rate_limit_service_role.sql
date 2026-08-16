-- =============================================================================
-- Migração 078 — Rate limit de login: funções restritas ao service_role
--                (fecha o achado A3/P1-04 da auditoria de segurança)
--
-- PROBLEMA:
--   As funções de rate limit de login (migration 017) foram concedidas a
--   `anon` e `authenticated`:
--     • login_espera_segundos(text)   — quanto o IP deve aguardar;
--     • login_registrar_falha(text)   — +1 falha (pode disparar o bloqueio);
--     • login_registrar_sucesso(text) — zera o contador do IP.
--   A `anon key` é PÚBLICA (vai no bundle do navegador). Com ela, qualquer um
--   chama essas funções direto no endpoint REST do Supabase, ignorando a
--   server action: zera o próprio contador entre tentativas (brute force
--   ilimitado) ou infla o contador de uma chave para travar o login de uma
--   equipe inteira pelo IP de saída (NAT). O assertivo A3/P1-04 do CI de
--   segurança (supabase/ci/10_assertivas_seguranca.sql) reprova exatamente isso.
--
-- CORREÇÃO:
--   As três funções passam a ser executáveis SOMENTE pelo `service_role`. A
--   server action de login (lib/actions/auth.ts) já foi ajustada para chamá-las
--   com o cliente service-role (chave secreta, nunca exposta ao navegador); o
--   `signInWithPassword` continua no cliente anon (é o fluxo de auth normal).
--   Assim o rate limit deixa de ser manipulável pelo público, sem mudar o
--   comportamento visível do login.
--
-- SEGURANÇA / não-destrutivo:
--   Só mexe em GRANTs (nenhum dado, nenhuma assinatura de função). Revoga de
--   `public` também, porque o EXECUTE default do PostgreSQL é concedido a PUBLIC
--   na criação da função — sem isso, `anon`/`authenticated` ainda executariam
--   por herança do PUBLIC. Idempotente.
-- =============================================================================

revoke execute on function public.login_espera_segundos(text)   from public, anon, authenticated;
revoke execute on function public.login_registrar_falha(text)   from public, anon, authenticated;
revoke execute on function public.login_registrar_sucesso(text) from public, anon, authenticated;

grant execute on function public.login_espera_segundos(text)   to service_role;
grant execute on function public.login_registrar_falha(text)   to service_role;
grant execute on function public.login_registrar_sucesso(text) to service_role;
