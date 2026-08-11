-- =============================================================================
-- Migration 064 — Telefone do membro da equipe.
--
-- POR QUE
--   Cadastrar alguém na equipe cria o login e não avisa ninguém: sem e-mail,
--   sem link, sem mensagem. Em 11/08/2026 a academia Geração Saúde cadastrou
--   três funcionários às 11h e todos ficaram sem acessar — não porque algo
--   falhou (as contas estavam corretas e com e-mail confirmado), mas porque
--   ninguém tinha como saber que a conta existia, qual o endereço do painel ou
--   qual a senha.
--
--   Com o telefone, a tela de Equipe passa a ter o mesmo botão de WhatsApp que
--   a ficha do aluno já tem, enviando o endereço do painel e a orientação de
--   definir a própria senha pelo "Esqueci minha senha" — assim a dona nunca
--   precisa escolher, saber nem transmitir a senha de ninguém.
--
-- OPCIONAL DE PROPÓSITO
--   `null` é um estado normal e permanente: os membros cadastrados antes desta
--   migration não têm telefone, e continuar funcionando sem ele é requisito.
--   A tela cai no botão de copiar o convite quando o número não existe.
--
--   Nada de e-mail obrigatório ou de convite automático aqui: o WhatsApp é o
--   canal que a recepção realmente usa, e é o mesmo caminho já adotado para o
--   link do aluno (lib/whats.ts).
--
-- Seguro rodar mais de uma vez. Não lê nem altera nenhuma linha existente.
-- =============================================================================

alter table public.perfis_admin
  add column if not exists telefone text;

comment on column public.perfis_admin.telefone is
  'Telefone do membro da equipe, para enviar o convite de acesso por WhatsApp. Opcional — membros antigos não têm, e a tela lida com isso.';
