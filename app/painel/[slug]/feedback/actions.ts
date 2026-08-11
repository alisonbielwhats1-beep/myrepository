"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EstadoAcao, StatusFeedback } from "@/lib/types";
import { erroAmigavel } from "@/lib/erros-amigaveis";

const STATUS_VALIDOS: StatusFeedback[] = [
  "novo",
  "em_analise",
  "respondido",
  "concluido",
];

/**
 * Responde um feedback. Feedback NÃO é chat: é uma resposta só, que substitui
 * a anterior se a academia reescrever. Conversa com ida e volta é Atendimento.
 *
 * O status vai para 'respondido' automaticamente, a não ser que já esteja
 * 'concluido' — nesse caso quem concluiu decidiu encerrar, e reabrir sozinho
 * seria desfazer uma decisão do usuário.
 */
export async function responderFeedback(
  slug: string,
  feedbackId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "feedback");

  const resposta = String(formData.get("resposta") ?? "").trim();
  if (!resposta) return { erro: "Escreva a resposta antes de salvar." };
  if (resposta.length > 2000) {
    return { erro: "A resposta deve ter no máximo 2000 caracteres." };
  }

  const supabase = createClient();

  const { data: atual, error: erroLeitura } = await supabase
    .from("feedbacks")
    .select("status")
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (erroLeitura) return { erro: erroAmigavel(erroLeitura, "abrir o feedback") };
  if (!atual) return { erro: "Feedback não encontrado." };

  const { error } = await supabase
    .from("feedbacks")
    .update({
      resposta,
      respondido_em: new Date().toISOString(),
      respondido_por: sessao.userId,
      respondido_por_nome: sessao.nome,
      status: atual.status === "concluido" ? "concluido" : "respondido",
      lido: true,
    })
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: erroAmigavel(error, "responder") };

  revalidatePath(`/painel/${slug}/feedback`);
  return { ok: true, savedAt: Date.now(), id: feedbackId };
}

/** Move o feedback na fila de tratamento, sem tocar na resposta. */
export async function atualizarStatusFeedback(
  slug: string,
  feedbackId: string,
  status: StatusFeedback
): Promise<void> {
  const sessao = await requireSecao(slug, "feedback");
  if (!STATUS_VALIDOS.includes(status)) {
    throw new Error("Status inválido.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("feedbacks")
    .update({ status })
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(erroAmigavel(error, "atualizar o status"));
  revalidatePath(`/painel/${slug}/feedback`);
}

export async function marcarFeedbackLido(
  slug: string,
  feedbackId: string,
  lido: boolean
): Promise<void> {
  const sessao = await requireSecao(slug, "feedback");
  const supabase = createClient();
  const { error } = await supabase
    .from("feedbacks")
    .update({ lido })
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(erroAmigavel(error, "atualizar feedback"));
  revalidatePath(`/painel/${slug}/feedback`);
}

export async function excluirFeedback(
  slug: string,
  feedbackId: string
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "feedback");
  const supabase = createClient();
  const { error } = await supabase
    .from("feedbacks")
    .delete()
    .eq("id", feedbackId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: erroAmigavel(error, "excluir o feedback") };
  revalidatePath(`/painel/${slug}/feedback`);
}
