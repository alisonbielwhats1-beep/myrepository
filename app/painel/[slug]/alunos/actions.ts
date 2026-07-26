"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusMatricula } from "@/lib/types";
import { normalizarCpf, validarUrl } from "@/lib/validacoes";

/**
 * Gera a mensalidade do mês corrente para o aluno, se ainda não existir.
 * Usa o índice único uidx_mensalidade_aluno_comp para idempotência —
 * em caso de duplicidade o banco ignora silenciosamente (onConflict ignore).
 */
async function gerarMensalidadeAtual(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string,
  diaVencimento: number
): Promise<void> {
  const { data: plano } = await supabase
    .from("planos")
    .select("nome, valor_mensal, cobranca_recorrente")
    .eq("id", planoId)
    .eq("academia_id", academiaId)
    .maybeSingle();

  if (!plano || !plano.cobranca_recorrente || plano.valor_mensal <= 0) return;

  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const diaVenc = Math.min(diaVencimento, 28);
  const vencimento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

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
 * Cancela mensalidades pendentes futuras (competência > mês atual) do aluno.
 * Chamado ao trancar ou cancelar — não apaga dívidas passadas.
 */
async function cancelarMensalidadesFuturas(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string
): Promise<void> {
  const hoje = new Date();
  const competenciaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
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

/** Registra no histórico o plano que o aluno passou a ter (troca/renovação). */
async function registrarHistoricoPlano(
  supabase: ReturnType<typeof createClient>,
  academiaId: string,
  alunoId: string,
  planoId: string
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
    await registrarHistoricoPlano(supabase, sessao.academia.id, novo.id, planoId);
    if (statusInicial === "ativa") {
      await gerarMensalidadeAtual(supabase, sessao.academia.id, novo.id, planoId, diaVencimento);
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

  if (trocouPlano) {
    await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, planoId);
  }

  // Reativando (de qualquer status não-ativo para ativo): gera mensalidade do mês corrente.
  if (novoStatus === "ativa" && statusAnterior !== "ativa" && planoId) {
    await gerarMensalidadeAtual(supabase, sessao.academia.id, alunoId, planoId, diaVencimento);
  }

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

/** Renova o plano atual do aluno: registra histórico e gera mensalidade do mês. */
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

  const diaVencimento = aluno.dia_vencimento ?? Math.min(new Date().getDate(), 28);

  await registrarHistoricoPlano(supabase, sessao.academia.id, alunoId, aluno.plano_id);
  await gerarMensalidadeAtual(supabase, sessao.academia.id, alunoId, aluno.plano_id, diaVencimento);

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
