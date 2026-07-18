// Tipos de domínio do GymFlow — espelham as tabelas do Supabase (schema.sql).

export type StatusMatricula = "ativa" | "inativa" | "trancada" | "pendente";
export type OrigemAcesso = "Direto" | "Gympass" | "TotalPass";
export type StatusLiberacao = "liberado" | "negado" | "pendente";
export type StatusFuncionario = "ativo" | "inativo";
export type TipoReceita = "mensalidade" | "matricula" | "venda_produto" | "outra";
export type StatusPagamento = "pago" | "pendente";
export type CategoriaDespesa =
  | "energia_eletrica"
  | "agua"
  | "internet"
  | "aluguel"
  | "salarios"
  | "manutencao"
  | "equipamentos"
  | "impostos"
  | "produtos_limpeza"
  | "outros";

export const CATEGORIAS_DESPESA: { value: CategoriaDespesa; label: string }[] = [
  { value: "energia_eletrica", label: "Energia elétrica" },
  { value: "agua", label: "Água" },
  { value: "internet", label: "Internet" },
  { value: "aluguel", label: "Aluguel" },
  { value: "salarios", label: "Salários" },
  { value: "manutencao", label: "Manutenção" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "impostos", label: "Impostos" },
  { value: "produtos_limpeza", label: "Produtos de limpeza" },
  { value: "outros", label: "Outros gastos" },
];

export const TIPOS_RECEITA: { value: TipoReceita; label: string }[] = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "matricula", label: "Matrícula" },
  { value: "venda_produto", label: "Venda de produto" },
  { value: "outra", label: "Outra receita" },
];

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
  aluno_id: string | null;
  nome_treino: string;
  objetivo: string | null;
  modalidade: string | null;
  ordem: number;
  ativo: boolean;
  publico: boolean;
  share_token: string;
  criado_em: string;
  atualizado_em: string;
  exercicios?: ExercicioTreino[];
}

/** Retorno da RPC pública obter_treino_publico (treino compartilhado por QR). */
export interface TreinoPublico {
  treino: {
    id: string;
    nome_treino: string;
    objetivo: string | null;
    modalidade: string | null;
    ordem: number;
  };
  academia: {
    nome_fantasia: string;
    slug_url: string;
  };
  exercicios: ExercicioTreino[];
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

export interface Funcionario {
  id: string;
  academia_id: string;
  nome: string;
  cargo: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  foto_url: string | null;
  data_admissao: string | null;
  salario: number | null;
  dia_pagamento: number | null;
  status: StatusFuncionario;
  criado_em: string;
  atualizado_em: string;
}

export interface Receita {
  id: string;
  academia_id: string;
  aluno_id: string | null;
  tipo: TipoReceita;
  descricao: string;
  valor: number;
  data: string;
  status: StatusPagamento;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  aluno?: Pick<Aluno, "id" | "nome"> | null;
}

export interface Despesa {
  id: string;
  academia_id: string;
  descricao: string;
  categoria: CategoriaDespesa;
  valor: number;
  data: string;
  status: StatusPagamento;
  observacoes: string | null;
  funcionario_id: string | null;
  competencia: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Perfil do administrador autenticado + a academia que ele gerencia. */
export interface SessaoAcademia {
  userId: string;
  nome: string;
  email: string;
  academia: Academia;
}

/** Ficha pública do aluno (retorno da RPC obter_ficha_aluno). Sem CPF/e-mail/telefone. */
export interface FichaAlunoPublica {
  aluno: {
    id: string;
    nome: string;
    foto_perfil_url: string | null;
    status_matricula: StatusMatricula;
    matricula_codigo: string | null;
    plano_nome: string | null;
  };
  academia: {
    id: string;
    nome_fantasia: string;
    slug_url: string;
  };
  treinos: FichaTreinoPublico[];
}

export interface FichaTreinoPublico {
  id: string;
  nome_treino: string;
  objetivo: string | null;
  ordem: number;
  exercicios: ExercicioTreino[];
}
