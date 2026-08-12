import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MatriculaPeriodo = {
  id: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  motivo: string | null;
  planoNome: string | null;
};

export type DetalheAcessoAluno = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  statusCadastro: string;
  ativado: boolean;
  statusAcesso: string | null;
  conviteVivo: { id: string; status: string; expiraEm: string } | null;
  matriculas: MatriculaPeriodo[];
  planos: { id: string; nome: string }[];
};

/**
 * Detalhe do ciclo de acesso de UM aluno para a tela de gestão. Tudo isolado
 * por RLS (academia resolvida por academia_id_atual()). `academiaId` é usado
 * como filtro defensivo extra. Retorna null se o aluno não for da academia.
 */
export async function obterDetalheAcessoAluno(
  academiaId: string,
  alunoId: string
): Promise<DetalheAcessoAluno | null> {
  const supabase = createClient();

  const { data: aluno } = await supabase
    .from("alunos")
    .select("id, nome, telefone, email, status_cadastro, auth_user_id")
    .eq("id", alunoId)
    .eq("academia_id", academiaId)
    .maybeSingle();

  if (!aluno) return null;

  const [membroRes, conviteRes, matriculasRes, planosRes] = await Promise.all([
    supabase
      .from("academia_membros")
      .select("status_acesso")
      .eq("aluno_id", alunoId)
      .maybeSingle(),
    supabase
      .from("convites_acesso")
      .select("id, status, expira_em")
      .eq("aluno_id", alunoId)
      .in("status", ["gerado", "enviado", "aguardando_ativacao"])
      .maybeSingle(),
    supabase
      .from("matriculas")
      .select("id, status, data_inicio, data_fim, motivo, plano:planos(nome)")
      .eq("aluno_id", alunoId)
      .order("data_inicio", { ascending: false }),
    supabase
      .from("planos")
      .select("id, nome")
      .eq("academia_id", academiaId)
      .order("nome", { ascending: true }),
  ]);

  const matriculas: MatriculaPeriodo[] = (matriculasRes.data ?? []).map((m) => {
    const plano = m.plano as unknown as { nome?: string } | { nome?: string }[] | null;
    const planoNome = Array.isArray(plano) ? plano[0]?.nome ?? null : plano?.nome ?? null;
    return {
      id: m.id as string,
      status: m.status as string,
      dataInicio: m.data_inicio as string,
      dataFim: (m.data_fim as string) ?? null,
      motivo: (m.motivo as string) ?? null,
      planoNome,
    };
  });

  return {
    id: aluno.id as string,
    nome: (aluno.nome as string) ?? "",
    telefone: (aluno.telefone as string) ?? null,
    email: (aluno.email as string) ?? null,
    statusCadastro: (aluno.status_cadastro as string) ?? "ativo",
    ativado: Boolean(aluno.auth_user_id),
    statusAcesso: (membroRes.data?.status_acesso as string) ?? null,
    conviteVivo: conviteRes.data
      ? {
          id: conviteRes.data.id as string,
          status: conviteRes.data.status as string,
          expiraEm: conviteRes.data.expira_em as string,
        }
      : null,
    matriculas,
    planos: (planosRes.data ?? []).map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
    })),
  };
}
