# Baseline seguro das migrations em produção

> **Contexto (auditoria 2026-08-22).** O projeto de produção não apresenta
> histórico confiável em `supabase_migrations.schema_migrations` — a ferramenta
> de migrations retorna lista vazia. As tabelas e funções existem, mas não há
> como provar **qual** versão está aplicada. Este runbook descreve como
> estabelecer um baseline auditável **sem re-aplicar as 87 migrations às cegas**
> e **sem reset destrutivo**.
>
> Nada aqui deve ser executado em produção sem autorização explícita do
> proprietário. Rode primeiro em uma cópia/staging.

## Princípios

1. **Nunca** re-executar `schema.sql` + todas as migrations sobre um banco que
   já tem dados — recria objetos, pode duplicar policies/constraints e falha no
   meio.
2. O objetivo é **descobrir o estado real** e **registrar** o que já está
   aplicado como baseline, aplicando depois só o *delta* que faltar.
3. Toda mudança estrutural futura é uma migration versionada e auditável.

## Passo 1 — Fotografar o estado real do banco

> **Atalho:** cole `scripts/baseline-diagnostico.sql` no SQL Editor do Supabase.
> É só-leitura e já responde as três perguntas-chave (histórico vazio?
> hardenings 082/085/086/088 presentes? inventário e RLS-sem-policy). As
> consultas abaixo são a versão detalhada, caso queira ir campo a campo.

Rode em produção (somente leitura). O CI já tem a semente disso em
`supabase/ci/30_inventario_objetos.sql`.

```sql
-- Tabelas do schema public
select tablename from pg_tables where schemaname = 'public' order by 1;

-- Funções (nome + argumentos) do schema public
select p.proname, pg_get_function_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1, 2;

-- Políticas RLS por tabela
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public' order by 1, 2;

-- RLS habilitada?
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- Existe a tabela de histórico de migrations? Está vazia?
select * from supabase_migrations.schema_migrations order by version;
```

Guarde a saída. Ela é a **verdade** contra a qual o conjunto local
(`supabase/migrations/002…088`) será comparado.

## Passo 2 — Diferença entre "local" e "real"

Para cada migration local, verifique se os objetos que ela cria já existem no
banco (pelo inventário do Passo 1). Classifique cada uma:

- **Já refletida** — todos os objetos existem. Vai para o baseline (Passo 3),
  sem executar o corpo.
- **Parcialmente refletida** — alguns objetos faltam. Investigar caso a caso
  (pode ter sido aplicada uma versão anterior da função). Não replicar cega.
- **Ausente** — nenhum objeto existe. É delta real a aplicar (Passo 4).

As migrations de hardening que a auditoria destacou devem ser confirmadas como
**presentes** no banco (senão viram delta prioritário):

- `014_rls_fix_privilege_escalation.sql`
- `021_hardening_rls_papel_e_integridade.sql`
- `082_hardening_papel_rpcs_geracao_cobrancas.sql`
- `085_comunidade_academia.sql` / `086_comunidade_storage.sql`
- `088_hardening_papel_gerar_folha.sql` *(nova — quase certamente delta)*

## Passo 3 — Marcar o baseline (registrar como aplicado, sem executar)

Depois de confirmar que uma migration já está refletida, registre-a como
aplicada, para o histórico parar de mentir. Duas formas:

**A) Supabase CLI (preferível, se o projeto usar CLI):**

```bash
# Marca uma migration já refletida como aplicada, sem rodar o corpo:
supabase migration repair --status applied <version>
# Confirma:
supabase migration list
```

**B) Inserção controlada** (quando não há CLI vinculada), dentro de uma
transação e **somente** para versões comprovadamente refletidas:

```sql
begin;
insert into supabase_migrations.schema_migrations (version, name)
values ('002', 'funcionarios_salario_e_treinos')  -- repetir p/ cada refletida
on conflict (version) do nothing;
commit;
```

> ⚠️ Só registre o que o Passo 2 provou estar refletido. Marcar como aplicada
> uma migration que **não** está presente esconde um delta e recria o problema.

## Passo 4 — Aplicar só o delta

As migrations classificadas como **ausentes** (incluindo a `088`) são aplicadas
em ordem numérica, cada uma dentro de transação, validando depois. Todas as
migrations do projeto já são idempotentes (`create ... if not exists`,
`create or replace`), o que reduz o risco — mas isso **não** substitui a
classificação do Passo 2.

## Passo 5 — Verificação pós-deploy (evitar falha silenciosa)

O README já documenta um incidente real: a migration 040 (`logs_auditoria`) não
aplicada fazia a gravação **falhar em silêncio**. Para nunca mais:

1. Rodar as assertivas de `supabase/ci/10_assertivas_seguranca.sql` contra o
   banco após cada deploy — elas quebram se um hardening regrediu (agora
   incluindo a **A8**, que exige a checagem de papel na folha).
2. Rodar `supabase/ci/30_inventario_objetos.sql` e comparar contra o esperado.
3. Só considerar o deploy concluído quando ambos passarem.

## Resultado

- Histórico de migrations confiável e auditável.
- Certeza de que os hardenings de segurança estão em produção.
- Deploys futuros com verificação automática — sem o modo de falha silenciosa.
