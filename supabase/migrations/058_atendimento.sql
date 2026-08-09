-- =============================================================================
-- Migration 058 — Atendimento (dúvidas e solicitações do aluno).
--
-- Separado do Feedback de propósito. Feedback é opinião: entra, a academia
-- responde uma vez e conclui. Atendimento é solicitação: tem ida e volta, e
-- por isso tem tabela de mensagens.
--
--   aluno abre -> academia responde -> aluno responde -> academia resolve
--
-- Estrutura de TICKET, não de chat: sem realtime, sem websocket, sem presença.
-- As mensagens são lidas quando a página carrega. Notificação por e-mail/push/
-- WhatsApp NÃO entra agora — o desenho só não impede acrescentar depois.
--
-- Multi-tenant no padrão do projeto: `academia_id` em ambas as tabelas e as
-- quatro policies contra `public.academia_id_atual()`, iguais às de alunos,
-- receitas etc. `atendimento_mensagens` carrega `academia_id` próprio (em vez
-- de só depender do join com o pai) para a policy ser direta e o índice
-- composto funcionar.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Reversão: 058_atendimento_rollback.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.atendimentos (
  id            uuid        primary key default gen_random_uuid(),
  academia_id   uuid        not null references public.academias(id) on delete cascade,
  aluno_id      uuid        not null references public.alunos(id) on delete cascade,
  categoria     text        not null,
  assunto       text        not null,
  status        text        not null default 'novo',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint atendimentos_categoria_valida check (categoria in (
    'financeiro', 'plano', 'treino', 'horarios', 'cadastro', 'estrutura', 'outros'
  )),
  constraint atendimentos_status_valido check (status in (
    'novo', 'em_atendimento', 'aguardando_aluno', 'resolvido'
  )),
  constraint atendimentos_assunto_nao_vazio check (length(btrim(assunto)) > 0)
);

comment on table public.atendimentos is
  'Solicitações/dúvidas abertas pelo aluno (ticket). Separado de feedbacks: aqui há histórico de respostas.';

create index if not exists idx_atendimentos_academia
  on public.atendimentos(academia_id, status, criado_em desc);
create index if not exists idx_atendimentos_aluno
  on public.atendimentos(aluno_id, criado_em desc);

create table if not exists public.atendimento_mensagens (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  atendimento_id uuid        not null references public.atendimentos(id) on delete cascade,
  autor_tipo     text        not null,
  -- perfis_admin.id quando a academia responde; null quando é o aluno (que não
  -- tem usuário de autenticação — o acesso dele é por token pessoal).
  autor_id       uuid        references public.perfis_admin(id) on delete set null,
  autor_nome     text        not null,
  mensagem       text        not null,
  criado_em      timestamptz not null default now(),
  constraint atendimento_mensagens_autor_valido check (autor_tipo in ('aluno', 'academia')),
  constraint atendimento_mensagens_nao_vazia check (length(btrim(mensagem)) > 0)
);

comment on table public.atendimento_mensagens is
  'Histórico de mensagens de um atendimento. Append-only pela aplicação: nenhuma tela edita ou apaga mensagem.';

create index if not exists idx_atendimento_mensagens_ticket
  on public.atendimento_mensagens(atendimento_id, criado_em);
create index if not exists idx_atendimento_mensagens_academia
  on public.atendimento_mensagens(academia_id);

drop trigger if exists trg_atendimentos_upd on public.atendimentos;
create trigger trg_atendimentos_upd
  before update on public.atendimentos
  for each row execute function public.set_atualizado_em();

-- -----------------------------------------------------------------------------
-- 2. RLS — mesmo padrão de toda tabela tenant do projeto.
--
-- Tabela nova no Postgres NÃO nasce com RLS: sem este bloco, qualquer token
-- autenticado leria os atendimentos de todas as academias.
-- -----------------------------------------------------------------------------
alter table public.atendimentos          enable row level security;
alter table public.atendimento_mensagens enable row level security;

-- As policies vão escritas uma a uma, sem DO block e sem format(). O schema.sql
-- gera as equivalentes num laço, que é mais enxuto — mas aqui o arquivo precisa
-- sobreviver a um copiar-e-colar no editor SQL do dashboard, que quebra
-- statements nos ';' inclusive quando eles estão dentro de uma string. SQL
-- plano não tem como ser mal interpretado.

drop policy if exists "tenant_select_atendimentos" on public.atendimentos;
drop policy if exists "tenant_insert_atendimentos" on public.atendimentos;
drop policy if exists "tenant_update_atendimentos" on public.atendimentos;
drop policy if exists "tenant_delete_atendimentos" on public.atendimentos;
drop policy if exists "service_role_total_atendimentos" on public.atendimentos;

create policy "tenant_select_atendimentos" on public.atendimentos
  for select to authenticated
  using (academia_id = public.academia_id_atual());

create policy "tenant_insert_atendimentos" on public.atendimentos
  for insert to authenticated
  with check (academia_id = public.academia_id_atual());

create policy "tenant_update_atendimentos" on public.atendimentos
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

create policy "tenant_delete_atendimentos" on public.atendimentos
  for delete to authenticated
  using (academia_id = public.academia_id_atual());

create policy "service_role_total_atendimentos" on public.atendimentos
  for all to service_role
  using (true) with check (true);

drop policy if exists "tenant_select_atendimento_mensagens" on public.atendimento_mensagens;
drop policy if exists "tenant_insert_atendimento_mensagens" on public.atendimento_mensagens;
drop policy if exists "tenant_update_atendimento_mensagens" on public.atendimento_mensagens;
drop policy if exists "tenant_delete_atendimento_mensagens" on public.atendimento_mensagens;
drop policy if exists "service_role_total_atendimento_mensagens" on public.atendimento_mensagens;

create policy "tenant_select_atendimento_mensagens" on public.atendimento_mensagens
  for select to authenticated
  using (academia_id = public.academia_id_atual());

create policy "tenant_insert_atendimento_mensagens" on public.atendimento_mensagens
  for insert to authenticated
  with check (academia_id = public.academia_id_atual());

create policy "tenant_update_atendimento_mensagens" on public.atendimento_mensagens
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

create policy "tenant_delete_atendimento_mensagens" on public.atendimento_mensagens
  for delete to authenticated
  using (academia_id = public.academia_id_atual());

create policy "service_role_total_atendimento_mensagens" on public.atendimento_mensagens
  for all to service_role
  using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 3. RPCs do ALUNO — SECURITY DEFINER resolvendo por token + slug.
--
-- O aluno não tem sessão do Supabase Auth, então não passa pelas policies
-- acima: o acesso dele é sempre por estas três funções, que derivam academia e
-- aluno de dentro do banco. Nenhuma delas aceita aluno_id ou academia_id vindo
-- do cliente — mesmo desenho da migration 037.
-- -----------------------------------------------------------------------------

-- 3.1 Abrir solicitação.
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

-- 3.2 Aluno responde um atendimento seu.
-- O WHERE amarra o ticket ao aluno resolvido pelo token: mandar o id de um
-- atendimento de outro aluno não encontra linha e levanta exceção.
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

-- 3.3 Listar os atendimentos do aluno com todo o histórico.
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

comment on function public.abrir_atendimento(uuid, text, text, text, text) is
  'Abre um atendimento para UM aluno, resolvido por token pessoal + slug (nunca aluno_id).';
comment on function public.responder_atendimento_aluno(uuid, text, uuid, text) is
  'Acrescenta mensagem do aluno a um atendimento dele. Ticket de outro aluno levanta exceção.';
comment on function public.obter_atendimentos_aluno(uuid, text) is
  'Atendimentos de UM aluno com histórico, resolvido por token pessoal + slug. Nunca devolve ticket de outro aluno.';

revoke all on function public.abrir_atendimento(uuid, text, text, text, text) from public;
revoke all on function public.responder_atendimento_aluno(uuid, text, uuid, text) from public;
revoke all on function public.obter_atendimentos_aluno(uuid, text) from public;

grant execute on function public.abrir_atendimento(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.responder_atendimento_aluno(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.obter_atendimentos_aluno(uuid, text) to anon, authenticated;
