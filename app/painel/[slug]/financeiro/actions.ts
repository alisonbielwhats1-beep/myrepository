"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoriaDespesa, StatusPagamento, TipoReceita } from "@/lib/types";

export type EstadoAcaoFinanceiro = { erro?: string; ok?: boolean; savedAt?: number };

/**
 * Gera a folha salarial (despesas de 'Salários') de um mês. `competencia` é
 * uma data ISO qualquer dentro do mês desejado; usa a academia do admin.
 */
export async function gerarFolha(
  slug: string,
  competencia: string
): Promise<{ erro?: string; criadas?: number }> {
  await requireSessao(slug);
  const supabase = createClient();
  const comp = /^\d{4}-\d{2}-\d{2}$/.test(competencia)
    ? competencia
    : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("gerar_folha_do_mes", {
    p_competencia: comp,
  });
  if (error) return { erro: `Falha ao gerar folha: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { criadas: (data as number) ?? 0 };
}

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
function lerReceita(formData: FormData) {
  return {
    tipo: (formData.get("tipo") as TipoReceita) || "outra",
    descricao: String(formData.get("descricao") ?? "").trim(),
    valor: Number(formData.get("valor") ?? 0) || 0,
    data: String(formData.get("data") ?? "").trim(),
    status: (formData.get("status") as StatusPagamento) || "pendente",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    aluno_id: String(formData.get("aluno_id") ?? "").trim() || null,
  };
}

export async function criarReceita(
  slug: string,
  _estado: EstadoAcaoFinanceiro,
  formData: FormData
): Promise<EstadoAcaoFinanceiro> {
  const sessao = await requireSessao(slug);
  const campos = lerReceita(formData);
  if (!campos.descricao || !campos.data) {
    return { erro: "Informe descrição e data." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("receitas")
    .insert({ academia_id: sessao.academia.id, ...campos });

  if (error) return { erro: `Falha ao lançar receita: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarReceita(
  slug: string,
  receitaId: string,
  _estado: EstadoAcaoFinanceiro,
  formData: FormData
): Promise<EstadoAcaoFinanceiro> {
  const sessao = await requireSessao(slug);
  const campos = lerReceita(formData);
  if (!campos.descricao || !campos.data) {
    return { erro: "Informe descrição e data." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("receitas")
    .update(campos)
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar receita: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirReceita(slug: string, receitaId: string): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("receitas")
    .delete()
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir receita: ${error.message}`);
  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
}

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------
function lerDespesa(formData: FormData) {
  return {
    descricao: String(formData.get("descricao") ?? "").trim(),
    categoria: (formData.get("categoria") as CategoriaDespesa) || "outros",
    valor: Number(formData.get("valor") ?? 0) || 0,
    data: String(formData.get("data") ?? "").trim(),
    status: (formData.get("status") as StatusPagamento) || "pendente",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}

export async function criarDespesa(
  slug: string,
  _estado: EstadoAcaoFinanceiro,
  formData: FormData
): Promise<EstadoAcaoFinanceiro> {
  const sessao = await requireSessao(slug);
  const campos = lerDespesa(formData);
  if (!campos.descricao || !campos.data) {
    return { erro: "Informe descrição e data." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("despesas")
    .insert({ academia_id: sessao.academia.id, ...campos });

  if (error) return { erro: `Falha ao lançar despesa: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarDespesa(
  slug: string,
  despesaId: string,
  _estado: EstadoAcaoFinanceiro,
  formData: FormData
): Promise<EstadoAcaoFinanceiro> {
  const sessao = await requireSessao(slug);
  const campos = lerDespesa(formData);
  if (!campos.descricao || !campos.data) {
    return { erro: "Informe descrição e data." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("despesas")
    .update(campos)
    .eq("id", despesaId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar despesa: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirDespesa(slug: string, despesaId: string): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("despesas")
    .delete()
    .eq("id", despesaId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir despesa: ${error.message}`);
  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
}
