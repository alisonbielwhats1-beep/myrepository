-- =============================================================================
-- Migration 061 — Registro de erros da aplicação.
--
-- POR QUE EXISTE
--   Em 11/08/2026 o cliente viu um erro no painel e a única forma de descobrir
--   o que tinha acontecido foi abrir o log da Vercel. Isso não escala: o dono
--   da plataforma não fica olhando log de infraestrutura, e o registro some
--   depois do período de retenção. Esta tabela guarda o que falhou, para quem,
--   em qual academia — consultável na tela /admin/atividade.
--
-- O QUE ELA GUARDA
--   O erro TÉCNICO (código e mensagem do Postgres) e a frase que o usuário
--   leu na tela, lado a lado. É o par que permite responder "o cliente
--   reclamou de X, o que aconteceu de verdade?".
--
-- O QUE ELA NUNCA GUARDA
--   O campo `details` do Postgres. Ele carrega o VALOR que causou o conflito
--   (o CPF de outra pessoa, num erro de duplicidade) — o mesmo motivo pelo
--   qual ele nunca vai para a tela em lib/erros-amigaveis.ts. Também não
--   guarda senha, token nem conteúdo de formulário.
--
-- ACESSO
--   RLS ligada e NENHUMA policy: invisível para `anon` e `authenticated` por
--   qualquer caminho da API pública, inclusive para o dono da academia. É uma
--   tabela cruzada (todas as academias juntas), então não há tenant para
--   filtrar — só o superadministrador da plataforma lê, via
--   `createServiceRoleClient()`, que roda server-only.
--
--   A gravação também é feita pelo service role (lib/erros-servidor.ts): sem
--   policy de INSERT, o cliente autenticado não conseguiria escrever aqui — e
--   é melhor assim, porque impede o navegador de forjar registro de erro.
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

create table if not exists public.logs_erros (
  id                uuid        primary key default gen_random_uuid(),

  -- Nulos quando o erro acontece antes de saber quem/onde (ex.: falha ao ler a
  -- própria sessão). Sem FK para academias de propósito: um erro que menciona
  -- uma academia recém-excluída ainda é a informação mais útil do registro.
  academia_id       uuid,
  academia_nome     text,
  usuario_id        uuid,
  usuario_nome      text,

  -- O que o usuário estava tentando fazer, em infinitivo ("cadastrar o aluno").
  acao              text        not null,
  -- Código do Postgres/PostgREST (23505, 42501, PGRST205...). Null quando o
  -- erro não tem código (falha de rede, exceção do Supabase Auth).
  codigo            text,
  mensagem_tecnica  text,
  -- A frase que apareceu na tela, exatamente como o cliente leu.
  mensagem_usuario  text,

  criado_em         timestamptz not null default now()
);

comment on table public.logs_erros is
  'Erros da aplicação (migration 061): o que falhou, para quem, com o texto técnico e o que o usuário leu. Nunca guarda `details` do Postgres, senha ou token. Sem policy de RLS — leitura e escrita apenas pelo service role.';

-- A consulta da tela é sempre "os mais recentes", com filtro opcional por
-- academia. Os dois índices cobrem exatamente esses dois caminhos.
create index if not exists idx_logs_erros_recentes
  on public.logs_erros (criado_em desc);

create index if not exists idx_logs_erros_academia
  on public.logs_erros (academia_id, criado_em desc);

alter table public.logs_erros enable row level security;
