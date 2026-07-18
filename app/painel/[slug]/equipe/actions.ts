"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Papel } from "@/lib/types";

const PAPEIS_VALIDOS: Papel[] = ["dono", "gerente", "recepcao", "instrutor"];

/** Altera o papel de um membro da equipe. Só o dono pode fazer isso. */
export async function alterarPapel(
  slug: string,
  perfilId: string,
  papel: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "equipe");
  if (sessao.papel !== "dono") {
    return { erro: "Apenas o dono pode alterar papéis." };
  }
  if (!PAPEIS_VALIDOS.includes(papel as Papel)) {
    return { erro: "Papel inválido." };
  }
  if (perfilId === sessao.userId) {
    return { erro: "Você não pode alterar o seu próprio papel." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("perfis_admin")
    .update({ papel })
    .eq("id", perfilId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: `Falha ao atualizar: ${error.message}` };

  revalidatePath(`/painel/${slug}/equipe`);
  return { ok: true };
}
