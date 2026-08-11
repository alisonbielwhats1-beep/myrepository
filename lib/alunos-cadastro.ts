// Núcleo do cadastro de aluno reaproveitado pelo formulário (criarAluno) e
// pela importação em massa (importarAlunos) — uma regra de insert só, sem
// divergência. Server-only (usa o client do Supabase).

import type { createClient } from "./supabase/server";

type ClienteSupabase = ReturnType<typeof createClient>;

/**
 * Insere um aluno gerando a matrícula de forma atômica (nextval_matricula,
 * sem race condition). `campos` são as colunas já validadas por quem chama
 * (nome, cpf, email, telefone, status_matricula, plano_id, dia_vencimento,
 * chave_idempotencia e, no formulário, os campos de saúde). O `academia_id` e
 * o `matricula_codigo` são preenchidos aqui — nunca vêm de fora.
 *
 * Devolve o resultado cru do insert (`{ data, error }`): quem chama decide o
 * que fazer com 23505 (o formulário trata reenvio; a importação trata "já
 * existe" por CPF).
 */
export async function inserirAlunoComMatricula(
  supabase: ClienteSupabase,
  academiaId: string,
  campos: Record<string, unknown>
): Promise<{
  data: { id: string } | null;
  error: { code?: string; message: string } | null;
}> {
  const { data: codigoData } = await supabase.rpc("nextval_matricula", {
    p_academia_id: academiaId,
  });
  const matriculaCodigo = (codigoData as string | null) ?? `AL-${Date.now()}`;

  return supabase
    .from("alunos")
    .insert({
      academia_id: academiaId,
      matricula_codigo: matriculaCodigo,
      ...campos,
    })
    .select("id")
    .single();
}
