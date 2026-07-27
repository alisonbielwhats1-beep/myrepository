"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth"
import type { EstadoAcao } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { OrigemAcesso } from "@/lib/types";
import { tokenTemFormatoValido } from "@/lib/aluno-classificacao";
import { decidirAcesso, statusLiberacaoDe } from "@/lib/utils";

const REPASSE_POR_ORIGEM: Record<OrigemAcesso, number> = {
  Direto: 0,
  Gympass: 12.5,
  TotalPass: 10,
  qr: 0,
};

/** Registra manualmente uma entrada na catraca (recepção sem hardware integrado). */
export async function registrarAcesso(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "recepcao");
  const supabase = createClient();

  const alunoId = String(formData.get("aluno_id") ?? "").trim();
  const origem = (formData.get("origem") as OrigemAcesso) || "Direto";
  // Gerada uma vez por tentativa de envio (não por aluno) — ver FormularioAcesso.
  const chaveIdempotencia = String(formData.get("chave_idempotencia") ?? "").trim() || null;
  if (!alunoId) return { erro: "Selecione um aluno." };

  const { data: aluno } = await supabase
    .from("alunos")
    .select("status_matricula")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  if (!aluno) return { erro: "Aluno não encontrado." };

  // Mensalidades pendentes do aluno. A filtragem do que conta como vencido
  // (e o que é futuro, pago ou cancelado) é responsabilidade de decidirAcesso.
  const { data: mensalidades } = await supabase
    .from("receitas")
    .select("id, competencia, data, valor, status")
    .eq("academia_id", sessao.academia.id)
    .eq("aluno_id", alunoId)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente");

  const decisao = decidirAcesso(
    aluno.status_matricula,
    sessao.academia.politica_inadimplencia ?? "liberar",
    mensalidades ?? []
  );

  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: sessao.academia.id,
    aluno_id: alunoId,
    origem,
    // Entrada bloqueada fica no histórico, mas sem efeito financeiro: não houve
    // uso da academia, logo não há repasse a receber. "alerta" é entrada
    // permitida e mantém o repasse normal.
    valor_repasse:
      decisao.resultado === "bloqueado" ? 0 : REPASSE_POR_ORIGEM[origem],
    status_liberacao: statusLiberacaoDe(decisao.resultado),
    observacao: decisao.motivo,
    politica_aplicada: decisao.politicaAplicada,
    mensalidade_id: decisao.mensalidadeId,
    dias_atraso: decisao.diasAtraso,
    registrado_por: sessao.userId,
    chave_idempotencia: chaveIdempotencia,
  });

  if (error) {
    // 23505 = mesma chave de idempotência já gravada: é um reenvio da mesma
    // tentativa (duplo clique, retry de rede). A decisão recém-calculada é a
    // mesma que gerou a linha original, então devolvemos ok sem duplicar.
    if (error.code === "23505") {
      return { ok: true, savedAt: Date.now(), decisao };
    }
    return { erro: `Falha ao registrar acesso: ${error.message}` };
  }

  revalidatePath(`/painel/${slug}/recepcao`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now(), decisao };
}

/**
 * Confirma a entrada de um aluno pelo QR de acesso (Bloco 1). Só grava em
 * `acessos_catraca` quando a recepção clica explicitamente em "Confirmar" —
 * o carregamento da página (GET) nunca registra nada sozinho, para não
 * confundir uma pré-visualização de link/crawler com uma entrada real.
 *
 * O aluno é resolvido pelo `token_qr_acesso` INTEIRO no servidor, restrito à
 * academia da sessão (`sessao.academia.id`) — nunca por um aluno_id vindo do
 * formulário. Reaproveita a mesma `decidirAcesso()` da recepção manual: nenhuma
 * regra de acesso paralela.
 */
export async function confirmarAcessoQr(
  slug: string,
  tokenQr: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "recepcao");

  if (!tokenTemFormatoValido(tokenQr)) {
    return { erro: "QR inválido." };
  }

  const supabase = createClient();
  const chaveIdempotencia = String(formData.get("chave_idempotencia") ?? "").trim() || null;

  const { data: aluno } = await supabase
    .from("alunos")
    .select("id, status_matricula")
    .eq("token_qr_acesso", tokenQr)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  // Nunca distingue "token de outra academia" de "token inexistente" — os
  // dois caem na mesma mensagem genérica.
  if (!aluno) return { erro: "QR inválido ou aluno não encontrado nesta academia." };

  const { data: mensalidades } = await supabase
    .from("receitas")
    .select("id, competencia, data, valor, status")
    .eq("academia_id", sessao.academia.id)
    .eq("aluno_id", aluno.id)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente");

  const decisao = decidirAcesso(
    aluno.status_matricula,
    sessao.academia.politica_inadimplencia ?? "liberar",
    mensalidades ?? []
  );

  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: sessao.academia.id,
    aluno_id: aluno.id,
    origem: "qr",
    valor_repasse: REPASSE_POR_ORIGEM.qr,
    status_liberacao: statusLiberacaoDe(decisao.resultado),
    observacao: decisao.motivo,
    politica_aplicada: decisao.politicaAplicada,
    mensalidade_id: decisao.mensalidadeId,
    dias_atraso: decisao.diasAtraso,
    registrado_por: sessao.userId,
    chave_idempotencia: chaveIdempotencia,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, savedAt: Date.now(), decisao };
    }
    return { erro: `Falha ao registrar acesso: ${error.message}` };
  }

  revalidatePath(`/painel/${slug}/recepcao`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now(), decisao };
}
