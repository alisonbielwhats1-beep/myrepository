-- =============================================================================
-- CI — Bootstrap: faz um Postgres puro se comportar como Supabase
--
-- POR QUE ISSO EXISTE
--   O plano Free do Supabase permite 2 projetos, e os 2 já estão em uso. Logo
--   não há como ter um projeto de desenvolvimento separado na nuvem. A
--   alternativa (melhor, e de graça) é subir um Postgres descartável no
--   GitHub Actions a cada push/PR e aplicar o schema + as 55 migrations nele.
--
--   Para isso funcionar, o Postgres precisa dos poucos objetos que o Supabase
--   fornece de fábrica e que o nosso SQL referencia. O levantamento completo
--   (grep em schema.sql + migrations) deu exatamente isto:
--     • auth.uid()        — 20 usos, em toda policy de RLS
--     • auth.users        — 1 FK (perfis_admin.id)
--     • storage.buckets   — 2 inserts (migrations 039 e 053)
--     • storage.objects   — só em comentários, nenhum uso real
--     • roles anon, authenticated, service_role
--   Nada mais. Este arquivo cria só isso — não é um clone do Supabase.
--
-- COMO auth.uid() FUNCIONA AQUI
--   No Supabase real, auth.uid() lê o `sub` do JWT via current_setting(). Este
--   bootstrap reproduz o mesmo mecanismo, então os testes podem "virar" um
--   usuário específico do jeito que o PostgREST faz:
--
--       set local role authenticated;
--       set local request.jwt.claim.sub = '<uuid do usuario>';
--
--   É isso que permite testar RLS multi-tenant de verdade (ver
--   20_teste_rls_multitenant.sql) — o teste que hoje não existe no projeto.
--
-- ESTE ARQUIVO NUNCA DEVE SER EXECUTADO EM PRODUÇÃO. O Supabase já fornece
-- tudo isto, e sobrescrever auth.uid() num projeto real quebraria a
-- autenticação de todo mundo. Ele existe só para o Postgres efêmero do CI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles que o Supabase cria por padrão.
--    `nologin` porque no CI ninguém se conecta como elas — o teste usa
--    `set local role`, que não exige login.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- bypassrls espelha o comportamento real: a service role ignora RLS.
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- O owner do banco no CI precisa poder assumir essas roles.
do $$
begin
  execute format('grant anon, authenticated, service_role to %I', current_user);
end
$$;

-- -----------------------------------------------------------------------------
-- 2. Extensões (schema.sql também as declara; aqui garante ordem)
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 3. Schema `auth`
-- -----------------------------------------------------------------------------
create schema if not exists auth;

-- Mínimo de auth.users para a FK de perfis_admin resolver. O Supabase real
-- tem dezenas de colunas; nenhuma outra é referenciada pelo nosso SQL.
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Equivalente funcional do auth.uid() do Supabase: lê o claim `sub` do
-- "JWT". `true` no segundo argumento evita erro quando o GUC não está
-- definido (devolve null, exatamente como um request anônimo).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Schema `storage`
--    Só `buckets` é escrito de verdade (migrations 039 e 053). `objects`
--    existe para o caso de alguma migration futura mexer nele.
-- -----------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id) on delete cascade,
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- No Supabase real, storage.objects tem RLS habilitada e nega por padrão.
-- Reproduzir isso é o que valida a premissa documentada nas migrations 039 e
-- 053 ("sem policy para anon/authenticated, ninguém grava pelo cliente").
alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Permissões de schema que o Supabase concede por padrão em `public`.
--    Sem isto, as policies de RLS nunca são alcançadas: o acesso pararia
--    antes, no GRANT de tabela, e o teste de multi-tenant daria um
--    falso-positivo ("não vê nada" por falta de grant, não por RLS).
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
