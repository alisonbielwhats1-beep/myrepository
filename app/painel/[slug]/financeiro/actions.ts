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

/**
 * Define o saldo inicial e a data de corte do saldo registrado.
 *
 * requireSecao(slug, "financeiro") já restringe ao papel "dono" — nenhum outro
 * papel tem a seção financeiro em PERMISSOES. A academia vem sempre da sessão;
 * nada de academia_id vindo do formulário.
 */
export async function definirSaldoInicial(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");

  const brutoValor = String(formData.get("saldo_inicial") ?? "").trim();
  const valor = brutoValor
    ? Number(brutoValor.replace(/\./g, "").replace(",", "."))
    : 0;
  if (!Number.isFinite(valor)) return { erro: "Informe um saldo inicial válido." };
  if (Math.abs(valor) > 99_999_999) return { erro: "Saldo inicial fora da faixa." };

  const brutoData = String(formData.get("data_saldo_inicial") ?? "").trim();
  if (brutoData && !/^\d{4}-\d{2}-\d{2}$/.test(brutoData)) {
    return { erro: "Data do saldo inicial inválida." };
  }
  if (brutoData && brutoData > hojeSaoPaulo()) {
    return { erro: "A data do saldo inicial não pode estar no futuro." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("academias")
    .update({
      saldo_inicial: Math.round(valor * 100) / 100,
      data_saldo_inicial: brutoData || null,
    })
    .eq("id", sessao.academia.id);

  if (error) return { erro: `Falha ao salvar saldo inicial: ${error.message}` };

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
/**
 * Competência de um lançamento novo: a informada no formulário (YYYY-MM), ou o
 * mês da própria data. Sempre retorna o dia 1, que é como a coluna é gravada.
 * Nunca retorna null — a partir da Fase 7A todo lançamento nasce com competência.
 */
function competenciaDoFormulario(formData: FormData, data: string): string {
  const informada = String(formData.get("competencia") ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(informada)) return `${informada}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(informada)) return `${informada.slice(0, 7)}-01`;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeSaoPaulo();
  return `${base.slice(0, 7)}-01`;
}

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
    // Competência sempre preenchida: informada no formulário ou o mês da data
    // do lançamento. O fallback do DRE existe só para o histórico antigo.
    competencia: competenciaDoFormulario(formData, data),
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

  // UPDATE condicional em uma única ida ao banco: a condição status <> 'pago'
  // é avaliada pelo Postgres, então duas requisições simultâneas não disputam.
  // A segunda simplesmente não encontra linha e a primeira data_pagamento /
  // forma_pagamento — o registro do que de fato aconteceu — fica preservada.
  const { data: alteradas, error } = await supabase
    .from("receitas")
    .update({
      status: "pago",
      data_pagamento: hojeSaoPaulo(),
      forma_pagamento: formaPagamento?.trim() || null,
    })
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id)
    .neq("status", "pago")
    .select("id");

  if (error) return { erro: `Falha ao marcar como pago: ${error.message}` };

  // Zero linhas: ou já estava paga (idempotente, sucesso) ou não existe / é de
  // outra academia (erro genérico, sem revelar qual dos dois é o caso).
  if (!alteradas || alteradas.length === 0) {
    const { count } = await supabase
      .from("receitas")
      .select("id", { count: "exact", head: true })
      .eq("id", receitaId)
      .eq("academia_id", sessao.academia.id);

    if (!count) return { erro: "Cobrança não encontrada." };
    return { ok: true, savedAt: Date.now() };
  }
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
  const status = (formData.get("status") as StatusPagamento) || "pendente";
  const formaPagamento = String(formData.get("forma_pagamento") ?? "").trim();
  const dataPagamento = String(formData.get("data_pagamento") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  return {
    descricao: descricaoRaw || CATEGORIAS_DESPESA.find((c) => c.value === categoria)?.label || categoria,
    categoria,
    valor: Number(formData.get("valor") ?? 0) || 0,
    data,
    status,
    competencia: competenciaDoFormulario(formData, data),
    // Simetria com receitas: pagamento só faz sentido em despesa paga.
    data_pagamento: status === "pago" ? dataPagamento || data : null,
    forma_pagamento: status === "pago" ? formaPagamento || null : null,
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
