# Acesso dos alunos — arquitetura, entrega e roteiro

Este documento descreve a **espinha dorsal de identidade e acesso dos alunos**
implementada nas migrations `065`/`066` e no fluxo de ativação (`/ativar`),
além do que fica configurado externamente e do que ainda é fase seguinte.

> **Estado da entrega.** Esta é a **Fase 1 (backbone)**: banco, RPCs atômicas,
> RLS, utilitários testados, fluxo de ativação e login social **protegido por
> flag**. O que depende de credenciais externas (Google/Apple) e a UI
> administrativa completa de convites estão marcados como **pendentes** ao
> final — nada foi aplicado em produção e nenhum e-mail/conta real foi criado.

---

## 1. Diagnóstico da arquitetura encontrada

- **Stack:** Next.js 14 (App Router, Server Actions), Supabase (Postgres + Auth
  + RLS via `@supabase/ssr`), PWA básica.
- **Acesso do aluno hoje:** o aluno **não tem conta**. Acessa por
  `alunos.token_acesso_publico` (UUID, migration 037) + `slug`, via RPCs
  `SECURITY DEFINER` públicas. Há também `token_qr_acesso` (catraca, 044).
- **Equipe:** `perfis_admin` liga `auth.users` → academia. `academia_id_atual()`
  resolve o tenant a partir daí. Alunos não passam por `perfis_admin`.
- **Auth:** só e-mail/senha, só para a equipe. Recuperação de senha já existe
  (`/recuperar-senha`, `/auth/recuperar`, `/redefinir-senha`), com rate-limit e
  reautenticação. Sessão via cookies `@supabase/ssr` + `middleware.ts`.
- **Não existia:** OAuth Google/Apple, login de aluno, convites de ativação,
  tabela de membros conta↔academia, matrículas temporais separadas, colunas de
  vínculo (`auth_user_id`) e `status_cadastro` em `alunos`.

## 2. Mapa: estrutura atual → final

| Conceito | Antes | Agora (aditivo) |
|---|---|---|
| Identidade | `auth.users` (equipe) | `auth.users` (equipe **e** aluno) |
| Acesso conta↔academia | `perfis_admin` (equipe) | **`academia_membros`** (aluno) + `perfis_admin` (equipe) |
| Cadastro do aluno | `alunos` sem conta | `alunos` + `auth_user_id` (nullable, `ON DELETE SET NULL`) + `status_cadastro` |
| E-mail contato × login | `alunos.email` | `alunos.email` = **contato**; login em `auth.users` |
| Matrícula temporal | `alunos.status_matricula` + `historico_planos` | **`matriculas`** (períodos reais) |
| Convite | token público reutilizável | **`convites_acesso`** (hash, expira, uso único, atômico) |
| Trilha de acesso | — | **`logs_acesso`** (append-only) |

**Princípio central:** o **convite** define QUAL aluno é ativado; Google/Apple/
e-mail definem COMO a pessoa entra. O vínculo permanente depende do
`auth_user_id` imutável e dos relacionamentos internos — **nunca do texto do
e-mail nem do provedor**.

## 3. Decisões técnicas e justificativas

- **`academia_membros` separada de `perfis_admin`.** A equipe já vive em
  `perfis_admin` com uma policy de INSERT em `logs_auditoria` amarrada a ela.
  Reaproveitar `perfis_admin` para alunos misturaria dois modelos de permissão.
  `academia_membros` é o vínculo de acesso do aluno (papel `aluno`); a coluna
  `papel` já prevê papéis de equipe para uma futura unificação.
- **`logs_acesso` separada de `logs_auditoria`.** A policy de INSERT de
  `logs_auditoria` exige o ator em `perfis_admin`; o ator de uma ativação é o
  **próprio aluno**, que nunca está lá. São domínios diferentes (edição de
  registro de negócio × ciclo de identidade/acesso), não duas fontes de verdade
  do mesmo conceito.
- **Só o hash do token no banco.** O token bruto (`32 bytes` base64url) só
  existe no link e na memória do servidor durante a validação. Vazamento do
  banco não permite ativar convites.
- **Rejeições retornam status, não `RAISE`.** `RAISE` faria rollback e apagaria
  o log de auditoria da rejeição e a marcação de `expirado`. As RPCs de
  ativação retornam um `status` que o app mapeia para mensagem amigável.
  *(Validado: o smoke test confirma que o log de rejeição persiste.)*
- **`auth_user_id` `ON DELETE SET NULL`.** Excluir a conta Auth nunca apaga em
  cascata o aluno nem o histórico — só desfaz o vínculo de login.
- **Token fora da URL.** `/ativar/[token]` (Route Handler) grava o token num
  cookie `HttpOnly/Secure/SameSite=Lax` e redireciona para `/ativar` (URL
  limpa). O token some da barra de endereço/histórico e não vaza em Referer.

## 4. Fluxo da Maria (e dos alunos existentes)

1. Maria já existe como aluna (cadastro preservado, mesmo `aluno_id`).
2. A equipe gera um convite (`gerar_convite_acesso`): token bruto criado no
   servidor, só o hash vai ao banco, convite vivo anterior é revogado.
3. A academia entrega o link/QR (`/ativar/<token>`).
4. Maria abre; `/ativar/[token]` guarda o token no cookie seguro e leva a
   `/ativar`, que faz o **preview mascarado** ("Academia Geração Saúde" •
   "Maria S.") — sem CPF/e-mail/telefone.
5. Maria escolhe **Google, Apple ou e-mail e senha**, com um e-mail à sua
   escolha (pode diferir do contato cadastrado).
6. Google/Apple: OAuth do Supabase → `/auth/callback` → `/ativar/continuar` →
   `/ativar`. **Sem segunda confirmação de e-mail do GestAcad.**
7. E-mail/senha: `signUp` com **confirmação de e-mail obrigatória**; ao
   confirmar, volta por `/auth/callback` → `/ativar`.
8. Autenticada, `ativar_convite_acesso` (atômica, `FOR UPDATE`) vincula
   `auth_user_id` ao **cadastro existente**, cria/reativa o membro, consome o
   convite e audita. **Não cria outra aluna.**
9. Reabrir/replay é **idempotente** (`ja_ativado`). Próximos acessos usam a
   conta; a sessão persiste (cookies `@supabase/ssr`).

## 5. Fluxo dos novos alunos

Idêntico do passo 2 em diante: a academia cadastra o aluno (sem conta) e gera o
convite. O convite é sempre o que liga a ativação ao cadastro certo.

## 6. Desativação, retorno e exclusão de conta

- **Desativar/arquivar (não excluir):** `suspender_acesso_aluno` bloqueia o
  membro e revoga convites pendentes; o cadastro e o histórico ficam intactos;
  a conta Auth global **não** é excluída; outras academias da conta não são
  afetadas (o RLS bloqueia só aquela academia).
- **Retorno:** reative o cadastro existente (mesmo `aluno_id`) com
  `reativar_acesso_aluno`; um novo período é uma **nova matrícula**
  (`iniciar_matricula`), preservando o período anterior — nunca vira um período
  contínuo único.
- **Conta Auth excluída pela pessoa:** `ON DELETE SET NULL` preserva o domínio;
  o vínculo de login some; a academia pode gerar uma nova ativação depois de
  verificação. Exclusão/anonimização por LGPD deve ser um fluxo administrativo
  separado e auditado (pendente — ver seção 12).

## 7. Arquivos criados/alterados

**Banco:**
- `supabase/migrations/065_acesso_alunos_identidade.sql` (+ `_rollback`)
- `supabase/migrations/066_acesso_alunos_rpcs.sql` (+ `_rollback`)
- `supabase/tests/acesso_alunos_smoke.sql` (smoke test local)

**Servidor / libs:**
- `lib/convites.ts` — token: gerar/hash/validar/expiração/link (testado)
- `lib/redirecionamento.ts` — anti open-redirect (testado)
- `lib/auth-config.ts` — flags dos provedores sociais
- `lib/ativacao-cookie.ts` — constante do cookie de contexto
- `lib/actions/ativacao.ts` — ativação (finalizar, cadastro e-mail/senha)
- `lib/actions/convites.ts` — equipe: gerar/revogar convite + auditar migração

**UI / rotas:**
- `app/ativar/[token]/route.ts`, `app/ativar/page.tsx`,
  `app/ativar/continuar/page.tsx`, `app/ativar/layout.tsx`
- `components/auth/AtivacaoMetodos.tsx`, `components/auth/BotoesSociais.tsx`
- `app/login/page.tsx` — botões sociais (flag-gated) + `next` seguro
- `public/sw.js` — endurecido (não cacheia conteúdo autenticado)

**Testes:** `tests/convites.test.mjs`, `tests/redirecionamento.test.mjs`
(+ scripts no `package.json`).

## 8. Migrations, constraints, índices, funções

**Tabelas novas:** `academia_membros`, `matriculas`, `convites_acesso`,
`logs_acesso`. **Colunas novas:** `alunos.auth_user_id`,
`alunos.status_cadastro`.

**Constraints/índices de invariante:**
- `uidx_alunos_auth_por_academia` — 1 conta não vincula a 2 alunos na academia.
- `uidx_membro_conta_academia_papel` — sem vínculos equivalentes duplicados.
- `uidx_matricula_ativa_por_aluno` — no máx. 1 matrícula ativa por aluno.
- `uidx_convite_token_hash` / `uidx_convite_vivo_por_aluno` — hash único e no
  máx. 1 convite vivo por aluno.

**Funções (SECURITY DEFINER, `search_path` fixo):** `gerar_convite_acesso`,
`preview_convite_acesso` (anon), `ativar_convite_acesso`, `revogar_convite_acesso`,
`suspender_acesso_aluno`, `reativar_acesso_aluno`, `iniciar_matricula`,
`encerrar_matricula`, `auditar_migracao_alunos`, `usuario_tem_acesso_aluno`.

## 9. Políticas RLS revisadas

- `academia_membros`: equipe lê/gerencia da própria academia; o aluno lê o
  próprio vínculo; INSERT/DELETE só via funções `SECURITY DEFINER`.
- `matriculas`: equipe gerencia da própria academia; aluno lê as próprias.
- `convites_acesso`: **só a equipe** da própria academia; o aluno nunca lê a
  tabela — o preview público é a RPC de dados mínimos.
- `logs_acesso`: leitura só dono/gerente; imutável (sem UPDATE/DELETE).
- `service_role` total nas quatro tabelas (operações do servidor).

## 10. Rotas, telas e componentes

- `/ativar/<token>` (guarda cookie, tira token da URL) → `/ativar` (preview +
  três métodos) → `/ativar/continuar` (retomada pós-callback).
- Login (`/login`): botões sociais só quando habilitados + divisor + e-mail/
  senha (inalterado) + "Esqueci minha senha".
- **`/aluno` (Fase 3):** entrada por sessão do aluno — resolve o vínculo e
  redireciona à área; seleção quando há mais de uma academia; telas de acesso
  suspenso e de conta sem vínculo. `/painel` é o resolvedor universal pós-login
  (equipe → painel; aluno → `/aluno`). O `start_url` do PWA aponta para
  `/painel`, então o app instalado abre já na área certa quando há sessão.

---

## 11. Configuração externa necessária (checklist por ambiente)

> **Sem expor segredos no repositório.** Cadastre os valores abaixo apenas nos
> consoles indicados, por ambiente (dev / homologação / produção).

### 11.1 Supabase — URLs (Authentication → URL Configuration)
- **Site URL:** o domínio do ambiente (ex.: `https://gestacad.com.br`).
- **Redirect URLs (allow-list):** adicione, por ambiente:
  - `<site>/auth/callback`
  - `<site>/auth/recuperar`
  - `<site>/ativar/continuar`

### 11.2 Google (Authentication → Providers → Google)
1. No **Google Auth Platform**: crie um OAuth Client (Web), configure a tela de
   consentimento e escopos mínimos (`email`, `profile`).
2. **Authorized redirect URI:** o callback do Supabase
   (`https://<seu-projeto>.supabase.co/auth/v1/callback`).
3. Cole **Client ID** e **Client Secret** no Supabase (por ambiente).
4. Só então defina `NEXT_PUBLIC_AUTH_GOOGLE=1` no ambiente.

### 11.3 Apple (Authentication → Providers → Apple)
1. No **Apple Developer**: App ID + **Services ID**, domínio e **Return URL**
   (callback do Supabase), e a **chave (.p8)** para gerar o *client secret*.
2. Cadastre Services ID + segredo no Supabase.
3. **Responsabilidade operacional:** o *client secret* da Apple **expira** (máx.
   ~6 meses) e precisa de **rotação/renovação** periódica — agende isso.
4. Só então defina `NEXT_PUBLIC_AUTH_APPLE=1`.
5. Trate **Hide My Email** — nunca dependa do e-mail/nome retornado para
   localizar o aluno (o convite localiza; a conta autenticada é o vínculo).

### 11.4 E-mails (Authentication → Email Templates / SMTP)
- Templates em pt-BR (confirmação, recuperação) com o nome GestAcad, links só
  para domínios autorizados.
- **SMTP de produção** próprio (o SMTP padrão do Supabase tem limites baixos).
- Garanta que URL de dev nunca apareça em e-mail de produção (Site URL por
  ambiente).

### 11.5 Variáveis de ambiente (sem valores secretos aqui)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (já existiam).
- `NEXT_PUBLIC_SITE_URL` — domínio canônico do ambiente.
- `NEXT_PUBLIC_AUTH_GOOGLE`, `NEXT_PUBLIC_AUTH_APPLE` — `1` só quando operacional.

---

## 12. Testes executados e resultados

- **Unitários (Node, padrão do projeto):** `npm test` → **todas as suítes
  passam**, incluindo as novas `test:convites` (24) e `test:redirecionamento`
  (18). `typecheck` e `lint` limpos. `npm run build` de produção OK.
- **Banco (Postgres 16 local, efêmero):** `schema.sql` + todas as migrations
  aplicadas; **smoke test** `supabase/tests/acesso_alunos_smoke.sql`
  (`SMOKE TEST OK`) validando: ativação da Maria com e-mail diferente do
  contato, sem duplicar; idempotência; intruso barrado em convite usado;
  `aluno_ja_vinculado`; `conta_ja_vinculada_outro_aluno`; expiração marcada sem
  rollback; auditoria de rejeição persistida **sem token**; matrícula única
  ativa + histórico preservado; suspensão; contagens da auditoria de migração.

## 13. Falhas preexistentes / não-regressões

- Nenhuma regressão introduzida (estado inicial de lint/typecheck/testes já era
  limpo). As migrations `004_dados_demo`, `039` e `053` só "falham" num banco
  local **sem** dados/base de `storage` do Supabase — comportamento esperado,
  não relacionado a esta entrega.

## 14. Riscos e pendências reais (fases seguintes)

1. **Provedores Google/Apple:** exigem credenciais nos consoles. Enquanto as
   flags estiverem desligadas, os botões não aparecem (nada quebra).
2. **UI administrativa de convites:** as Server Actions
   (`gerarConviteAluno`/`revogarConvite`/`auditarMigracaoAcesso`) existem e
   estão testadas no banco, mas **ainda não há a tela** no painel de alunos
   (gerar em lote, copiar link, QR, status). Wiring é a próxima tarefa.
3. **Login de aluno com e-mail já existente:** o `/login` atual redireciona por
   `perfis_admin` (equipe). Um aluno com conta de e-mail que queira ativar
   precisa do caminho "entrar e retomar convite" — hoje coberto por Google/Apple
   e pelo reabrir do link já logado; o caso e-mail+senha existente fica para a
   fase de painel autenticado do aluno.
4. **Painel autenticado do aluno (Fase 3 — entregue como ponte):** existe a
   entrada por sessão `/aluno` (migration 067 + `meu_acesso_aluno`), que resolve
   o vínculo da conta e leva à área existente sem token na URL, trata seleção de
   múltiplas academias, acesso suspenso e conta sem vínculo, e quebra o loop de
   um aluno autenticado no `/painel` (resolvedor universal). As páginas
   `/aluno/[slug]/[token]` continuam por token (compatível com QR antigos);
   migrar a leitura dessas páginas para a sessão é evolução futura.
5. **Confirmação adicional de identidade (7.7)** e **exclusão/anonimização LGPD
   (10.3)**: modeladas conceitualmente; implementação dedicada pendente.
6. **Backfill de matrículas dos ~60 alunos:** não é feito automaticamente
   (regra do prompt). Use `auditar_migracao_alunos` (dry-run) antes de decidir.

---

## 15. Passos de validação manual (local)

1. `npm ci && npm run build && npm test` — tudo verde.
2. Banco local: suba um Postgres, crie stub `auth.users`/`auth.uid()` e os roles
   `anon`/`authenticated`/`service_role`, aplique `schema.sql` + migrations e
   rode `supabase/tests/acesso_alunos_smoke.sql` → `SMOKE TEST OK`.
3. App: com Supabase configurado, gere um convite (Server Action
   `gerarConviteAluno`), abra o link `/ativar/<token>` e ative por e-mail/senha
   (confirmação obrigatória) ou por Google/Apple (com as flags ligadas).

## 16. Roteiro de homologação

1. Projeto Supabase de homologação com Site URL/Redirect URLs próprios.
2. Aplique `065` e `066` (idempotentes) no SQL Editor.
3. Configure Google (e Apple, se for testar) com credenciais de homologação e
   ligue as flags só nesse ambiente.
4. Rode o roteiro manual acima e o checklist da seção 18.

## 17. Produção — implantação, migração dos ~60 e rollback

1. **Backup** do banco antes de tudo.
2. Aplique `065` depois `066` (aditivas/idempotentes). Nenhuma altera dados de
   aluno.
3. Rode `auditar_migracao_alunos()` (dry-run) e revise conflitos/pendências
   **antes** de gerar convites.
4. Gere convites gradualmente (piloto com poucos alunos) e acompanhe
   `logs_acesso`.
5. **Rollback:** `066_..._rollback.sql` e depois `065_..._rollback.sql`. O
   rollback do `065` remove as colunas de vínculo (`auth_user_id`,
   `status_cadastro`) e as tabelas novas — desfaz o **vínculo de login**, nunca
   o cadastro/histórico do aluno. Em base já ativada, exporte convites/vínculos/
   matrículas antes.

## 18. Checklist manual: Google, Apple, e-mail/senha, sessão e PWA

- [ ] **Google** ativa e volta sem segunda confirmação de e-mail do GestAcad.
- [ ] **Apple** (com Hide My Email) ativa sem depender do e-mail retornado.
- [ ] **E-mail/senha** exige confirmação antes do vínculo; mostrar/ocultar nos
      campos; senha divergente barrada.
- [ ] Provedor **desligado** não mostra botão quebrado.
- [ ] **Sessão persiste** ao atualizar a página, fechar/reabrir o navegador e a
      PWA; sem flash indevido da tela de login.
- [ ] **PWA** instala no Android (prompt nativo após ação), iPhone (Compartilhar
      → Adicionar à Tela de Início) e desktop; abrir pelo ícone com sessão não
      pede login; cache **não** contém dados privados.
- [ ] Deep link sem sessão → login → volta ao destino interno (sem open
      redirect).
