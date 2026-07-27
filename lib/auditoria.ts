import { createClient } from "@/lib/supabase/server";

export type EntidadeAuditoria =
  | "aluno"
  | "plano"
  | "mensalidade"
  | "equipe"
  | "funcionario";

export type AcaoAuditoria =
  | "aluno_criado"
  | "aluno_atualizado"
  | "aluno_excluido"
  | "plano_alterado"
  | "mensalidade_paga"
  | "mensalidade_cancelada"
  | "equipe_criado"
  | "equipe_removido"
  | "equipe_papel_alterado"
  | "funcionario_excluido";

type ParametrosAuditoria = {
  academiaId: string;
  usuarioId: string;
  usuarioNome: string;
  entidade: EntidadeAuditoria;
  entidadeId?: string | null;
  acao: AcaoAuditoria;
  /** NUNCA inclua senha, token, segredo, cookie ou dado sensível aqui. */
  valorAnterior?: Record<string, unknown> | null;
  /** NUNCA inclua senha, token, segredo, cookie ou dado sensível aqui. */
  valorNovo?: Record<string, unknown> | null;
  metadados?: Record<string, unknown> | null;
};

/**
 * Registra uma ação crítica no log de auditoria (Fase 14, migration 040).
 * Nunca lança: a ação de negócio já foi concluída quando isto é chamado, e uma
 * falha ao auditar não pode desfazê-la nem ser reportada como se a operação
 * tivesse falhado. A falha vai para o log técnico do servidor (console.error)
 * para não passar despercebida — nunca é um catch vazio.
 */
export async function registrarAuditoria(
  params: ParametrosAuditoria
): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("logs_auditoria").insert({
      academia_id: params.academiaId,
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome,
      entidade: params.entidade,
      entidade_id: params.entidadeId ?? null,
      acao: params.acao,
      valor_anterior: params.valorAnterior ?? null,
      valor_novo: params.valorNovo ?? null,
      metadados: params.metadados ?? null,
    });
    if (error) {
      console.error(
        `[auditoria] falha ao registrar "${params.acao}" (academia ${params.academiaId}): ${error.message}`
      );
    }
  } catch (excecao) {
    console.error(
      `[auditoria] exceção ao registrar "${params.acao}" (academia ${params.academiaId}):`,
      excecao
    );
  }
}
