"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPlataforma } from "@/lib/admin-plataforma";
import { validarFaixa } from "@/lib/faixas-comerciais";
import { EstadoAcao, FaixaComercial } from "@/lib/types";

/**
 * Gestão comercial das faixas de preço (migration 056).
 *
 * TODA action começa por `requireAdminPlataforma()`: Server Actions são
 * endpoints invocáveis diretamente, então o guard da página não protege estas
 * funções. Abaixo disso ainda existe a RLS fail-closed no banco — só
 * service_role enxerga as tabelas.
 *
 * Não existe action de exclusão de propósito: faixa que já foi usada numa
 * proposta vira histórico. Desativar (ativo = false) é o caminho.
 *
 * Nada aqui toca em `academias.plano_saas`, em contrato, cobrança ou
 * mensalidade de aluno — a faixa é referência para a conversa comercial.
 */

/** Código do Postgres para "relation does not exist" (migration não aplicada). */
const TABELA_INEXISTENTE = "42P01";

const AVISO_MIGRATION =
  "As tabelas de faixas comerciais ainda não existem. Aplique supabase/migrations/056_faixas_comerciais.sql.";

/** Aceita "99.90" e "99,90"; devolve NaN quando não dá para ler. */
function lerDecimal(valor: FormDataEntryValue | null): number {
  const bruto = String(valor ?? "").trim().replace(",", ".");
  if (!bruto) return Number.NaN;
  return Number(bruto);
}

function lerInteiro(valor: FormDataEntryValue | null): number {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return Number.NaN;
  return Number(bruto);
}

/** Campo de teto vazio significa "faixa sem limite superior". */
function lerTeto(valor: FormDataEntryValue | null): number | null {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  return Number(bruto);
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const bruto = String(valor ?? "").trim();
  return bruto.length > 0 ? bruto : null;
}

type CamposFaixa = {
  nome: string;
  alunos_min: number;
  alunos_max: number | null;
  preco_mensal: number;
  ordem: number;
  ativo: boolean;
  publico: boolean;
  disponivel_novos_clientes: boolean;
  descricao_interna: string | null;
  observacoes_comerciais: string | null;
};

function lerCampos(formData: FormData): CamposFaixa {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    alunos_min: lerInteiro(formData.get("alunos_min")),
    alunos_max: lerTeto(formData.get("alunos_max")),
    preco_mensal: lerDecimal(formData.get("preco_mensal")),
    ordem: lerInteiro(formData.get("ordem")),
    ativo: formData.get("ativo") === "on",
    publico: formData.get("publico") === "on",
    disponivel_novos_clientes: formData.get("disponivel_novos_clientes") === "on",
    descricao_interna: lerTexto(formData.get("descricao_interna")),
    observacoes_comerciais: lerTexto(formData.get("observacoes_comerciais")),
  };
}

/**
 * Grava uma entrada de auditoria. Nunca derruba a operação principal: um log
 * que falha vira console.error, igual ao contrato de `registrarAuditoria`
 * (lib/auditoria.ts) — perder o rastro é ruim, desfazer a alteração já feita
 * seria pior.
 */
async function registrarLog(params: {
  faixaId: string | null;
  faixaNome: string;
  usuarioId: string;
  usuarioEmail: string;
  acao: "criada" | "atualizada" | "ativada" | "desativada";
  valorAnterior: Record<string, unknown> | null;
  valorNovo: Record<string, unknown> | null;
  motivo: string | null;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("faixas_comerciais_log").insert({
      faixa_id: params.faixaId,
      faixa_nome: params.faixaNome,
      usuario_id: params.usuarioId,
      usuario_email: params.usuarioEmail,
      acao: params.acao,
      valor_anterior: params.valorAnterior,
      valor_novo: params.valorNovo,
      motivo: params.motivo,
    });
    if (error) {
      console.error("[faixas-comerciais] falha ao registrar auditoria:", error.message);
    }
  } catch (e) {
    console.error("[faixas-comerciais] falha ao registrar auditoria:", e);
  }
}

function revalidar() {
  revalidatePath("/admin/planos");
  revalidatePath("/admin");
}

export async function criarFaixa(
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const { userId, email } = await requireAdminPlataforma();

  const campos = lerCampos(formData);
  const erro = validarFaixa(campos);
  if (erro) return { erro };

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("faixas_comerciais")
    .insert(campos)
    .select()
    .single();

  if (error) {
    if (error.code === TABELA_INEXISTENTE) return { erro: AVISO_MIGRATION };
    if (error.code === "23505") {
      return { erro: "Já existe uma faixa com esse nome." };
    }
    return { erro: `Falha ao criar a faixa: ${error.message}` };
  }

  await registrarLog({
    faixaId: data.id,
    faixaNome: data.nome,
    usuarioId: userId,
    usuarioEmail: email,
    acao: "criada",
    valorAnterior: null,
    valorNovo: data,
    motivo: lerTexto(formData.get("motivo")),
  });

  revalidar();
  return { ok: true, savedAt: Date.now(), id: data.id };
}

export async function atualizarFaixa(
  faixaId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const { userId, email } = await requireAdminPlataforma();

  const campos = lerCampos(formData);
  const erro = validarFaixa(campos);
  if (erro) return { erro };

  const admin = createServiceRoleClient();

  // Estado anterior COMPLETO antes de escrever: é o que a auditoria compara
  // (valor anterior/novo, limite anterior/novo) exigido no requisito 12.
  const { data: anterior, error: erroLeitura } = await admin
    .from("faixas_comerciais")
    .select("*")
    .eq("id", faixaId)
    .maybeSingle();

  if (erroLeitura) {
    if (erroLeitura.code === TABELA_INEXISTENTE) return { erro: AVISO_MIGRATION };
    return { erro: `Falha ao ler a faixa: ${erroLeitura.message}` };
  }
  if (!anterior) return { erro: "Faixa não encontrada." };

  const { data: novo, error } = await admin
    .from("faixas_comerciais")
    .update(campos)
    .eq("id", faixaId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { erro: "Já existe uma faixa com esse nome." };
    return { erro: `Falha ao salvar a faixa: ${error.message}` };
  }

  const anteriorTipado = anterior as FaixaComercial;
  const acao =
    anteriorTipado.ativo === campos.ativo
      ? "atualizada"
      : campos.ativo
        ? "ativada"
        : "desativada";

  await registrarLog({
    faixaId,
    faixaNome: novo.nome,
    usuarioId: userId,
    usuarioEmail: email,
    acao,
    valorAnterior: anterior,
    valorNovo: novo,
    motivo: lerTexto(formData.get("motivo")),
  });

  revalidar();
  return { ok: true, savedAt: Date.now(), id: faixaId };
}
