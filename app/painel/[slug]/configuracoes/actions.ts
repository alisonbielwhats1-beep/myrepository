"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfig = { erro?: string; ok?: boolean; savedAt?: number };

export async function atualizarAcademia(
  slug: string,
  _estado: EstadoConfig,
  formData: FormData
): Promise<EstadoConfig> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  if (!nomeFantasia) return { erro: "Informe o nome da academia." };

  const { error } = await supabase
    .from("academias")
    .update({
      nome_fantasia: nomeFantasia,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      logo_url: String(formData.get("logo_url") ?? "").trim() || null,
      cor_primaria: String(formData.get("cor_primaria") ?? "").trim() || "#adff42",
    })
    .eq("id", sessao.academia.id);

  if (error) return { erro: `Falha ao salvar: ${error.message}` };

  revalidatePath(`/painel/${slug}/configuracoes`);
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/aluno/${slug}`);
  return { ok: true, savedAt: Date.now() };
}
