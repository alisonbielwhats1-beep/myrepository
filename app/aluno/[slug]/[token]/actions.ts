"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getFichaAlunoPublica } from "@/lib/data";

export type EstadoFeedback = { erro?: string; ok?: boolean; savedAt?: number };

/** IP real do cliente (último hop confiável / x-real-ip), p/ rate-limit. */
function ipCliente(): string {
  const h = headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const partes = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || "desconhecido";
}

/**
 * Registra a opinião do aluno (sem login) via RPC pública `registrar_feedback`
 * (pré-existente, fora do escopo da Fase 12 — recebe aluno_id). A ficha é
 * resolvida pelo TOKEN pessoal (nunca aluno_id vindo do formulário); só
 * depois de confirmar que o token pertence a esta academia é que usamos o
 * `aluno.id` da própria ficha para chamar a RPC existente.
 */
export async function enviarFeedback(
  slug: string,
  token: string,
  _estado: EstadoFeedback,
  formData: FormData
): Promise<EstadoFeedback> {
  const nota = Number(formData.get("nota") ?? 0);
  if (!nota || nota < 1 || nota > 5) {
    return { erro: "Escolha uma nota de 1 a 5 estrelas." };
  }

  // Garante que o token é válido e pertence a esta academia.
  const ficha = await getFichaAlunoPublica(token, slug);
  if (!ficha || ficha.academia.slug_url !== slug) {
    return { erro: "Link inválido." };
  }

  const supabase = createClient();

  // Anti-spam: no máx. 5 envios a cada 5 min por IP+token.
  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `fb:${token}:${ipCliente()}`,
    p_max: 5,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return { erro: "Muitos envios em pouco tempo. Tente novamente em alguns minutos." };
  }

  const { error } = await supabase.rpc("registrar_feedback", {
    p_aluno_id: ficha.aluno.id,
    p_nota: nota,
    p_categoria: String(formData.get("categoria") ?? "geral"),
    p_comentario: String(formData.get("comentario") ?? ""),
  });

  if (error) return { erro: `Não foi possível enviar: ${error.message}` };
  return { ok: true, savedAt: Date.now() };
}

/**
 * Abre um atendimento (migration 058).
 *
 * A RPC `abrir_atendimento` resolve aluno e academia por token+slug DENTRO do
 * banco — nenhum id vem do formulário. Mesmo rate-limit por IP+token do
 * feedback, porque este endpoint também é acessível sem login.
 */
export async function abrirAtendimento(
  slug: string,
  token: string,
  _estado: EstadoFeedback,
  formData: FormData
): Promise<EstadoFeedback> {
  const categoria = String(formData.get("categoria") ?? "").trim();
  const assunto = String(formData.get("assunto") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();

  if (!categoria) return { erro: "Escolha uma categoria." };
  if (!assunto) return { erro: "Escreva o assunto." };
  if (!mensagem) return { erro: "Escreva sua mensagem." };
  if (assunto.length > 120) return { erro: "O assunto deve ter no máximo 120 caracteres." };
  if (mensagem.length > 2000) return { erro: "A mensagem deve ter no máximo 2000 caracteres." };

  const supabase = createClient();

  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `at:${token}:${ipCliente()}`,
    p_max: 5,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return { erro: "Muitos envios em pouco tempo. Tente novamente em alguns minutos." };
  }

  const { error } = await supabase.rpc("abrir_atendimento", {
    p_token: token,
    p_slug: slug,
    p_categoria: categoria,
    p_assunto: assunto,
    p_mensagem: mensagem,
  });
  if (error) return { erro: `Não foi possível abrir a solicitação: ${error.message}` };

  revalidatePath(`/aluno/${slug}/${token}/atendimento`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Aluno responde um atendimento dele. A RPC amarra o ticket ao aluno do token:
 * mandar o id de outro aluno não encontra linha e levanta exceção no banco.
 */
export async function responderAtendimentoAluno(
  slug: string,
  token: string,
  atendimentoId: string,
  _estado: EstadoFeedback,
  formData: FormData
): Promise<EstadoFeedback> {
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  if (!mensagem) return { erro: "Escreva sua mensagem." };
  if (mensagem.length > 2000) return { erro: "A mensagem deve ter no máximo 2000 caracteres." };

  const supabase = createClient();

  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `at:${token}:${ipCliente()}`,
    p_max: 10,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return { erro: "Muitos envios em pouco tempo. Tente novamente em alguns minutos." };
  }

  const { error } = await supabase.rpc("responder_atendimento_aluno", {
    p_token: token,
    p_slug: slug,
    p_atendimento_id: atendimentoId,
    p_mensagem: mensagem,
  });
  if (error) return { erro: `Não foi possível enviar: ${error.message}` };

  revalidatePath(`/aluno/${slug}/${token}/atendimento`);
  return { ok: true, savedAt: Date.now() };
}
