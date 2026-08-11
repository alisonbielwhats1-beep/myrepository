-- =============================================================================
-- Migration 060 — Padronização dos cadastros já existentes.
--
-- POR QUE ESTA MIGRATION EXISTE
--   O sistema nunca normalizou o que a recepção digitava: o texto ia cru para
--   o banco. Com CAPS LOCK ligado, uma base inteira entrou como
--   "MARIA DA SILVA" / "MENSAL PREMIUM". O nome do aluno e o do plano aparecem
--   na cobrança, no WhatsApp e na exportação — caixa alta ali vira grito na
--   mensagem que o cliente recebe.
--
--   A partir de 2026-08-11 o app normaliza na gravação (lib/normalizacao.ts,
--   aplicado no formulário E na importação em massa). Esta migration cuida do
--   que já estava gravado antes disso.
--
-- O QUE ELA FAZ
--   1. Cria `backup_padronizacao_060` e guarda o valor ORIGINAL de cada campo
--      que vai mudar, linha a linha.
--   2. Normaliza alunos (nome, e-mail, telefone), planos (nome), funcionários
--      (nome, cargo, e-mail, telefone) e produtos (nome).
--   3. Descarta as funções auxiliares no fim (ver "SOBRE AS FUNÇÕES").
--
-- O QUE ELA NÃO FAZ
--   Não apaga, não recusa e não esvazia nada: todo UPDATE aqui é reescrita de
--   formatação do mesmo dado. Telefone fora do padrão brasileiro e nome com
--   caractere estranho são mantidos como estão.
--   Não toca em `academias.nome_fantasia`: é a marca do cliente, escrita por
--   ele de propósito (uma academia pode se chamar "CIA ATHLETICA" mesmo).
--
-- COMO DESFAZER
--   supabase/migrations/060_padronizacao_cadastros_rollback.sql restaura todos
--   os valores originais a partir da tabela de backup.
--
-- SOBRE AS FUNÇÕES
--   `normalizar_nome_proprio` e `normalizar_telefone_br` são criadas, usadas e
--   REMOVIDAS no fim desta migration, de propósito. A regra oficial é a de
--   lib/normalizacao.ts; deixar uma cópia viva no banco criaria uma segunda
--   fonte da verdade, livre para divergir da primeira sem ninguém perceber.
--   Divergência conhecida e aceita nesta passagem única: o `initcap` do
--   Postgres capitaliza depois de qualquer caractere não alfanumérico, e o TS
--   só depois de espaço, hífen e apóstrofo. Muda apenas casos com pontuação
--   incomum no meio da palavra.
--
-- Seguro rodar mais de uma vez: o backup usa `create table if not exists` e os
-- updates só tocam linhas que ainda não estão no formato final.
--
-- TUDO OU NADA
--   O arquivo inteiro roda dentro de uma transação (`begin`/`commit` nas duas
--   pontas). Colado no SQL Editor do Supabase, cada comando iria confirmando
--   sozinho: uma falha no meio deixaria metade dos alunos padronizados e a
--   outra metade não — o pior estado possível, e sem backup completo para
--   voltar. Com a transação, ou o banco inteiro fica consistente, ou nada muda.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Backup dos valores originais
--
-- RLS ligada e NENHUMA policy: nem `anon` nem `authenticated` leem esta tabela
-- por nenhum caminho da API pública. Ela guarda nome, e-mail e telefone de
-- alunos de TODAS as academias juntos — sem tenant para filtrar, a única
-- postura correta é não expor a ninguém. Acesso apenas por conexão direta ao
-- banco (SQL Editor / service_role), que é quem roda a restauração.
-- -----------------------------------------------------------------------------
create table if not exists public.backup_padronizacao_060 (
  id              bigserial   primary key,
  tabela          text        not null,
  registro_id     uuid        not null,
  coluna          text        not null,
  valor_original  text,
  valor_novo      text,
  criado_em       timestamptz not null default now()
);

comment on table public.backup_padronizacao_060 is
  'Valores originais dos cadastros antes da padronização de 2026-08-11 (migration 060). Só para restauração — sem policy de RLS, invisível pela API pública.';

create index if not exists idx_backup_padronizacao_060_registro
  on public.backup_padronizacao_060 (tabela, registro_id);

alter table public.backup_padronizacao_060 enable row level security;

-- -----------------------------------------------------------------------------
-- 1. Funções auxiliares (temporárias — removidas no passo 4)
-- -----------------------------------------------------------------------------

-- Espelha normalizarNomeProprio() de lib/normalizacao.ts:
-- caixa de nome próprio, partículas em minúscula fora da primeira palavra e
-- algarismos romanos preservados em maiúscula.
create or replace function public.normalizar_nome_proprio(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  v_base     text;
  v_palavras text[];
  v_saida    text[] := '{}';
  v_palavra  text;
  i          int;
begin
  v_base := btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
  if v_base = '' then
    return '';
  end if;

  v_palavras := string_to_array(initcap(lower(v_base)), ' ');

  for i in 1 .. coalesce(array_length(v_palavras, 1), 0) loop
    v_palavra := v_palavras[i];

    if i > 1 and lower(v_palavra) in (
      'da','das','de','del','di','do','dos','du',
      'e','la','las','le','les','van','von','y'
    ) then
      v_palavra := lower(v_palavra);
    elsif lower(v_palavra) ~ '^(i{1,3}|iv|v|vi{1,3}|ix|x)$' then
      v_palavra := upper(v_palavra);
    end if;

    v_saida := v_saida || v_palavra;
  end loop;

  return array_to_string(v_saida, ' ');
end;
$$;

-- Espelha normalizarTelefone() de lib/normalizacao.ts: máscara BR para 10/11
-- dígitos, DDI 55 removido, qualquer outro formato devolvido como está.
create or replace function public.normalizar_telefone_br(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  v_original text;
  v_digitos  text;
  v_nacional text;
begin
  v_original := btrim(coalesce(p_texto, ''));
  if v_original = '' then
    return null;
  end if;

  v_digitos := regexp_replace(v_original, '\D', '', 'g');

  -- DDI estrangeiro explícito sai intacto (ver comentário equivalente no TS):
  -- formatar 11 dígitos de um número dos EUA inventaria um celular brasileiro.
  if left(v_original, 1) = '+' and left(v_digitos, 2) <> '55' then
    return v_original;
  end if;

  v_nacional := case
    when length(v_digitos) > 11 and left(v_digitos, 2) = '55' then substr(v_digitos, 3)
    else v_digitos
  end;

  if length(v_nacional) = 11 then
    return '(' || substr(v_nacional, 1, 2) || ') ' || substr(v_nacional, 3, 5) || '-' || substr(v_nacional, 8, 4);
  end if;
  if length(v_nacional) = 10 then
    return '(' || substr(v_nacional, 1, 2) || ') ' || substr(v_nacional, 3, 4) || '-' || substr(v_nacional, 7, 4);
  end if;

  return v_original;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Backup — só as linhas que realmente vão mudar
--
-- `is distinct from` (e não `<>`) porque compara certo quando um dos lados é
-- NULL: com `<>`, toda linha de e-mail/telefone vazio ficaria de fora da
-- comparação e o backup sairia incompleto.
-- -----------------------------------------------------------------------------
insert into public.backup_padronizacao_060 (tabela, registro_id, coluna, valor_original, valor_novo)
select 'alunos', id, 'nome', nome, public.normalizar_nome_proprio(nome)
  from public.alunos
 where nome is distinct from public.normalizar_nome_proprio(nome)
union all
select 'alunos', id, 'email', email, lower(btrim(email))
  from public.alunos
 where email is not null and email is distinct from lower(btrim(email))
union all
select 'alunos', id, 'telefone', telefone, public.normalizar_telefone_br(telefone)
  from public.alunos
 where telefone is not null and telefone is distinct from public.normalizar_telefone_br(telefone)
union all
select 'planos', id, 'nome', nome, public.normalizar_nome_proprio(nome)
  from public.planos
 where nome is distinct from public.normalizar_nome_proprio(nome)
union all
select 'funcionarios', id, 'nome', nome, public.normalizar_nome_proprio(nome)
  from public.funcionarios
 where nome is distinct from public.normalizar_nome_proprio(nome)
union all
select 'funcionarios', id, 'cargo', cargo, public.normalizar_nome_proprio(cargo)
  from public.funcionarios
 where cargo is distinct from public.normalizar_nome_proprio(cargo)
union all
select 'funcionarios', id, 'email', email, lower(btrim(email))
  from public.funcionarios
 where email is not null and email is distinct from lower(btrim(email))
union all
select 'funcionarios', id, 'telefone', telefone, public.normalizar_telefone_br(telefone)
  from public.funcionarios
 where telefone is not null and telefone is distinct from public.normalizar_telefone_br(telefone);

-- Produtos podem não existir em instalações antigas (migration da loja veio
-- depois) — por isso este bloco é condicional, e não um insert direto.
do $$
begin
  if to_regclass('public.produtos') is not null then
    insert into public.backup_padronizacao_060 (tabela, registro_id, coluna, valor_original, valor_novo)
    select 'produtos', id, 'nome', nome, public.normalizar_nome_proprio(nome)
      from public.produtos
     where nome is distinct from public.normalizar_nome_proprio(nome);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Padronização
-- -----------------------------------------------------------------------------
update public.alunos
   set nome = public.normalizar_nome_proprio(nome)
 where nome is distinct from public.normalizar_nome_proprio(nome);

update public.alunos
   set email = lower(btrim(email))
 where email is not null and email is distinct from lower(btrim(email));

update public.alunos
   set telefone = public.normalizar_telefone_br(telefone)
 where telefone is not null and telefone is distinct from public.normalizar_telefone_br(telefone);

update public.planos
   set nome = public.normalizar_nome_proprio(nome)
 where nome is distinct from public.normalizar_nome_proprio(nome);

update public.funcionarios
   set nome = public.normalizar_nome_proprio(nome)
 where nome is distinct from public.normalizar_nome_proprio(nome);

update public.funcionarios
   set cargo = public.normalizar_nome_proprio(cargo)
 where cargo is distinct from public.normalizar_nome_proprio(cargo);

update public.funcionarios
   set email = lower(btrim(email))
 where email is not null and email is distinct from lower(btrim(email));

update public.funcionarios
   set telefone = public.normalizar_telefone_br(telefone)
 where telefone is not null and telefone is distinct from public.normalizar_telefone_br(telefone);

do $$
begin
  if to_regclass('public.produtos') is not null then
    update public.produtos
       set nome = public.normalizar_nome_proprio(nome)
     where nome is distinct from public.normalizar_nome_proprio(nome);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Relatório e limpeza
-- -----------------------------------------------------------------------------
do $$
declare
  v_total int;
begin
  select count(*) into v_total from public.backup_padronizacao_060;
  raise notice 'Migration 060: % campo(s) padronizado(s). Originais em public.backup_padronizacao_060.', v_total;
end;
$$;

drop function if exists public.normalizar_nome_proprio(text);
drop function if exists public.normalizar_telefone_br(text);

commit;
