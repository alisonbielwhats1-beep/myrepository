"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EstadoPlano = { erro?: string; ok?: boolean; savedAt?: number };

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
  _estado: EstadoPlano,
  formData: FormData
): Promise<EstadoPlano> {
  const sessao = await requireSessao(slug);
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
  _estado: EstadoPlano,
  formData: FormData
): Promise<EstadoPlano> {
  const sessao = await requireSessao(slug);
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
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("planos")
    .delete()
    .eq("id", planoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir plano: ${error.message}`);
  revalidatePath(`/painel/${slug}/configuracoes`);
}
