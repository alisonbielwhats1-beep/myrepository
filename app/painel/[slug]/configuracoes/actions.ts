"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { validarUrl } from "@/lib/validacoes";

export async function atualizarAcademia(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "configuracoes");
  const supabase = createClient();

  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  if (!nomeFantasia) return { erro: "Informe o nome da academia." };

  // Meta de faturamento: aceita formato "1.234,56" ou "1234.56"; nunca negativa.
  const metaRaw = String(formData.get("meta_faturamento_mensal") ?? "").trim();
  const metaNum = metaRaw
    ? Number(metaRaw.replace(/\./g, "").replace(",", "."))
    : 0;
  const meta = Number.isFinite(metaNum) && metaNum > 0 ? metaNum : 0;

  const { error } = await supabase
    .from("academias")
    .update({
      nome_fantasia: nomeFantasia,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      logo_url: validarUrl(String(formData.get("logo_url") ?? "")),
      cor_primaria: String(formData.get("cor_primaria") ?? "").trim() || "#adff42",
      meta_faturamento_mensal: meta,
    })
    .eq("id", sessao.academia.id);

  if (error) return { erro: `Falha ao salvar: ${error.message}` };

  revalidatePath(`/painel/${slug}/configuracoes`);
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/aluno/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

/** Gera um novo segredo para o webhook de uma plataforma parceira. */
export async function rotarSecretWebhook(
  slug: string,
  plataforma: "gympass" | "totalpass"
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "configuracoes");
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

  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}
