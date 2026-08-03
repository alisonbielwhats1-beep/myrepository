-- =============================================================================
-- Migration 054 — Clipes de demonstração (vídeo, pessoas reais) para os
-- exercícios padrão e para o catálogo global.
--
-- Pedido do cliente (ver migration 053): o treino precisa mostrar um vídeo
-- curto do movimento, de preferência com pessoas reais. Em vez de deixar tudo
-- para o professor gravar do zero, populamos aqui os exercícios que já têm um
-- clipe real disponível — mesma ideia da migration 019 (que fez isso para
-- imagem), agora para vídeo.
--
-- ORIGEM DOS CLIPES: wger.de (banco de exercícios open source, CC BY-SA 4.0,
-- autor "Goulart"). Os vídeos originais (câmera, 1080p/4K, 5–330 MB) foram
-- recortados para ≤8s, reduzidos para 640px de largura e re-codificados sem
-- áudio — cada arquivo final fica na faixa de 40 KB–1 MB, bem abaixo do teto
-- de 4 MB do bucket de upload (migration 053). Os arquivos ficam versionados
-- em public/videos/catalogo/ (mesmo padrão da migration 04_dados_demo/65ea664
-- antes de ser removida em favor do catálogo real) — servidos como asset
-- estático do Next, sem depender do Supabase Storage nem de credenciais.
-- Por ser uma obra derivada sob CC BY-SA, o crédito ao autor original fica
-- visível no rodapé da tela de treinos (ver componente RodapeCreditoVideos).
--
-- COBERTURA: só os exercícios com uma correspondência confiável ao movimento
-- do vídeo (mesmo equipamento/execução) foram preenchidos. Exercícios com
-- variação técnica relevante (ex.: "Levantamento Terra" vs. o Terra Romeno do
-- wger, "Agachamento Livre" vs. Front Squat) ficaram de fora de propósito,
-- para não rotular um movimento errado.
--
-- Segue o padrão da migration 019: função de mapeamento + recriação do
-- helper de treino-padrão + backfill só onde ainda está null (nunca sobrescreve
-- ajuste manual do dono).
--
-- Seguro rodar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) catalogo_exercicios (biblioteca global usada pelo ExercicioBuilder)
-- -----------------------------------------------------------------------------
update public.catalogo_exercicios
   set video_demonstracao_url = v.url
  from (values
    ('Supino Inclinado Halteres',   '/videos/catalogo/supino-inclinado-halteres.mp4'),
    ('Rosca Martelo',               '/videos/catalogo/rosca-martelo.mp4'),
    ('Rosca Direta Barra',          '/videos/catalogo/rosca-direta-barra.mp4'),
    ('Elevação Pélvica',            '/videos/catalogo/elevacao-pelvica.mp4'),
    ('Panturrilha em Pé',           '/videos/catalogo/panturrilha-em-pe.mp4'),
    ('Leg Press 45°',               '/videos/catalogo/leg-press-45.mp4'),
    ('Afundo (Passada)',            '/videos/catalogo/afundo-passada.mp4'),
    ('Elevação Lateral',            '/videos/catalogo/elevacao-lateral.mp4'),
    ('Desenvolvimento com Halteres','/videos/catalogo/desenvolvimento-halteres.mp4'),
    ('Cadeira Flexora',             '/videos/catalogo/cadeira-flexora.mp4'),
    ('Rosca Scott',                 '/videos/catalogo/rosca-scott.mp4'),
    ('Tríceps Testa',               '/videos/catalogo/triceps-testa.mp4'),
    ('Remada Baixa (Cabo)',         '/videos/catalogo/remada-baixa-cabo.mp4'),
    ('Tríceps Corda',               '/videos/catalogo/triceps-corda.mp4'),
    ('Mergulho no Banco',           '/videos/catalogo/mergulho-no-banco.mp4')
  ) as v(nome, url)
 where catalogo_exercicios.nome = v.nome;

-- -----------------------------------------------------------------------------
-- 2) Treinos-modelo padrão (migration 018) — nomenclatura própria, diferente
--    da do catálogo acima, por isso um mapeamento separado.
-- -----------------------------------------------------------------------------
create or replace function public.video_exercicio_padrao(p_nome text)
returns text
language sql
immutable
as $$
  select case p_nome
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

-- Recria o helper: agora grava também o vídeo de cada exercício.
create or replace function public._add_treino_padrao(
  p_academia_id uuid,
  p_nome        text,
  p_objetivo    text,
  p_modalidade  text,
  p_ordem       int,
  p_exercicios  jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treino_id uuid;
begin
  insert into public.treinos
    (academia_id, aluno_id, nome_treino, objetivo, modalidade, ordem)
  values
    (p_academia_id, null, p_nome, p_objetivo, p_modalidade, p_ordem)
  returning id into v_treino_id;

  insert into public.exercicios_treino
    (treino_id, nome_exercicio, series, repeticoes, descanso_segundos,
     imagem_demonstracao_url, video_demonstracao_url, ordem)
  select
    v_treino_id,
    e->>'nome',
    coalesce((e->>'series')::int, 3),
    coalesce(e->>'reps', '12'),
    coalesce((e->>'descanso')::int, 60),
    public.img_exercicio_padrao(e->>'nome'),
    public.video_exercicio_padrao(e->>'nome'),
    ord::int
  from jsonb_array_elements(p_exercicios) with ordinality as t(e, ord);
end;
$$;

grant execute on function public.video_exercicio_padrao(text) to service_role;
grant execute on function public._add_treino_padrao(uuid, text, text, text, int, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- BACKFILL: preenche o vídeo dos exercícios dos treinos-modelo já criados
-- (apenas onde ainda está sem vídeo, para não sobrescrever ajuste do dono).
-- ---------------------------------------------------------------------------
update public.exercicios_treino et
   set video_demonstracao_url = public.video_exercicio_padrao(et.nome_exercicio)
  from public.treinos t
 where t.id = et.treino_id
   and t.aluno_id is null
   and et.video_demonstracao_url is null
   and public.video_exercicio_padrao(et.nome_exercicio) is not null;
