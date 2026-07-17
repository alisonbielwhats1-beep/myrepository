// Camada de acesso a dados — usada pelos Server Components.
// Escolhe entre Supabase (quando configurado) e dados de demonstração (mock).

import { createClient, isMockMode } from "./supabase/server";
import {
  MOCK_ACADEMIA,
  MOCK_ACESSOS,
  MOCK_ALUNOS,
  MOCK_PLANOS,
  MOCK_TREINOS,
} from "./mock-data";
import { Academia, AcessoCatraca, Aluno, Plano, Treino } from "./types";

export async function getAcademia(slug: string): Promise<Academia | null> {
  if (isMockMode()) return MOCK_ACADEMIA;
  const supabase = createClient();
  if (!supabase) return MOCK_ACADEMIA;
  const { data } = await supabase
    .from("academias")
    .select("*")
    .eq("slug_url", slug)
    .maybeSingle();
  return (data as Academia) ?? MOCK_ACADEMIA;
}

export async function getAlunos(academiaId: string): Promise<Aluno[]> {
  if (isMockMode()) return MOCK_ALUNOS;
  const supabase = createClient();
  if (!supabase) return MOCK_ALUNOS;
  const { data } = await supabase
    .from("alunos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("criado_em", { ascending: false });
  return (data as Aluno[]) ?? MOCK_ALUNOS;
}

export async function getAluno(alunoId: string): Promise<Aluno | null> {
  if (isMockMode()) return MOCK_ALUNOS.find((a) => a.id === alunoId) ?? MOCK_ALUNOS[0];
  const supabase = createClient();
  if (!supabase) return MOCK_ALUNOS[0];
  const { data } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", alunoId)
    .maybeSingle();
  return (data as Aluno) ?? null;
}

export async function getPlanos(academiaId: string): Promise<Plano[]> {
  if (isMockMode()) return MOCK_PLANOS;
  const supabase = createClient();
  if (!supabase) return MOCK_PLANOS;
  const { data } = await supabase
    .from("planos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("valor_mensal", { ascending: false });
  return (data as Plano[]) ?? MOCK_PLANOS;
}

export async function getTreinosDoAluno(alunoId: string): Promise<Treino[]> {
  if (isMockMode()) return MOCK_TREINOS.filter((t) => t.aluno_id === alunoId);
  const supabase = createClient();
  if (!supabase) return MOCK_TREINOS;
  const { data } = await supabase
    .from("treinos")
    .select("*, exercicios:exercicios_treino(*)")
    .eq("aluno_id", alunoId)
    .order("ordem", { ascending: true });
  return (data as Treino[]) ?? [];
}

export async function getAcessos(
  academiaId: string,
  limite = 50
): Promise<AcessoCatraca[]> {
  if (isMockMode())
    return [...MOCK_ACESSOS].sort(
      (a, b) =>
        new Date(b.data_hora_entrada).getTime() -
        new Date(a.data_hora_entrada).getTime()
    );
  const supabase = createClient();
  if (!supabase) return MOCK_ACESSOS;
  const { data } = await supabase
    .from("acessos_catraca")
    .select("*, aluno:alunos(id, nome, foto_perfil_url)")
    .eq("academia_id", academiaId)
    .order("data_hora_entrada", { ascending: false })
    .limit(limite);
  return (data as AcessoCatraca[]) ?? MOCK_ACESSOS;
}
