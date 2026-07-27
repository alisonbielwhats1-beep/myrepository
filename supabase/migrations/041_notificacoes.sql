-- =============================================================================
-- Migration 041 — Fase 9: central de notificações operacionais.
--
-- MVP focado no primeiro cliente: mensalidade vencendo/atrasada, plano perto
-- de vencer, aluno sem acesso há X dias, aniversariante do dia e estoque
-- baixo (só onde a loja já existe). Nenhum disparo automático de WhatsApp —
-- só o link "abrir WhatsApp com mensagem pronta", clicado e confirmado pelo
-- dono (ver lib/whats.ts).
--
-- Reaproveitado sem duplicar: `ultimos_acessos_por_aluno()` e
-- `aniversariantes_do_mes()` (migration 038) resolvem para UMA academia via
-- `academia_id_atual()` (o admin logado). A geração diária abaixo processa
-- TODAS as academias em uma chamada só (mesmo desenho de
-- `sincronizar_cobrancas_todas`, migration 032), então usa a mesma lógica
-- (mesmo filtro de acesso efetivo, mesmo campo data_nascimento) reescrita
-- parametrizada por academia — não dá para chamar as funções de tenant único
-- de dentro de um laço multi-tenant sem sessão de usuário.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configurações por academia — uma linha por academia, criada sob demanda
--    (upsert). Sem linha = todos os alertas habilitados e aluno_ausente_dias
--    padrão 14 (COALESCE nas leituras abaixo) — o primeiro cliente já recebe
--    valor sem precisar configurar nada antes.
-- -----------------------------------------------------------------------------
create table if not exists public.configuracoes_notificacoes (
  academia_id                 uuid primary key references public.academias(id) on delete cascade,
  alerta_mensalidade_vencendo boolean not null default true,
  alerta_mensalidade_atrasada boolean not null default true,
  alerta_aluno_ausente        boolean not null default true,
  alerta_aniversario          boolean not null default true,
  alerta_estoque_baixo        boolean not null default true,
  -- Único limiar configurável pelo dono (não é uma cascata como a de
  -- mensalidade) — mantém a fase simples, sem construtor de regras.
  aluno_ausente_dias          integer not null default 14 check (aluno_ausente_dias in (7, 14, 30)),
  atualizado_em               timestamptz not null default now()
);

comment on table public.configuracoes_notificacoes is
  'Fase 9: liga/desliga categorias de alerta por academia. Ausência de linha = tudo habilitado com o padrão (14 dias de ausência) — ver COALESCE em gerar_notificacoes_diarias().';

alter table public.configuracoes_notificacoes enable row level security;

-- SELECT: qualquer membro autenticado da própria academia (a UI precisa ler
-- para saber o que mostrar/ocultar, não é uma área só do dono).
create policy configuracoes_notificacoes_select on public.configuracoes_notificacoes
  for select to authenticated
  using (academia_id = public.academia_id_atual());

-- INSERT/UPDATE: só o dono ativa/desativa categorias (mesmo critério de
-- log_integracoes e da Fase 10: configuração crítica é exclusiva do dono).
create policy configuracoes_notificacoes_insert on public.configuracoes_notificacoes
  for insert to authenticated
  with check (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() = 'dono'
  );

create policy configuracoes_notificacoes_update on public.configuracoes_notificacoes
  for update to authenticated
  using (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() = 'dono'
  )
  with check (
    academia_id = public.academia_id_atual()
    and public.papel_do_usuario_atual() = 'dono'
  );

-- DELETE: sem policy → bloqueado. Reconfigurar é UPDATE, nunca apagar a linha.

-- -----------------------------------------------------------------------------
-- 2. Notificações — geradas pelo servidor (função abaixo), nunca por escrita
--    direta do cliente. `entidade`/`entidade_id` são polimórficos (aluno,
--    mensalidade ou produto) — sem FK cruzada possível, mas nunca confiados
--    isoladamente: toda leitura sempre filtra por academia_id primeiro.
-- -----------------------------------------------------------------------------
create table if not exists public.notificacoes (
  id             uuid        primary key default gen_random_uuid(),
  academia_id    uuid        not null references public.academias(id) on delete cascade,
  -- Destinatário específico opcional (Fase 9: "por usuário quando
  -- aplicável"). Hoje toda notificação é academia-wide (null) — nenhuma
  -- regra de negócio ainda direciona um alerta a uma pessoa específica.
  usuario_id     uuid,
  categoria      text        not null check (categoria in ('mensalidade', 'acesso', 'retencao', 'estoque', 'sistema')),
  tipo           text        not null check (tipo in (
    'mensalidade_vencendo', 'mensalidade_atrasada', 'plano_vencimento',
    'aluno_ausente', 'aniversario', 'estoque_baixo'
  )),
  prioridade     text        not null check (prioridade in ('alta', 'media', 'baixa')),
  titulo         text        not null,
  mensagem       text        not null,
  entidade       text        check (entidade in ('aluno', 'mensalidade', 'produto')),
  entidade_id    uuid,
  data_referencia date       not null,
  -- Impede geração repetida do mesmo alerta (idempotência da geração diária).
  -- Formato: "<entidade>:<id>:<tipo>:<rótulo>" — ver comentários da função
  -- gerar_notificacoes_diarias() para o formato exato de cada tipo.
  dedupe_key     text        not null,
  metadados      jsonb,
  lida_em        timestamptz,
  dispensada_em  timestamptz,
  criado_em      timestamptz not null default now(),
  unique (academia_id, dedupe_key)
);

comment on table public.notificacoes is
  'Fase 9: central de alertas operacionais. Só o servidor grava (função gerar_notificacoes_diarias, SECURITY DEFINER) — nenhuma policy de INSERT para authenticated. Nunca contém senha/token/segredo.';

-- Consulta típica do sino: não dispensadas da academia, mais recentes primeiro.
create index if not exists idx_notificacoes_painel
  on public.notificacoes (academia_id, criado_em desc)
  where dispensada_em is null;

-- Contador de não lidas (o índice cobre exatamente o filtro do count).
create index if not exists idx_notificacoes_nao_lidas
  on public.notificacoes (academia_id)
  where lida_em is null and dispensada_em is null;

create index if not exists idx_notificacoes_entidade
  on public.notificacoes (academia_id, entidade, entidade_id);

alter table public.notificacoes enable row level security;

-- SELECT: isolamento de tenant + a MESMA restrição por papel do componente
-- (lib/permissoes.ts PERMISSOES), replicada aqui com papel_do_usuario_atual()
-- — não um sistema de permissões novo, só a regra existente aplicada também
-- no banco. Sem isto, recepção/instrutor podiam ler alerta financeiro direto
-- via REST mesmo com o componente escondendo a categoria na tela.
--   mensalidade → seção "financeiro": só dono.
--   retencao    → seção "retencao": dono e gerente.
--   estoque     → seção "loja": dono, gerente e recepção.
--   acesso      → seção "recepcao": todo papel tem essa seção, sempre visível.
--   sistema     → não é dado sensível (aniversário): sempre visível.
create policy notificacoes_select on public.notificacoes
  for select to authenticated
  using (
    academia_id = public.academia_id_atual()
    and (
      public.papel_do_usuario_atual() = 'dono'
      or categoria in ('sistema', 'acesso')
      or (categoria = 'retencao' and public.papel_do_usuario_atual() = 'gerente')
      or (categoria = 'estoque' and public.papel_do_usuario_atual() in ('gerente', 'recepcao'))
    )
  );

-- UPDATE: qualquer membro autenticado da própria academia pode marcar como
-- lida/dispensar. RLS sozinha não limita QUAIS colunas mudam — só limita
-- quais LINHAS. Sem a restrição de coluna abaixo, um UPDATE direto via REST
-- (fora do app) poderia reescrever titulo/mensagem/entidade_id/dedupe_key à
-- vontade, mesmo respeitando o limite de tenant.
create policy notificacoes_update on public.notificacoes
  for update to authenticated
  using (academia_id = public.academia_id_atual())
  with check (academia_id = public.academia_id_atual());

-- Privilégio de coluna do Postgres (não é RLS): restringe o UPDATE de
-- `authenticated` a exatamente lida_em e dispensada_em. Menor solução segura
-- para o problema — nenhuma RPC nova é necessária porque o Postgres já
-- resolve "só estas colunas" nativamente, e as Server Actions
-- (app/painel/[slug]/notificacoes/actions.ts) já só escrevem essas duas.
-- Tentar mudar qualquer outra coluna (tipo, titulo, entidade_id, dedupe_key,
-- academia_id, criado_em...) falha por falta de privilégio, mesmo que a
-- linha passe pela policy acima.
revoke update on public.notificacoes from authenticated;
grant update (lida_em, dispensada_em) on public.notificacoes to authenticated;

-- INSERT e DELETE: nenhuma policy para authenticated → bloqueados por padrão.
-- Só a função SECURITY DEFINER abaixo (chamada com service_role a partir do
-- cron) cria linhas. "Dispensar" é UPDATE de dispensada_em, nunca um DELETE.

-- -----------------------------------------------------------------------------
-- 3. Geração diária — idempotente via UNIQUE(academia_id, dedupe_key) +
--    ON CONFLICT DO NOTHING. Processa todas as academias em uma passada só
--    (mesmo desenho de sincronizar_cobrancas_todas, migration 032). REVOKE
--    explícito de EXECUTE para public/anon/authenticated logo após a criação
--    (ver abaixo) — só service_role chama, a partir da rota de cron.
-- -----------------------------------------------------------------------------
create or replace function public.gerar_notificacoes_diarias()
returns table (tipo text, criadas integer)
language plpgsql
security definer
-- pg_catalog explícito (não só implícito) + public: toda tabela referenciada
-- no corpo já é qualificada com `public.` (conferido linha a linha); as únicas
-- referências sem prefixo são built-ins de pg_catalog (now(), to_char(),
-- jsonb_build_object(), EXTRACT(...), operadores de texto/data) — nenhuma
-- delas é shadowable por um objeto criado em public, porque pg_catalog é
-- sempre resolvido antes de qualquer schema de usuário. search_path = ''
-- exigiria prefixar cada uma dessas chamadas manualmente sem ganho real de
-- segurança aqui — não é a "menor solução segura" para este corpo.
set search_path = pg_catalog, public
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Reconciliação: dispensa automaticamente alertas ainda não lidos cujo
  --    motivo já deixou de existir — mensalidade paga/cancelada, aluno
  --    excluído/inativado, ou estoque recomposto acima do mínimo (produto
  --    desativado/excluído conta como resolvido também). Sem isto, o
  --    contador e a lista continuariam mostrando pendência resolvida
  --    (regra obrigatória da Fase 9).
  -- ---------------------------------------------------------------------------
  update public.notificacoes n
     set dispensada_em = now()
   where n.dispensada_em is null
     and n.lida_em is null
     and (
       -- Mensalidade não está mais pendente (paga, cancelada ou some da base).
       (n.tipo in ('mensalidade_vencendo', 'mensalidade_atrasada')
         and not exists (
           select 1 from public.receitas r
           where r.id = n.entidade_id and r.status = 'pendente'
         ))
       -- Aluno não existe mais ou não está mais ativo.
       or (n.tipo in ('aluno_ausente', 'aniversario', 'plano_vencimento')
         and not exists (
           select 1 from public.alunos a
           where a.id = n.entidade_id and a.status_matricula = 'ativa'
         ))
       -- Estoque voltou acima do mínimo, produto foi desativado ou excluído.
       or (n.tipo = 'estoque_baixo'
         and not exists (
           select 1 from public.produtos p
           where p.id = n.entidade_id
             and p.ativo = true
             and p.estoque is not null
             and p.estoque <= p.estoque_minimo
         ))
     );

  -- ---------------------------------------------------------------------------
  -- 1. Mensalidade vencendo em 7, 3 ou 1 dia.
  --    dedupe_key: mensalidade:<receita_id>:vencendo:<dias>d:<vencimento>
  -- ---------------------------------------------------------------------------
  return query
  with novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      r.academia_id, 'mensalidade', 'mensalidade_vencendo',
      case when (r.data - v_hoje) = 1 then 'media' else 'baixa' end,
      'Mensalidade vencendo',
      a.nome || ' — mensalidade vence em ' || (r.data - v_hoje) || ' dia(s), em ' || to_char(r.data, 'DD/MM/YYYY') || '.',
      'mensalidade', r.id, r.data,
      'mensalidade:' || r.id || ':vencendo:' || (r.data - v_hoje) || 'd:' || r.data,
      jsonb_build_object('aluno_id', a.id, 'dias', r.data - v_hoje)
    from public.receitas r
    join public.alunos a on a.id = r.aluno_id and a.academia_id = r.academia_id
    join public.academias ac on ac.id = r.academia_id
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = r.academia_id
    where r.tipo = 'mensalidade'
      and r.status = 'pendente'
      and a.status_matricula = 'ativa'
      and (r.data - v_hoje) in (7, 3, 1)
      and coalesce(cfg.alerta_mensalidade_vencendo, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'mensalidade_vencendo', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 2. Mensalidade atrasada há 1, 3 ou 7 dias.
  --    dedupe_key: mensalidade:<receita_id>:atrasada:<dias>d:<vencimento>
  -- ---------------------------------------------------------------------------
  return query
  with novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      r.academia_id, 'mensalidade', 'mensalidade_atrasada',
      case (v_hoje - r.data)
        when 7 then 'alta'
        when 3 then 'media'
        else 'baixa'
      end,
      'Mensalidade atrasada',
      a.nome || ' — mensalidade vencida há ' || (v_hoje - r.data) || ' dia(s) (venceu em ' || to_char(r.data, 'DD/MM/YYYY') || ').',
      'mensalidade', r.id, r.data,
      'mensalidade:' || r.id || ':atrasada:' || (v_hoje - r.data) || 'd:' || r.data,
      jsonb_build_object('aluno_id', a.id, 'dias', v_hoje - r.data)
    from public.receitas r
    join public.alunos a on a.id = r.aluno_id and a.academia_id = r.academia_id
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = r.academia_id
    where r.tipo = 'mensalidade'
      and r.status = 'pendente'
      and a.status_matricula = 'ativa'
      and (v_hoje - r.data) in (1, 3, 7)
      and coalesce(cfg.alerta_mensalidade_atrasada, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'mensalidade_atrasada', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 3. Plano próximo do vencimento (ciclo vigente termina em 7 dias).
  --    Janela única de 7 dias — não replica a cascata de mensalidade, para
  --    não multiplicar tipos. dedupe_key: plano:<aluno_id>:vencimento:<data>
  -- ---------------------------------------------------------------------------
  return query
  with ciclo_vigente as (
    select distinct on (h.aluno_id)
      h.aluno_id, h.academia_id,
      (h.data_inicio + (h.recorrencia_meses || ' months')::interval)::date as data_renovacao
    from public.historico_planos h
    where h.data_fim is null
    order by h.aluno_id, h.data_inicio desc
  ),
  novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      c.academia_id, 'mensalidade', 'plano_vencimento', 'baixa',
      'Plano perto de renovar',
      a.nome || ' — ciclo do plano atual termina em ' || to_char(c.data_renovacao, 'DD/MM/YYYY') || '.',
      'aluno', a.id, c.data_renovacao,
      'plano:' || a.id || ':vencimento:' || c.data_renovacao,
      jsonb_build_object('aluno_id', a.id)
    from ciclo_vigente c
    join public.alunos a on a.id = c.aluno_id and a.academia_id = c.academia_id
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = c.academia_id
    where a.status_matricula = 'ativa'
      and (c.data_renovacao - v_hoje) = 7
      and coalesce(cfg.alerta_mensalidade_vencendo, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'plano_vencimento', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 4. Aluno sem acesso há N dias (N = configuracoes_notificacoes, padrão 14).
  --    Mesmo filtro de "acesso efetivo" de ultimos_acessos_por_aluno()
  --    (migration 038): status_liberacao IN ('liberado','alerta').
  --    Um alerta por EPISÓDIO de ausência: dedupe_key ancorado na data do
  --    último acesso (ou na matrícula, se nunca acessou) — só muda quando o
  --    aluno acessa de novo, então não repete todo dia enquanto ausente.
  --    dedupe_key: aluno:<aluno_id>:ausente:<ultimo_acesso_ou_matricula>
  -- ---------------------------------------------------------------------------
  return query
  with ultimo_acesso as (
    select distinct on (c.aluno_id)
      c.aluno_id, c.academia_id, c.data_hora_entrada::date as data
    from public.acessos_catraca c
    where c.status_liberacao in ('liberado', 'alerta')
    order by c.aluno_id, c.data_hora_entrada desc
  ),
  candidatos as (
    select
      a.id as aluno_id, a.academia_id, a.nome,
      coalesce(u.data, a.criado_em::date) as referencia,
      v_hoje - coalesce(u.data, a.criado_em::date) as dias_ausente
    from public.alunos a
    left join ultimo_acesso u on u.aluno_id = a.id
    where a.status_matricula = 'ativa'
  ),
  novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      c.academia_id, 'retencao', 'aluno_ausente',
      case when c.dias_ausente >= 30 then 'alta' when c.dias_ausente >= 14 then 'media' else 'baixa' end,
      'Aluno sem acesso',
      c.nome || ' está sem acesso há ' || c.dias_ausente || ' dia(s).',
      'aluno', c.aluno_id, c.referencia,
      'aluno:' || c.aluno_id || ':ausente:' || c.referencia,
      jsonb_build_object('aluno_id', c.aluno_id, 'dias', c.dias_ausente)
    from candidatos c
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = c.academia_id
    where c.dias_ausente >= coalesce(cfg.aluno_ausente_dias, 14)
      and coalesce(cfg.alerta_aluno_ausente, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'aluno_ausente', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 5. Aniversariante do dia (mês E dia, não do mês inteiro como a função de
  --    Retenção). Um alerta por ano: dedupe_key inclui o ano corrente.
  --    dedupe_key: aluno:<aluno_id>:aniversario:<ano>
  -- ---------------------------------------------------------------------------
  return query
  with novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      a.academia_id, 'sistema', 'aniversario', 'baixa',
      'Aniversariante do dia',
      a.nome || ' faz aniversário hoje! 🎉',
      'aluno', a.id, v_hoje,
      'aluno:' || a.id || ':aniversario:' || extract(year from v_hoje),
      jsonb_build_object('aluno_id', a.id)
    from public.alunos a
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = a.academia_id
    where a.status_matricula = 'ativa'
      and a.data_nascimento is not null
      and extract(month from a.data_nascimento) = extract(month from v_hoje)
      and extract(day from a.data_nascimento) = extract(day from v_hoje)
      and coalesce(cfg.alerta_aniversario, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'aniversario', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 6. Estoque abaixo do mínimo — só produtos com controle de estoque
  --    (estoque não nulo) e ativos. Dedupe SEMANAL (não diário): sem um
  --    marcador de "quando ficou baixo", uma chave por dia geraria ruído
  --    diário; uma chave por semana ainda avisa se ninguém repuser, sem
  --    virar spam. dedupe_key: produto:<id>:estoque_baixo:<ano>-S<semana>
  -- ---------------------------------------------------------------------------
  return query
  with novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      p.academia_id, 'estoque', 'estoque_baixo', 'media',
      'Estoque baixo',
      p.nome || ' — estoque atual: ' || p.estoque || ' (mínimo: ' || p.estoque_minimo || ').',
      'produto', p.id, v_hoje,
      'produto:' || p.id || ':estoque_baixo:' || extract(isoyear from v_hoje) || '-S' || extract(week from v_hoje),
      jsonb_build_object('produto_id', p.id)
    from public.produtos p
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = p.academia_id
    where p.ativo = true
      and p.estoque is not null
      and p.estoque <= p.estoque_minimo
      and coalesce(cfg.alerta_estoque_baixo, true)
    on conflict (academia_id, dedupe_key) do nothing
    returning 1
  )
  select 'estoque_baixo', count(*)::integer from novos;
end;
$$;

comment on function public.gerar_notificacoes_diarias() is
  'Fase 9: gera os alertas operacionais de todas as academias em uma passada. Idempotente via UNIQUE(academia_id, dedupe_key) + ON CONFLICT DO NOTHING. Só service_role executa (ver REVOKE/GRANT abaixo) — chamada pela rota de cron, nunca por um usuário autenticado comum.';

-- Postgres concede EXECUTE a PUBLIC por padrão na criação de QUALQUER função
-- (sincronizar_cobrancas_todas, migration 032, já se protege disso com
-- `REVOKE ALL ... FROM public, anon, authenticated` logo após criá-la —
-- mesma ideia aplicada aqui). Sem o REVOKE abaixo, qualquer usuário
-- autenticado de QUALQUER academia
-- poderia chamar `select gerar_notificacoes_diarias()` via RPC do
-- PostgREST e disparar a geração para TODAS as academias sob demanda — a
-- função não recebe academia_id nem lê auth.uid(), então nada a impediria.
-- RLS não cobre isto: RLS protege LINHAS de tabela, não a permissão de
-- executar a função em si.
revoke execute on function public.gerar_notificacoes_diarias()
  from public, anon, authenticated;

grant execute on function public.gerar_notificacoes_diarias()
  to service_role;
