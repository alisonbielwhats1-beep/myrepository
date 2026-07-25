"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EstadoAcao } from "@/lib/types";
import { LABELS_STATUS_INTEGRACAO, type StatusIntegracao } from "@/lib/types";

/** Gera um novo segredo para o webhook da plataforma.
 *  Registra auditoria com usuário, academia e data/hora — nunca o valor do segredo. */
export async function rotarSecretIntegracao(
  slug: string,
  plataforma: "gympass" | "totalpass"
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");
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

  if (error) return { erro: `Falha ao rotacionar: ${error.message}` };

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

  if (error) return { erro: `Falha ao atualizar status: ${error.message}` };

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
