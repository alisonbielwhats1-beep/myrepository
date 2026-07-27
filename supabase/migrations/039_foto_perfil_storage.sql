-- =============================================================================
-- Migration 039 — Foto de perfil do aluno via Supabase Storage
--
-- Antes desta migration, `alunos.foto_perfil_url` só aceitava uma URL https://
-- colada manualmente (admin) ou convertida no cliente para um data: URL
-- gigante embutido no formulário (Fase 12 já previa isso: ver comentário da
-- migration 037, seção 4 — "sem upload de arquivo/storage novo, fora do
-- escopo desta fase").
--
-- Esta migration cria APENAS o bucket usado pelo upload real (Server Actions
-- em lib/fotos-perfil.ts). Nada mais.
--
-- POR QUE NÃO HÁ POLICY AQUI:
--   `storage.objects` é uma tabela gerenciada pelo Supabase e pertence ao
--   papel `supabase_storage_admin`. Qualquer ALTER TABLE / ENABLE RLS /
--   CREATE POLICY / GRANT sobre ela falha com "42501: must be owner of table
--   objects" quando a migration roda com o usuário comum do projeto — foi
--   exatamente assim que a primeira versão desta migration quebrou.
--
--   E nada disso é necessário: o RLS de `storage.objects` já vem habilitado
--   pelo Supabase e nega por padrão. Sem nenhuma policy para `anon` /
--   `authenticated`, ninguém grava neste bucket pelo cliente — que é
--   precisamente a garantia que queremos (nunca upload anônimo direto no
--   bucket). Upload, substituição e remoção acontecem SÓ pela Server Action,
--   com a `service_role`, que ignora RLS por design e só é acionada depois de
--   validar quem está autorizado: token+slug na área do aluno sem login,
--   sessão+seção no painel.
--
--   A leitura pública das fotos também não depende de policy: `public = true`
--   é o que habilita o caminho `/storage/v1/object/public/fotos-perfil/...`,
--   usado para exibir a foto na área do aluno, no painel, na ficha e no
--   cartão da Recepção sem exigir autenticação para carregar uma imagem.
--
-- file_size_limit = 1 MB é a última barreira, não a primeira: a foto original
-- (até 5 MB) é recortada para 512x512 e comprimida no NAVEGADOR
-- (lib/imagem-cliente.ts), que recusa qualquer resultado acima de 800 KB; o
-- servidor revalida em 900 KB (lib/fotos-perfil.ts). O teto do bucket fica
-- logo acima disso, e o corpo da Server Action segue no padrão do Next
-- (1 MB) — nunca ampliado para caber o arquivo original.
--
-- Aditiva e idempotente. Nenhum dado existente é alterado.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil',
  'fotos-perfil',
  true,
  1048576, -- 1 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
