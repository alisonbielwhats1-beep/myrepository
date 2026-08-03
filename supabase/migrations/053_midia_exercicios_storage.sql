-- =============================================================================
-- Migration 053 — Vídeo/GIF de demonstração dos exercícios via Supabase Storage
--
-- Antes desta migration, `exercicios_treino.video_demonstracao_url` e
-- `catalogo_exercicios.video_demonstracao_url` só aceitavam uma URL colada
-- manualmente (ver ExercicioBuilder.tsx) — sem upload de arquivo, o professor
-- precisava já ter o clipe hospedado em outro lugar. Pedido do cliente: o
-- treino precisa mostrar um vídeo curto (ou GIF) do movimento, de preferência
-- com pessoas reais executando — e para isso o caminho natural é o professor
-- gravar/enviar o próprio clipe direto do celular, como já acontece com a
-- foto de perfil do aluno (migration 039).
--
-- Esta migration cria APENAS o bucket usado pelo upload real (Server Actions
-- em lib/midia-exercicios.ts). Nada mais.
--
-- POR QUE NÃO HÁ POLICY AQUI: mesma razão da migration 039 — `storage.objects`
-- pertence ao `supabase_storage_admin`; RLS já vem habilitado e nega por
-- padrão sem policy para `anon`/`authenticated`, então upload só acontece
-- pela Server Action com `service_role` (que já valida sessão+seção do
-- painel antes de chamar). Leitura pública não depende de policy: é o
-- `public = true` do bucket que habilita
-- `/storage/v1/object/public/midia-exercicios/...`, usado para exibir o
-- clipe no card do exercício sem exigir autenticação.
--
-- file_size_limit = 4 MB: teto de payload de Function do Vercel é 4.5 MB
-- (Server Action ou Route Handler, mesma plataforma) — 4 MB no bucket fica
-- logo abaixo disso, com o cliente (lib/midia-exercicios.ts) recusando antes
-- de sequer tentar o upload. Um clipe mudo de poucos segundos em webm/mp4
-- bem comprimido (480p) ou um GIF curto cabem tranquilamente nesse teto;
-- next.config.mjs eleva o limite de corpo da Server Action de 1 MB (padrão,
-- pensado para JSON) para 4 MB só para isto.
--
-- Aditiva e idempotente. Nenhum dado existente é alterado.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'midia-exercicios',
  'midia-exercicios',
  true,
  4194304, -- 4 MB
  array['video/mp4', 'video/webm', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
