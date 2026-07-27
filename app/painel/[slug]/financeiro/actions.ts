"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao, requireSessao } from "@/lib/auth";
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
export type PreviaCobrancas = {
  competencia: string;
  /** Alunos ativos cujo plano tem cobrança recorrente e valor > 0. */
  comPlanoAtivo: number;
  /** Desses, quantos já têm cobrança lançada nesta competência. */
  jaLancados: number;
  erro?: string;
};

/**
 * Prévia para a confirmação do botão "Gerar cobranças mensais".
 *
 * Conta os alunos que a RPC considera (ativo + plano com cobrança recorrente e
 * valor > 0) e quantos já têm mensalidade nesta competência. Não replica a
 * regra de ciclo da RPC — planos trimestrais/semestrais só são cobrados no mês
 * em que o ciclo fecha, então este número é um teto, não uma promessa.
 */
export async function previewCobrancasMensais(
  slug: string,
  competencia: string
): Promise<PreviaCobrancas> {
  const sessao = await requireSecao(slug, "financeiro");
  const supabase = createClient();
  const comp = /^\d{4}-\d{2}-\d{2}$/.test(competencia)
    ? competencia
    : `${hojeSaoPaulo().slice(0, 7)}-01`;

  const { data: alunos, error } = await supabase
    .from("alunos")
    .select("id, plano:planos!inner(valor_mensal, cobranca_recorrente)")
    .eq("academia_id", sessao.academia.id)
    .eq("status_matricula", "ativa")
    .eq("planos.cobranca_recorrente", true)
    .gt("planos.valor_mensal", 0);

  if (error) {
    return { competencia: comp, comPlanoAtivo: 0, jaLancados: 0, erro: error.message };
  }

  const ids = (alunos ?? []).map((a) => a.id);
  let jaLancados = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("receitas")
      .select("id", { count: "exact", head: true })
      .eq("academia_id", sessao.academia.id)
      .eq("tipo", "mensalidade")
      .eq("competencia", comp)
      .in("aluno_id", ids);
    jaLancados = count ?? 0;
  }

  return { competencia: comp, comPlanoAtivo: ids.length, jaLancados };
}

export type ResultadoCobrancas = {
  erro?: string;
  criadas?: number;
  jaExistiam?: number;
  naoElegiveis?: number;
};

export type ResultadoSincronizacao = {
  erro?: string;
  criadas?: number;
  jaExistiam?: number;
  alunosElegiveis?: number;
};

/**
 * Botão "Sincronizar cobranças".
 *
 * Chama a MESMA RPC que a rotina diária (/api/cron/cobrancas) usa — a regra de
 * qual cobrança criar existe só no banco, em sincronizar_cobrancas_academia.
 * Cria cobranças cujo vencimento está a até 7 dias, sem duplicar as existentes
 * e sem olhar se a anterior foi paga. Apenas lançamentos pendentes.
 */
export async function sincronizarCobrancas(
  slug: string
): Promise<ResultadoSincronizacao> {
  await requireSecao(slug, "financeiro");
  const supabase = createClient();

  const { data, error } = await supabase
    .rpc("sincronizar_cobrancas", { p_dias: 7 })
    .maybeSingle();

  if (error) return { erro: `Falha ao sincronizar cobranças: ${error.message}` };

  const r = data as {
    criadas: number;
    ja_existiam: number;
    alunos_elegiveis: number;
  } | null;

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return {
    criadas: r?.criadas ?? 0,
    jaExistiam: r?.ja_existiam ?? 0,
    alunosElegiveis: r?.alunos_elegiveis ?? 0,
  };
}

/**
 * Executa a RPC gerar_mensalidades_do_mes.
 *
 * A RPC cria APENAS lançamentos pendentes — não movimenta dinheiro nem cobra
 * ninguém. Ela retorna só a quantidade criada, então medimos a situação antes
 * para conseguir explicar o resto do número ao usuário.
 */
export async function gerarMensalidades(
  slug: string,
  competencia: string
): Promise<ResultadoCobrancas> {
  await requireSecao(slug, "financeiro");
  const supabase = createClient();
  const comp = /^\d{4}-\d{2}-\d{2}$/.test(competencia)
    ? competencia
    : `${hojeSaoPaulo().slice(0, 7)}-01`;

  const antes = await previewCobrancasMensais(slug, comp);

  const { data, error } = await supabase.rpc("gerar_mensalidades_do_mes", {
    p_competencia: comp,
  });
  if (error) return { erro: `Falha ao gerar cobranças: ${error.message}` };

  const criadas = (data as number) ?? 0;
  // O que sobrou de elegível e não virou cobrança nova é ciclo que ainda não
  // fechou (trimestral, semestral, anual) ou aluno sem dia de vencimento válido.
  const naoElegiveis = Math.max(
    0,
    antes.comPlanoAtivo - antes.jaLancados - criadas
  );

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { criadas, jaExistiam: antes.jaLancados, naoElegiveis };
}

/**
 * Preenche data e forma de pagamento de um lançamento já pago, sem tocar em
 * valor, competência, vencimento ou status. Usado na correção do histórico.
 *
 * Só age sobre lançamento cuja data_pagamento ainda está nula: uma tela aberta
 * antes de outra pessoa registrar o pagamento não pode sobrescrever a data já
 * gravada.
 */
export async function registrarPagamentoRetroativo(
  slug: string,
  tabela: "receitas" | "despesas",
  id: string,
  dataPagamento: string,
  formaPagamento: string
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "financeiro");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) {
    return { erro: "Informe uma data de pagamento válida." };
  }
  if (dataPagamento > hojeSaoPaulo()) {
    return { erro: "A data de pagamento não pode estar no futuro." };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from(tabela)
    .update({
      data_pagamento: dataPagamento,
      forma_pagamento: formaPagamento.trim() || null,
    })
    .eq("id", id)
    .eq("academia_id", sessao.academia.id)
    .eq("status", "pago")
    // Só preenche o que está vazio — nunca sobrescreve data já registrada.
    .is("data_pagamento", null)
    .select("id");

  if (error) return { erro: `Falha ao salvar: ${error.message}` };
  if (!data || data.length === 0) {
    return {
      erro:
        "Lançamento não encontrado, não está pago, ou já teve o pagamento " +
        "registrado por outra pessoa. Atualize a página.",
    };
  }

  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
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
/**
 * Marca uma cobrança (mensalidade) como paga hoje. Chamada tanto da ficha do
 * aluno quanto do Financeiro — por isso o papel é checado aqui, e não com
 * requireSecao(slug, "financeiro"): recepção precisa registrar pagamento sem
 * ganhar a seção inteira (DRE, saldo inicial, despesas, configurações
 * financeiras seguem exclusivas do dono).
 *
 * A escrita em si não é um UPDATE direto na tabela: recepção não tem (nem
 * pode ter) permissão de RLS para isso, porque UPDATE de linha não segura
 * coluna — liberar isso deixaria valor/vencimento/competência/aluno/tipo/
 * descrição da mensalidade editáveis via REST direto. A gravação passa pela
 * RPC `registrar_pagamento_mensalidade` (migration 034), SECURITY DEFINER,
 * que só toca status/data_pagamento/forma_pagamento.
 */
export async function marcarPago(
  slug: string,
  receitaId: string,
  formaPagamento?: string
): Promise<EstadoAcao> {
  const sessao = await requireSessao(slug);
  if (sessao.papel !== "dono" && sessao.papel !== "recepcao") {
    return { erro: "Você não tem permissão para registrar pagamentos." };
  }
  const supabase = createClient();

  const { data: pagas, error } = await supabase.rpc(
    "registrar_pagamento_mensalidade",
    { p_receita_id: receitaId, p_forma_pagamento: formaPagamento?.trim() || null }
  );

  if (error) return { erro: `Falha ao marcar como pago: ${error.message}` };

  // Zero linhas: ou já estava paga (idempotente, sucesso) ou não existe / é de
  // outra academia / não é mensalidade (erro genérico, sem revelar qual caso).
  if (!pagas || pagas.length === 0) {
    const { count } = await supabase
      .from("receitas")
      .select("id", { count: "exact", head: true })
      .eq("id", receitaId)
      .eq("academia_id", sessao.academia.id)
      .eq("tipo", "mensalidade");

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
