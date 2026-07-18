"use server";

import { createClient } from "@/lib/supabase/server";
import { getFichaAlunoPublica } from "@/lib/data";

export type EstadoFeedback = { erro?: string; ok?: boolean; savedAt?: number };

/**
 * Registra a opinião do aluno (sem login) via RPC pública `registrar_feedback`,
 * que resolve a academia a partir do aluno. Valida antes que o aluno pertence
 * à academia da URL (defesa contra link adulterado).
 */
export async function enviarFeedback(
  slug: string,
  alunoId: string,
  _estado: EstadoFeedback,
  formData: FormData
): Promise<EstadoFeedback> {
  const nota = Number(formData.get("nota") ?? 0);
  if (!nota || nota < 1 || nota > 5) {
    return { erro: "Escolha uma nota de 1 a 5 estrelas." };
  }

  // Garante que o aluno é válido e pertence a esta academia.
  const ficha = await getFichaAlunoPublica(alunoId);
  if (!ficha || ficha.academia.slug_url !== slug) {
    return { erro: "Link inválido." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("registrar_feedback", {
    p_aluno_id: alunoId,
    p_nota: nota,
    p_categoria: String(formData.get("categoria") ?? "geral"),
    p_comentario: String(formData.get("comentario") ?? ""),
  });

  if (error) return { erro: `Não foi possível enviar: ${error.message}` };
  return { ok: true, savedAt: Date.now() };
}
