"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ResultadoCiclo = { ok: boolean; erro?: string };

/** Revalida as telas que mostram o estado do aluno após uma ação de ciclo. */
function revalidar(slug: string) {
  revalidatePath(`/painel/${slug}/alunos/acesso`);
  revalidatePath(`/painel/${slug}/alunos`);
  revalidatePath(`/painel/${slug}`);
}

/** Mensagem amigável a partir do código/mensagem cru da RPC (sem jargão). */
function amigavel(msg: string, acaoFalha: string): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("aluno_nao_encontrado"))
    return "Aluno não encontrado nesta academia.";
  if (m.includes("matricula_nao_encontrada"))
    return "Matrícula não encontrada.";
  if (m.includes("status_invalido")) return "Situação inválida para esta ação.";
  if (m.includes("uniq") || m.includes("duplicate") || m.includes("23505"))
    return "Já existe uma matrícula ativa para este aluno. Encerre a atual antes de abrir outra.";
  return `Não foi possível ${acaoFalha} agora. Tente novamente.`;
}

// ---------------------------------------------------------------------------
// Acesso (vínculo academia_membros)
// ---------------------------------------------------------------------------

export async function suspenderAcessoAluno(
  slug: string,
  alunoId: string,
  motivo?: string
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("suspender_acesso_aluno", {
    p_aluno_id: alunoId,
    p_motivo: motivo?.trim() || null,
  });
  if (error) return { ok: false, erro: amigavel(error.message, "suspender o acesso") };
  revalidar(slug);
  return { ok: true };
}

export async function reativarAcessoAluno(
  slug: string,
  alunoId: string
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("reativar_acesso_aluno", {
    p_aluno_id: alunoId,
  });
  if (error) return { ok: false, erro: amigavel(error.message, "reativar o acesso") };
  revalidar(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cadastro (arquivar / reativar) — SEPARADO da cobrança (status_matricula)
// ---------------------------------------------------------------------------

export async function arquivarAluno(
  slug: string,
  alunoId: string,
  motivo?: string
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("arquivar_aluno", {
    p_aluno_id: alunoId,
    p_motivo: motivo?.trim() || null,
  });
  if (error) return { ok: false, erro: amigavel(error.message, "arquivar o aluno") };
  revalidar(slug);
  return { ok: true };
}

export async function reativarCadastroAluno(
  slug: string,
  alunoId: string
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("reativar_cadastro_aluno", {
    p_aluno_id: alunoId,
  });
  if (error) return { ok: false, erro: amigavel(error.message, "reativar o cadastro") };
  revalidar(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Matrículas (períodos temporais) — histórico de acesso, não a cobrança
// ---------------------------------------------------------------------------

export async function iniciarMatricula(
  slug: string,
  alunoId: string,
  planoId?: string | null
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("iniciar_matricula", {
    p_aluno_id: alunoId,
    p_plano_id: planoId?.trim() || null,
    p_data_inicio: new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, erro: amigavel(error.message, "iniciar a matrícula") };
  revalidar(slug);
  return { ok: true };
}

export async function encerrarMatricula(
  slug: string,
  matriculaId: string,
  status: "encerrada" | "cancelada" | "trancada" = "encerrada",
  motivo?: string
): Promise<ResultadoCiclo> {
  await requireSecao(slug, "alunos");
  const supabase = createClient();
  const { error } = await supabase.rpc("encerrar_matricula", {
    p_matricula_id: matriculaId,
    p_status: status,
    p_motivo: motivo?.trim() || null,
    p_data_fim: new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, erro: amigavel(error.message, "encerrar a matrícula") };
  revalidar(slug);
  return { ok: true };
}
