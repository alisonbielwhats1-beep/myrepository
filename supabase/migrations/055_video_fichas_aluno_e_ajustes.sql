-- =============================================================================
-- Migration 055 — Corrige a cobertura de vídeo nas fichas já criadas.
--
-- DOIS PROBLEMAS ENCONTRADOS DEPOIS DA MIGRATION 054:
--
-- 1) BUG (app/painel/[slug]/alunos/actions.ts, função `criarTreino`): ao
--    criar a FICHA INDIVIDUAL de um aluno (diferente do treino-modelo da
--    biblioteca, que usa `criarTreinoBiblioteca` e nunca teve esse problema),
--    a imagem e o vídeo passavam por `validarUrl()` — que só aceita uma URL
--    `https://` absoluta. Isso rejeitava (virava `null` silenciosamente):
--      • o `data:` URL da foto comprimida no navegador (ImageUpload);
--      • o caminho local dos clipes do catálogo (`/videos/catalogo/...`,
--        migration 054), que é relativo, não absoluto.
--    Corrigido no código (mesmo tratamento trim-or-null de
--    `criarTreinoBiblioteca`); esta migration só cobre o dado que já ficou
--    errado no banco.
--
-- 2) O backfill da migration 054 só alcançava treinos-modelo da biblioteca
--    (`t.aluno_id is null`) — mesma limitação, aliás, do backfill de imagem
--    da migration 019. Fichas já atribuídas a um aluno (`aluno_id` próprio)
--    nunca foram tocadas. Aqui o backfill roda para QUALQUER exercício sem
--    vídeo, biblioteca ou já atribuído a um aluno.
--
-- De brinde, adiciona 1 exercício que tinha vídeo real disponível e passou
-- batido na migration 054: "Supino Reto com Barra" (wger.de, exercício 73
-- "Bench Press", mesmo autor/licença dos demais — Goulart, CC BY-SA 4.0).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Novo clipe no catálogo global.
-- -----------------------------------------------------------------------------
update public.catalogo_exercicios
   set video_demonstracao_url = '/videos/catalogo/supino-reto-barra.mp4'
 where nome = 'Supino Reto com Barra';

-- -----------------------------------------------------------------------------
-- 2) Mesmo exercício na nomenclatura dos treinos-modelo padrão (migration 018).
-- -----------------------------------------------------------------------------
create or replace function public.video_exercicio_padrao(p_nome text)
returns text
language sql
immutable
as $$
  select case p_nome
    when 'Supino Reto com Barra'                 then '/videos/catalogo/supino-reto-barra.mp4'
    when 'Supino Inclinado com Halteres'         then '/videos/catalogo/supino-inclinado-halteres.mp4'
    when 'Rosca Martelo'                         then '/videos/catalogo/rosca-martelo.mp4'
    when 'Rosca Direta com Barra'                then '/videos/catalogo/rosca-direta-barra.mp4'
    when 'Panturrilha em Pé'                     then '/videos/catalogo/panturrilha-em-pe.mp4'
    when 'Leg Press 45°'                         then '/videos/catalogo/leg-press-45.mp4'
    when 'Elevação Lateral'                      then '/videos/catalogo/elevacao-lateral.mp4'
    when 'Desenvolvimento Militar com Halteres'  then '/videos/catalogo/desenvolvimento-halteres.mp4'
    when 'Mesa Flexora'                          then '/videos/catalogo/cadeira-flexora.mp4'
    when 'Rosca Scott'                           then '/videos/catalogo/rosca-scott.mp4'
    when 'Tríceps Testa'                         then '/videos/catalogo/triceps-testa.mp4'
    when 'Remada Baixa (Triângulo)'              then '/videos/catalogo/remada-baixa-cabo.mp4'
    when 'Tríceps Corda na Polia'                then '/videos/catalogo/triceps-corda.mp4'
    else null
  end;
$$;

grant execute on function public.video_exercicio_padrao(text) to service_role;

-- -----------------------------------------------------------------------------
-- 3) BACKFILL AMPLO: qualquer exercício sem vídeo — biblioteca ou já
--    atribuído a um aluno —, tentando primeiro pelo nome do catálogo global
--    e depois pela nomenclatura dos treinos-modelo padrão. Nunca sobrescreve
--    um vídeo que já esteja preenchido (ajuste manual do dono, upload
--    próprio ou clipe colado).
-- -----------------------------------------------------------------------------
update public.exercicios_treino et
   set video_demonstracao_url = ce.video_demonstracao_url
  from public.catalogo_exercicios ce
 where ce.nome = et.nome_exercicio
   and et.video_demonstracao_url is null
   and ce.video_demonstracao_url is not null;

update public.exercicios_treino et
   set video_demonstracao_url = public.video_exercicio_padrao(et.nome_exercicio)
 where et.video_demonstracao_url is null
   and public.video_exercicio_padrao(et.nome_exercicio) is not null;
