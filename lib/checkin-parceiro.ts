// Registro de um check-in vindo de plataforma parceira (TotalPass) no controle
// de acessos. Server-only: recebe o client de service role de quem chama (as
// rotas de webhook), que já identificou a academia.
//
// Mesma decisão central da recepção (decidirAcesso) — nunca uma regra paralela.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisaoAcesso, PoliticaInadimplencia } from "@/lib/types";
import { decidirAcesso, statusLiberacaoDe } from "@/lib/utils";

export type ResultadoCheckinParceiro =
  | { duplicado: true }
  | { duplicado: false; acessoId: string; decisao: DecisaoAcesso | null; alunoId: string | null }
  | { erro: string };

export async function registrarCheckinParceiro(
  supabase: SupabaseClient,
  entrada: {
    academiaId: string;
    politica: PoliticaInadimplencia | null;
    cpf: string | null;
    eventoId: string | null;
    /** Observação quando o CPF não é de nenhum aluno cadastrado. */
    observacaoSemCadastro?: string;
  }
): Promise<ResultadoCheckinParceiro> {
  const { academiaId, cpf } = entrada;

  let alunoId: string | null = null;
  let observacao: string | null = null;
  let decisao: DecisaoAcesso | null = null;

  if (cpf) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, status_matricula")
      .eq("academia_id", academiaId)
      .eq("cpf", cpf)
      .maybeSingle();

    if (aluno) {
      alunoId = aluno.id;
      const { data: mensalidades } = await supabase
        .from("receitas")
        .select("id, competencia, data, valor, status")
        .eq("academia_id", academiaId)
        .eq("aluno_id", aluno.id)
        .eq("tipo", "mensalidade")
        .eq("status", "pendente");

      decisao = decidirAcesso(
        aluno.status_matricula,
        entrada.politica ?? "liberar",
        mensalidades ?? []
      );
      observacao = decisao.motivo;
    } else {
      observacao = entrada.observacaoSemCadastro ?? "CPF não encontrado no cadastro";
    }
  }

  // Valor vigente configurado pelo dono (migration 049) — copiado agora para
  // o acesso, para nunca mudar retroativamente se a config mudar depois.
  const { data: config } = await supabase
    .from("config_repasse_parceiros")
    .select("valor_por_checkin")
    .eq("academia_id", academiaId)
    .eq("plataforma", "totalpass")
    .eq("ativo", true)
    .maybeSingle();
  const valorRepasseVigente = config?.valor_por_checkin ?? null;

  const { data, error } = await supabase
    .from("acessos_catraca")
    .insert({
      academia_id: academiaId,
      aluno_id: alunoId,
      origem: "TotalPass",
      // Check-in bloqueado permanece registrado, mas sem repasse: a entrada
      // não aconteceu. "alerta" é entrada permitida e mantém o repasse.
      valor_repasse: decisao?.resultado === "bloqueado" ? 0 : valorRepasseVigente,
      status_liberacao: decisao ? statusLiberacaoDe(decisao.resultado) : "liberado",
      evento_externo_id: entrada.eventoId,
      observacao,
      politica_aplicada: decisao?.politicaAplicada ?? null,
      mensalidade_id: decisao?.mensalidadeId ?? null,
      dias_atraso: decisao?.diasAtraso ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = reenvio do mesmo check-in. Idempotente: não duplica.
    if (error.code === "23505") return { duplicado: true };
    return { erro: error.message };
  }
  return { duplicado: false, acessoId: data.id as string, decisao, alunoId };
}
