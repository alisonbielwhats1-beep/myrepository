# Aplicar as migrations 083–086 (app do aluno) — passo a passo

Estas migrations habilitam **dias de treino**, **redes sociais da academia**,
**Comunidade** e o **bucket de imagens** da comunidade. Sem elas, o app do aluno
não quebra, mas a Comunidade fica vazia e os dias caem sempre em "Tudo".

> **Natureza das migrations:** todas são **aditivas e idempotentes** — só criam
> colunas/tabelas/funções novas (`if not exists` / `create or replace`). **Não
> apagam nem alteram dados existentes.** Ainda assim: **aplique primeiro em
> staging** (um projeto Supabase de teste). Só vá para produção depois de validar.

---

## 0. Pré-requisitos
- Acesso ao projeto no **Supabase** (o de **staging**, de preferência).
- Os arquivos em `supabase/migrations/` (083 a 086) — já estão no repositório.

## 1. Ordem de aplicação (respeitar)
```
083_dias_semana_treino.sql
084_redes_sociais_academia.sql
085_comunidade_academia.sql
086_comunidade_storage.sql
```
083 e 085 usam helpers já existentes (`academia_id_atual`, `papel_do_usuario_atual`,
`acao_permitida`) — todos de migrations anteriores, então rode-as **em ordem**.

## 2. Aplicar (jeito mais simples: SQL Editor do Supabase)
Para **cada arquivo, na ordem acima**:
1. Supabase → seu projeto (staging) → **SQL Editor** → **New query**.
2. Abra o arquivo `.sql` correspondente no seu editor e **copie todo o conteúdo**.
3. **Cole** no SQL Editor e clique em **Run**.
4. Deve aparecer **Success. No rows returned**. Passe para o próximo arquivo.

> Alternativa (Supabase CLI, se você usa): `supabase db push` com o projeto linkado
> aplica as migrations pendentes na ordem automaticamente.

## 3. Verificação (cole no SQL Editor e rode)
Cada bloco deve retornar as linhas indicadas.

**083 — coluna de dias + função:**
```sql
select column_name from information_schema.columns
 where table_name='treinos' and column_name='dias_semana';        -- 1 linha
select proname from pg_proc where proname='definir_dias_treino';  -- 1 linha
```

**084 — colunas de redes sociais:**
```sql
select column_name from information_schema.columns
 where table_name='academias'
   and column_name in ('instagram','site','facebook','tiktok');   -- 4 linhas
```

**085 — tabelas da comunidade + RLS ligada:**
```sql
select relname, relrowsecurity as rls_ligada
  from pg_class
 where relname in ('comunidade_posts','comunidade_curtidas',
                   'comunidade_comentarios','comunidade_denuncias');
-- 4 linhas, rls_ligada = true em TODAS
```

**085 — funções do feed/moderação existem:**
```sql
select proname from pg_proc
 where proname in ('obter_feed_comunidade','criar_post_comunidade',
                   'curtir_post_comunidade','comentar_post_comunidade',
                   'excluir_post_comunidade','denunciar_post_comunidade',
                   'listar_posts_moderacao','remover_post_moderacao');
-- 8 linhas
```

**086 — bucket público criado:**
```sql
select id, public from storage.buckets where id='comunidade';     -- 1 linha, public = true
```

## 4. Checagem de segurança / isolamento (importante)
As tabelas da comunidade **não** podem ter policy para `anon` (o acesso do aluno é
só pelas funções `security definer`). Confira:
```sql
select tablename, policyname, roles
  from pg_policies
 where tablename like 'comunidade_%'
 order by tablename;
-- Só devem aparecer policies "mod_*" para o papel {authenticated} (moderação).
-- NENHUMA policy para {anon}. Se aparecer algo para anon, PARE e me avise.
```
O isolamento por academia é garantido dentro das funções (resolvem o aluno por
`token + slug`) e pela coluna `academia_id` em cada tabela.

## 5. Smoke test no app (staging)
1. **Comunidade (aluno):** abra o app de um aluno → aba **Comunidade** → deve
   carregar (vazia) **sem erro**. Publique um post com foto → aparece no feed.
2. **Moderação (painel):** `/painel/[slug]/comunidade` → o post aparece; "Remover"
   funciona; denúncias aparecem em destaque.
3. **Redes sociais:** painel → **Configurações** → preencha Instagram/Site → no app
   do aluno, aba Comunidade, o bloco da academia mostra os links.
4. **Dias de treino:** painel → **Treinos** → atribua um treino a um aluno marcando
   dias (ex.: SEG e QUA) → no app do aluno, aba **Treinos**, esses dias filtram a ficha.
5. **Multitenant:** confirme que um aluno da Academia A **não** vê post da Academia B
   (abra links de alunos de academias diferentes).

## 6. Rollback (só se algo der errado em staging)
> ⚠️ Isto **apaga** os dados da comunidade. Use apenas em staging, se precisar refazer.
```sql
drop table if exists public.comunidade_denuncias, public.comunidade_comentarios,
                      public.comunidade_curtidas, public.comunidade_posts cascade;
drop function if exists public.definir_dias_treino(uuid, smallint[]);
alter table public.treinos drop column if exists dias_semana;
alter table public.academias
  drop column if exists instagram, drop column if exists site,
  drop column if exists facebook, drop column if exists tiktok;
-- o bucket pode ser removido pelo painel (Storage) se estiver vazio.
```
As RPCs `obter_ficha_aluno` e `obter_academia_publica` voltam à versão anterior
reaplicando as migrations 075 e 003, respectivamente (se necessário).

## 7. Produção
Só **depois** de validar em staging. Mesmos passos (seções 2–5). Faça um **backup**
antes por precaução, mesmo sendo migrations aditivas.
