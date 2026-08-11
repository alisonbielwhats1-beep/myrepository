"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusFuncionario } from "@/lib/types";
import { validarUrl } from "@/lib/validacoes";
import { registrarAuditoria } from "@/lib/auditoria";
import { erroAmigavel } from "@/lib/erros-amigaveis";
import {
  normalizarEmail,
  normalizarNomeProprio,
  normalizarTelefone,
} from "@/lib/normalizacao";


function lerCampos(formData: FormData) {
  const dia = Number(formData.get("dia_pagamento") ?? 0);
  return {
    // Padronização (2026-08-11): nome/cargo em capitalização de nome próprio,
    // e-mail minúsculo e telefone com máscara BR. Não recusa nada — só formata.
    nome: normalizarNomeProprio(formData.get("nome") as string),
    cargo: normalizarNomeProprio(formData.get("cargo") as string),
    telefone: normalizarTelefone(formData.get("telefone") as string),
    email: normalizarEmail(formData.get("email") as string),
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

  if (error) return { erro: erroAmigavel(error, "cadastrar o funcionário") };

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

  if (error) return { erro: erroAmigavel(error, "atualizar o funcionário") };

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
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "funcionarios");
  const supabase = createClient();

  // Lido ANTES de excluir: depois de deletado não há mais linha para
  // consultar. Nunca CPF nem salário aqui — nome, cargo e status já bastam
  // para investigação, sem dado sensível desnecessário.
  const { data: funcionarioRemovido } = await supabase
    .from("funcionarios")
    .select("nome, cargo, status")
    .eq("id", funcionarioId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  const { error } = await supabase
    .from("funcionarios")
    .delete()
    .eq("id", funcionarioId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: erroAmigavel(error, "excluir o funcionário") };

  await registrarAuditoria({
    academiaId: sessao.academia.id,
    usuarioId: sessao.userId,
    usuarioNome: sessao.nome,
    entidade: "funcionario",
    entidadeId: funcionarioId,
    acao: "funcionario_excluido",
    valorAnterior: funcionarioRemovido ?? undefined,
  });

  revalidatePath(`/painel/${slug}/funcionarios`);
  revalidatePath(`/painel/${slug}`);
}
