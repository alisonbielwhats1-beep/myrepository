"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIAS_DESPESA,
  CategoriaDespesa,
  TIPOS_RECEITA,
  StatusPagamento,
  TipoReceita,
} from "@/lib/types";
import { hojeSaoPaulo } from "@/lib/utils";


/**
 * Gera a folha salarial (despesas de 'Salários') de um mês. `competencia` é
 * uma data ISO qualquer dentro do mês desejado; usa a academia do admin.
 */
export async function gerarFolha(
  slug: string,
  competencia: string
): Promise<{ erro?: string; criadas?: number }> {
  await requireSecao(slug, "financeiro");
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

/**
 * Gera as mensalidades pendentes do mês para todos os alunos ativos com plano,
 * respeitando a recorrência de cada plano. Idempotente.
 */
export async function gerarMensalidades(
  slug: string,
  competencia: string
): Promise<{ erro?: string; criadas?: number }> {
  await requireSecao(slug, "financeiro");
  const supabase = createClient();
  const comp = /^\d{4}-\d{2}-\d{2}$/.test(competencia)
    ? competencia
    : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("gerar_mensalidades_do_mes", {
    p_competencia: comp,
  });
  if (error) return { erro: `Falha ao gerar mensalidades: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { criadas: (data as number) ?? 0 };
}

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
function lerReceita(formData: FormData) {
  const tipo = (formData.get("tipo") as TipoReceita) || "outra";
  const descricaoRaw = String(formData.get("descricao") ?? "").trim();
  const status = (formData.get("status") as StatusPagamento) || "pendente";
  const formaPagamento = String(formData.get("forma_pagamento") ?? "").trim();
  const dataPagamento = String(formData.get("data_pagamento") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  return {
    tipo,
    descricao: descricaoRaw || TIPOS_RECEITA.find((t) => t.value === tipo)?.label || tipo,
    valor: Number(formData.get("valor") ?? 0) || 0,
    data,
    status,
    // Só faz sentido guardar pagamento em receita paga; se voltar a pendente
    // ou for cancelada, os campos são limpos.
    data_pagamento: status === "pago" ? dataPagamento || data : null,
    forma_pagamento: status === "pago" ? formaPagamento || null : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    aluno_id: String(formData.get("aluno_id") ?? "").trim() || null,
  };
}

export async function criarReceita(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  const campos = lerReceita(formData);
  if (!campos.data) return { erro: "Informe a data." };
  if (campos.valor <= 0) return { erro: "O valor deve ser maior que zero." };

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
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  const campos = lerReceita(formData);
  if (!campos.data) return { erro: "Informe a data." };
  if (campos.valor <= 0) return { erro: "O valor deve ser maior que zero." };

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

/**
 * Marca uma mensalidade como paga sem exigir todos os campos do formulário.
 * Registra também quando e como foi pago — `data` continua sendo o vencimento,
 * intocado, para não perder a informação de atraso.
 */
export async function marcarPago(
  slug: string,
  receitaId: string,
  formaPagamento?: string
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  const supabase = createClient();

  const { error } = await supabase
    .from("receitas")
    .update({
      status: "pago",
      // Data do pagamento = hoje no fuso da academia (helper central).
      data_pagamento: hojeSaoPaulo(),
      forma_pagamento: formaPagamento?.trim() || null,
    })
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: `Falha ao marcar como pago: ${error.message}` };
  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Cancela uma cobrança individualmente, preservando o histórico.
 * - Status → "cancelada" (não exclui o registro).
 * - Motivo + timestamp SP + responsável são appended em observacoes.
 * - Cobranças canceladas são ignoradas nos cálculos financeiros.
 */
export async function cancelarCobranca(
  slug: string,
  receitaId: string,
  motivo: string
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  if (!motivo.trim()) return { erro: "Informe o motivo do cancelamento." };

  const supabase = createClient();

  const { data: receita, error: errLeitura } = await supabase
    .from("receitas")
    .select("observacoes, status")
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  if (errLeitura || !receita) return { erro: "Cobrança não encontrada." };
  if (receita.status === "cancelada") return { erro: "Cobrança já cancelada." };

  const timestamp = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const novoObservacoes = [
    receita.observacoes,
    `[Cancelada em ${timestamp} por ${sessao.nome}] ${motivo.trim()}`,
  ].filter(Boolean).join("\n");

  const { error } = await supabase
    .from("receitas")
    .update({ status: "cancelada", observacoes: novoObservacoes })
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao cancelar: ${error.message}` };

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}/financeiro`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirReceita(slug: string, receitaId: string): Promise<void> {
  const sessao = await requireSecao(slug, "financeiro");
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
  const categoria = (formData.get("categoria") as CategoriaDespesa) || "outros";
  const descricaoRaw = String(formData.get("descricao") ?? "").trim();
  return {
    descricao: descricaoRaw || CATEGORIAS_DESPESA.find((c) => c.value === categoria)?.label || categoria,
    categoria,
    valor: Number(formData.get("valor") ?? 0) || 0,
    data: String(formData.get("data") ?? "").trim(),
    status: (formData.get("status") as StatusPagamento) || "pendente",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}

export async function criarDespesa(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  const campos = lerDespesa(formData);
  if (!campos.data) return { erro: "Informe a data." };
  if (campos.valor <= 0) return { erro: "O valor deve ser maior que zero." };

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
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  const campos = lerDespesa(formData);
  if (!campos.data) return { erro: "Informe a data." };
  if (campos.valor <= 0) return { erro: "O valor deve ser maior que zero." };

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
  const sessao = await requireSecao(slug, "financeiro");
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
