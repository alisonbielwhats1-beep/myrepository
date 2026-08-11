-- =============================================================================
-- Rollback da migration 060 — desfaz a padronização dos cadastros.
--
-- Restaura, campo a campo, o valor original guardado em
-- `public.backup_padronizacao_060`. Restaura APENAS o que continua igual ao
-- que a 060 gravou: se alguém editou o cadastro depois (a recepção corrigiu um
-- nome na mão, por exemplo), a edição mais nova é preservada — desfazer a
-- padronização não pode apagar trabalho feito depois dela.
--
-- A tabela de backup NÃO é apagada no fim, de propósito: rodar o rollback não
-- deve queimar a única cópia dos valores originais. Para descartá-la depois de
-- confirmar que está tudo certo:
--   drop table public.backup_padronizacao_060;
--
-- Seguro rodar mais de uma vez. Roda em transação, pelo mesmo motivo da
-- migration: restaurar metade da base seria pior do que não restaurar nada.
-- =============================================================================

begin;

update public.alunos a
   set nome = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'alunos' and b.coluna = 'nome'
   and a.id = b.registro_id
   and a.nome is not distinct from b.valor_novo;

update public.alunos a
   set email = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'alunos' and b.coluna = 'email'
   and a.id = b.registro_id
   and a.email is not distinct from b.valor_novo;

update public.alunos a
   set telefone = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'alunos' and b.coluna = 'telefone'
   and a.id = b.registro_id
   and a.telefone is not distinct from b.valor_novo;

update public.planos p
   set nome = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'planos' and b.coluna = 'nome'
   and p.id = b.registro_id
   and p.nome is not distinct from b.valor_novo;

update public.funcionarios f
   set nome = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'funcionarios' and b.coluna = 'nome'
   and f.id = b.registro_id
   and f.nome is not distinct from b.valor_novo;

update public.funcionarios f
   set cargo = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'funcionarios' and b.coluna = 'cargo'
   and f.id = b.registro_id
   and f.cargo is not distinct from b.valor_novo;

update public.funcionarios f
   set email = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'funcionarios' and b.coluna = 'email'
   and f.id = b.registro_id
   and f.email is not distinct from b.valor_novo;

update public.funcionarios f
   set telefone = b.valor_original
  from public.backup_padronizacao_060 b
 where b.tabela = 'funcionarios' and b.coluna = 'telefone'
   and f.id = b.registro_id
   and f.telefone is not distinct from b.valor_novo;

do $$
begin
  if to_regclass('public.produtos') is not null then
    update public.produtos p
       set nome = b.valor_original
      from public.backup_padronizacao_060 b
     where b.tabela = 'produtos' and b.coluna = 'nome'
       and p.id = b.registro_id
       and p.nome is not distinct from b.valor_novo;
  end if;
end;
$$;

commit;
