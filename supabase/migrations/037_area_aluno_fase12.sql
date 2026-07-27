-- =============================================================================
-- Migration 037 — Fase 12: área do aluno (mensalidades, frequência, foto) +
-- token pessoal revogável.
--
-- O aluno continua sem login (débito técnico já registrado: substituir isto
-- por login real é a melhoria de segurança pendente mais importante). Mas a
-- CREDENCIAL deixa de ser `aluno_id` (chave primária interna, usada em toda
-- FK do banco) e passa a ser `alunos.token_acesso_publico`: um UUID v4
-- gerado por `gen_random_uuid()` (pgcrypto, já habilitado — ver linha 17 de
-- schema.sql), independente do `id`, único, e regenerável pelo dono a
-- qualquer momento (função `regenerar_token_aluno` abaixo) — sem precisar
-- trocar a chave primária nem quebrar nenhuma FK existente.
--
-- Toda RPC pública passa a receber (p_token, p_slug) e resolve o aluno
-- INTERNAMENTE, com a junção token+slug feita dentro do próprio banco (não
-- mais no código da aplicação). Token que não bate com o slug informado, ou
-- que não existe, nunca é distinguível de um aluno inexistente: a função
-- simplesmente não encontra nada e devolve o mesmo "vazio" genérico.
--
-- `aluno_id` interno NUNCA é aceito como parâmetro de entrada de nenhuma RPC
-- pública — só pode sair no retorno da ficha (`obter_ficha_aluno`), e só
-- porque o QR Code de acesso à catraca (recurso pré-existente, fora desta
-- fase) precisa dele para funcionar. Mensalidade, frequência e foto resolvem
-- tudo pelo token; nenhuma delas aceita ou precisa do aluno_id.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Token pessoal de acesso — coluna nova em `alunos`.
--
-- UUID v4 (gen_random_uuid(), CSPRNG do pgcrypto): não sequencial, não
-- derivado de nenhum outro campo — mesmo padrão já usado em `share_token`
-- (migration 002, treino compartilhado por QR). Populado automaticamente
-- para alunos já existentes no ALTER TABLE.
-- -----------------------------------------------------------------------------
alter table public.alunos
  add column if not exists token_acesso_publico uuid not null default gen_random_uuid();

create unique index if not exists uidx_alunos_token_acesso_publico
  on public.alunos (token_acesso_publico);

comment on column public.alunos.token_acesso_publico is
  'Credencial do link pessoal do aluno sem login (Fase 12). Nunca é o id (chave primária/FK) — é regenerável via regenerar_token_aluno() sem afetar nenhum relacionamento do banco.';

-- -----------------------------------------------------------------------------
-- 1. Ficha do aluno — troca de assinatura: (p_aluno_id uuid) -> (p_token uuid, p_slug text).
--
-- A versão anterior (migration 003/009), que recebia só `aluno_id`, é
-- removida explicitamente: como esta migration ainda NÃO foi aplicada em
-- produção, isto evita que as duas assinaturas coexistam como overloads
-- (o que deixaria uma porta dos fundos aceitando aluno_id puro).
-- -----------------------------------------------------------------------------
drop function if exists public.obter_ficha_aluno(uuid);

create or replace function public.obter_ficha_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with aluno_resolvido as (
    select a.id as aluno_id
    from public.alunos a
    join public.academias ac on ac.id = a.academia_id
    where a.token_acesso_publico = p_token
      and ac.slug_url = p_slug
  )
  select jsonb_build_object(
    'aluno', (
      select jsonb_build_object(
        'id', a.id,
        'nome', a.nome,
        'foto_perfil_url', a.foto_perfil_url,
        'status_matricula', a.status_matricula,
        'matricula_codigo', a.matricula_codigo,
        'plano_nome', p.nome,
        'criado_em', a.criado_em
      )
      from public.alunos a
      left join public.planos p on p.id = a.plano_id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'academia', (
      select jsonb_build_object(
        'id', ac.id,
        'nome_fantasia', ac.nome_fantasia,
        'slug_url', ac.slug_url
      )
      from public.academias ac
      join public.alunos a on a.academia_id = ac.id
      where a.id = (select aluno_id from aluno_resolvido)
    ),
    'treinos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nome_treino', t.nome_treino,
        'objetivo', t.objetivo,
        'ordem', t.ordem,
        'exercicios', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'treino_id', e.treino_id,
            'nome_exercicio', e.nome_exercicio,
            'series', e.series,
            'repeticoes', e.repeticoes,
            'carga_kg', e.carga_kg,
            'descanso_segundos', e.descanso_segundos,
            'imagem_demonstracao_url', e.imagem_demonstracao_url,
            'video_demonstracao_url', e.video_demonstracao_url,
            'observacoes', e.observacoes,
            'ordem', e.ordem,
            'criado_em', e.criado_em
          ) order by e.ordem), '[]'::jsonb)
          from public.exercicios_treino e
          where e.treino_id = t.id
        )
      ) order by t.ordem)
      from public.treinos t
      where t.aluno_id = (select aluno_id from aluno_resolvido) and t.ativo = true
    ), '[]'::jsonb),
    'progresso', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'data', pr.data,
        'peso_kg', pr.peso_kg,
        'percentual_gordura', pr.percentual_gordura,
        'peito_cm', pr.peito_cm,
        'cintura_cm', pr.cintura_cm,
        'quadril_cm', pr.quadril_cm,
        'braco_cm', pr.braco_cm,
        'coxa_cm', pr.coxa_cm,
        'foto_url', pr.foto_url
      ) order by pr.data asc)
      from public.progresso_aluno pr
      where pr.aluno_id = (select aluno_id from aluno_resolvido)
    ), '[]'::jsonb)
  )
  where exists (select 1 from aluno_resolvido);
$$;

comment on function public.obter_ficha_aluno(uuid, text) is
  'Leitura pública e restrita (sem CPF/e-mail/telefone) da ficha de um aluno, resolvida por token pessoal + slug da academia (nunca por aluno_id). Token ou slug incorretos devolvem null, indistinguível de "aluno inexistente".';

grant execute on function public.obter_ficha_aluno(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Mensalidades do próprio aluno (nunca o financeiro da academia).
--
-- Mesmos campos de `getMensalidadesDetalhadas` (uso do admin), sem
-- `descricao` (texto livre do admin, desnecessário para o aluno) e sem
-- qualquer coluna de outro aluno ou agregado da academia. Resolvida por
-- token+slug — nunca recebe aluno_id.
-- -----------------------------------------------------------------------------
create or replace function public.obter_mensalidades_aluno(p_token uuid, p_slug text)
returns jsonb
language sql
security definer
set search_path = public
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
    'id', r.id,
    'competencia', r.competencia,
    'data', r.data,
    'valor', r.valor,
    'status', r.status,
    'data_pagamento', r.data_pagamento,
    'forma_pagamento', r.forma_pagamento
  ) order by r.data desc), '[]'::jsonb)
  from public.receitas r
  where r.aluno_id = (select aluno_id from aluno_resolvido)
    and r.tipo = 'mensalidade';
$$;

comment on function public.obter_mensalidades_aluno(uuid, text) is
  'Mensalidades (competência/valor/vencimento/status/pagamento) de UM aluno, resolvido por token pessoal + slug (nunca aluno_id). Nunca DRE, saldo ou dados de outro aluno.';

grant execute on function public.obter_mensalidades_aluno(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Frequência do próprio aluno.
--
-- Mesma regra da migration 030 (retenção): só entrada EFETIVA conta —
-- status_liberacao IN ('liberado', 'alerta'). 'negado' e 'pendente' nunca
-- aparecem aqui nem contam como presença. Devolve só entrada+status; nenhum
-- campo de valor_repasse/observacao/politica_aplicada (dado interno da
-- academia, não do aluno). Resolvida por token+slug — nunca aluno_id.
-- -----------------------------------------------------------------------------
create or replace function public.obter_frequencia_aluno(p_token uuid, p_slug text, p_dias integer default 90)
returns jsonb
language sql
security definer
set search_path = public
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
    'data_hora_entrada', c.data_hora_entrada,
    'status_liberacao', c.status_liberacao
  ) order by c.data_hora_entrada desc), '[]'::jsonb)
  from public.acessos_catraca c
  where c.aluno_id = (select aluno_id from aluno_resolvido)
    and c.status_liberacao in ('liberado', 'alerta')
    and c.data_hora_entrada >= now() - make_interval(days => greatest(least(coalesce(p_dias, 90), 365), 1));
$$;

comment on function public.obter_frequencia_aluno(uuid, text, integer) is
  'Acessos efetivos (liberado/alerta) de UM aluno nos últimos p_dias dias, resolvido por token pessoal + slug (nunca aluno_id). Acesso negado nunca é contado nem retornado.';

grant execute on function public.obter_frequencia_aluno(uuid, text, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Atualização da foto de perfil pelo próprio aluno.
--
-- Único campo do cadastro que o aluno pode alterar sem login (mesma URL
-- https:// já usada pelo admin em `alunos.foto_perfil_url` — sem upload de
-- arquivo/storage novo, fora do escopo desta fase). Resolve o aluno
-- INTEIRAMENTE por token+slug: não existe parâmetro aluno_id nesta função,
-- então conhecer o aluno_id (por exemplo, visto no payload do QR Code de
-- acesso) nunca é suficiente para alterar a foto — é preciso o token. E-mail,
-- telefone, plano, matrícula, vencimento e status continuam exclusivos do
-- painel do admin — esta função não toca essas colunas.
-- -----------------------------------------------------------------------------
create or replace function public.atualizar_foto_aluno_publico(
  p_token uuid,
  p_slug text,
  p_foto_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno_id uuid;
begin
  select a.id into v_aluno_id
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;

  if v_aluno_id is null then
    return false;
  end if;

  if p_foto_url is not null and p_foto_url !~ '^https://' then
    return false;
  end if;

  update public.alunos
    set foto_perfil_url = p_foto_url,
        atualizado_em = now()
    where id = v_aluno_id;

  return true;
end;
$$;

comment on function public.atualizar_foto_aluno_publico(uuid, text, text) is
  'Atualiza SOMENTE foto_perfil_url do próprio aluno, resolvido por token pessoal + slug (nunca aluno_id — conhecer o aluno_id sozinho não é suficiente). Nunca altera e-mail, telefone, plano, matrícula, vencimento ou status.';

grant execute on function public.atualizar_foto_aluno_publico(uuid, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Regeneração/revogação do token pelo dono (admin) — preparação para o
-- futuro. Nenhuma interface é construída agora (fora do escopo desta
-- correção); a função existe para que isso seja possível sem nova migration
-- quando a interface for feita. Restrita à própria academia via
-- `academia_id_atual()` (migration 011, mesmo helper de todas as políticas
-- de RLS do admin) — só um usuário autenticado da academia dona do aluno
-- pode regenerar. Regenerar invalida IMEDIATAMENTE o link antigo (UPDATE
-- substitui o valor; nada mais no banco referencia o token antigo).
-- -----------------------------------------------------------------------------
create or replace function public.regenerar_token_aluno(p_aluno_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo_token uuid := gen_random_uuid();
  v_linhas integer;
begin
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
  'Gera um novo token_acesso_publico para o aluno (revoga o link antigo imediatamente). Só o admin autenticado da própria academia pode chamar. Sem interface própria ainda — só a capacidade no banco.';

grant execute on function public.regenerar_token_aluno(uuid) to authenticated;
