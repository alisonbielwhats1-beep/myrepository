-- =============================================================================
-- Migração 074 — Notificações no app do aluno
--
-- Avisos in-app para o aluno (ex.: "Você recebeu um treino novo"). O aluno
-- acessa sem login, por token, então a leitura/baixa é feita por RPCs
-- security definer que validam token_acesso_publico + slug (mesmo padrão das
-- demais RPCs da área do aluno). O painel (admin autenticado) insere/gerencia
-- via RLS de tenant.
-- =============================================================================

create table if not exists public.notificacoes_aluno (
  id           uuid        primary key default gen_random_uuid(),
  academia_id  uuid        not null references public.academias(id) on delete cascade,
  aluno_id     uuid        not null references public.alunos(id)     on delete cascade,
  tipo         text        not null default 'treino',
  titulo       text        not null,
  mensagem     text,
  link         text,        -- rota interna do app do aluno (ex.: 'treinos')
  lida         boolean     not null default false,
  criada_em    timestamptz not null default now()
);

create index if not exists idx_notif_aluno_lista
  on public.notificacoes_aluno(aluno_id, lida, criada_em desc);
create index if not exists idx_notif_aluno_academia
  on public.notificacoes_aluno(academia_id);

alter table public.notificacoes_aluno enable row level security;

-- Painel (admin autenticado): tenant isolado.
drop policy if exists "tenant_select_notif_aluno" on public.notificacoes_aluno;
create policy "tenant_select_notif_aluno" on public.notificacoes_aluno
  for select to authenticated using (academia_id = public.academia_id_atual());
drop policy if exists "tenant_insert_notif_aluno" on public.notificacoes_aluno;
create policy "tenant_insert_notif_aluno" on public.notificacoes_aluno
  for insert to authenticated with check (academia_id = public.academia_id_atual());
drop policy if exists "tenant_update_notif_aluno" on public.notificacoes_aluno;
create policy "tenant_update_notif_aluno" on public.notificacoes_aluno
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());
drop policy if exists "tenant_delete_notif_aluno" on public.notificacoes_aluno;
create policy "tenant_delete_notif_aluno" on public.notificacoes_aluno
  for delete to authenticated using (academia_id = public.academia_id_atual());

-- ----------------------------------------------------------------------------
-- Leitura pelo aluno (sem login): valida token + slug e devolve as não lidas.
-- ----------------------------------------------------------------------------
create or replace function public.obter_notificacoes_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'tipo', n.tipo,
    'titulo', n.titulo,
    'mensagem', n.mensagem,
    'link', n.link,
    'lida', n.lida,
    'criada_em', n.criada_em
  ) order by n.criada_em desc), '[]'::jsonb)
  from public.notificacoes_aluno n
  join public.alunos a    on a.id = n.aluno_id
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug
    and n.lida = false;
$$;

grant execute on function public.obter_notificacoes_aluno(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Marcar como lidas (o aluno abriu/visualizou). Valida token + slug.
-- ----------------------------------------------------------------------------
create or replace function public.marcar_notificacoes_aluno_lidas(p_token uuid, p_slug text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno uuid;
  v_qtd integer;
begin
  select a.id into v_aluno
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token and ac.slug_url = p_slug;

  if v_aluno is null then
    return 0;
  end if;

  update public.notificacoes_aluno
  set lida = true
  where aluno_id = v_aluno and lida = false;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

grant execute on function public.marcar_notificacoes_aluno_lidas(uuid, text) to anon, authenticated;

comment on table public.notificacoes_aluno is
  'Avisos in-app para o aluno (ex.: treino novo atribuído). Aluno lê por RPC token+slug; painel gerencia por RLS de tenant.';
