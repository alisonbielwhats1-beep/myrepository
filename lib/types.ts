// Tipos de domínio do GymFlow — espelham as tabelas do Supabase (schema.sql).

export type StatusMatricula = "ativa" | "inativa" | "trancada" | "pendente";
export type OrigemAcesso = "Direto" | "Gympass" | "TotalPass";
export type StatusLiberacao = "liberado" | "negado" | "pendente";

export interface Academia {
  id: string;
  nome_fantasia: string;
  slug_url: string;
  endereco: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  telefone: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Plano {
  id: string;
  academia_id: string;
  nome: string;
  descricao: string | null;
  valor_mensal: number;
  recorrencia_meses: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Aluno {
  id: string;
  academia_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  foto_perfil_url: string | null;
  data_nascimento: string | null;
  status_matricula: StatusMatricula;
  plano_id: string | null;
  matricula_codigo: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ExercicioTreino {
  id: string;
  treino_id: string;
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number | null;
  descanso_segundos: number | null;
  imagem_demonstracao_url: string | null;
  video_demonstracao_url: string | null;
  observacoes: string | null;
  ordem: number;
  criado_em: string;
}

export interface Treino {
  id: string;
  academia_id: string;
  aluno_id: string;
  nome_treino: string;
  objetivo: string | null;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  exercicios?: ExercicioTreino[];
}

export interface AcessoCatraca {
  id: string;
  academia_id: string;
  aluno_id: string | null;
  origem: OrigemAcesso;
  valor_repasse: number | null;
  data_hora_entrada: string;
  status_liberacao: StatusLiberacao;
  observacao: string | null;
  aluno?: Pick<Aluno, "id" | "nome" | "foto_perfil_url"> | null;
}
