"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusMatricula } from "@/lib/types";

export type EstadoAcaoAluno = { erro?: string; ok?: boolean; savedAt?: number };

function proximaMatricula(totalAtual: number): string {
  return `AL-${String(totalAtual + 1).padStart(4, "0")}`;
}

export async function criarAluno(
  slug: string,
  _estado: EstadoAcaoAluno,
  formData: FormData
): Promise<EstadoAcaoAluno> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do aluno." };

  const { count } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id);

  const { error } = await supabase.from("alunos").insert({
    academia_id: sessao.academia.id,
    nome,
    cpf: String(formData.get("cpf") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    foto_perfil_url: String(formData.get("foto_perfil_url") ?? "").trim() || null,
    status_matricula: (formData.get("status") as StatusMatricula) || "ativa",
    plano_id: String(formData.get("plano_id") ?? "").trim() || null,
    matricula_codigo: proximaMatricula(count ?? 0),
  });

  if (error) return { erro: `Falha ao cadastrar aluno: ${error.message}` };

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarAluno(
  slug: string,
  alunoId: string,
  _estado: EstadoAcaoAluno,
  formData: FormData
): Promise<EstadoAcaoAluno> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do aluno." };

  const { error } = await supabase
    .from("alunos")
    .update({
      nome,
      cpf: String(formData.get("cpf") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      foto_perfil_url:
        String(formData.get("foto_perfil_url") ?? "").trim() || null,
      status_matricula: (formData.get("status") as StatusMatricula) || "ativa",
      plano_id: String(formData.get("plano_id") ?? "").trim() || null,
    })
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar aluno: ${error.message}` };

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirAluno(slug: string, alunoId: string): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("alunos")
    .delete()
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir aluno: ${error.message}`);

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
}

export async function criarTreino(
  slug: string,
  alunoId: string,
  _estado: EstadoAcaoAluno,
  formData: FormData
): Promise<EstadoAcaoAluno> {
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
    .eq("aluno_id", alunoId);

  const { data: treino, error: erroTreino } = await supabase
    .from("treinos")
    .insert({
      academia_id: sessao.academia.id,
      aluno_id: alunoId,
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
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
    // Desfaz o treino se os exercícios falharem, para não deixar ficha vazia.
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: `Falha ao salvar exercícios: ${erroExercicios.message}` };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirTreino(slug: string, treinoId: string): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir treino: ${error.message}`);

  revalidatePath(`/painel/${slug}/alunos`);
}

// ---------------------------------------------------------------------------
// Progresso do aluno (peso, medidas, fotos ao longo do tempo)
// ---------------------------------------------------------------------------
export async function registrarProgresso(
  slug: string,
  alunoId: string,
  _estado: EstadoAcaoAluno,
  formData: FormData
): Promise<EstadoAcaoAluno> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const num = (nome: string) => {
    const v = String(formData.get(nome) ?? "").trim();
    return v ? Number(v) : null;
  };

  const { error } = await supabase.from("progresso_aluno").insert({
    academia_id: sessao.academia.id,
    aluno_id: alunoId,
    data: String(formData.get("data") ?? "").trim() || new Date().toISOString().slice(0, 10),
    peso_kg: num("peso_kg"),
    percentual_gordura: num("percentual_gordura"),
    peito_cm: num("peito_cm"),
    cintura_cm: num("cintura_cm"),
    quadril_cm: num("quadril_cm"),
    braco_cm: num("braco_cm"),
    coxa_cm: num("coxa_cm"),
    foto_url: String(formData.get("foto_url") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  });

  if (error) return { erro: `Falha ao registrar progresso: ${error.message}` };

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirProgresso(
  slug: string,
  registroId: string
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("progresso_aluno")
    .delete()
    .eq("id", registroId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir registro: ${error.message}`);

  revalidatePath(`/painel/${slug}/alunos`);
}
