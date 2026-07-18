"use server";

import { createClient } from "@/lib/supabase/server";

export type EstadoFeedback = { erro?: string; ok?: boolean; savedAt?: number };

/** Feedback anônimo por slug (QR fixo da academia), via RPC pública. */
export async function enviarFeedbackPublico(
  slug: string,
  _estado: EstadoFeedback,
  formData: FormData
): Promise<EstadoFeedback> {
  const nota = Number(formData.get("nota") ?? 0);
  if (!nota || nota < 1 || nota > 5) {
    return { erro: "Escolha uma nota de 1 a 5 estrelas." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("registrar_feedback_publico", {
    p_slug: slug,
    p_nota: nota,
    p_categoria: String(formData.get("categoria") ?? "geral"),
    p_comentario: String(formData.get("comentario") ?? ""),
  });

  if (error) return { erro: `Não foi possível enviar: ${error.message}` };
  return { ok: true, savedAt: Date.now() };
}
