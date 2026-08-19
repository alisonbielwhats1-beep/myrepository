-- =============================================================================
-- Migration 084 — Redes sociais da academia (App do aluno — Comunidade)
--
-- CONTEXTO
--   A aba "Comunidade" do app do aluno mostra um bloco da própria academia com
--   Instagram / WhatsApp / Site (e outras redes). O WhatsApp já existe em
--   `academias.whatsapp`; faltavam os demais links. São específicos do tenant e
--   NUNCA se misturam entre academias — cada aluno só vê os da sua.
--
--   Colunas de texto simples na tabela `academias` (mesma natureza de
--   `whatsapp`/`endereco`). A edição é no painel (papel dono, seção
--   Configurações) e a leitura pública sai pela RPC `obter_academia_publica`,
--   que o mini-site e o app do aluno já consomem.
--
-- Idempotente. NÃO aplicar em produção sem autorização.
-- =============================================================================

alter table public.academias
  add column if not exists instagram text,
  add column if not exists site      text,
  add column if not exists facebook  text,
  add column if not exists tiktok    text;

comment on column public.academias.instagram is
  '@ ou URL do Instagram da academia (exibido na Comunidade do app do aluno). Específico do tenant.';
comment on column public.academias.site is
  'URL do site da academia.';
comment on column public.academias.facebook is
  'URL/nome do Facebook da academia.';
comment on column public.academias.tiktok is
  '@ ou URL do TikTok da academia.';

-- -----------------------------------------------------------------------------
-- obter_academia_publica passa a incluir as redes sociais. Corpo reproduzido
-- inteiro (create or replace substitui a função) a partir da migration 003,
-- somando apenas os quatro campos novos.
-- -----------------------------------------------------------------------------
create or replace function public.obter_academia_publica(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', id,
    'nome_fantasia', nome_fantasia,
    'slug_url', slug_url,
    'cor_primaria', cor_primaria,
    'logo_url', logo_url,
    'endereco', endereco,
    'whatsapp', whatsapp,
    'instagram', instagram,
    'site', site,
    'facebook', facebook,
    'tiktok', tiktok
  )
  from public.academias where slug_url = p_slug;
$$;

grant execute on function public.obter_academia_publica(text) to anon, authenticated;
