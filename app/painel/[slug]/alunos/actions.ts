"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusMatricula } from "@/lib/types";
import { normalizarCpf, validarUrl } from "@/lib/validacoes";

// ---------------------------------------------------------------------------
// Helpers de data no fuso America/Sao_Paulo
// ---------------------------------------------------------------------------

function spHoje(): { ano: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => parseInt(partes.find((p) => p.type === t)!.value, 10);
  return { ano: v("year"), mes: v("month"), dia: v("day") };
}

function spHojeISO(): string {
  const { ano, mes, dia } = spHoje();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
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
 * Sempre tenta inserir uma cobrança para a competência fornecida.
 * Idempotente via índice único uidx_mensalidade_aluno_comp.
 */
async function gerarCobrancaInicial(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string,
  diaVencimento: number,
  competencia: string // YYYY-MM-01 no fuso SP
): Promise<void> {
  const { data: plano } = await supabase
    .from("planos")
    .select("nome, valor_mensal, cobranca_recorrente")
    .eq("id", planoId)
    .eq("academia_id", academiaId)
    .maybeSingle();

  if (!plano || !plano.cobranca_recorrente || plano.valor_mensal <= 0) return;

  const ano = parseInt(competencia.slice(0, 4), 10);
  const mes = parseInt(competencia.slice(5, 7), 10);
  const diaVenc = Math.min(diaVencimento, 28);
  const vencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

  await supabase.from("receitas").upsert(
    {
      academia_id: academiaId,
      aluno_id: alunoId,
      tipo: "mensalidade",
      descricao: `Mensalidade — ${plano.nome}`,
      valor: plano.valor_mensal,
      data: vencimento,
      competencia,
      status: "pendente",
    },
    { onConflict: "aluno_id,competencia", ignoreDuplicates: true }
  );
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
 * Fecha o registro mais recente em historico_planos que ainda não tem data_fim.
 * Chamado antes de abrir um novo ciclo (renovar ou reativar com novo plano).
 */
async function fecharHistoricoVigente(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string
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
    .update({ data_fim: spHojeISO() })
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
 */
async function registrarHistoricoPlano(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string,
  dataInicio?: string
): Promise<void> {
  const { data: plano } = await supabase
    .from("planos")
    .select("nome, valor_mensal, recorrencia_meses")
    .eq("id", planoId)
    .eq("academia_id", academiaId)
    .maybeSingle();
  if (!plano) return;
  await supabase.from("historico_planos").insert({
    academia_id: academiaId,
    aluno_id: alunoId,
    plano_id: planoId,
    plano_nome: plano.nome,
    valor: plano.valor_mensal,
    recorrencia_meses: plano.recorrencia_meses,
    data_inicio: dataInicio ?? spHojeISO(),
  });
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

  // Gera código de matrícula de forma atômica (sem race condition)
  const { data: codigoData } = await supabase.rpc("nextval_matricula", {
    p_academia_id: sessao.academia.id,
  });
  const matriculaCodigo = (codigoData as string | null) ?? `AL-${Date.now()}`;

  const { data: novo, error } = await supabase
    .from("alunos")
    .insert({
      academia_id: sessao.academia.id,
      nome,
      cpf: cpf.cpf,
      email: String(formData.get("email") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      foto_perfil_url: validarUrl(String(formData.get("foto_perfil_url") ?? "")),
      status_matricula: statusInicial,
      plano_id: planoId,
      dia_vencimento: diaVencimento,
      matricula_codigo: matriculaCodigo,
      ...lerCamposSaude(formData),
    })
    .select("id")
    .single();

  if (error) return { erro: `Falha ao cadastrar aluno: ${error.message}` };

  if (planoId && novo) {
    const competencia = spCompetencia();
    // data_inicio do ciclo inicial = hoje em SP.
    await registrarHistoricoPlano(supabase, sessao.academia.id, novo.id, planoId, spHojeISO());
    if (statusInicial === "ativa") {
      // Primeira cobrança do ciclo — sempre gera exatamente uma.
      await gerarCobrancaInicial(supabase, sessao.academia.id, novo.id, planoId, diaVencimento, competencia);
    }
  }

  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now(), id: novo?.id };
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
      foto_perfil_url: validarUrl(String(formData.get("foto_perfil_url") ?? "")),
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

  if (reativando && trocouPlano && planoId) {
    // Reativação com troca de plano: fecha ciclo anterior, abre novo e gera cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId);
    await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
    await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
  } else if (reativando && planoId) {
    // Reativação com mesmo plano: só gera cobrança se ciclo encerrado.
    const vigente = await cicloVigente(supabase, sessao.academia.id, alunoId);
    if (!vigente) {
      await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, planoId, diaVencimento, spCompetencia());
    }
  } else if (trocouPlano && planoId) {
    // Troca de plano sem reativação: registra histórico, sem gerar cobrança.
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId);
    await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId, spHojeISO());
  }
  // Edição de dados comuns (nome, email, dia_vencimento etc.) sem troca de status/plano:
  // nenhuma cobrança gerada.

  // Trancando ou cancelando: cancela mensalidades futuras pendentes.
  if (
    (novoStatus === "trancada" || novoStatus === "cancelada") &&
    statusAnterior === "ativa"
  ) {
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
    await fecharHistoricoVigente(supabase, sessao.academia.id, alunoId);
    // Cria novo registro para o ciclo que inicia hoje em SP.
    await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, aluno.plano_id, spHojeISO());
  }

  // Gera a cobrança do novo ciclo (idempotente via unique index).
  await gerarCobrancaInicial(supabase, sessao.academia.id, alunoId, aluno.plano_id, diaVencimento, competencia);

  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true };
}

export async function excluirAluno(slug: string, alunoId: string): Promise<void> {
  const sessao = await requireSecao(slug, "alunos");
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
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "alunos");
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
        imagem_demonstracao_url: validarUrl(ex.imagem_demonstracao_url),
        video_demonstracao_url: validarUrl(ex.video_demonstracao_url),
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
