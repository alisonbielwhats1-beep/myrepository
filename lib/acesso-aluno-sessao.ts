import "server-only";
import { createClient } from "@/lib/supabase/server";

export type VinculoAluno = {
  slug: string;
  academiaNome: string;
  academiaLogo: string | null;
  alunoId: string;
  token: string;
  statusAcesso: string;
};

/** Vínculos de aluno da conta autenticada (via RPC SECURITY DEFINER 067). */
export async function meusVinculosAluno(): Promise<VinculoAluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("meu_acesso_aluno");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    slug: String(r.academia_slug ?? ""),
    academiaNome: String(r.academia_nome ?? ""),
    academiaLogo: (r.academia_logo as string) ?? null,
    alunoId: String(r.aluno_id ?? ""),
    token: String(r.aluno_token ?? ""),
    statusAcesso: String(r.status_acesso ?? ""),
  }));
}

export type DestinoAluno =
  | { tipo: "area"; href: string }
  | { tipo: "selecao"; vinculos: VinculoAluno[] }
  | { tipo: "suspenso"; vinculos: VinculoAluno[] }
  | { tipo: "nenhum" };

/** Caminho da área do aluno a partir de um vínculo (área existente por token). */
export function hrefAreaAluno(v: VinculoAluno): string {
  return `/aluno/${v.slug}/${v.token}`;
}

/**
 * Decide para onde mandar o aluno autenticado:
 *  - 1 vínculo ativo  -> área dele;
 *  - vários ativos    -> seleção de academia;
 *  - só suspensos     -> tela de acesso suspenso;
 *  - nenhum vínculo   -> conta sem acesso de aluno (provável login antes de ativar).
 */
export async function destinoAlunoLogado(): Promise<DestinoAluno> {
  const vinculos = await meusVinculosAluno();
  if (vinculos.length === 0) return { tipo: "nenhum" };

  const ativos = vinculos.filter((v) => v.statusAcesso === "ativo");
  if (ativos.length === 1) return { tipo: "area", href: hrefAreaAluno(ativos[0]) };
  if (ativos.length > 1) return { tipo: "selecao", vinculos: ativos };
  return { tipo: "suspenso", vinculos };
}
