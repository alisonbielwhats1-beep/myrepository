"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import {
  lerExerciciosDoFormulario,
  montarLinhasExercicio,
} from "@/lib/exercicios-treino";
import {
  enviarMidiaExercicio,
  validarArquivoMidiaExercicio,
} from "@/lib/midia-exercicios";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros-amigaveis";

/** Cria um treino da biblioteca (modelo, sem aluno), com seus exercícios. */
export async function criarTreinoBiblioteca(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  const lidos = lerExerciciosDoFormulario(formData.get("exercicios_json"));
  if ("erro" in lidos) return lidos;
  const exercicios = lidos.exercicios;

  const { count } = await supabase
    .from("treinos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null);

  const { data: treino, error: erroTreino } = await supabase
    .from("treinos")
    .insert({
      academia_id: sessao.academia.id,
      aluno_id: null,
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
      modalidade: String(formData.get("modalidade") ?? "").trim() || null,
      ordem: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (erroTreino || !treino) {
    return { erro: erroAmigavel(erroTreino, "criar o treino") };
  }

  const { error: erroExercicios } = await supabase
    .from("exercicios_treino")
    .insert(montarLinhasExercicio(treino.id, exercicios));

  if (erroExercicios) {
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: erroAmigavel(erroExercicios, "salvar os exercícios") };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Upload do clipe de demonstração (vídeo curto ou GIF) de um exercício.
 * Chamada diretamente pelo client (components/ui/VideoUpload.tsx) enquanto o
 * professor monta o treino — antes de o formulário do treino em si ser
 * enviado, por isso não recebe `treinoId`: o resultado é só a URL pública,
 * guardada no estado do ExercicioBuilder até o treino ser salvo.
 */
export async function enviarClipeExercicio(
  slug: string,
  formData: FormData
): Promise<{ url: string } | { erro: string }> {
  const sessao = await requireSecao(slug, "treinos");

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return { erro: "Selecione um vídeo ou GIF." };
  }
  const validacao = validarArquivoMidiaExercicio(arquivo);
  if ("erro" in validacao) return validacao;

  return enviarMidiaExercicio(sessao.academia.id, arquivo, validacao.extensao);
}

export async function excluirTreinoBiblioteca(
  slug: string,
  treinoId: string
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: erroAmigavel(error, "excluir o treino") };
  revalidatePath(`/painel/${slug}/treinos`);
}

/** Liga/desliga o compartilhamento público (QR) de um treino. */
export async function definirPublicoTreino(
  slug: string,
  treinoId: string,
  publico: boolean
): Promise<void> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .update({ publico })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(erroAmigavel(error, "atualizar treino"));
  revalidatePath(`/painel/${slug}/treinos`);
}
