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

export type GrupoMuscular =
  | "peito"
  | "costas"
  | "perna"
  | "ombro"
  | "biceps"
  | "triceps"
  | "abdomen"
  | "gluteos"
  | "panturrilha"
  | "cardio"
  | "outro";

export const GRUPOS_MUSCULARES: { value: GrupoMuscular; label: string }[] = [
  { value: "peito", label: "Peito" },
  { value: "costas", label: "Costas" },
  { value: "perna", label: "Perna" },
  { value: "ombro", label: "Ombro" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "abdomen", label: "Abdômen" },
  { value: "gluteos", label: "Glúteos" },
  { value: "panturrilha", label: "Panturrilha" },
  { value: "cardio", label: "Cardio" },
  { value: "outro", label: "Outro" },
];

export type CategoriaProduto =
  | "suplemento"
  | "acessorio"
  | "vestuario"
  | "bebida"
  | "equipamento"
  | "outro";

export const CATEGORIAS_PRODUTO: { value: CategoriaProduto; label: string }[] = [
  { value: "suplemento", label: "Suplemento" },
  { value: "acessorio", label: "Acessório" },
  { value: "vestuario", label: "Vestuário" },
  { value: "bebida", label: "Bebida / Garrafa" },
  { value: "equipamento", label: "Equipamento" },
  { value: "outro", label: "Outro" },
];

export const CATEGORIAS_FEEDBACK: { value: string; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "estrutura", label: "Estrutura" },
  { value: "atendimento", label: "Atendimento" },
  { value: "limpeza", label: "Limpeza" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "aulas", label: "Aulas" },
];

export interface Academia {
  id: string;
  nome_fantasia: string;
  slug_url: string;
  endereco: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  telefone: string | null;
  whatsapp: string | null;
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
  cobranca_recorrente: boolean;
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
  objetivo: string | null;
  condicoes_medicas: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
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

export interface CatalogoExercicio {
  id: string;
  grupo_muscular: GrupoMuscular;
  nome: string;
  series_padrao: number;
  repeticoes_padrao: string;
  imagem_demonstracao_url: string | null;
  video_demonstracao_url: string | null;
  ordem: number;
}

export interface ProgressoAluno {
  id: string;
  academia_id: string;
  aluno_id: string;
  data: string;
  peso_kg: number | null;
  percentual_gordura: number | null;
  peito_cm: number | null;
  cintura_cm: number | null;
  quadril_cm: number | null;
  braco_cm: number | null;
  coxa_cm: number | null;
  foto_url: string | null;
  observacoes: string | null;
  criado_em: string;
}

/** Registro de progresso exposto na ficha pública (sem `observacoes`). */
export interface ProgressoPublico {
  id: string;
  data: string;
  peso_kg: number | null;
  percentual_gordura: number | null;
  peito_cm: number | null;
  cintura_cm: number | null;
  quadril_cm: number | null;
  braco_cm: number | null;
  coxa_cm: number | null;
  foto_url: string | null;
}

/** Retorno da RPC pública obter_academia_publica (mini-site). */
export interface AcademiaPublica {
  id: string;
  nome_fantasia: string;
  slug_url: string;
  cor_primaria: string | null;
  logo_url: string | null;
  endereco: string | null;
  whatsapp: string | null;
}

/** Retorno da RPC pública obter_planos_publicos (mini-site). */
export interface PlanoPublico {
  id: string;
  nome: string;
  descricao: string | null;
  valor_mensal: number;
  recorrencia_meses: number;
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
  produto_id: string | null;
  tipo: TipoReceita;
  descricao: string;
  valor: number;
  data: string;
  status: StatusPagamento;
  competencia: string | null;
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

export interface Produto {
  id: string;
  academia_id: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaProduto;
  preco: number;
  imagem_url: string | null;
  estoque: number | null;
  estoque_minimo: number;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

/** Produto exposto publicamente (loja do mini-site / aluno). */
export interface ProdutoPublico {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaProduto;
  preco: number;
  imagem_url: string | null;
  destaque: boolean;
}

export interface Feedback {
  id: string;
  academia_id: string;
  aluno_id: string | null;
  nota: number;
  categoria: string | null;
  comentario: string | null;
  lido: boolean;
  criado_em: string;
  aluno?: Pick<Aluno, "id" | "nome"> | null;
}

/** Retorno padrão de Server Actions: erro, sucesso e timestamp para forçar re-render. */
export type EstadoAcao = { erro?: string; ok?: boolean; savedAt?: number };

export type Papel = "dono" | "gerente" | "recepcao" | "instrutor";

export const PAPEIS: { value: Papel; label: string; descricao: string }[] = [
  { value: "dono", label: "Dono", descricao: "Acesso total a tudo" },
  { value: "gerente", label: "Gerente", descricao: "Tudo, menos configurações e equipe" },
  { value: "recepcao", label: "Recepção", descricao: "Catraca, alunos e loja" },
  { value: "instrutor", label: "Instrutor", descricao: "Treinos e alunos" },
];

/** Perfil da equipe (um usuário da academia). */
export interface PerfilEquipe {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  criado_em: string;
}

export interface HistoricoPlano {
  id: string;
  academia_id: string;
  aluno_id: string;
  plano_id: string | null;
  plano_nome: string;
  valor: number;
  recorrencia_meses: number;
  data_inicio: string;
  criado_em: string;
}

/** Perfil do administrador autenticado + a academia que ele gerencia. */
export interface SessaoAcademia {
  userId: string;
  nome: string;
  email: string;
  papel: Papel;
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
  progresso: ProgressoPublico[];
}

export interface FichaTreinoPublico {
  id: string;
  nome_treino: string;
  objetivo: string | null;
  ordem: number;
  exercicios: ExercicioTreino[];
}
