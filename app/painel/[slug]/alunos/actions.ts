"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAluno, getAlunosResumo, getPlanos } from "@/lib/data";
import {
  Aluno,
  ORIGENS_ACESSO_ALUNO,
  OrigemAcessoAluno,
  StatusMatricula,
} from "@/lib/types";
import {
  calcularIdade,
  hojeSaoPaulo,
  origemExigePlanoDaAcademia,
  resolverStatusMatricula,
} from "@/lib/utils";
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
import { analisarLinhas, linhasDoArquivo } from "@/lib/importar-alunos";
import { erroAmigavel } from "@/lib/erros-servidor";
import {
  diaVencimentoDoMes,
  lerDiaVencimento,
  DIA_VENCIMENTO_MAX,
} from "@/lib/vencimento";
import {
  normalizarEmail,
  normalizarNomeProprio,
  normalizarTelefone,
} from "@/lib/normalizacao";

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
 * Retorna null em sucesso ou a mensagem de erro JÁ TRADUZIDA para o usuário
 * (erroAmigavel) — quem chama devolve o texto direto, sem concatenar prefixo.
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
  // Dia 31 em fevereiro vira 28 (29 em ano bissexto), em abril vira 30. Mesma
  // conta que `gerar_mensalidades_do_mes` faz no banco desde a migration 025 —
  // aqui era `Math.min(dia, 28)`, o único ponto do sistema que discordava dela.
  const diaVenc = diaVencimentoDoMes(diaVencimento, ano, mes);

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

  if (errBusca) return await erroAmigavel(errBusca, "verificar as mensalidades já lançadas");
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
  if (error && error.code !== "23505") return await erroAmigavel(error, "gerar a cobrança do plano");
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


/**
 * Lê a data de nascimento do formulário (input type="date" → YYYY-MM-DD).
 * Campo opcional: vazio vira null. Só aceita o formato de data-calendário;
 * qualquer outra coisa também vira null (o input nativo já garante o formato,
 * isto é a defesa do lado do servidor). A idade não é gravada — é sempre
 * derivada desta data (ver calcularIdade), então nunca fica desatualizada.
 */
function lerDataNascimento(formData: FormData): string | null {
  const raw = String(formData.get("data_nascimento") ?? "").trim();
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Origem do acesso + nome do convênio (migration 096).
 *
 * Valor desconhecido cai em "plano_academia", que é o comportamento de antes
 * da coluna existir — um formulário antigo em cache nunca vira uma origem
 * inventada. O nome do convênio só é gravado para "outro_convenio"; nas outras
 * origens vai null, como o CHECK do banco exige.
 */
function lerOrigemAcesso(formData: FormData): {
  origem: OrigemAcessoAluno;
  parceiroExterno: string | null;
} {
  const bruta = String(formData.get("origem_acesso") ?? "").trim();
  const origem = ORIGENS_ACESSO_ALUNO.some((o) => o.value === bruta)
    ? (bruta as OrigemAcessoAluno)
    : "plano_academia";
  const parceiroExterno =
    origem === "outro_convenio"
      ? String(formData.get("parceiro_externo") ?? "").trim().slice(0, 80) || null
      : null;
  return { origem, parceiroExterno };
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
 * Retorna null em sucesso ou a mensagem de erro JÁ TRADUZIDA para o usuário
 * (erroAmigavel) — quem chama devolve o texto direto, sem concatenar prefixo.
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
  if (errPlano) return await erroAmigavel(errPlano, "carregar os dados do plano");
  if (!plano) return "O plano escolhido não existe mais. Atualize a página e escolha outro.";
  const { error } = await supabase.from("historico_planos").insert({
    academia_id: academiaId,
    aluno_id: alunoId,
    plano_id: planoId,
    plano_nome: plano.nome,
    valor: plano.valor_mensal,
    recorrencia_meses: plano.recorrencia_meses,
    data_inicio: dataInicio ?? spHojeISO(),
  });
  return error ? await erroAmigavel(error, "registrar o histórico do plano") : null;
}

export async function criarAluno(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  // Padronização (2026-08-11): "MARIA DA SILVA" é gravado "Maria da Silva".
  // Normalizar não recusa nada — nome vazio continua sendo o único caso que
  // barra o cadastro, e a checagem abaixo pega tanto "" quanto "   ".
  const nome = normalizarNomeProprio(formData.get("nome") as string);
  if (!nome) return { erro: "Informe o nome do aluno." };

  const cpf = lerCpf(formData);
  if ("erro" in cpf) return { erro: cpf.erro };

  // Gerada uma vez por abertura do formulário (não por aluno) — ver
  // FormularioAluno. Sem CPF, é a única defesa contra duplo clique/reenvio
  // criar duas matrículas para a mesma pessoa (unique(academia_id, cpf) só
  // protege quando o CPF é preenchido).
  const chaveIdempotencia = String(formData.get("chave_idempotencia") ?? "").trim() || null;

  const { origem, parceiroExterno } = lerOrigemAcesso(formData);
  const planoId = String(formData.get("plano_id") ?? "").trim() || null;

  // A trava "sem plano → pendente" vale só para a origem "Plano da academia" —
  // ver resolverStatusMatricula (lib/utils.ts) para o porquê.
  const statusInicial = resolverStatusMatricula(
    origem,
    planoId,
    (formData.get("status") as StatusMatricula) || "ativa"
  );

  // Dia de vencimento (1 a 31): usa o campo do formulário; sem valor válido,
  // cai no dia de hoje. O dia de hoje nunca precisa de limite — se hoje é 31,
  // é porque este mês tem 31.
  const diaVencimento =
    lerDiaVencimento(formData.get("dia_vencimento") as string) ?? spHoje().dia;

  // Insere gerando a matrícula de forma atômica (helper compartilhado com a
  // importação em massa — mesma regra de insert, sem divergência).
  const { data: novoInserido, error } = await inserirAlunoComMatricula(
    supabase,
    sessao.academia.id,
    {
      nome,
      cpf: cpf.cpf,
      email: normalizarEmail(formData.get("email") as string),
      telefone: normalizarTelefone(formData.get("telefone") as string),
      data_nascimento: lerDataNascimento(formData),
      // Foto é enviada à parte, por atualizarFotoAlunoAdmin (upload real via
      // Storage) — este formulário não grava foto_perfil_url.
      status_matricula: statusInicial,
      plano_id: planoId,
      origem_acesso: origem,
      parceiro_externo: parceiroExterno,
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
    return { erro: await erroAmigavel(error, "cadastrar o aluno") };
  }

  // Mesma trava da edição: origem de parceiro/avulso não abre ciclo de plano
  // nem gera cobrança, mesmo que um plano tenha chegado no formulário.
  if (planoId && novo && origemExigePlanoDaAcademia(origem)) {
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
      return { erro: errHist };
    }

    if (statusInicial === "ativa") {
      const errCobranca = await gerarCobrancaInicial(
        supabase, sessao.academia.id, novo.id, planoId, diaVencimento,
        competencia, statusCobranca, dataPagamento, formaPagamento
      );
      if (errCobranca) {
        await supabase.from("alunos").delete().eq("id", novo.id).eq("academia_id", sessao.academia.id);
        return { erro: errCobranca };
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

/**
 * Monta os dados para exportar TODA a base de alunos em CSV. Roda no servidor
 * (a listagem no cliente é paginada — só 20 por página), devolve cabeçalho +
 * linhas já formatados, e o cliente dispara o download com `baixarCSV`
 * (lib/csv.ts), o mesmo utilitário que o Financeiro usa. Idade é derivada da
 * data de nascimento, nunca gravada. CPF sai formatado; datas em pt-BR.
 */
export async function exportarAlunosCsv(slug: string): Promise<
  | { cabecalho: string[]; linhas: (string | number | null)[][]; nomeArquivo: string }
  | { erro: string }
> {
  const sessao = await requireSecao(slug, "alunos");

  try {
    const [alunos, planos] = await Promise.all([
      getAlunosResumo(sessao.academia.id),
      getPlanos(sessao.academia.id),
    ]);
    const nomePlano = new Map(planos.map((p) => [p.id, p.nome]));

    const formatarCpf = (cpf: string | null): string => {
      const d = (cpf ?? "").replace(/\D/g, "");
      if (d.length !== 11) return cpf ?? "";
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    };
    const formatarData = (iso: string | null): string =>
      iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR") : "";

    const cabecalho = [
      "Matrícula", "Nome", "CPF", "E-mail", "Telefone", "Nascimento", "Idade",
      "Status", "Plano", "Dia de vencimento", "Objetivo",
    ];
    const linhas = alunos.map((a) => {
      const idade = calcularIdade(a.data_nascimento);
      return [
        a.matricula_codigo ?? "",
        a.nome,
        formatarCpf(a.cpf),
        a.email ?? "",
        a.telefone ?? "",
        formatarData(a.data_nascimento),
        idade ?? "",
        a.status_matricula,
        a.plano_id ? nomePlano.get(a.plano_id) ?? "" : "",
        a.dia_vencimento ?? "",
        a.objetivo ?? "",
      ];
    });

    return { cabecalho, linhas, nomeArquivo: `alunos-${slug}-${hojeSaoPaulo()}.csv` };
  } catch (error) {
    return { erro: await erroAmigavel(error as Error, "exportar os alunos") };
  }
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
 * Importa alunos em massa a partir de uma planilha .xlsx ou .csv.
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
    return { erro: "Selecione um arquivo Excel (.xlsx) ou CSV." };
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    return { erro: "Arquivo muito grande — máximo 5 MB." };
  }

  // Aceita .xlsx e .csv; a detecção é pelos bytes, não pela extensão.
  let grade: string[][];
  try {
    grade = await linhasDoArquivo(arquivo);
  } catch {
    return {
      erro: "Não consegui ler o arquivo. Use o modelo em Excel (.xlsx) ou um CSV.",
    };
  }

  const { data: planos } = await supabase
    .from("planos")
    .select("id, nome")
    .eq("academia_id", sessao.academia.id);

  const analise = analisarLinhas(
    grade,
    (planos ?? []) as { id: string; nome: string }[]
  );

  if (analise.validos.length === 0) {
    return {
      erro: analise.erros[0]?.motivo ?? "Nenhum aluno válido na planilha.",
      errosLinha: analise.erros,
      avisos: analise.avisos,
    };
  }

  const diaPadrao = spHoje().dia;
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
      else errosLinha.push({ linha: a.linha, motivo: await erroAmigavel(error, "gravar este aluno") });
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

  // Padronização (2026-08-11): "MARIA DA SILVA" é gravado "Maria da Silva".
  // Normalizar não recusa nada — nome vazio continua sendo o único caso que
  // barra o cadastro, e a checagem abaixo pega tanto "" quanto "   ".
  const nome = normalizarNomeProprio(formData.get("nome") as string);
  if (!nome) return { erro: "Informe o nome do aluno." };

  const cpf = lerCpf(formData);
  if ("erro" in cpf) return { erro: cpf.erro };

  const { origem, parceiroExterno } = lerOrigemAcesso(formData);
  const statusDoForm = (formData.get("status") as StatusMatricula) || "ativa";

  // Lê estado atual ANTES de decidir o plano: é dele que sai o vínculo a
  // preservar quando o formulário não traz o campo (ver abaixo).
  const { data: atual } = await supabase
    .from("alunos")
    .select("plano_id, status_matricula, dia_vencimento")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  // PROTEÇÃO DE DADO: este update grava `plano_id` direto do formulário. Se um
  // formulário qualquer deixar de enviar o campo (é o caso das origens de
  // parceiro, onde o select de plano não aparece), `plano_id` viraria null e o
  // vínculo do aluno com o plano dele — Mensal, Trimestral, o que for — seria
  // apagado em silêncio. Campo ausente passa a significar "não mexer";
  // desvincular exige enviar o campo vazio de propósito.
  const planoId = formData.has("plano_id")
    ? String(formData.get("plano_id") ?? "").trim() || null
    : (atual?.plano_id ?? null);

  // A trava "sem plano → pendente" vale só para a origem "Plano da academia" —
  // ver resolverStatusMatricula (lib/utils.ts).
  const novoStatus = resolverStatusMatricula(origem, planoId, statusDoForm);

  // Sem valor válido no formulário, mantém o dia que o aluno já tinha — trocar
  // silenciosamente o vencimento de quem já é cliente seria pior que ignorar.
  const diaVencimento =
    lerDiaVencimento(formData.get("dia_vencimento") as string) ??
    atual?.dia_vencimento ??
    spHoje().dia;

  const { error } = await supabase
    .from("alunos")
    .update({
      nome,
      cpf: cpf.cpf,
      email: normalizarEmail(formData.get("email") as string),
      telefone: normalizarTelefone(formData.get("telefone") as string),
      data_nascimento: lerDataNascimento(formData),
      // Foto é enviada à parte, por atualizarFotoAlunoAdmin — edição de dados
      // cadastrais não mexe em foto_perfil_url.
      status_matricula: novoStatus,
      plano_id: planoId,
      origem_acesso: origem,
      parceiro_externo: parceiroExterno,
      dia_vencimento: diaVencimento,
      ...lerCamposSaude(formData),
    })
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "atualizar o aluno") };

  const statusAnterior = atual?.status_matricula ?? "ativa";
  const trocouPlano = planoId && planoId !== (atual?.plano_id ?? null);
  const reativando = novoStatus === "ativa" && statusAnterior !== "ativa";

  // Ciclo de plano e cobrança pertencem SÓ a quem paga plano da academia. Sem
  // esta trava, um aluno de parceiro que ainda carrega o plano-fantasma
  // preservado pela migration 096 geraria mensalidade daquele plano ao ser
  // reativado — cobrança indevida de quem o parceiro já paga.
  const gerenciaPlanoDaAcademia = origemExigePlanoDaAcademia(origem);

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

  if (gerenciaPlanoDaAcademia && reativando && trocouPlano && planoId) {
    // Reativação com troca de plano: fecha ciclo anterior, abre novo e gera cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Troca de plano na reativação");
    const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
    if (errHist) return { erro: errHist };
    const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
    if (errCob) return { erro: errCob };
  } else if (gerenciaPlanoDaAcademia && reativando && planoId) {
    const vigente = await cicloVigente(supabase, sessao.academia.id, alunoId);
    if (!vigente) {
      // Ciclo encerrado (ou inexistente): abre um novo ciclo e cobra.
      await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Ciclo encerrado — reativação");
      const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
      if (errHist) return { erro: errHist };
      const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
      if (errCob) return { erro: errCob };
    } else if (!(await possuiCobrancaNoCicloAtual(supabase, sessao.academia.id, alunoId))) {
      // Ciclo vigente mas ainda sem cobrança — caso do aluno cadastrado com
      // plano e status "pendente", que nunca recebeu a cobrança inicial.
      const errCob = await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
      if (errCob) return { erro: errCob };
    }
  } else if (gerenciaPlanoDaAcademia && trocouPlano && planoId) {
    // Troca de plano sem reativação: registra histórico, sem gerar cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId, "Troca de plano");
    const errHist = await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
    if (errHist) return { erro: errHist };
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
  if (errCob) return { erro: errCob };

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true };
}

export async function excluirAluno(slug: string, alunoId: string): Promise<{ erro: string } | void> {
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

  if (error) return { erro: await erroAmigavel(error, "excluir o aluno") };

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
    .eq("academia_id", sessao.academia.id)
    .eq("aluno_id", alunoId);

  const { data: treino, error: erroTreino } = await supabase
    .from("treinos")
    .insert({
      academia_id: sessao.academia.id,
      aluno_id: alunoId,
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
      criado_por: sessao.userId,
      profissional_nome: sessao.nome,
      origem: "manual",
      ordem: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (erroTreino || !treino) {
    return { erro: await erroAmigavel(erroTreino, "criar o treino") };
  }

  const { error: erroExercicios } = await supabase
    .from("exercicios_treino")
    .insert(montarLinhasExercicio(treino.id, exercicios));

  if (erroExercicios) {
    // Desfaz o treino se os exercícios falharem, para não deixar ficha vazia.
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: await erroAmigavel(erroExercicios, "salvar os exercícios") };
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
    return { erro: await erroAmigavel(erroTreino, "atualizar a ficha") };
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
    return { erro: await erroAmigavel(erroRemocao, "atualizar os exercícios") };
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
    return { erro: await erroAmigavel(erroInsercao, "salvar os exercícios") };
  }

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirTreino(slug: string, treinoId: string): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "excluir a ficha de treino") };

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
    data: String(formData.get("data") ?? "").trim() || spHojeISO(),
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

  if (error) return { erro: await erroAmigavel(error, "registrar o progresso") };

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirProgresso(
  slug: string,
  registroId: string
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "alunos");
  const supabase = createClient();

  const { error } = await supabase
    .from("progresso_aluno")
    .delete()
    .eq("id", registroId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "excluir o registro de progresso") };

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

  if (error) return { erro: await erroAmigavel(error, "salvar a foto") };

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

  if (error) return { erro: await erroAmigavel(error, "remover a foto") };

  await removerFotoAntiga(atual?.foto_perfil_url ?? null);

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}/recepcao`);
  return { ok: true };
}

/**
 * Busca um aluno completo (todos os campos) para preencher o formulário de
 * edição sob demanda. A listagem paginada (getAlunosPaginado) não traz mais
 * CPF, e-mail e contato de emergência em massa — esses campos só chegam ao
 * cliente quando o usuário abre a edição de um aluno específico.
 *
 * Devolve `{ erro }` em vez de lançar exceção — mesmo padrão das demais
 * actions deste arquivo — para o cliente poder sair do estado de
 * carregamento e mostrar uma mensagem em vez de ficar preso no spinner.
 */
export async function buscarAlunoParaEdicao(
  slug: string,
  alunoId: string
): Promise<{ aluno: Aluno | null; erro?: string }> {
  const sessao = await requireSecao(slug, "alunos");
  try {
    const aluno = await getAluno(sessao.academia.id, alunoId);
    return { aluno };
  } catch (error) {
    return { aluno: null, erro: await erroAmigavel(error as Error, "carregar os dados do aluno") };
  }
}
