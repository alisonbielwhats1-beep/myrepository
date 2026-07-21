"use server";

import type { EstadoAcao } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function lerCampos(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    valor_mensal: Number(formData.get("valor_mensal") ?? 0) || 0,
    recorrencia_meses: Math.max(1, Number(formData.get("recorrencia_meses") ?? 1) || 1),
    cobranca_recorrente: formData.get("cobranca_recorrente") === "on",
    ativo: formData.get("ativo") === "on",
  };
}

export async function criarPlano(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "configuracoes");
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do plano." };

  const supabase = createClient();
  const { error } = await supabase
    .from("planos")
    .insert({ academia_id: sessao.academia.id, ...campos });
  if (error) return { erro: `Falha ao criar plano: ${error.message}` };

  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarPlano(
  slug: string,
  planoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "configuracoes");
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do plano." };

  const supabase = createClient();
  const { error } = await supabase
    .from("planos")
    .update(campos)
    .eq("id", planoId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: `Falha ao atualizar plano: ${error.message}` };

  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

export async function excluirPlano(slug: string, planoId: string): Promise<void> {
  const sessao = await requireSecao(slug, "configuracoes");
  const supabase = createClient();

  // Bloqueia excluir um plano que ainda tem alunos: sem isso o FK zerava o
  // plano de todos eles silenciosamente e a mensalidade parava de ser gerada.
  const { count } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id)
    .eq("plano_id", planoId);

  if ((count ?? 0) > 0) {
    throw new Error(
      `Este plano tem ${count} aluno(s) vinculado(s). Migre-os para outro plano ou desative o plano em vez de excluir.`
    );
  }

  const { error } = await supabase
    .from("planos")
    .delete()
    .eq("id", planoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir plano: ${error.message}`);
  revalidatePath(`/painel/${slug}/configuracoes`);
}
