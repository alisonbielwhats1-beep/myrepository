-- =============================================================================
-- Migration 086 — Bucket Storage `comunidade` (imagens das publicações)
--
-- Cria APENAS o bucket usado pelo upload das imagens da comunidade (Server
-- Action em lib/comunidade-fotos.ts). Mesmo desenho da migration 039
-- (fotos-perfil):
--
--   • SEM policy sobre storage.objects — a tabela pertence a
--     `supabase_storage_admin` e o RLS já nega por padrão. Sem policy para
--     anon/authenticated, ninguém grava direto no bucket pelo cliente. O upload
--     acontece SÓ pela Server Action com a service_role, DEPOIS de validar
--     token+slug do aluno. A RPC criar_post_comunidade ainda recusa qualquer
--     URL que não seja deste bucket.
--   • public = true habilita a leitura da imagem em
--     /storage/v1/object/public/comunidade/... sem autenticação (o feed é
--     carregado no navegador do aluno, sem login).
--
-- file_size_limit é a última barreira: o navegador comprime a imagem antes de
-- enviar (lib/imagem-cliente.ts) e o servidor revalida bem abaixo deste teto,
-- respeitando o corpo padrão de 1 MB de uma Server Action do Next.
--
-- Aditiva e idempotente. NÃO aplicar em produção sem autorização.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comunidade',
  'comunidade',
  true,
  1572864, -- 1.5 MB (teto do bucket; o servidor valida ~950 KB)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
