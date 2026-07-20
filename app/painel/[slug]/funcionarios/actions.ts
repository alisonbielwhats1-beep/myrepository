"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusFuncionario } from "@/lib/types";
import { validarUrl } from "@/lib/validacoes";


function lerCampos(formData: FormData) {
  const dia = Number(formData.get("dia_pagamento") ?? 0);
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    cpf: String(formData.get("cpf") ?? "").trim() || null,
    foto_url: validarUrl(String(formData.get("foto_url") ?? "")),
    data_admissao: String(formData.get("data_admissao") ?? "").trim() || null,
    salario: Number(formData.get("salario") ?? 0) || 0,
    dia_pagamento: dia >= 1 && dia <= 31 ? dia : null,
    status: (formData.get("status") as StatusFuncionario) || "ativo",
  };
}

/** Gera a folha do mês atual (ignora erro silenciosamente — é best-effort). */
async function gerarFolhaMesAtual(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const competencia = new Date().toISOString().slice(0, 7) + "-01";
  await supabase.rpc("gerar_folha_do_mes", { p_competencia: competencia });
}

export async function criarFuncionario(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "funcionarios");
  const campos = lerCampos(formData);
  if (!campos.nome || !campos.cargo) {
    return { erro: "Informe ao menos nome e cargo." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("funcionarios")
    .insert({ academia_id: sessao.academia.id, ...campos });

  if (error) return { erro: `Falha ao cadastrar funcionário: ${error.message}` };

  // Salário definido -> já lança a despesa da folha deste mês.
  if (campos.salario > 0 && campos.dia_pagamento) {
    await gerarFolhaMesAtual(supabase);
  }

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarFuncionario(
  slug: string,
  funcionarioId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "funcionarios");
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

  if (campos.salario > 0 && campos.dia_pagamento) {
    await gerarFolhaMesAtual(supabase);
  }

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirFuncionario(
  slug: string,
  funcionarioId: string
): Promise<void> {
  const sessao = await requireSecao(slug, "funcionarios");
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
