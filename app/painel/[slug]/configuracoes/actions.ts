"use server";

import type { EstadoAcao, PoliticaInadimplencia } from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POLITICAS_INADIMPLENCIA } from "@/lib/types";
import { validarUrl } from "@/lib/validacoes";
import { erroAmigavel } from "@/lib/erros-servidor";
import { normalizarTelefone } from "@/lib/normalizacao";

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

  // Limites de retenção: inteiros vindos do navegador nunca são confiáveis.
  // Cada campo cai no default da migration 029 se vier vazio ou inválido, e a
  // ordem atenção < risco < sumido é imposta aqui, não só pelo CHECK do banco.
  const inteiro = (campo: string, padrao: number) => {
    const n = parseInt(String(formData.get(campo) ?? ""), 10);
    return Number.isFinite(n) && n >= 1 && n <= 365 ? n : padrao;
  };

  const diasAtencao = inteiro("dias_atencao_sem_acesso", 7);
  const diasRisco = inteiro("dias_risco_sem_acesso", 10);
  const diasSumido = inteiro("dias_sumido_sem_acesso", 14);
  const toleranciaNovo = inteiro("tolerancia_novo_aluno_dias", 7);

  if (!(diasAtencao < diasRisco && diasRisco < diasSumido)) {
    return {
      erro:
        "Os limites de retenção devem ser crescentes: atenção menor que risco, " +
        "e risco menor que sumido.",
    };
  }

  const { error } = await supabase
    .from("academias")
    .update({
      nome_fantasia: nomeFantasia,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      // Só a máscara do telefone é padronizada. `nome_fantasia` fica como o
      // dono escreveu: é a marca dele, e "CIA ATHLETICA" em caixa alta pode
      // ser exatamente o nome registrado da academia.
      telefone: normalizarTelefone(formData.get("telefone") as string),
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      logo_url: validarUrl(String(formData.get("logo_url") ?? "")),
      cor_primaria: String(formData.get("cor_primaria") ?? "").trim() || "#adff42",
      meta_faturamento_mensal: meta,
      politica_inadimplencia: politica,
      dias_atencao_sem_acesso: diasAtencao,
      dias_risco_sem_acesso: diasRisco,
      dias_sumido_sem_acesso: diasSumido,
      tolerancia_novo_aluno_dias: toleranciaNovo,
    })
    .eq("id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "salvar") };

  revalidatePath(`/painel/${slug}/configuracoes`);
  revalidatePath(`/painel/${slug}/recepcao`);
  revalidatePath(`/painel/${slug}/retencao`);
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/aluno/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

