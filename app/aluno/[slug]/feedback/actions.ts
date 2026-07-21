"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type EstadoFeedback = { erro?: string; ok?: boolean; savedAt?: number };

/** IP real do cliente (último hop confiável / x-real-ip), p/ rate-limit. */
function ipCliente(): string {
  const h = headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const partes = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || "desconhecido";
}

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

  // Anti-spam: no máx. 5 envios a cada 5 min por IP+academia.
  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `fb:${slug}:${ipCliente()}`,
    p_max: 5,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return { erro: "Muitos envios em pouco tempo. Tente novamente em alguns minutos." };
  }

  const { error } = await supabase.rpc("registrar_feedback_publico", {
    p_slug: slug,
    p_nota: nota,
    p_categoria: String(formData.get("categoria") ?? "geral"),
    p_comentario: String(formData.get("comentario") ?? ""),
  });

  if (error) return { erro: `Não foi possível enviar: ${error.message}` };
  return { ok: true, savedAt: Date.now() };
}
