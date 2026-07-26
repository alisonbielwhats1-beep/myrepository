"use server";

import type { EstadoAcao, PoliticaInadimplencia } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POLITICAS_INADIMPLENCIA } from "@/lib/types";
import { validarUrl } from "@/lib/validacoes";

export async function atualizarAcademia(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  // requireSecao("configuracoes") já restringe ao papel "dono" — nenhum outro
  // papel tem essa seção em PERMISSOES. A academia vem sempre da sessão do
  // servidor; nada de academia_id, usuário ou papel vindo do navegador.
  const sessao = await requireSecao(slug, "configuracoes");
  const supabase = createClient();

  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  if (!nomeFantasia) return { erro: "Informe o nome da academia." };

  // Política de inadimplência: só aceita valor da lista branca. Qualquer coisa
  // fora dela cai no padrão seguro, que é não bloquear ninguém.
  const politicaRecebida = String(formData.get("politica_inadimplencia") ?? "").trim();
  const politica: PoliticaInadimplencia = POLITICAS_INADIMPLENCIA.some(
    (p) => p.value === politicaRecebida
  )
    ? (politicaRecebida as PoliticaInadimplencia)
    : "liberar";

  // Meta de faturamento: aceita formato "1.234,56" ou "1234.56"; nunca negativa.
  const metaRaw = String(formData.get("meta_faturamento_mensal") ?? "").trim();
  const metaNum = metaRaw
    ? Number(metaRaw.replace(/\./g, "").replace(",", "."))
    : 0;
  const meta = Number.isFinite(metaNum) && metaNum > 0 ? metaNum : 0;

  const { error } = await supabase
    .from("academias")
    .update({
      nome_fantasia: nomeFantasia,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      logo_url: validarUrl(String(formData.get("logo_url") ?? "")),
      cor_primaria: String(formData.get("cor_primaria") ?? "").trim() || "#adff42",
      meta_faturamento_mensal: meta,
      politica_inadimplencia: politica,
    })
    .eq("id", sessao.academia.id);

  if (error) return { erro: `Falha ao salvar: ${error.message}` };

  revalidatePath(`/painel/${slug}/configuracoes`);
  revalidatePath(`/painel/${slug}/recepcao`);
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/aluno/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

