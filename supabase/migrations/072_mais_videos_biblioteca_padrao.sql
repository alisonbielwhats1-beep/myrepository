-- =============================================================================
-- Migração 072 — Mais vídeos de demonstração na biblioteca padrão GestAcad
--
-- Adiciona 14 clipes curtos novos (public/videos/catalogo/*.mp4) para exercícios
-- da biblioteca padrão que ainda estavam só com foto. Mesma origem e licença dos
-- anteriores: wger.de, CC BY-SA 4.0, autor "Goulart" — recortados para ≤8s,
-- 640px de largura, sem áudio, H.264 (~150–300 KB cada). O crédito CC BY-SA
-- aparece automaticamente (componente CreditoVideosExercicios).
--
-- Match exercício↔vídeo conferido item a item; exercícios sem correspondência
-- confiável no wger (ex.: agachamento livre, abdominais, prancha, crucifixo na
-- máquina) ficaram de fora de propósito, para não rotular movimento errado.
--
-- Guarda só o caminho relativo (~30 chars): zero sobrecarga no banco. Só toca
-- nos modelos de plataforma 'gestacad-%' e só quando sem vídeo. Reexecutável.
-- =============================================================================

update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/barra-fixa.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Barra Fixa' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/cadeira-adutora.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Cadeira Adutora' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/crucifixo-inverso.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Crucifixo Inverso' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/desenvolvimento-maquina.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Desenvolvimento Máquina' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/encolhimento.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Encolhimento' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/hack.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Hack' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/mesa-flexora.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Mesa Flexora' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/panturrilha-sentado.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Panturrilha Sentado' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/remada-sentada.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Remada Sentada' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/remada-unilateral.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Remada Unilateral' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/rosca-alternada.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Rosca Alternada' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/stiff.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Stiff' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/supino-inclinado-barra.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Supino Inclinado com Barra' and coalesce(e.video_demonstracao_url,'') = '';
update public.exercicios_treino e set video_demonstracao_url = '/videos/catalogo/triceps-pulley.mp4' from public.treinos t where e.treino_id = t.id and t.academia_id is null and t.visibilidade = 'plataforma' and t.codigo_importacao like 'gestacad-%' and e.nome_exercicio = 'Tríceps Pulley' and coalesce(e.video_demonstracao_url,'') = '';
