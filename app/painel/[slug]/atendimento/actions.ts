"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EstadoAcao, StatusAtendimento } from "@/lib/types";

/**
 * Atendimento pelo lado da ACADEMIA (migration 058).
 *
 * Toda action revalida o papel com `requireSecao(slug, "atendimento")` e todo
 * write filtra por `academia_id` além do id do ticket — o mesmo cinto e
 * suspensório do resto do painel, por cima da RLS.
 */

const STATUS_VALIDOS: StatusAtendimento[] = [
  "novo",
  "em_atendimento",
  "aguardando_aluno",
  "resolvido",
];

/** Confirma que o ticket é da academia da sessão antes de qualquer escrita. */
async function ticketDaAcademia(
  supabase: ReturnType<typeof createClient>,
  atendimentoId: string,
  academiaId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("atendimentos")
    .select("id")
    .eq("id", atendimentoId)
    .eq("academia_id", academiaId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Acrescenta uma resposta da academia ao histórico e devolve a bola ao aluno
 * (status vira 'aguardando_aluno'). Ticket já resolvido continua resolvido:
 * responder não reabre sozinho.
 */
export async function responderAtendimento(
  slug: string,
  atendimentoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "atendimento");

  const mensagem = String(formData.get("mensagem") ?? "").trim();
  if (!mensagem) return { erro: "Escreva a mensagem antes de enviar." };
  if (mensagem.length > 2000) {
    return { erro: "A mensagem deve ter no máximo 2000 caracteres." };
  }

  const supabase = createClient();
  if (!(await ticketDaAcademia(supabase, atendimentoId, sessao.academia.id))) {
    return { erro: "Atendimento não encontrado." };
  }

  const { error } = await supabase.from("atendimento_mensagens").insert({
    academia_id: sessao.academia.id,
    atendimento_id: atendimentoId,
    autor_tipo: "academia",
    autor_id: sessao.userId,
    autor_nome: sessao.nome,
    mensagem,
  });
  if (error) return { erro: `Falha ao enviar a resposta: ${error.message}` };

  const { error: erroStatus } = await supabase
    .from("atendimentos")
    .update({ status: "aguardando_aluno" })
    .eq("id", atendimentoId)
    .eq("academia_id", sessao.academia.id)
    .neq("status", "resolvido");
  if (erroStatus) {
    // A mensagem já foi gravada; o status é secundário e o painel deixa mudar
    // à mão. Falhar a action aqui faria o usuário reenviar e duplicar a resposta.
    console.error("[atendimento] falha ao atualizar status:", erroStatus.message);
  }

  revalidatePath(`/painel/${slug}/atendimento`);
  return { ok: true, savedAt: Date.now(), id: atendimentoId };
}

/** Muda o status do ticket sem escrever mensagem. */
export async function atualizarStatusAtendimento(
  slug: string,
  atendimentoId: string,
  status: StatusAtendimento
): Promise<void> {
  const sessao = await requireSecao(slug, "atendimento");
  if (!STATUS_VALIDOS.includes(status)) throw new Error("Status inválido.");

  const supabase = createClient();
  const { error } = await supabase
    .from("atendimentos")
    .update({ status })
    .eq("id", atendimentoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao atualizar status: ${error.message}`);
  revalidatePath(`/painel/${slug}/atendimento`);
}
