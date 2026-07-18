-- =============================================================================
-- Remove os dados de demonstração gerados por 004_dados_demo.sql (identificados
-- por matricula_codigo "DEMO-%", cpf "DEMO-EMP-%" e observações "[DEMO]").
-- Não mexe em nada que você tenha cadastrado manualmente.
--
-- Rode isso quando quiser limpar a base de teste antes de usar a academia
-- "pra valer", ou antes de rodar 004_dados_demo.sql de novo.
-- =============================================================================
begin;

delete from public.acessos_catraca
where aluno_id in (select id from public.alunos where matricula_codigo like 'DEMO-%');

delete from public.receitas
where aluno_id in (select id from public.alunos where matricula_codigo like 'DEMO-%')
   or observacoes = '[DEMO]';

delete from public.despesas
where observacoes = '[DEMO]'
   or funcionario_id in (select id from public.funcionarios where cpf like 'DEMO-EMP-%');

delete from public.funcionarios where cpf like 'DEMO-EMP-%';

-- progresso_aluno, treinos e exercicios_treino têm "on delete cascade" a
-- partir de alunos, então somem sozinhos aqui.
delete from public.alunos where matricula_codigo like 'DEMO-%';

-- Os 3 planos (Mensal/Trimestral/Anual) criados pelo seed NÃO são apagados
-- de propósito — são planos reais e reutilizáveis. Se quiser removê-los
-- também, descomente as linhas abaixo (só funciona se nenhum aluno real
-- estiver usando esses planos):
-- delete from public.planos
--   where nome in ('Mensal', 'Trimestral', 'Anual')
--     and descricao in (
--       'Acesso completo à academia, renovação mensal',
--       'Acesso completo, plano trimestral com desconto',
--       'Acesso completo, plano anual com o melhor preço'
--     );

commit;
