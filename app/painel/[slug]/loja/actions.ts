"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth"
import type { EstadoAcao } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { CategoriaProduto } from "@/lib/types";

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
    estoque_minimo: Math.max(0, Number(formData.get("estoque_minimo") ?? 5) || 0),
    destaque: formData.get("destaque") === "on",
    ativo: formData.get("ativo") === "on",
  };
}

export async function criarProduto(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "loja");
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };
  if (campos.preco < 0) return { erro: "O preço não pode ser negativo." };

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
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "loja");
  const campos = lerCampos(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };
  if (campos.preco < 0) return { erro: "O preço não pode ser negativo." };

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
  const sessao = await requireSecao(slug, "loja");
  const supabase = createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ ativo })
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao atualizar produto: ${error.message}`);
  revalidatePath(`/painel/${slug}/loja`);
}

/**
 * Dá baixa de estoque e registra a venda como receita (venda_produto, paga).
 * Ex.: vendeu 1 par de meias -> baixa 1 do estoque e lança a receita.
 */
export async function registrarVendaProduto(
  slug: string,
  produtoId: string,
  quantidade: number
): Promise<{ ok?: boolean; erro?: string }> {
  const sessao = await requireSecao(slug, "loja");
  const qtd = Math.max(1, Math.floor(Number(quantidade) || 1));
  const supabase = createClient();

  const { data: produto, error: e1 } = await supabase
    .from("produtos")
    .select("*")
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (e1 || !produto) return { erro: "Produto não encontrado." };

  // Baixa de estoque ATÔMICA no banco (checa e subtrai num único UPDATE),
  // evitando corrida entre duas vendas simultâneas (oversell).
  const { data: baixou, error: eBaixa } = await supabase.rpc(
    "baixar_estoque_venda",
    { p_produto_id: produtoId, p_qtd: qtd }
  );
  if (eBaixa) return { erro: `Falha ao baixar estoque: ${eBaixa.message}` };
  if (baixou === false) {
    return { erro: "Estoque insuficiente para essa quantidade." };
  }

  // Lança a receita da venda (vinculada ao produto, para o relatório da loja).
  const { error: eRec } = await supabase.from("receitas").insert({
    academia_id: sessao.academia.id,
    produto_id: produtoId,
    tipo: "venda_produto",
    descricao: `Venda - ${produto.nome}${qtd > 1 ? ` (x${qtd})` : ""}`,
    valor: Number(produto.preco) * qtd,
    data: new Date().toISOString().slice(0, 10),
    status: "pago",
    observacoes: "Baixa de estoque na loja",
  });
  if (eRec) return { erro: `Falha ao lançar a venda: ${eRec.message}` };

  revalidatePath(`/painel/${slug}/loja`);
  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
  return { ok: true };
}

/**
 * Estorna uma venda: apaga a receita e devolve o estoque ao produto.
 * Só funciona em receitas do tipo venda_produto da própria academia.
 */
export async function estornarVenda(
  slug: string,
  receitaId: string
): Promise<void> {
  const sessao = await requireSecao(slug, "loja");
  const supabase = createClient();

  const { data: receita, error: e1 } = await supabase
    .from("receitas")
    .select("id, valor, produto_id, produto:produtos(preco, estoque)")
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id)
    .eq("tipo", "venda_produto")
    .maybeSingle();
  if (e1 || !receita) throw new Error("Venda não encontrada.");

  const prod = (receita as unknown as {
    produto_id: string | null;
    valor: number;
    produto: { preco: number; estoque: number | null } | null;
  });

  if (prod.produto_id && prod.produto && prod.produto.estoque != null) {
    const preco = Number(prod.produto.preco);
    const qty = preco > 0 ? Math.round(Number(prod.valor) / preco) : 1;
    await supabase
      .from("produtos")
      .update({ estoque: prod.produto.estoque + qty })
      .eq("id", prod.produto_id)
      .eq("academia_id", sessao.academia.id);
  }

  const { error: e2 } = await supabase
    .from("receitas")
    .delete()
    .eq("id", receitaId)
    .eq("academia_id", sessao.academia.id);
  if (e2) throw new Error(`Falha ao estornar: ${e2.message}`);

  revalidatePath(`/painel/${slug}/loja`);
  revalidatePath(`/painel/${slug}/financeiro`, "layout");
  revalidatePath(`/painel/${slug}`);
}

export async function excluirProduto(
  slug: string,
  produtoId: string
): Promise<void> {
  const sessao = await requireSecao(slug, "loja");
  const supabase = createClient();
  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", produtoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(`Falha ao excluir produto: ${error.message}`);
  revalidatePath(`/painel/${slug}/loja`);
}
