-- =============================================================================
-- Migration 044 — QR Code real de acesso (Bloco 1, Parte A).
--
-- Problema corrigido: components/aluno/QRCodeCard.tsx gerava um payload só no
-- frontend (aluno.id + timestamp) que nenhum backend validava — decorativo.
--
-- Solução: credencial PRÓPRIA para o QR de acesso, separada do
-- `token_acesso_publico` (que abre o app inteiro do aluno, Fase 12). O QR
-- passa a codificar uma URL interna, autenticada, que a RECEPÇÃO escaneia
-- (com a câmera do próprio celular/tablet da equipe) para confirmar a entrada
-- usando a MESMA regra de decisão já existente (`decidirAcesso`, lib/utils.ts)
-- — nenhuma regra de acesso paralela é criada aqui.
--
-- Seguro rodar mais de uma vez. Não altera nem substitui a migration 037.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Token de QR — coluna nova em `alunos`, independente de `token_acesso_publico`.
--
-- UUID v4 (gen_random_uuid()), populado automaticamente para alunos já
-- existentes pelo próprio ALTER TABLE (mesmo padrão da migration 037).
-- Nunca é usado para abrir a área do aluno — só para a rota interna de
-- confirmação de acesso da recepção.
-- -----------------------------------------------------------------------------
alter table public.alunos
  add column if not exists token_qr_acesso uuid not null default gen_random_uuid();

create unique index if not exists uidx_alunos_token_qr_acesso
  on public.alunos (token_qr_acesso);

comment on column public.alunos.token_qr_acesso is
  'Credencial do QR de acesso à recepção (Bloco 1). Não abre a área do aluno — só resolve para a rota interna /painel/[slug]/recepcao/qr/[token], acessível apenas por membro autenticado da academia. Regenerável via regenerar_token_qr_acesso().';

-- -----------------------------------------------------------------------------
-- 1. Regeneração/revogação pelo painel — mesmo padrão de `regenerar_token_aluno`
-- (migration 037): só o admin autenticado da própria academia pode chamar,
-- restrito via `academia_id_atual()`. Regenerar invalida IMEDIATAMENTE o QR
-- anterior (a coluna é sobrescrita; nada mais no banco referencia o valor antigo).
-- -----------------------------------------------------------------------------
create or replace function public.regenerar_token_qr_acesso(p_aluno_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_novo_token uuid := gen_random_uuid();
  v_linhas integer;
begin
  -- Checagem de papel DENTRO da função (não só na Server Action): mesmo que
  -- alguém chame esta RPC diretamente com uma sessão autenticada não-dono da
  -- própria academia, a regra "só o dono regenera" continua valendo.
  if public.papel_do_usuario_atual() is distinct from 'dono' then
    return null;
  end if;

  update public.alunos
    set token_qr_acesso = v_novo_token
    where id = p_aluno_id
      and academia_id = public.academia_id_atual();

  get diagnostics v_linhas = row_count;

  if v_linhas = 0 then
    return null;
  end if;

  return v_novo_token;
end;
$$;

comment on function public.regenerar_token_qr_acesso(uuid) is
  'Gera um novo token_qr_acesso para o aluno (revoga o QR antigo imediatamente). Só o dono autenticado da própria academia pode chamar — verificado dentro da função, não só na camada de aplicação.';

revoke all on function public.regenerar_token_qr_acesso(uuid) from public, anon;
grant execute on function public.regenerar_token_qr_acesso(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Leitura do próprio token de QR — chamada pela Home do aluno (mesma
-- credencial pessoal token_acesso_publico + slug, nunca aluno_id) para saber
-- qual URL codificar no QR exibido. Não devolve nenhum outro dado do aluno.
-- -----------------------------------------------------------------------------
create or replace function public.obter_token_qr_aluno(p_token uuid, p_slug text)
returns uuid
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select a.token_qr_acesso
  from public.alunos a
  join public.academias ac on ac.id = a.academia_id
  where a.token_acesso_publico = p_token
    and ac.slug_url = p_slug;
$$;

comment on function public.obter_token_qr_aluno(uuid, text) is
  'Token do QR de acesso do próprio aluno, resolvido por token pessoal + slug (nunca aluno_id). Não expõe nenhum outro campo.';

revoke all on function public.obter_token_qr_aluno(uuid, text) from public;
grant execute on function public.obter_token_qr_aluno(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Novo valor de origem para `acessos_catraca.origem` — identifica que a
-- entrada veio da confirmação por QR (em vez de busca manual/Gympass/TotalPass).
--
-- ADD VALUE não é usado nesta mesma migration (mesma cautela da migration
-- 028): o valor só passa a ser referenciado em código/SQL a partir da
-- migration 045 em diante.
-- -----------------------------------------------------------------------------
alter type public.origem_acesso_enum add value if not exists 'qr';
