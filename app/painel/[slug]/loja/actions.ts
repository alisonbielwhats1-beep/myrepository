"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoriaProduto } from "@/lib/types";

export type EstadoProduto = { erro?: string; ok?: boolean; savedAt?: number };

const CATEGORIAS_VALIDAS: CategoriaProduto[] = [
  "suplemento",
  "acessorio",
  "vestuario",
  "bebida",
  "equipamento",
  "outro",
];

function lerCampos(formData: FormData) {
  const categoria = String(formData.get("categoria") ?? "outro") as CategoriaProduto;
  const estoqueRaw = String(formData.get("estoque") ?? "").trim();
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    categoria: CATEGORIAS_VALIDAS.includes(categoria) ? categoria : "outro",
    preco: Number(formData.get("preco") ?? 0) || 0,
    imagem_url: String(formData.get("imagem_url") ?? "").trim() || null,
    estoque: estoqueRaw === "" ? null : Number(estoqueRaw),
    destaque: formData.get("destaque") === "on",
    ativo: formData.get("ativo") === "on",
  };
}

export async function criarProduto(
  slug: string,
  _estado: EstadoProduto,
  formData: FormData
): Promise<EstadoProduto> {
  const sessao = await requireSessao(slug);
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };

  const supabase = createClient();
  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id);

  const { error } = await supabase.from("produtos").insert({
    academia_id: sessao.academia.id,
    ...campos,
    ordem: (count ?? 0) + 1,
  });

  if (error) return { erro: `Falha ao cadastrar produto: ${error.message}` };

  revalidatePath(`/painel/${slug}/loja`);
  return { ok: true, savedAt: Date.now() };
}

export async function atualizarProduto(
  slug: string,
  produtoId: string,
  _estado: EstadoProduto,
  formData: FormData
): Promise<EstadoProduto> {
  const sessao = await requireSessao(slug);
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };

  const supabase = createClient();
  const { error } = await supabase
    .from("produtos")
    .update(campos)
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id);

  if (error) return { erro: `Falha ao atualizar produto: ${error.message}` };

  revalidatePath(`/painel/${slug}/loja`);
  return { ok: true, savedAt: Date.now() };
}

export async function alternarAtivoProduto(
  slug: string,
  produtoId: string,
  ativo: boolean
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ ativo })
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao atualizar produto: ${error.message}`);
  revalidatePath(`/painel/${slug}/loja`);
}

export async function excluirProduto(
  slug: string,
  produtoId: string
): Promise<void> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();
  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir produto: ${error.message}`);
  revalidatePath(`/painel/${slug}/loja`);
}
