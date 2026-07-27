"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ProgressoExercicio, SessaoTreino } from "@/lib/types";

export type EstadoSessao = { erro?: string; sessao?: SessaoTreino };
export type EstadoProgresso = { erro?: string; progresso?: ProgressoExercicio[] };

/**
 * Inicia (ou retoma, se já ativa) a execução de um treino pelo próprio aluno.
 * Resolve o aluno e valida o vínculo do treino INTEIRAMENTE dentro da RPC
 * `iniciar_sessao_treino` (token pessoal + slug — nunca aluno_id). Idempotente:
 * clique duplo nunca cria duas sessões (garantido por índice único no banco,
 * não só por esta camada).
 */
export async function iniciarSessaoTreino(
  slug: string,
  token: string,
  treinoId: string
): Promise<EstadoSessao> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("iniciar_sessao_treino", {
    p_token: token,
    p_slug: slug,
    p_treino_id: treinoId,
  });

  if (error || !data) {
    return { erro: "Não foi possível iniciar o treino. Tente novamente." };
  }

  revalidatePath(`/aluno/${slug}/${token}/treinos`);
  return { sessao: data as SessaoTreino };
}

/**
 * Salva o progresso realizado de uma sessão ativa. A RPC reconstrói o jsonb
 * campo a campo e rejeita qualquer exercício que não pertença ao treino da
 * sessão — esta camada só repassa o que o usuário marcou, sem confiar nele.
 * Sem revalidatePath: chamada a cada interação (marcar exercício), uma
 * revalidação completa da página a cada toque seria excessiva.
 */
export async function salvarProgressoTreino(
  slug: string,
  token: string,
  sessaoId: string,
  progresso: ProgressoExercicio[]
): Promise<EstadoProgresso> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("salvar_progresso_treino", {
    p_token: token,
    p_slug: slug,
    p_sessao_id: sessaoId,
    p_progresso: progresso,
  });

  if (error || !data) {
    return { erro: "Não foi possível salvar. Tente novamente." };
  }

  return { progresso: (data as { progresso: ProgressoExercicio[] }).progresso };
}

/**
 * Finaliza a sessão ativa. Idempotente: finalizar de novo a mesma sessão
 * (duplo clique, retry de rede) apenas devolve o estado já finalizado — a RPC
 * nunca sobrescreve `finalizado_em` de uma sessão que já não está ativa.
 */
export async function finalizarSessaoTreino(
  slug: string,
  token: string,
  sessaoId: string
): Promise<EstadoSessao> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("finalizar_sessao_treino", {
    p_token: token,
    p_slug: slug,
    p_sessao_id: sessaoId,
  });

  if (error || !data) {
    return { erro: "Não foi possível finalizar o treino. Tente novamente." };
  }

  revalidatePath(`/aluno/${slug}/${token}/treinos`);
  return { sessao: data as SessaoTreino };
}
