"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusMatricula } from "@/lib/types";
import { hojeSaoPaulo } from "@/lib/utils";
import { normalizarCpf, validarUrl } from "@/lib/validacoes";
import {
  lerExerciciosDoFormulario,
  montarLinhasExercicio,
} from "@/lib/exercicios-treino";
import {
  enviarFotoPerfil,
  removerFotoAntiga,
  validarArquivoFoto,
} from "@/lib/fotos-perfil";
import { registrarAuditoria } from "@/lib/auditoria";
import { inserirAlunoComMatricula } from "@/lib/alunos-cadastro";
import { analisarPlanilha } from "@/lib/importar-alunos";

// ---------------------------------------------------------------------------
// Helpers de data no fuso America/Sao_Paulo
// ---------------------------------------------------------------------------

/** Deriva ano/mês/dia a partir do helper central de data (lib/utils). */
function spHoje(): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = hojeSaoPaulo().split("-").map(Number);
  return { ano, mes, dia };
}

function spHojeISO(): string {
  return hojeSaoPaulo();
}

function spCompetencia(): string {
  const { ano, mes } = spHoje();
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

// ---------------------------------------------------------------------------
// Geração de cobranças — três funções separadas por contexto
// ---------------------------------------------------------------------------

/**
 * Gera a cobrança inicial de um ciclo (criar aluno ou reativar sem ciclo vigente).
 * Cria no máximo uma cobrança para a competência fornecida.
 *
 * Idempotência: `uidx_mensalidade_aluno_comp` é um índice **parcial**
 * (WHERE tipo = 'mensalidade' AND ...). O PostgREST monta o upsert como
 * `ON CONFLICT (aluno_id, competencia)` sem repetir o predicado, e o Postgres
 * não consegue inferir o índice — o upsert falha com 42P10. Por isso fazemos
 * verificação explícita antes do insert e tratamos a violação de unicidade
 * (23505, corrida entre duas requisições) como no-op bem-sucedido.
 *
 * statusCobranca: "pendente" (a pagar) ou "pago" (pago agora).
 * dataPagamento: quando pago, a data efetiva do pagamento (YYYY-MM-DD em SP).
 * formaPagamento: forma usada (pix, dinheiro, etc.) — registrada em observacoes.
 *
 * Retorna null em sucesso ou mensagem de erro.
 */
async function gerarCobrancaInicial(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string,
  diaVencimento: number,
  competencia: string, // YYYY-MM-01 no fuso SP
  statusCobranca: "pago" | "pendente" = "pendente",
  dataPagamento?: string,
  formaPagamento?: string
): Promise<string | null> {
  const { data: plano } = await supabase
    .from("planos")
    .select("nome, valor_mensal, cobranca_recorrente")
    .eq("id", planoId)
    .eq("academia_id", academiaId)
    .maybeSingle();

  if (!plano || !plano.cobranca_recorrente || plano.valor_mensal <= 0) return null;

  const ano = parseInt(competencia.slice(0, 4), 10);
  const mes = parseInt(competencia.slice(5, 7), 10);
  const diaVenc = Math.min(diaVencimento, 28);

  // `data` é SEMPRE o vencimento, mesmo quando já pago — a data em que o
  // dinheiro entrou vai em data_pagamento, coluna própria (migration 027).
  const vencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;
  const pago = statusCobranca === "pago";

  // Já existe mensalidade desta competência? Não duplica (qualquer status).
  const { data: existente, error: errBusca } = await supabase
    .from("receitas")
    .select("id")
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .eq("tipo", "mensalidade")
    .eq("competencia", competencia)
    .limit(1)
    .maybeSingle();

  if (errBusca) return errBusca.message;
  if (existente) return null;

  const { error } = await supabase.from("receitas").insert({
    academia_id: academiaId,
    aluno_id: alunoId,
    tipo: "mensalidade",
    descricao: `Mensalidade — ${plano.nome}`,
    valor: plano.valor_mensal,
    data: vencimento,
    competencia,
    status: statusCobranca,
    data_pagamento: pago ? (dataPagamento ?? spHojeISO()) : null,
    forma_pagamento: pago ? (formaPagamento ?? null) : null,
  });

  // 23505 = unique_violation: outra requisição criou a mesma competência
  // entre a verificação e o insert. O resultado desejado já está no banco.
  if (error && error.code !== "23505") return error.message;
  return null;
}

/**
 * Retorna true se já existe cobrança (não cancelada) dentro do ciclo vigente,
 * ou seja, com competência a partir do mês em que o ciclo começou.
 * Usado na reativação para não repetir a cobrança de um ciclo já cobrado —
 * e para gerar a que faltou quando o aluno foi cadastrado sem cobrança
 * (ex.: criado com plano mas status "pendente").
 */
async function possuiCobrancaNoCicloAtual(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string
): Promise<boolean> {
  const { data: hist } = await supabase
    .from("historico_planos")
    .select("data_inicio")
    .eq("aluno_id", alunoId)
    .eq("academia_id", academiaId)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hist) return false;

  // Competência do mês em que o ciclo começou (YYYY-MM-01).
  const competenciaInicio = `${hist.data_inicio.slice(0, 7)}-01`;

  const { data: cobrancas } = await supabase
    .from("receitas")
    .select("id")
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .eq("tipo", "mensalidade")
    .neq("status", "cancelada")
    .gte("competencia", competenciaInicio)
    .limit(1);

  return (cobrancas?.length ?? 0) > 0;
}

/**
 * Retorna true se o aluno ainda está dentro de um ciclo vigente,
 * calculado a partir do data_inicio mais recente em historico_planos.
 * Ciclo vigente = meses decorridos desde data_inicio < recorrencia_meses.
 */
async function cicloVigente(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string
): Promise<boolean> {
  const { data: hist } = await supabase
    .from("historico_planos")
    .select("data_inicio, recorrencia_meses")
    .eq("aluno_id", alunoId)
    .eq("academia_id", academiaId)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hist) return false;

  const { ano: anoHoje, mes: mesHoje } = spHoje();
  const mesesHoje = anoHoje * 12 + mesHoje;

  const [anoI, mesI] = hist.data_inicio.split("-").map(Number);
  const mesesInicio = anoI * 12 + mesI;

  const mesesDecorridos = mesesHoje - mesesInicio;
  return mesesDecorridos >= 0 && mesesDecorridos < hist.recorrencia_meses;
}

/**
 * Fecha o registro mais recente em historico_planos que ainda não tem data_fim,
 * gravando por que o ciclo terminou. Chamado ao renovar, trocar de plano,
 * trancar e cancelar — o `motivo` é o que explica o encerramento no histórico.
 * Não faz nada se o último registro já estiver fechado.
 */
async function fecharHistoricoVigente(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  motivo: string
): Promise<void> {
  const { data: ultimo } = await supabase
    .from("historico_planos")
    .select("id, data_fim")
    .eq("aluno_id", alunoId)
    .eq("academia_id", academiaId)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimo || ultimo.data_fim) return;

  await supabase
    .from("historico_planos")
    .update({ data_fim: spHojeISO(), motivo })
    .eq("id", ultimo.id)
    .eq("academia_id", academiaId);
}

/**
 * Cancela mensalidades pendentes futuras (competência > mês atual em SP).
 * Chamado ao trancar ou cancelar — não apaga dívidas passadas.
 */
async function cancelarMensalidadesFuturas(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string
): Promise<void> {
  const competenciaAtual = spCompetencia();
  await supabase
    .from("receitas")
    .delete()
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente")
    .gt("competencia", competenciaAtual);
}

/**
 * Lê e normaliza o CPF do formulário. Retorna:
 *  - { cpf } com os 11 dígitos limpos quando válido;
 *  - { cpf: null } quando o campo veio vazio (CPF é opcional);
 *  - { erro } quando foi preenchido mas não tem 11 dígitos.
 * Guardar sempre só os dígitos é o que faz o match do webhook Gympass/TotalPass
 * (que também normaliza) funcionar.
 */
function lerCpf(formData: FormData): { cpf: string | null } | { erro: string } {
  const raw = String(formData.get("cpf") ?? "").trim();
  if (!raw) return { cpf: null };
  const cpf = normalizarCpf(raw);
  if (!cpf) return { erro: "CPF inválido: informe os 11 dígitos." };
  return { cpf };
}


/** Campos de anamnese/saúde — nunca expostos na ficha pública do aluno. */
function lerCamposSaude(formData: FormData) {
  return {
    objetivo: String(formData.get("objetivo") ?? "").trim() || null,
    condicoes_medicas: String(formData.get("condicoes_medicas") ?? "").trim() || null,
    contato_emergencia_nome:
      String(formData.get("contato_emergencia_nome") ?? "").trim() || null,
    contato_emergencia_telefone:
      String(formData.get("contato_emergencia_telefone") ?? "").trim() || null,
  };
}

/**
 * Registra no histórico o plano que o aluno passou a ter.
 * dataInicio: data em SP (YYYY-MM-DD). Padrão: hoje em SP.
 * Retorna null em sucesso ou mensagem de erro.
 */
async function registrarHistoricoPlano(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string,
  dataInicio?: string
): Promise<string | null> {
  const { data: plano, error: errPlano } = await supabase
    .from("planos")
    .select("nome, valor_mensal, recorrencia_meses")
    .eq("id", planoId)
    .eq("academia_id", academiaId)
    .maybeSingle();
  if (errPlano) return errPlano.message;
  if (!plano) return "Plano não encontrado.";
  const { error } = await supabase.from("historico_planos").insert({
    academia_id: academiaId,
    aluno_id: alunoId,
    plano_id: planoId,
    plano_nome: plano.nome,
    valor: plano.valor_mensal,
    recorrencia_meses: plano.recorrencia_meses,
    data_inicio: dataInicio ?? spHojeISO(),
  });
  return error ? error.message : null;
}

export async function criarAluno(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do aluno." };

  const cpf = lerCpf(formData);
  if ("erro" in cpf) return { erro: cpf.erro };

  // Gerada uma vez por abertura do formulário (não por aluno) — ver
  // FormularioAluno. Sem CPF, é a única defesa contra duplo clique/reenvio
  // criar duas matrículas para a mesma pessoa (unique(academia_id, cpf) só
  // protege quando o CPF é preenchido).
  const chaveIdempotencia = String(formData.get("chave_idempotencia") ?? "").trim() || null;

  const planoId = String(formData.get("plano_id") ?? "").trim() || null;

  // Sem plano → sempre "pendente", independentemente do que o formulário enviou.
  // Com plano → respeita o select de status (default "ativa").
  const statusInicial: StatusMatricula = planoId === null
    ? "pendente"
    : ((formData.get("status") as StatusMatricula) || "ativa");

  // Dia de vencimento: usa o campo do form, ou o dia atual limitado a 28
  const diaVencimentoRaw = parseInt(String(formData.get("dia_vencimento") ?? ""), 10);
  const diaVencimento = Number.isFinite(diaVencimentoRaw) && diaVencimentoRaw >= 1 && diaVencimentoRaw <= 28
    ? diaVencimentoRaw
    : Math.min(new Date().getDate(), 28);

  // Insere gerando a matrícula de forma atômica (helper compartilhado com a
  // importação em massa — mesma regra de insert, sem divergência).
  const { data: novoInserido, error } = await inserirAlunoComMatricula(
    supabase,
    sessao.academia.id,
    {
      nome,
      cpf: cpf.cpf,
      email: String(formData.get("email") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      // Foto é enviada à parte, por atualizarFotoAlunoAdmin (upload real via
      // Storage) — este formulário não grava foto_perfil_url.
      status_matricula: statusInicial,
      plano_id: planoId,
      dia_vencimento: diaVencimento,
      chave_idempotencia: chaveIdempotencia,
      ...lerCamposSaude(formData),
    }
  );

  let novo = novoInserido;

  if (error) {
    // 23505 pode ser a mesma tentativa reenviada (duplo clique/retry) OU uma
    // colisão real de CPF. Só a primeira tem uma linha com esta chave.
    if (error.code === "23505" && chaveIdempotencia) {
      const { data: existente } = await supabase
        .from("alunos")
        .select("id")
        .eq("academia_id", sessao.academia.id)
        .eq("chave_idempotencia", chaveIdempotencia)
        .maybeSingle();
      if (existente) {
        revalidatePath(`/painel/${slug}/alunos`);
        return { ok: true, savedAt: Date.now(), id: existente.id };
      }
    }
    return { erro: `Falha ao cadastrar aluno: ${error.message}` };
  }

  if (planoId && novo) {
    // Lê campos de pagamento inicial (somente relevantes na criação de novos alunos).
    const pagamentoInicial = String(formData.get("pagamento_inicial") ?? "a_pagar").trim();
    const formaPagamento = String(formData.get("forma_pagamento") ?? "").trim() || undefined;
    const dataPagamentoRaw = String(formData.get("data_pagamento") ?? "").trim();
    const dataPagamento = dataPagamentoRaw || spHojeISO();
    const statusCobranca: "pago" | "pendente" =
      pagamentoInicial === "pago_agora" ? "pago" : "pendente";

    // Compensação: se qualquer etapa falhar após criar o aluno, deleta o aluno
    // (ON DELETE CASCADE limpa historico_planos automaticamente).
    const competencia = spCompetencia();

    const errHist = await registrarHistoricoPlano(
      supabase, sessao.academia.id, novo.id, planoId, spHojeISO()
    );
    if (errHist) {
      await supabase.from("alunos").delete().eq("id", novo.id).eq("academia_id", sessao.academia.id);
      return { erro: `Falha ao registrar histórico do plano: ${errHist}` };
    }

    if (statusInicial === "ativa") {
      const errCobranca = await gerarCobrancaInicial(
        supabase, sessao.academia.id, novo.id, planoId, diaVencimento,
        competencia, statusCobranca, dataPagamento, formaPagamento
      );
      if (errCobranca) {
        await supabase.from("alunos").delete().eq("id", novo.id).eq("academia_id", sessao.academia.id);
        return { erro: `Falha ao gerar cobrança inicial: ${errCobranca}` };
      }
    }
  }

  if (novo) {
    await registrarAuditoria({
      academiaId: sessao.academia.id,
      usuarioId: sessao.userId,
      usuarioNome: sessao.nome,
      entidade: "aluno",
      entidadeId: novo.id,
      acao: "aluno_criado",
      valorNovo: { nome, status_matricula: statusInicial, plano_id: planoId },
    });
  }

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now(), id: novo?.id };
}

export type ResultadoImportacao = {
  erro?: string;
  criados?: number;
  /** Já existiam (colisão de CPF) — não duplicamos. */
  ignorados?: number;
  errosLinha?: { linha: number; motivo: string }[];
  avisos?: { linha: number; motivo: string }[];
  savedAt?: number;
};

/**
 * Importa alunos em massa a partir de um CSV (Bloco de vendas).
 *
 * Reusa o MESMO insert do cadastro (inserirAlunoComMatricula) — sem caminho
 * paralelo. `academia_id` sempre da sessão, nunca do arquivo. Best-effort:
 * grava os válidos e relata os problemas por linha; CPF que já existe na
 * academia (23505) é IGNORADO, não duplicado. Não gera cobranças nem histórico
 * de plano (migração de base existente) — o ciclo normal cuida disso depois.
 */
export async function importarAlunos(
  slug: string,
  _estado: ResultadoImportacao,
  formData: FormData
): Promise<ResultadoImportacao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo CSV." };
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    return { erro: "Arquivo muito grande — máximo 5 MB." };
  }
  const texto = await arquivo.text();

  const { data: planos } = await supabase
    .from("planos")
    .select("id, nome")
    .eq("academia_id", sessao.academia.id);

  const analise = analisarPlanilha(
    texto,
    (planos ?? []) as { id: string; nome: string }[]
  );

  if (analise.validos.length === 0) {
    return {
      erro: analise.erros[0]?.motivo ?? "Nenhum aluno válido na planilha.",
      errosLinha: analise.erros,
      avisos: analise.avisos,
    };
  }

  const diaPadrao = Math.min(new Date().getDate(), 28);
  let criados = 0;
  let ignorados = 0;
  const errosLinha = [...analise.erros];

  for (const a of analise.validos) {
    const { error } = await inserirAlunoComMatricula(supabase, sessao.academia.id, {
      nome: a.nome,
      cpf: a.cpf,
      email: a.email,
      telefone: a.telefone,
      status_matricula: a.status_matricula,
      plano_id: a.plano_id,
      dia_vencimento: a.dia_vencimento ?? diaPadrao,
      chave_idempotencia: null,
    });
    if (error) {
      // 23505 = unique(academia_id, cpf): o aluno já existe → ignora.
      if (error.code === "23505") ignorados++;
      else errosLinha.push({ linha: a.linha, motivo: `Falha ao gravar: ${error.message}` });
    } else {
      criados++;
    }
  }

  if (criados > 0) {
    revalidatePath(`/painel/${slug}/alunos`);
    revalidatePath(`/painel/${slug}`);
  }

  return {
    criados,
    ignorados,
    errosLinha,
    avisos: analise.avisos,
    savedAt: Date.now(),
  };
}

export async function atualizarAluno(
  slug: string,
  alunoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do aluno." };

  const cpf = lerCpf(formData);
  if ("erro" in cpf) return { erro: cpf.erro };

  const planoId = String(formData.get("plano_id") ?? "").trim() || null;
  const statusDoForm = (formData.get("status") as StatusMatricula) || "ativa";

  // Sem plano + status "ativa" → forçar "pendente" no servidor.
  // Trancado, cancelado ou inativo sem plano são estados válidos (admin escolheu explicitamente).
  const novoStatus: StatusMatricula =
    planoId === null && statusDoForm === "ativa" ? "pendente" : statusDoForm;

  // Lê estado atual para detectar transições relevantes.
  const { data: atual } = await supabase
    .from("alunos")
    .select("plano_id, status_matricula, dia_vencimento")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  const diaVencimentoRaw = parseInt(String(formData.get("dia_vencimento") ?? ""), 10);
  const diaVencimento = Number.isFinite(diaVencimentoRaw) && diaVencimentoRaw >= 1 && diaVencimentoRaw <= 28
    ? diaVencimentoRaw
    : (atual?.dia_vencimento ?? Math.min(new Date().getDate(), 28));

  const { error } = await supabase
    .from("alunos")
    .update({
      nome,
      cpf: cpf.cpf,
      email: String(formData.get("email") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      // Foto é enviada à parte, por atualizarFotoAlunoAdmin — edição de dados
      // cadastrais não mexe em foto_perfil_url.
      status_matricula: novoStatus,
      plano_id: planoId,
      dia_vencimento: diaVencimento,
      ...lerCamposSaude(formData),
    })
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar aluno: ${error.message}` };

  const statusAnterior = atual?.status_matricula ?? "ativa";
  const trocouPlano = planoId && planoId !== (atual?.plano_id ?? null);
  const reativando = novoStatus === "ativa" && statusAnterior !== "ativa";

  await registrarAuditoria({
    academiaId: sessao.academia.id,
    usuarioId: sessao.userId,
    usuarioNome: sessao.nome,
    entidade: "aluno",
    entidadeId: alunoId,
    acao: "aluno_atualizado",
    valorAnterior: {
      status_matricula: statusAnterior,
      dia_vencimento: atual?.dia_vencimento ?? null,
    },
    valorNovo: { status_matricula: novoStatus, dia_vencimento: diaVencimento },
  });

  if (trocouPlano) {
    await registrarAuditoria({
      academiaId: sessao.academia.id,
      usuarioId: sessao.userId,
      usuarioNome: sessao.nome,
      entidade: "plano",
      entidadeId: alunoId,
      acao: "plano_alterado",
      valorAnterior: { plano_id: atual?.plano_id ?? null },
      valorNovo: { plano_id: planoId },
    });
  }

  if (reativando && trocouPlano && planoId) {
    // Reativação com troca de plano: fecha ciclo anterior, abre novo e gera cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Troca de plano na reativação");
    const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
    if (errHist) return { erro: `Falha ao registrar histórico: ${errHist}` };
    const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
    if (errCob) return { erro: `Falha ao gerar cobrança: ${errCob}` };
  } else if (reativando && planoId) {
    const vigente = await cicloVigente(supabase, sessao.academia.id, alunoId);
    if (!vigente) {
      // Ciclo encerrado (ou inexistente): abre um novo ciclo e cobra.
      await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Ciclo encerrado — reativação");
      const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
      if (errHist) return { erro: `Falha ao registrar histórico: ${errHist}` };
      const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
      if (errCob) return { erro: `Falha ao gerar cobrança: ${errCob}` };
    } else if (!(await possuiCobrancaNoCicloAtual(supabase, sessao.academia.id, alunoId))) {
      // Ciclo vigente mas ainda sem cobrança — caso do aluno cadastrado com
      // plano e status "pendente", que nunca recebeu a cobrança inicial.
      const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
      if (errCob) return { erro: `Falha ao gerar cobrança: ${errCob}` };
    }
  } else if (trocouPlano && planoId) {
    // Troca de plano sem reativação: registra histórico, sem gerar cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Troca de plano");
    const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
    if (errHist) return { erro: `Falha ao registrar histórico: ${errHist}` };
  }
  // Edição de dados comuns (nome, email, dia_vencimento etc.) sem troca de status/plano:
  // nenhuma cobrança gerada.

  // Trancando ou cancelando: encerra o ciclo no histórico (deixando registrado
  // o porquê) e cancela as mensalidades futuras pendentes.
  if (
    (novoStatus === "trancada" || novoStatus === "cancelada") &&
    statusAnterior === "ativa"
  ) {
    await fecharHistoricoVigente(
      supabase,
      sessao.academia.id,
      alunoId,
      novoStatus === "trancada" ? "Matrícula trancada" : "Matrícula cancelada"
    );
    await cancelarMensalidadesFuturas(supabase, sessao.academia.id, alunoId);
  }

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now(), id: alunoId };
}

/**
 * Renova o plano do aluno: fecha o ciclo vigente, cria novo histórico e
 * gera exatamente uma cobrança para o novo ciclo.
 * Idempotente: se já existe historico com data_inicio no mês corrente,
 * não cria duplicata (unique index protege a receita).
 */
export async function renovarPlano(
  slug: string,
  alunoId: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const { data: aluno } = await supabase
    .from("alunos")
    .select("plano_id, dia_vencimento")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (!aluno?.plano_id) return { erro: "O aluno não tem um plano definido." };

  const competencia = spCompetencia(); // YYYY-MM-01 em SP
  const diaVencimento = aluno.dia_vencimento ?? 1;

  // Idempotência: verifica se já existe histórico criado neste mês.
  const { data: jaRenovado } = await supabase
    .from("historico_planos")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .gte("data_inicio", competencia)
    .limit(1)
    .maybeSingle();

  if (!jaRenovado) {
    // Fecha somente o histórico vigente mais recente (sem data_fim).
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Renovação de plano");
    // Cria novo registro para o ciclo que inicia hoje em SP.
    await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, aluno.plano_id, spHojeISO());
  }

  // Gera a cobrança do novo ciclo (idempotente via unique index).
  const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, aluno.plano_id, diaVencimento, competencia);
  if (errCob) return { erro: `Falha ao gerar cobrança: ${errCob}` };

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true };
}

export async function excluirAluno(slug: string, alunoId: string): Promise<void> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  // Lido ANTES de excluir: depois de deletado não há mais linha para
  // consultar, e o log de auditoria é o único lugar que vai preservar quem
  // era esse aluno.
  const { data: alunoRemovido } = await supabase
    .from("alunos")
    .select("nome, matricula_codigo, status_matricula")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  const { error } = await supabase
    .from("alunos")
    .delete()
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir aluno: ${error.message}`);

  await registrarAuditoria({
    academiaId: sessao.academia.id,
    usuarioId: sessao.userId,
    usuarioNome: sessao.nome,
    entidade: "aluno",
    entidadeId: alunoId,
    acao: "aluno_excluido",
    valorAnterior: alunoRemovido ?? undefined,
  });

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
}

export async function criarTreino(
  slug: string,
  alunoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  const lidos = lerExerciciosDoFormulario(formData.get("exercicios_json"));
  if ("erro" in lidos) return lidos;
  const exercicios = lidos.exercicios;

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
    .insert(montarLinhasExercicio(treino.id, exercicios));

  if (erroExercicios) {
    // Desfaz o treino se os exercícios falharem, para não deixar ficha vazia.
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: `Falha ao salvar exercícios: ${erroExercicios.message}` };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Edita uma ficha de treino já existente: nome, objetivo e a lista inteira de
 * exercícios (séries, reps, carga, descanso, observações, imagem e vídeo).
 *
 * Antes desta action não havia NENHUM caminho de UPDATE em `exercicios_treino`
 * no projeto — só insert. Para trocar um vídeo ou corrigir uma carga, o
 * professor tinha que excluir a ficha e remontá-la do zero.
 *
 * ESTRATÉGIA: substitui os exercícios (delete + insert) em vez de casar linha
 * por linha, porque o construtor permite reordenar, remover e acrescentar na
 * mesma edição. Como o cliente Supabase não expõe transação, a lista antiga é
 * lida ANTES e reinserida se o insert novo falhar — assim uma falha no meio
 * nunca deixa a ficha vazia.
 *
 * O `treinos.id` é preservado (não recria a ficha), então o QR compartilhado
 * e o `share_token` continuam válidos.
 */
export async function atualizarTreino(
  slug: string,
  treinoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  const lidos = lerExerciciosDoFormulario(formData.get("exercicios_json"));
  if ("erro" in lidos) return lidos;

  // Confirma que a ficha é desta academia antes de qualquer escrita. O RLS já
  // bloquearia, mas aqui a mensagem de erro fica clara em vez de "0 linhas".
  const { data: treino } = await supabase
    .from("treinos")
    .select("id")
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  if (!treino) return { erro: "Ficha não encontrada." };

  const { error: erroTreino } = await supabase
    .from("treinos")
    .update({
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);

  if (erroTreino) {
    return { erro: `Falha ao atualizar a ficha: ${erroTreino.message}` };
  }

  // Guarda a lista atual para poder restaurar se o insert novo falhar.
  const { data: anteriores } = await supabase
    .from("exercicios_treino")
    .select(
      "nome_exercicio, series, repeticoes, carga_kg, descanso_segundos, observacoes, imagem_demonstracao_url, video_demonstracao_url, ordem"
    )
    .eq("treino_id", treinoId)
    .order("ordem", { ascending: true });

  const { error: erroRemocao } = await supabase
    .from("exercicios_treino")
    .delete()
    .eq("treino_id", treinoId);

  if (erroRemocao) {
    return { erro: `Falha ao atualizar exercícios: ${erroRemocao.message}` };
  }

  const { error: erroInsercao } = await supabase
    .from("exercicios_treino")
    .insert(montarLinhasExercicio(treinoId, lidos.exercicios));

  if (erroInsercao) {
    // Compensação: devolve os exercícios antigos para a ficha não ficar vazia.
    if (anteriores && anteriores.length > 0) {
      await supabase
        .from("exercicios_treino")
        .insert(anteriores.map((ex) => ({ ...ex, treino_id: treinoId })));
    }
    return { erro: `Falha ao salvar exercícios: ${erroInsercao.message}` };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirTreino(slug: string, treinoId: string): Promise<void> {
  const sessao = await requireSecao(slug, "alunos");
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
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
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
    foto_url: validarUrl(String(formData.get("foto_url") ?? "")),
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
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const { error } = await supabase
    .from("progresso_aluno")
    .delete()
    .eq("id", registroId)
    .eq("academia_id", sessao.academia.id);

  if (error) throw new Error(`Falha ao excluir registro: ${error.message}`);

  revalidatePath(`/painel/${slug}/alunos`);
}

// ---------------------------------------------------------------------------
// Acesso do aluno: regenerar o link/QR pessoal (token_acesso_publico)
// ---------------------------------------------------------------------------

/**
 * Gera um novo token_acesso_publico para o aluno via RPC `regenerar_token_aluno`
 * (migration 037) — revoga o link/QR antigo imediatamente. Só o "dono" pode
 * chamar: quem tiver o link antigo perde acesso, e essa é uma decisão que só
 * o dono da academia deveria poder tomar.
 */
export async function regenerarTokenAluno(
  slug: string,
  alunoId: string
): Promise<{ erro?: string; token?: string }> {
  const sessao = await requireSecao(slug, "alunos");
  if (sessao.papel !== "dono") {
    return { erro: "Só o dono da academia pode gerar um novo link de acesso." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("regenerar_token_aluno", {
    p_aluno_id: alunoId,
  });

  if (error || !data) {
    return { erro: "Não foi possível gerar um novo link. Tente novamente." };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { token: data as string };
}

/**
 * Regenera o token do QR de acesso à recepção (Bloco 1, migration 044) —
 * credencial separada de `token_acesso_publico`, que abre a área do aluno.
 * Regenerar invalida o QR anterior imediatamente.
 */
export async function regenerarTokenQrAluno(
  slug: string,
  alunoId: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "alunos");
  if (sessao.papel !== "dono") {
    return { erro: "Só o dono da academia pode gerar um novo QR de acesso." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("regenerar_token_qr_acesso", {
    p_aluno_id: alunoId,
  });

  if (error || !data) {
    return { erro: "Não foi possível gerar um novo QR. Tente novamente." };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Foto de perfil do aluno (upload real via Supabase Storage) — lado do painel
// ---------------------------------------------------------------------------

export type EstadoFotoAdmin = { erro?: string; ok?: boolean; savedAt?: number };

/**
 * Substitui a foto do aluno: valida a sessão (mesma seção "alunos" das
 * demais ações de cadastro), envia o arquivo para o Storage com nome não
 * previsível e só então atualiza `foto_perfil_url` — a foto antiga (se
 * pertencer ao nosso bucket) é apagada depois, para não acumular arquivo
 * órfão. Como o nome do arquivo muda a cada envio, a URL nova nunca colide
 * com cache de navegador/CDN da foto antiga.
 */
export async function atualizarFotoAlunoAdmin(
  slug: string,
  alunoId: string,
  _estado: EstadoFotoAdmin,
  formData: FormData
): Promise<EstadoFotoAdmin> {
  const sessao = await requireSecao(slug, "alunos");

  const arquivo = formData.get("foto") as File | null;
  const validado = validarArquivoFoto(arquivo);
  if ("erro" in validado) return { erro: validado.erro };

  const supabase = createClient();
  const { data: atual } = await supabase
    .from("alunos")
    .select("foto_perfil_url")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  const enviado = await enviarFotoPerfil(
    sessao.academia.id,
    alunoId,
    arquivo as File,
    validado.extensao
  );
  if ("erro" in enviado) return { erro: enviado.erro };

  const { error } = await supabase
    .from("alunos")
    .update({ foto_perfil_url: enviado.url })
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao salvar a foto: ${error.message}` };

  await removerFotoAntiga(atual?.foto_perfil_url ?? null);

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}/recepcao`);
  return { ok: true, savedAt: Date.now() };
}

/** Remove a foto do aluno (Storage + coluna) — aluno volta a mostrar o avatar de iniciais. */
export async function removerFotoAlunoAdmin(
  slug: string,
  alunoId: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const { data: atual } = await supabase
    .from("alunos")
    .select("foto_perfil_url")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  const { error } = await supabase
    .from("alunos")
    .update({ foto_perfil_url: null })
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao remover a foto: ${error.message}` };

  await removerFotoAntiga(atual?.foto_perfil_url ?? null);

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}/recepcao`);
  return { ok: true };
}
