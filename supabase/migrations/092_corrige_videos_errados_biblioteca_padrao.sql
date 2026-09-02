-- =============================================================================
-- Migração 092 — Remove os dois vídeos de demonstração ERRADOS da biblioteca
-- padrão GestAcad.
--
-- Conferência quadro a quadro dos clipes de public/videos/catalogo/ apontou dois
-- arquivos cujo conteúdo NÃO corresponde ao nome do exercício:
--
--   • remada-unilateral.mp4  → mostra uma ELEVAÇÃO LATERAL NO CABO, não uma
--                              remada unilateral.
--   • leg-press-45.mp4       → mostra um LEG PRESS HORIZONTAL/RECLINADO, não o
--                              leg press 45° (trenó inclinado).
--
-- Não existe no catálogo um clipe correto para esses movimentos, então em vez de
-- reapontar, aqui o vídeo é REMOVIDO desses exercícios. O card do aluno já cai
-- no fallback de foto (ExercicioCard: temVideo = Boolean(video_demonstracao_url);
-- sem vídeo, usa imagem_demonstracao_url), e ambos têm foto correta na
-- migration 070 (Leg_Press/0.jpg e One-Arm_Dumbbell_Row/0.jpg).
--
-- Escopo: SÓ estes dois clipes, identificados pelo caminho exato. Só zera onde
-- o valor é exatamente o clipe errado — nunca toca em upload próprio do dono nem
-- em qualquer outro vídeo. Os arquivos .mp4 correspondentes foram removidos do
-- repositório na mesma alteração. Reexecutável.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Fichas e treinos-modelo (exercicios_treino): zera os dois clipes errados.
-- -----------------------------------------------------------------------------
update public.exercicios_treino
   set video_demonstracao_url = null
 where video_demonstracao_url in (
   '/videos/catalogo/remada-unilateral.mp4',
   '/videos/catalogo/leg-press-45.mp4'
 );

-- -----------------------------------------------------------------------------
-- 2) Catálogo global (catalogo_exercicios): zera o clipe errado do Leg Press
--    (a "Remada Unilateral" não tem vídeo no catálogo global).
-- -----------------------------------------------------------------------------
update public.catalogo_exercicios
   set video_demonstracao_url = null
 where video_demonstracao_url in (
   '/videos/catalogo/remada-unilateral.mp4',
   '/videos/catalogo/leg-press-45.mp4'
 );

-- -----------------------------------------------------------------------------
-- 3) Recria video_exercicio_padrao() SEM o 'Leg Press 45°', para que uma
--    reconstrução do banco (rodar todas as migrations) não reintroduza o clipe
--    errado via backfill (migrations 054/055). Mantém todos os demais mapeamentos
--    da última versão (migration 055).
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
    -- 'Leg Press 45°' removido de propósito (clipe errado — ver migração 092).
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
