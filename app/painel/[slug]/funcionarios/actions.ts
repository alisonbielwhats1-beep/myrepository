"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusFuncionario } from "@/lib/types";

export type EstadoAcaoFuncionario = { erro?: string; ok?: boolean; savedAt?: number };

function lerCampos(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    cpf: String(formData.get("cpf") ?? "").trim() || null,
    data_admissao: String(formData.get("data_admissao") ?? "").trim() || null,
    salario: Number(formData.get("salario") ?? 0) || 0,
    status: (formData.get("status") as StatusFuncionario) || "ativo",
  };
}

export async function criarFuncionario(
  slug: string,
  _estado: EstadoAcaoFuncionario,
  formData: FormData
): Promise<EstadoAcaoFuncionario> {
  const sessao = await requireSessao(slug);
  const campos = lerCampos(formData);
  if (!campos.nome || !campos.cargo) {
    return { erro: "Informe ao menos nome e cargo." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("funcionarios")
    .insert({ academia_id: sessao.academia.id, ...campos });

  if (error) return { erro: `Falha ao cadastrar funcionário: ${error.message}` };

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarFuncionario(
  slug: string,
  funcionarioId: string,
  _estado: EstadoAcaoFuncionario,
  formData: FormData
): Promise<EstadoAcaoFuncionario> {
  const sessao = await requireSessao(slug);
  const campos = lerCampos(formData);
  if (!campos.nome || !campos.cargo) {
    return { erro: "Informe ao menos nome e cargo." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("funcionarios")
    .update(campos)
    .eq("id", funcionarioId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar funcionário: ${error.message}` };

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirFuncionario(
  slug: string,
  funcionarioId: string
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("funcionarios")
    .delete()
    .eq("id", funcionarioId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir funcionário: ${error.message}`);

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}`);
}
