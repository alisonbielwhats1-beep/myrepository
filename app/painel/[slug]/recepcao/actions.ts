"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth"
import type { EstadoAcao } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { OrigemAcesso } from "@/lib/types";
import { decidirAcesso, statusLiberacaoDe } from "@/lib/utils";

const REPASSE_POR_ORIGEM: Record<OrigemAcesso, number> = {
  Direto: 0,
  Gympass: 12.5,
  TotalPass: 10,
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
