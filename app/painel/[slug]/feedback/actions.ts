"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function marcarFeedbackLido(
  slug: string,
  feedbackId: string,
  lido: boolean
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("feedbacks")
    .update({ lido })
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao atualizar feedback: ${error.message}`);
  revalidatePath(`/painel/${slug}/feedback`);
}

export async function excluirFeedback(
  slug: string,
  feedbackId: string
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("feedbacks")
    .delete()
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir feedback: ${error.message}`);
  revalidatePath(`/painel/${slug}/feedback`);
}
