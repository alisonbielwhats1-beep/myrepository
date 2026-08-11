"use server";

import { revalidatePath } from "next/cache";
import { requireSecao, requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros-servidor";

/** Marca uma notificação como lida. Qualquer membro da academia pode — não é ação crítica. */
export async function marcarNotificacaoLida(
  slug: string,
  notificacaoId: string
): Promise<{ erro?: string }> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", notificacaoId)
    .eq("academia_id", sessao.academia.id)
    .is("lida_em", null);

  if (error) return { erro: await erroAmigavel(error, "marcar como lida") };
  revalidatePath(`/painel/${slug}`, "layout");
  return {};
}

/**
 * Marca como lidas as notificações não lidas/não dispensadas informadas.
 * Recebe os ids explicitamente (em vez de "todas da academia") porque a
 * leitura é filtrada por permissão no cliente (quem não vê Financeiro nunca
 * vê alerta de mensalidade) — "marcar todas" só pode marcar o que esse
 * usuário realmente enxergou, nunca categorias de outra seção junto.
 */
export async function marcarTodasNotificacoesLidas(
  slug: string,
  ids: string[]
): Promise<{ erro?: string }> {
  if (ids.length === 0) return {};
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("academia_id", sessao.academia.id)
    .in("id", ids)
    .is("lida_em", null)
    .is("dispensada_em", null);

  if (error) return { erro: await erroAmigavel(error, "marcar todas como lidas") };
  revalidatePath(`/painel/${slug}`, "layout");
  return {};
}

/**
 * Dispensa uma notificação (some da central). Não é DELETE — preserva a
 * linha (e a dedupe_key), então o mesmo evento não pode gerar outro alerta
 * idêntico enquanto a condição que o originou continuar valendo.
 */
export async function dispensarNotificacao(
  slug: string,
  notificacaoId: string
): Promise<{ erro?: string }> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const { error } = await supabase
    .from("notificacoes")
    .update({ dispensada_em: new Date().toISOString() })
    .eq("id", notificacaoId)
    .eq("academia_id", sessao.academia.id)
    .is("dispensada_em", null);

  if (error) return { erro: await erroAmigavel(error, "dispensar o aviso") };
  revalidatePath(`/painel/${slug}`, "layout");
  return {};
}

/**
 * Liga/desliga categorias de alerta e o limiar de "aluno ausente". Só o dono
 * (requireSecao("configuracoes") já restringe a esse papel, mesmo critério de
 * atualizarAcademia). Upsert: cria a linha na primeira configuração.
 */
export async function atualizarConfiguracoesNotificacoes(
  slug: string,
  formData: FormData
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "configuracoes");
  const supabase = createClient();

  const dias = parseInt(String(formData.get("aluno_ausente_dias") ?? "14"), 10);
  const alunoAusenteDias = [7, 14, 30].includes(dias) ? dias : 14;

  const { error } = await supabase.from("configuracoes_notificacoes").upsert({
    academia_id: sessao.academia.id,
    alerta_mensalidade_vencendo: formData.get("alerta_mensalidade_vencendo") === "on",
    alerta_mensalidade_atrasada: formData.get("alerta_mensalidade_atrasada") === "on",
    alerta_aluno_ausente: formData.get("alerta_aluno_ausente") === "on",
    alerta_aniversario: formData.get("alerta_aniversario") === "on",
    alerta_estoque_baixo: formData.get("alerta_estoque_baixo") === "on",
    aluno_ausente_dias: alunoAusenteDias,
    atualizado_em: new Date().toISOString(),
  });

  if (error) return { erro: await erroAmigavel(error, "salvar") };

  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true };
}
