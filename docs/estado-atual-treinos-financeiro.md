# Estado atual — Treinos e fluxo de aluno/financeiro

Resumo do que foi entregue nas últimas iterações, para quem retomar o projeto
(inclusive uma sessão nova de IA) achar tudo rápido, sem reconstruir contexto.

Última atualização: 2026-08-16.

## Migrations a aplicar em produção (SQL Editor do Supabase, em ordem)

As migrations são aplicadas **à mão**. Aplique nesta ordem se ainda não aplicou:

| # | Arquivo | O que faz | Destrutiva? |
|---|---|---|---|
| 075 | `075_hardening_ficha_aluno_tenant.sql` | Isolamento multi-tenant da ficha do aluno + RLS de INSERT de treinos | Não |
| 076 | `076_origem_tipo_treinos.sql` | Coluna `origem_tipo` (gestacad/academia/instrutor) + backfill + trigger | Não |
| 077 | `077_visibilidade_privado_equipe_academia.sql` | Visibilidade em 3 níveis (privado/equipe/academia) + RLS + RPC | Não |
| 078 | `078_login_rate_limit_service_role.sql` | Rate limit de login → `service_role`-only (fecha A3/P1-04) | Não |
| 079 | `079_acao_permitida_janela_fixa.sql` | Anti-spam com janela fixa no servidor (fecha A4/P1-08) | Não |
| 080 | `080_atribuir_treino_aluno_pendente.sql` | Atribuir treino também a aluno `pendente` (fim do erro "P0001") | Não |

Todas são idempotentes e não-destrutivas (só GRANTs, colunas aditivas, corpo de
função). **078 depende do código novo** de `lib/actions/auth.ts` (client
service-role) — aplique junto/depois do deploy; se antes, o rate limit de login
só fica inoperante (falha aberta, login continua).

### Conferir o que já está aplicado

```sql
select
  (select count(*) from information_schema.columns
     where table_name='treinos' and column_name='origem_tipo')  as tem_076,
  (select count(*) from pg_constraint
     where conname='treinos_visibilidade_valida')                as tem_077,
  (select 1 - has_function_privilege('anon','public.login_registrar_falha(text)','EXECUTE')::int) as tem_078,
  (select position('interval ''300 seconds''' in pg_get_functiondef('public.acao_permitida(text,int,int)'::regprocedure)) > 0) as tem_079;
```

## Modelo de dados (o que mudou)

- **Treino** tem dois eixos ortogonais (antes conflacionados em `visibilidade`):
  - `origem_tipo`: `gestacad` (plataforma, `academia_id` NULL) / `academia` /
    `instrutor` (autoria). Fonte única de "é da plataforma".
  - `visibilidade`: `privado` (só o criador; dono/gerente também) / `equipe`
    (dono/gerente/instrutor — recepção **não** vê) / `academia` (todo o tenant,
    inclui recepção).
  - Helper de classificação: `lib/treinos.ts` → `nivelDoTreino()`.
- **Ficha do aluno** é sempre uma **cópia** (snapshot) do modelo — editar o
  modelo não altera fichas já atribuídas. RPC: `atribuir_modelo_treino`.
- **StatusFinanceiro** (`lib/types.ts`) tem 4 valores:
  `em_dia` (verde) / `a_vencer` (âmbar, vence no futuro) /
  `pendente` (âmbar, "Vence hoje") / `inadimplente` (vermelho, atrasada).
  Cálculo em `lib/utils.ts` → `calcularStatusFinanceiro`; rótulo em
  `rotuloStatusFinanceiro`.

## Funcionalidades de Treinos (biblioteca)

Tela: `app/painel/[slug]/treinos`. Componente: `components/painel/GestaoTreinos.tsx`.
Server actions: `app/painel/[slug]/treinos/actions.ts`.

- Criar modelo, criar exercício de catálogo.
- **Editar** modelo (autor/gestor; preserva `share_token`; não mexe em fichas).
- **Duplicar** modelo (inclusive um GestAcad, para personalizar — original intacto).
- Atribuir a aluno (cria a cópia na ficha; aceita aluno `ativa` ou `pendente`).
- Compartilhar (link/QR público), visibilidade em 3 níveis, excluir.
- Biblioteca mostra academia + instrutor + GestAcad (RLS filtra privado alheio).

## Fluxo de aluno

- Criar aluno **sem plano** → matrícula nasce `pendente` (não libera catraca).
  O formulário mostra um aviso (trava suave); "Nenhum" continua permitido.
- Mensagens de erro de RPC (`P0001`) são mostradas com a frase de negócio, não
  o código — ver `lib/erros-amigaveis.ts`.

## CI de banco

Workflow `.github/workflows/validar-banco.yml` aplica schema + todas as
migrations num Postgres efêmero e roda `supabase/ci/10_assertivas_seguranca.sql`
(7 asserções) e `supabase/ci/20_teste_rls_multitenant.sql`. Só dispara em
mudanças de `supabase/**`. Verde no estado atual.

## Verificação local

```
npm run typecheck && npm run lint && npm test && npm run build
```
