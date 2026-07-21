-- =============================================================================
-- Migration 017 — Rate limit de login (proteção contra brute-force).
--
-- PROBLEMA (segurança):
--   A tela de login não tinha limite de tentativas. Um atacante podia testar
--   milhares de senhas por segundo (brute-force / password spraying) contra
--   qualquer e-mail de admin.
--
-- SOLUÇÃO (100% Postgres, sem serviço externo):
--   Tabela `login_rate_limit` + 3 funções SECURITY DEFINER chamadas pela
--   action de login. A chave é o IP do cliente (janela deslizante simples):
--     • login_espera_segundos(chave) → quantos segundos o IP deve aguardar (0 = livre)
--     • login_registrar_falha(chave) → registra 1 falha; bloqueia ao atingir o limite
--     • login_registrar_sucesso(chave) → limpa o contador (login válido)
--
--   Limites embutidos (não expostos ao chamador, para não permitir abuso):
--     • 10 falhas dentro de 10 minutos → bloqueio de 10 minutos.
--
--   Chavear por IP (não por e-mail) evita que um atacante trave a conta de uma
--   vítima só chutando o e-mail dela — travar o próprio IP é inútil para ele.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create table if not exists public.login_rate_limit (
  chave         text        primary key,   -- IP do cliente
  tentativas    int         not null default 0,
  janela_inicio timestamptz not null default now(),
  bloqueado_ate timestamptz
);

comment on table public.login_rate_limit is
  'Contador de tentativas de login por IP, para rate limit anti-brute-force.';

alter table public.login_rate_limit enable row level security;

-- Nenhum acesso direto de anon/authenticated à tabela — só via as funções abaixo.
drop policy if exists "login_rate_limit_service" on public.login_rate_limit;
create policy "login_rate_limit_service" on public.login_rate_limit
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Quantos segundos o IP ainda precisa esperar (0 / null = liberado).
-- ---------------------------------------------------------------------------
create or replace function public.login_espera_segundos(p_chave text)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select greatest(
           0,
           coalesce(ceil(extract(epoch from (bloqueado_ate - now()))), 0)
         )::int
  from public.login_rate_limit
  where chave = p_chave
    and bloqueado_ate is not null
    and bloqueado_ate > now();
$$;

-- ---------------------------------------------------------------------------
-- Registra uma falha de login. Reinicia a janela se ela expirou; bloqueia ao
-- atingir o limite. Limites fixos embutidos (não parametrizáveis pelo chamador).
-- ---------------------------------------------------------------------------
create or replace function public.login_registrar_falha(p_chave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max          constant int := 10;    -- falhas permitidas na janela
  v_janela_seg   constant int := 600;   -- 10 minutos de janela
  v_bloqueio_seg constant int := 600;   -- 10 minutos de bloqueio
  v_tentativas   int;
begin
  insert into public.login_rate_limit (chave, tentativas, janela_inicio)
    values (p_chave, 1, now())
  on conflict (chave) do update
    set tentativas = case
          when now() - login_rate_limit.janela_inicio > make_interval(secs => v_janela_seg)
            then 1
            else login_rate_limit.tentativas + 1
          end,
        janela_inicio = case
          when now() - login_rate_limit.janela_inicio > make_interval(secs => v_janela_seg)
            then now()
            else login_rate_limit.janela_inicio
          end,
        bloqueado_ate = null
  returning tentativas into v_tentativas;

  if v_tentativas >= v_max then
    update public.login_rate_limit
      set bloqueado_ate = now() + make_interval(secs => v_bloqueio_seg)
      where chave = p_chave;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Login bem-sucedido: zera o contador do IP.
-- ---------------------------------------------------------------------------
create or replace function public.login_registrar_sucesso(p_chave text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_rate_limit where chave = p_chave;
$$;

grant execute on function public.login_espera_segundos(text)   to anon, authenticated;
grant execute on function public.login_registrar_falha(text)   to anon, authenticated;
grant execute on function public.login_registrar_sucesso(text) to anon, authenticated;
