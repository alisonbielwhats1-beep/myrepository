// Camada de acesso a dados — usada por Server Components e Server Actions.
// Toda consulta roda com a sessão do usuário logado; o RLS multi-tenant do
// banco garante que só os dados da academia do admin autenticado voltam.

import { createClient } from "./supabase/server";
import {
  AcessoCatraca,
  Aluno,
  Despesa,
  FichaAlunoPublica,
  Funcionario,
  Plano,
  Receita,
  Treino,
  TreinoPublico,
} from "./types";

/**
 * Lookup público mínimo de academia por slug (nome, cor) via RPC
 * `obter_academia_publica` — usado apenas pela tela do aluno (sem login).
 * Não retorna endereço/telefone completos das tabelas internas.
 */
export async function getAcademiaPublica(slug: string): Promise<{
  id: string;
  nome_fantasia: string;
  slug_url: string;
  cor_primaria: string | null;
} | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_academia_publica", {
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar academia: ${error.message}`);
  return data && (data as { id: string }).id ? data : null;
}

export async function getAlunos(academiaId: string): Promise<Aluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(`Falha ao carregar alunos: ${error.message}`);
  return (data as Aluno[]) ?? [];
}

export async function getAluno(
  academiaId: string,
  alunoId: string
): Promise<Aluno | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", alunoId)
    .eq("academia_id", academiaId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar aluno: ${error.message}`);
  return (data as Aluno) ?? null;
}

export async function getPlanos(academiaId: string): Promise<Plano[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("valor_mensal", { ascending: false });
  if (error) throw new Error(`Falha ao carregar planos: ${error.message}`);
  return (data as Plano[]) ?? [];
}

export async function getTreinosDoAluno(
  academiaId: string,
  alunoId: string
): Promise<Treino[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .select("*, exercicios:exercicios_treino(*)")
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(`Falha ao carregar treinos: ${error.message}`);
  return (data as Treino[]) ?? [];
}

export async function getTodosOsTreinos(academiaId: string): Promise<Treino[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .select("*, exercicios:exercicios_treino(*)")
    .eq("academia_id", academiaId)
    .not("aluno_id", "is", null)
    .order("ordem", { ascending: true });
  if (error) throw new Error(`Falha ao carregar treinos: ${error.message}`);
  return (data as Treino[]) ?? [];
}

/** Treinos da biblioteca (modelos, sem aluno vinculado), por modalidade. */
export async function getTreinosBiblioteca(
  academiaId: string
): Promise<Treino[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .select("*, exercicios:exercicios_treino(*)")
    .eq("academia_id", academiaId)
    .is("aluno_id", null)
    .order("modalidade", { ascending: true })
    .order("ordem", { ascending: true });
  if (error) throw new Error(`Falha ao carregar treinos: ${error.message}`);
  return (data as Treino[]) ?? [];
}

export async function getAcessos(
  academiaId: string,
  limite = 50
): Promise<AcessoCatraca[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acessos_catraca")
    .select("*, aluno:alunos(id, nome, foto_perfil_url)")
    .eq("academia_id", academiaId)
    .order("data_hora_entrada", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao carregar acessos: ${error.message}`);
  return (data as AcessoCatraca[]) ?? [];
}

export async function getFuncionarios(
  academiaId: string
): Promise<Funcionario[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select("*")
    .eq("academia_id", academiaId)
    .order("nome", { ascending: true });
  if (error) throw new Error(`Falha ao carregar funcionários: ${error.message}`);
  return (data as Funcionario[]) ?? [];
}

/**
 * Receitas mais recentes primeiro. Filtra por `desde` (>= data) e/ou `ate`
 * (<= data), ambos ISO "YYYY-MM-DD".
 */
export async function getReceitas(
  academiaId: string,
  desde?: string,
  ate?: string
): Promise<Receita[]> {
  const supabase = createClient();
  let query = supabase
    .from("receitas")
    .select("*, aluno:alunos(id, nome)")
    .eq("academia_id", academiaId)
    .order("data", { ascending: false });
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar receitas: ${error.message}`);
  return (data as Receita[]) ?? [];
}

/**
 * Despesas mais recentes primeiro. Filtra por `desde` (>= data) e/ou `ate`
 * (<= data), ambos ISO "YYYY-MM-DD".
 */
export async function getDespesas(
  academiaId: string,
  desde?: string,
  ate?: string
): Promise<Despesa[]> {
  const supabase = createClient();
  let query = supabase
    .from("despesas")
    .select("*")
    .eq("academia_id", academiaId)
    .order("data", { ascending: false });
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
  return (data as Despesa[]) ?? [];
}

/**
 * Ficha pública do aluno (nome, foto, treinos e exercícios — nunca CPF/
 * e-mail/telefone) via RPC `obter_ficha_aluno`. Não exige login: é o link
 * único usado pela tela do aluno.
 */
export async function getFichaAlunoPublica(
  alunoId: string
): Promise<FichaAlunoPublica | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_ficha_aluno", {
    p_aluno_id: alunoId,
  });
  if (error) throw new Error(`Falha ao carregar ficha do aluno: ${error.message}`);
  if (!data || !(data as FichaAlunoPublica).aluno) return null;
  return data as FichaAlunoPublica;
}

/** Treino compartilhado por QR (público) via RPC obter_treino_publico. */
export async function getTreinoPublico(
  token: string
): Promise<TreinoPublico | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_treino_publico", {
    p_token: token,
  });
  if (error) throw new Error(`Falha ao carregar treino: ${error.message}`);
  if (!data || !(data as TreinoPublico).treino) return null;
  return data as TreinoPublico;
}
