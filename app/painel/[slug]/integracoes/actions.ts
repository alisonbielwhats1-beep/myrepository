"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EstadoAcao } from "@/lib/types";
import { LABELS_STATUS_INTEGRACAO, type StatusIntegracao } from "@/lib/types";
import { erroAmigavel } from "@/lib/erros-servidor";

/** Gera um novo segredo para o webhook da plataforma.
 *  Registra auditoria com usuário, academia e data/hora — nunca o valor do segredo. */
export async function rotarSecretIntegracao(
  slug: string,
  plataforma: "gympass" | "totalpass"
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  const supabase = createClient();

  const campo =
    plataforma === "gympass"
      ? "gympass_webhook_secret"
      : "totalpass_webhook_secret";

  const novoSecret = randomUUID();

  const { error } = await supabase
    .from("academias")
    .update({ [campo]: novoSecret })
    .eq("id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "gerar uma nova chave") };

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "rotacao_secret",
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

/** Atualiza o status de integração de uma plataforma.
 *  Registra auditoria com status anterior e novo — nunca o valor do segredo. */
export async function atualizarStatusIntegracao(
  slug: string,
  plataforma: "gympass" | "totalpass",
  novoStatus: StatusIntegracao
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  if (!Object.keys(LABELS_STATUS_INTEGRACAO).includes(novoStatus)) {
    return { erro: "Status inválido." };
  }

  const supabase = createClient();
  const { data: atual } = await supabase
    .from("academias")
    .select("gympass_status, totalpass_status")
    .eq("id", sessao.academia.id)
    .maybeSingle();

  const statusAnterior =
    plataforma === "gympass"
      ? atual?.gympass_status
      : atual?.totalpass_status;

  const campoStatus =
    plataforma === "gympass" ? "gympass_status" : "totalpass_status";

  const { error } = await supabase
    .from("academias")
    .update({ [campoStatus]: novoStatus })
    .eq("id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "atualizar o status") };

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "atualizar_status",
    status_anterior: statusAnterior ?? null,
    status_novo: novoStatus,
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Define o valor estimado por check-in (e se está ativo) de uma plataforma
 * parceira (migration 049). `valorReais` null grava "não configurado" —
 * nunca inventa um padrão. A escrita real acontece na RPC
 * `definir_valor_repasse_parceiro` (valida papel e faixa por dentro); esta
 * Server Action só traduz a entrada e registra a auditoria (mesmo padrão de
 * rotarSecretIntegracao/atualizarStatusIntegracao, que já usam
 * `log_integracoes` para ações de integração).
 */
export async function definirRepasseParceiro(
  slug: string,
  plataforma: "gympass" | "totalpass",
  valorReais: number | null,
  ativo: boolean
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  if (valorReais !== null && (!Number.isFinite(valorReais) || valorReais < 0 || valorReais > 500)) {
    return { erro: "Valor inválido. Use um número entre 0 e 500." };
  }

  const supabase = createClient();

  const { data: anterior } = await supabase
    .from("config_repasse_parceiros")
    .select("valor_por_checkin")
    .eq("plataforma", plataforma)
    .maybeSingle();

  const { data: resultado, error } = await supabase.rpc(
    "definir_valor_repasse_parceiro",
    { p_plataforma: plataforma, p_valor: valorReais, p_ativo: ativo }
  );

  if (error) return { erro: await erroAmigavel(error, "salvar") };
  if (!resultado || resultado.length === 0) {
    return { erro: "Você não tem permissão para configurar o repasse." };
  }

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "definir_valor_repasse",
    valor_anterior: anterior?.valor_por_checkin ?? null,
    valor_novo: valorReais,
    ativo_novo: ativo,
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/financeiro`);
  return { ok: true, savedAt: Date.now() };
}
