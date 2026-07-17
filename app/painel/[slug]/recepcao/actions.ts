"use server";

import { revalidatePath } from "next/cache";
import { requireSessao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrigemAcesso } from "@/lib/types";

export type EstadoAcesso = { erro?: string; ok?: boolean; savedAt?: number };

const REPASSE_POR_ORIGEM: Record<OrigemAcesso, number> = {
  Direto: 0,
  Gympass: 12.5,
  TotalPass: 10,
};

/** Registra manualmente uma entrada na catraca (recepção sem hardware integrado). */
export async function registrarAcesso(
  slug: string,
  _estado: EstadoAcesso,
  formData: FormData
): Promise<EstadoAcesso> {
  const sessao = await requireSessao(slug);
  const supabase = createClient();

  const alunoId = String(formData.get("aluno_id") ?? "").trim();
  const origem = (formData.get("origem") as OrigemAcesso) || "Direto";
  if (!alunoId) return { erro: "Selecione um aluno." };

  const { data: aluno } = await supabase
    .from("alunos")
    .select("status_matricula")
    .eq("id", alunoId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();

  if (!aluno) return { erro: "Aluno não encontrado." };

  const liberado = aluno.status_matricula === "ativa";

  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: sessao.academia.id,
    aluno_id: alunoId,
    origem,
    valor_repasse: REPASSE_POR_ORIGEM[origem],
    status_liberacao: liberado ? "liberado" : "negado",
    observacao: liberado ? null : "Matrícula não está ativa",
  });

  if (error) return { erro: `Falha ao registrar acesso: ${error.message}` };

  revalidatePath(`/painel/${slug}/recepcao`);
  revalidatePath(`/painel/${slug}`);
  return { ok: true, savedAt: Date.now() };
}
