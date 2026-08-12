import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SituacaoAcessoAluno } from "@/lib/acesso-alunos-tipos";

export type { SituacaoAcessoAluno } from "@/lib/acesso-alunos-tipos";
export { statusDerivado } from "@/lib/acesso-alunos-tipos";

/**
 * Lista os alunos NÃO arquivados da academia com a situação de acesso de cada
 * um (ativado / convite vivo / apto a convidar). Duas consultas isoladas por
 * RLS (a academia é resolvida por `academia_id_atual()`), unidas em memória —
 * sem expor token nem dado sensível de convite.
 */
export async function listarAcessoAlunos(): Promise<SituacaoAcessoAluno[]> {
  const supabase = createClient();

  const [alunosRes, convitesRes] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, nome, telefone, email, auth_user_id, status_cadastro")
      .neq("status_cadastro", "arquivado")
      .order("nome", { ascending: true }),
    supabase
      .from("convites_acesso")
      .select("id, aluno_id, status, expira_em")
      .in("status", ["gerado", "enviado", "aguardando_ativacao"]),
  ]);

  const alunos = alunosRes.data ?? [];
  const convites = convitesRes.data ?? [];

  // Índice do convite vivo por aluno (há no máx. 1, garantido por índice único).
  const conviteDoAluno = new Map<
    string,
    { id: string; status: string; expiraEm: string }
  >();
  for (const c of convites) {
    conviteDoAluno.set(c.aluno_id as string, {
      id: c.id as string,
      status: c.status as string,
      expiraEm: c.expira_em as string,
    });
  }

  return alunos.map((a) => ({
    id: a.id as string,
    nome: (a.nome as string) ?? "",
    telefone: (a.telefone as string) ?? null,
    email: (a.email as string) ?? null,
    ativado: Boolean(a.auth_user_id),
    convite: conviteDoAluno.get(a.id as string) ?? null,
  }));
}
