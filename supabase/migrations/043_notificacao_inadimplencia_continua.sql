-- =============================================================================
-- Migration 043 — corrige a regra de inadimplência das notificações (Fase 9).
--
-- PROBLEMA (migration 041, bloco 2 de gerar_notificacoes_diarias):
--   a condição era `(v_hoje - r.data) in (1, 3, 7)` — igualdade em dias
--   EXATOS. Consequências reais:
--     * mensalidade com 17, 30 ou 200 dias de atraso nunca gerava alerta;
--     * se o cron falhasse no dia 1, 3 ou 7, aquela janela era perdida para
--       sempre (a condição nunca volta a ser verdadeira);
--     * dívidas anteriores à implantação da Fase 9 ficavam invisíveis;
--     * a dedupe_key incluía os dias (`:atrasada:3d:<venc>`), então a MESMA
--       mensalidade podia acumular até 3 notificações (1d, 3d, 7d).
--
-- REGRA CORRETA (implementada aqui):
--   qualquer mensalidade pendente com vencimento anterior a hoje, de aluno
--   ativo da academia, gera EXATAMENTE UMA notificação — dedupe_key estável
--   por mensalidade (`mensalidade:<id>:atrasada`, sem os dias). A execução
--   diária faz ON CONFLICT DO UPDATE: atualiza título, mensagem, prioridade e
--   os dias de atraso na linha existente, em vez de inserir outra.
--
-- Os avisos PRÉVIOS (7, 3 e 1 dia antes do vencimento) continuam idênticos —
-- ali a cascata é desejada: são três avisos distintos, não um só que evolui.
--
-- Não destrutiva: nenhuma linha é apagada. As notificações de atraso no
-- formato antigo são DISPENSADAS (dispensada_em preenchido, histórico
-- preservado) para não coexistirem com a nova chave estável. Não altera as
-- migrations 041/042, já aplicadas. Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Transição das notificações de atraso já existentes.
--
--    Formato antigo: mensalidade:<id>:atrasada:<N>d:<venc>  (tem `:` depois de
--    "atrasada"). Formato novo: mensalidade:<id>:atrasada   (termina ali).
--    O LIKE abaixo casa só com o antigo. Não dá para renomear a chave das
--    linhas antigas para a nova: uma mesma mensalidade pode ter 1d, 3d E 7d,
--    e as três colidiriam na UNIQUE(academia_id, dedupe_key). Então são
--    dispensadas e a próxima execução do cron cria uma única linha nova, já
--    com o total de dias correto.
-- -----------------------------------------------------------------------------
update public.notificacoes
   set dispensada_em = now()
 where tipo = 'mensalidade_atrasada'
   and dispensada_em is null
   and dedupe_key like 'mensalidade:%:atrasada:%';

-- -----------------------------------------------------------------------------
-- 2. Função de geração — CREATE OR REPLACE preserva as permissões já
--    concedidas (o REVOKE/GRANT de 041 continua valendo), mas são reafirmados
--    no fim desta migration para que ela seja autocontida.
--
--    Mudanças em relação à 041, e SÓ estas:
--      (a) reconciliação (bloco 0) não exige mais `lida_em is null`;
--      (b) bloco 2 (atraso): regra contínua + chave estável + DO UPDATE;
--      (c) bloco 1: removido um join morto para public.academias (sem efeito
--          algum na regra — ver comentário no próprio bloco).
--    Os blocos 3, 4, 5 e 6 são idênticos aos da 041.
-- -----------------------------------------------------------------------------
create or replace function public.gerar_notificacoes_diarias()
returns table (tipo text, criadas integer)
language plpgsql
security definer
-- Mantido igual à 041: toda tabela é qualificada com `public.`; o que não tem
-- prefixo é built-in de pg_catalog, que resolve antes de qualquer schema de
-- usuário e não é sequestrável por objeto criado em public.
set search_path = pg_catalog, public
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Reconciliação: dispensa alertas cujo motivo já deixou de existir —
  --    mensalidade paga/cancelada, aluno excluído/inativado, ou estoque
  --    recomposto acima do mínimo (produto desativado/excluído idem).
  --
  --    MUDANÇA vs. 041: não exige mais `lida_em is null`. Antes, um alerta que
  --    o usuário já tinha marcado como lido NUNCA era dispensado — ele saía do
  --    contador (porque o contador só conta não lidas), mas continuava
  --    aparecendo na LISTA como pendência mesmo depois de a mensalidade ser
  --    paga. A regra da Fase 9 é sair do contador E da lista.
  -- ---------------------------------------------------------------------------
  update public.notificacoes n
     set dispensada_em = now()
   where n.dispensada_em is null
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
  -- 1. Mensalidade vencendo em 7, 3 ou 1 dia. Regra inalterada em relação à
  --    041 — aqui a cascata de três avisos distintos é o comportamento
  --    desejado. Única diferença: removido o `join public.academias ac`, que
  --    era morto (o alias `ac` nunca era referenciado) e não filtrava nada,
  --    já que receitas.academia_id tem FK para academias(id).
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
  -- 2. Mensalidade ATRASADA — qualquer vencimento anterior a hoje, sem
  --    janela de dias exatos.
  --
  --    dedupe_key ESTÁVEL por mensalidade: mensalidade:<receita_id>:atrasada
  --    (sem os dias). Com a UNIQUE(academia_id, dedupe_key), isso garante no
  --    máximo UMA notificação de atraso por mensalidade, para sempre.
  --
  --    ON CONFLICT DO UPDATE mantém a linha existente e só atualiza o que
  --    muda com o tempo: dias de atraso (mensagem + metadados) e prioridade.
  --    O `where notificacoes.dispensada_em is null` impede que um alerta
  --    dispensado pelo usuário volte a ser mexido — dispensar continua
  --    significando "não me mostre mais isto", como na Fase 9. `lida_em` não
  --    é tocado: quem já leu não recebe a linha como não lida de novo todo dia.
  --
  --    `criadas` aqui conta linhas criadas OU atualizadas (RETURNING devolve
  --    as duas), não só inserções.
  -- ---------------------------------------------------------------------------
  return query
  with novos as (
    insert into public.notificacoes (
      academia_id, categoria, tipo, prioridade, titulo, mensagem,
      entidade, entidade_id, data_referencia, dedupe_key, metadados
    )
    select
      r.academia_id, 'mensalidade', 'mensalidade_atrasada',
      case
        when (v_hoje - r.data) >= 7 then 'alta'
        when (v_hoje - r.data) >= 3 then 'media'
        else 'baixa'
      end,
      'Mensalidade atrasada',
      a.nome || ' — mensalidade vencida há ' || (v_hoje - r.data) || ' dia(s) (venceu em ' || to_char(r.data, 'DD/MM/YYYY') || ').',
      'mensalidade', r.id, r.data,
      'mensalidade:' || r.id || ':atrasada',
      jsonb_build_object('aluno_id', a.id, 'dias', v_hoje - r.data)
    from public.receitas r
    join public.alunos a on a.id = r.aluno_id and a.academia_id = r.academia_id
    left join public.configuracoes_notificacoes cfg on cfg.academia_id = r.academia_id
    where r.tipo = 'mensalidade'
      and r.status = 'pendente'
      and a.status_matricula = 'ativa'
      and r.data < v_hoje
      and coalesce(cfg.alerta_mensalidade_atrasada, true)
    on conflict (academia_id, dedupe_key) do update
      set titulo     = excluded.titulo,
          mensagem   = excluded.mensagem,
          prioridade = excluded.prioridade,
          metadados  = excluded.metadados
      where notificacoes.dispensada_em is null
    returning 1
  )
  select 'mensalidade_atrasada', count(*)::integer from novos;

  -- ---------------------------------------------------------------------------
  -- 3. Plano próximo do vencimento (ciclo vigente termina em 7 dias).
  --    IDÊNTICO à 041. dedupe_key: plano:<aluno_id>:vencimento:<data>
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
  --    IDÊNTICO à 041.
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
  -- 5. Aniversariante do dia. IDÊNTICO à 041.
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
  -- 6. Estoque abaixo do mínimo. IDÊNTICO à 041 (dedupe semanal).
  --    dedupe_key: produto:<id>:estoque_baixo:<ano>-S<semana>
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
  'Fase 9 (rev. 043): gera os alertas operacionais de todas as academias em uma passada. Inadimplência = qualquer mensalidade pendente vencida, com UMA notificação estável por mensalidade (dedupe_key sem os dias) atualizada a cada execução. Idempotente. Só service_role executa.';

-- Reafirmação das permissões — CREATE OR REPLACE preserva a ACL existente,
-- mas repetir aqui torna esta migration autocontida e idempotente.
revoke execute on function public.gerar_notificacoes_diarias()
  from public, anon, authenticated;

grant execute on function public.gerar_notificacoes_diarias()
  to service_role;
