// Tipos e lógica PURA da gestão de acesso do aluno. Sem I/O e sem
// `server-only`, então pode ser importado tanto pelo Server Component que
// consulta o banco quanto pelo Client Component da UI. A consulta em si vive
// em lib/acesso-alunos.ts (server-only).

/** Situação de acesso de um aluno, para a tela de gestão de convites. */
export type SituacaoAcessoAluno = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  /** true se já vinculou uma conta (auth_user_id preenchido). */
  ativado: boolean;
  /** Convite vivo (não consumido) deste aluno, se houver. */
  convite: { id: string; status: string; expiraEm: string } | null;
};

/** Situação derivada para filtro/badge na UI. */
export type StatusDerivado = "ativado" | "convidado" | "apto";

export function statusDerivado(a: SituacaoAcessoAluno): StatusDerivado {
  if (a.ativado) return "ativado";
  if (a.convite) return "convidado";
  return "apto";
}
