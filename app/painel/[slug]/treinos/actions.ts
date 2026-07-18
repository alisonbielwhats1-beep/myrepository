"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EstadoTreino = { erro?: string; ok?: boolean; savedAt?: number };

/** Cria um treino da biblioteca (modelo, sem aluno), com seus exercícios. */
export async function criarTreinoBiblioteca(
  slug: string,
  _estado: EstadoTreino,
  formData: FormData
): Promise<EstadoTreino> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  let exercicios: Array<{
    nome_exercicio: string;
    series: number;
    repeticoes: string;
    carga_kg: number;
    imagem_demonstracao_url: string;
    video_demonstracao_url: string;
  }> = [];
  try {
    exercicios = JSON.parse(String(formData.get("exercicios_json") ?? "[]"));
  } catch {
    return { erro: "Lista de exercícios inválida." };
  }
  exercicios = exercicios.filter((e) => e.nome_exercicio?.trim());
  if (exercicios.length === 0) {
    return { erro: "Adicione ao menos um exercício com nome." };
  }

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
    return { erro: `Falha ao criar treino: ${erroTreino?.message ?? ""}` };
  }

  const { error: erroExercicios } = await supabase
    .from("exercicios_treino")
    .insert(
      exercicios.map((ex, idx) => ({
        treino_id: treino.id,
        nome_exercicio: ex.nome_exercicio.trim(),
        series: Number(ex.series) || 0,
        repeticoes: ex.repeticoes || "0",
        carga_kg: Number(ex.carga_kg) || 0,
        imagem_demonstracao_url: ex.imagem_demonstracao_url?.trim() || null,
        video_demonstracao_url: ex.video_demonstracao_url?.trim() || null,
        ordem: idx + 1,
      }))
    );

  if (erroExercicios) {
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: `Falha ao salvar exercícios: ${erroExercicios.message}` };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirTreinoBiblioteca(
  slug: string,
  treinoId: string
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir treino: ${error.message}`);
  revalidatePath(`/painel/${slug}/treinos`);
}

/** Liga/desliga o compartilhamento público (QR) de um treino. */
export async function definirPublicoTreino(
  slug: string,
  treinoId: string,
  publico: boolean
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .update({ publico })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao atualizar treino: ${error.message}`);
  revalidatePath(`/painel/${slug}/treinos`);
}
