// Tipos de domínio do GestAcad — espelham as tabelas do Supabase (schema.sql).

export type PlanoSaas = "basico" | "profissional" | "premium";

export type StatusMatricula = "ativa" | "inativa" | "trancada" | "pendente" | "cancelada";

/** Status financeiro calculado pelas mensalidades do aluno.
 *  Não é persistido — derivado em tempo de execução. */
export type StatusFinanceiro =
  | "em_dia"
  | "a_vencer"
  | "pendente"
  | "inadimplente";
export type OrigemAcesso = "Direto" | "Gympass" | "TotalPass" | "qr";
export type StatusLiberacao = "liberado" | "negado" | "pendente" | "alerta";

/**
 * De ONDE vem o direito de acesso do aluno (migration 096).
 *
 * NÃO confundir com `OrigemAcesso` acima, que descreve UMA ENTRADA na catraca
 * ("por onde essa pessoa passou agora"), nem com a PERIODICIDADE, que continua
 * vivendo em `Plano.recorrencia_meses`. Origem e periodicidade são dois eixos
 * separados: só "Plano da academia" tem periodicidade — Wellhub e TotalPass
 * não são "mensal" nem "trimestral", são a fonte do acesso.
 */
export type OrigemAcessoAluno =
  | "plano_academia"
  | "wellhub"
  | "totalpass"
  | "avulso"
  | "outro_convenio";

export const ORIGENS_ACESSO_ALUNO: {
  value: OrigemAcessoAluno;
  label: string;
  /** Explicação curta exibida abaixo do campo, no formulário do aluno. */
  ajuda: string;
}[] = [
  {
    value: "plano_academia",
    label: "Plano da academia",
    ajuda:
      "O aluno paga um plano seu. Pode ficar sem plano definido enquanto você " +
      "decide — a matrícula fica pendente até o plano ser escolhido.",
  },
  {
    value: "wellhub",
    label: "Wellhub/Gympass",
    ajuda: "Acesso pago pelo parceiro. A academia não cobra mensalidade deste aluno.",
  },
  {
    value: "totalpass",
    label: "TotalPass",
    ajuda: "Acesso pago pelo parceiro. A academia não cobra mensalidade deste aluno.",
  },
  {
    value: "avulso",
    label: "Avulso / diária",
    ajuda:
      "Só para quem NÃO vai ter plano: diária, cortesia ou uso pontual. Se o " +
      "plano ainda vai ser definido, mantenha \"Plano da academia\".",
  },
  {
    value: "outro_convenio",
    label: "Outro convênio",
    ajuda: "Convênio de empresa, clube ou parceiro fora do Wellhub/TotalPass.",
  },
];

/** Como a academia trata o acesso de aluno com mensalidade vencida (Fase 5). */
export type PoliticaInadimplencia = "liberar" | "alertar" | "bloquear";

export const POLITICAS_INADIMPLENCIA: {
  value: PoliticaInadimplencia;
  label: string;
  descricao: string;
}[] = [
  {
    value: "liberar",
    label: "Liberar normalmente",
    descricao:
      "A entrada é registrada sem aviso financeiro. A cobrança continua no Financeiro.",
  },
  {
    value: "alertar",
    label: "Liberar com alerta",
    descricao:
      "A entrada é permitida, mas a recepção vê um aviso com o valor e os dias de atraso.",
  },
  {
    value: "bloquear",
    label: "Bloquear acesso",
    descricao:
      "A entrada é negada enquanto houver mensalidade vencida. A tentativa fica registrada.",
  },
];
export type StatusFuncionario = "ativo" | "inativo";
export type TipoReceita = "mensalidade" | "matricula" | "venda_produto" | "outra";
export type StatusPagamento = "pago" | "pendente" | "cancelada";

export type StatusIntegracao =
  | "nao_configurada"
  | "aguardando_configuracao"
  | "aguardando_homologacao"
  | "em_testes"
  | "ativa"
  | "com_erro"
  | "desativada";

export const LABELS_STATUS_INTEGRACAO: Record<StatusIntegracao, string> = {
  nao_configurada: "Não configurada",
  aguardando_configuracao: "Aguardando configuração",
  aguardando_homologacao: "Aguardando homologação",
  em_testes: "Em testes",
  ativa: "Ativa",
  com_erro: "Com erro",
  desativada: "Desativada",
};

/** Plataformas parceiras com repasse estimado configurável (migration 049). */
export type PlataformaRepasse = "gympass" | "totalpass";

/** Config do dono: quanto a academia estima receber por check-in de cada
 *  parceiro. `valor_por_checkin` nulo = "Valor não configurado" — nunca um
 *  padrão inventado. Nunca use "faturamento por aluno", "receita recebida"
 *  ou "valor garantido" para descrever isso na interface. */
export type ConfigRepasseParceiro = {
  plataforma: PlataformaRepasse;
  valor_por_checkin: number | null;
  ativo: boolean;
};
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

export const FORMAS_PAGAMENTO: { value: string; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência bancária" },
  { value: "boleto", label: "Boleto" },
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
  /** Redes sociais da academia (migration 084) — exibidas na Comunidade do app do aluno. Específicas do tenant. */
  instagram: string | null;
  site: string | null;
  facebook: string | null;
  tiktok: string | null;
  plano_saas: PlanoSaas;
  is_demo: boolean;
  meta_faturamento_mensal: number | null;
  /** Fase 5 — default 'liberar' preserva o comportamento anterior à migration 028. */
  politica_inadimplencia: PoliticaInadimplencia;
  /** Fase 6 — limites de retenção (migration 029). */
  dias_atencao_sem_acesso: number;
  dias_risco_sem_acesso: number;
  dias_sumido_sem_acesso: number;
  tolerancia_novo_aluno_dias: number;
  /** Fase 7A — ponto de partida do saldo registrado (migration 031). */
  saldo_inicial: number;
  /** null = contar desde o primeiro lançamento pago com data_pagamento. */
  data_saldo_inicial: string | null;
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

/**
 * Faixa de preço por quantidade de alunos ativos (migration 056).
 *
 * NÃO confundir com `Plano` (o que a academia vende ao aluno dela) nem com
 * `PlanoSaas` (tier de funcionalidade). Esta é referência interna do processo
 * comercial do GestAcad, visível só para o superadministrador da plataforma.
 */
export interface FaixaComercial {
  id: string;
  nome: string;
  alunos_min: number;
  /** null = faixa sem teto. */
  alunos_max: number | null;
  preco_mensal: number;
  ativo: boolean;
  /** Nasce false: a landing pública nunca exibe a tabela completa. */
  publico: boolean;
  disponivel_novos_clientes: boolean;
  ordem: number;
  descricao_interna: string | null;
  observacoes_comerciais: string | null;
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
  /** Migration 096 — fonte do acesso. `plano_id` continua sendo o plano da
   *  academia; as duas informações coexistem e nenhuma substitui a outra. */
  origem_acesso: OrigemAcessoAluno;
  /** Nome do convênio quando `origem_acesso` é "outro_convenio". */
  parceiro_externo: string | null;
  matricula_codigo: string | null;
  dia_vencimento: number | null;
  objetivo: string | null;
  condicoes_medicas: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  /** Credencial do link pessoal do aluno sem login (Fase 12). Nunca usar `id` para montar /aluno/[slug]/[...]. */
  token_acesso_publico: string;
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
  /** Vínculo com o exercício da biblioteca (migração 098). A imagem exibida é
   *  a própria do exercício ou, se vazia, a da biblioteca — resolvido na
   *  leitura, sem duplicar arquivo. */
  catalogo_exercicio_id?: string | null;
  observacoes: string | null;
  configuracao?: Record<string, unknown>;
  ordem: number;
  criado_em: string;
}

export interface Treino {
  id: string;
  /** null = treino-modelo da plataforma ("Padrão GestAcad", migration 069). */
  academia_id: string | null;
  aluno_id: string | null;
  nome_treino: string;
  objetivo: string | null;
  modalidade: string | null;
  ordem: number;
  ativo: boolean;
  publico: boolean;
  share_token: string;
  criado_por?: string | null;
  profissional_nome?: string | null;
  nivel?: string | null;
  publico_alvo?: string | null;
  origem?: string;
  /**
   * Nível de visibilidade do treino-modelo (migration 077):
   *   • privado  → só `criado_por`; além dele, só dono/gerente enxergam;
   *   • equipe   → equipe técnica (dono/gerente/instrutor); recepção não vê;
   *   • academia → todo o tenant, inclusive recepção.
   * Fichas de aluno (aluno_id != null) ignoram este campo. A ORIGEM está em
   * `origem_tipo`. Os valores `instrutor`/`plataforma` são legados (pré-077) e
   * só aparecem em dados ainda não migrados — tratados no fallback de nivelDoTreino.
   */
  visibilidade?:
    | "privado"
    | "selecionado"
    | "equipe"
    | "academia"
    | "instrutor"
    | "plataforma";
  /**
   * ORIGEM do treino (migration 076) — eixo ortogonal à visibilidade, que
   * antes vivia conflacionada em `visibilidade`:
   *   • gestacad  → curado pela plataforma (academia_id null);
   *   • academia  → pertence ao tenant (inclui fichas de aluno);
   *   • instrutor → autorado por um profissional da academia (`criado_por`).
   * Fonte de verdade para classificar a origem/nível na UI. `visibilidade`
   * passa a responder só por PRIVADO/EQUIPE/ACADEMIA. Opcional no tipo para
   * tolerar dados anteriores à migração (fallback em `lib/treinos.ts`).
   */
  origem_tipo?: "gestacad" | "academia" | "instrutor";
  codigo_importacao?: string | null;
  metadados?: Record<string, unknown>;
  modelo_origem_id?: string | null;
  atribuido_por?: string | null;
  atribuido_em?: string | null;
  versao_origem?: number | null;
  /**
   * Dias da semana desta ficha (migration 083). ISO: 1=seg … 7=dom. Vazio =
   * sem dia definido. Só faz sentido em ficha de aluno (aluno_id != null).
   */
  dias_semana?: number[];
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
  academia_id?: string | null;
  criado_por?: string | null;
  visibilidade?: "sistema" | "academia";
  aliases?: string[];
  metadados?: Record<string, unknown>;
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
  /** Redes sociais (migration 084) — exibidas na Comunidade do app do aluno. */
  instagram: string | null;
  site: string | null;
  facebook: string | null;
  tiktok: string | null;
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
  /** Motivo da decisão — campo já existente, reaproveitado na Fase 5. */
  observacao: string | null;
  politica_aplicada: PoliticaInadimplencia | null;
  mensalidade_id: string | null;
  dias_atraso: number | null;
  registrado_por: string | null;
  /** Chave de idempotência da tentativa de registro manual (Fase 8). */
  chave_idempotencia: string | null;
  /** Cancelamento (migration 052) — nunca exclui a linha, só anota quem/quando/por quê. */
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  aluno?: Pick<Aluno, "id" | "nome" | "foto_perfil_url"> | null;
}

/** Filtros do histórico paginado de acessos (Recepção, Fase 8). */
export type FiltroAcessos = {
  pagina: number;
  tamanhoPagina: number;
  dataIni?: string;
  dataFim?: string;
  resultado?: StatusLiberacao;
  origem?: OrigemAcesso;
  alunoId?: string;
};

export type AcessosPaginados = {
  acessos: AcessoCatraca[];
  total: number;
};

/**
 * Filtros da listagem paginada de alunos (Fase 13 — escala). Busca cobre
 * nome, matrícula e telefone (por dígitos) em uma única consulta no banco.
 */
export type FiltroAlunos = {
  pagina: number;
  tamanhoPagina: number;
  busca?: string;
  status?: StatusMatricula;
  planoId?: string;
};

export type AlunosPaginados = {
  alunos: Aluno[];
  total: number;
};

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
  /** Sempre a data de vencimento — nunca a data do pagamento. */
  data: string;
  status: StatusPagamento;
  competencia: string | null;
  /** Quando foi efetivamente pago. Null enquanto pendente ou cancelada. */
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  aluno?: Pick<Aluno, "id" | "nome" | "telefone"> | null;
}

export interface Despesa {
  id: string;
  academia_id: string;
  descricao: string;
  categoria: CategoriaDespesa;
  valor: number;
  /** Vencimento. A data em que o dinheiro saiu fica em data_pagamento. */
  data: string;
  status: StatusPagamento;
  observacoes: string | null;
  funcionario_id: string | null;
  competencia: string | null;
  /** Fase 7A (migration 031) — quando foi efetivamente paga. */
  data_pagamento: string | null;
  forma_pagamento: string | null;
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

/** Fila de tratamento do feedback (migration 057). Independente de `lido`. */
export type StatusFeedback = "novo" | "em_analise" | "respondido" | "concluido";

export const STATUS_FEEDBACK: { value: StatusFeedback; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "respondido", label: "Respondido" },
  { value: "concluido", label: "Concluído" },
];

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
  /** Migration 057 — tratamento pela academia. */
  status?: StatusFeedback;
  resposta?: string | null;
  respondido_em?: string | null;
  respondido_por?: string | null;
  respondido_por_nome?: string | null;
  atualizado_em?: string | null;
}

/** Feedback como o ALUNO vê (RPC obter_feedbacks_aluno, migration 057). */
export interface FeedbackDoAluno {
  id: string;
  nota: number;
  categoria: string | null;
  comentario: string | null;
  status: StatusFeedback;
  resposta: string | null;
  respondido_em: string | null;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Atendimento (migration 058) — solicitações do aluno, com histórico.
// Não confundir com Feedback: lá a academia responde uma vez e conclui.
// ---------------------------------------------------------------------------
export type CategoriaAtendimento =
  | "financeiro"
  | "plano"
  | "treino"
  | "horarios"
  | "cadastro"
  | "estrutura"
  | "outros";

export const CATEGORIAS_ATENDIMENTO: {
  value: CategoriaAtendimento;
  label: string;
}[] = [
  { value: "financeiro", label: "Financeiro" },
  { value: "plano", label: "Plano/Mensalidade" },
  { value: "treino", label: "Treino" },
  { value: "horarios", label: "Horários/Aulas" },
  { value: "cadastro", label: "Cadastro" },
  { value: "estrutura", label: "Estrutura" },
  { value: "outros", label: "Outros" },
];

export type StatusAtendimento =
  | "novo"
  | "em_atendimento"
  | "aguardando_aluno"
  | "resolvido";

export const STATUS_ATENDIMENTO: {
  value: StatusAtendimento;
  label: string;
}[] = [
  { value: "novo", label: "Novo" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "aguardando_aluno", label: "Aguardando aluno" },
  { value: "resolvido", label: "Resolvido" },
];

export interface AtendimentoMensagem {
  id: string;
  autor_tipo: "aluno" | "academia";
  autor_nome: string;
  mensagem: string;
  criado_em: string;
}

/**
 * Ticket como a ACADEMIA vê (linha da tabela + aluno + histórico).
 *
 * O aluno usa `AtendimentoDoAluno`: a RPC obter_atendimentos_aluno não devolve
 * academia_id nem aluno_id de propósito — ele já sabe quem é, e expor ids
 * internos na área pública não serve para nada.
 */
export interface Atendimento {
  id: string;
  academia_id: string;
  aluno_id: string;
  categoria: CategoriaAtendimento;
  assunto: string;
  status: StatusAtendimento;
  criado_em: string;
  atualizado_em: string;
  aluno?: Pick<Aluno, "id" | "nome"> | null;
  mensagens: AtendimentoMensagem[];
}

export type AtendimentoDoAluno = Omit<
  Atendimento,
  "academia_id" | "aluno_id" | "aluno"
>;

/** Retorno padrão de Server Actions: erro, sucesso e timestamp para forçar re-render.
 *  `id` traz o registro criado/atualizado, para o cliente selecioná-lo após salvar. */
/** Ponto da série financeira (gráfico Receita x Despesa x Projetado). */
export type PontoFinanceiroMensal = {
  mes: string;
  receita: number;
  despesa: number;
  /** Receita − despesa do próprio bucket (caixa realizado). */
  resultado?: number;
  /** Resultado de caixa do bucket somado às pendências que vencem nele. */
  projetado?: number;
};

// ---------------------------------------------------------------------------
// Fase 6 — retenção
// ---------------------------------------------------------------------------

export type ClassificacaoRetencao = "normal" | "atencao" | "em_risco" | "sumido";

/** Limites de ausência configurados pela academia (migration 029). */
export type ConfigRetencao = {
  diasAtencao: number;
  diasRisco: number;
  diasSumido: number;
  toleranciaNovoAluno: number;
};

/** Retorno de classificarRetencao — mesma base para Dashboard e Retenção. */
export type ResultadoRetencao = {
  classificacao: ClassificacaoRetencao;
  ultimoAcesso: string | null;
  /** Dias desde o último acesso. null quando o aluno nunca acessou. */
  diasSemAcesso: number | null;
  nuncaAcessou: boolean;
  diasDesdeMatricula: number;
  explicacao: string;
};

/** Uma linha da RPC retencao_alunos, já agregada no banco. */
export type LinhaRetencao = {
  aluno_id: string;
  nome: string;
  criado_em: string;
  ultimo_acesso: string | null;
  acessos_periodo: number;
};

/** Aluno com a classificação já aplicada, pronto para as telas. */
export type AlunoRetencao = LinhaRetencao & ResultadoRetencao;

/**
 * Adesão aos treinos por aluno (migration 094) — quanto o aluno de fato executa
 * as fichas prescritas, medido por sessoes_treino finalizadas. Diferente da
 * retenção, que mede acesso à academia (catraca).
 */
export interface LinhaAdesaoTreino {
  aluno_id: string;
  nome: string;
  /** Tem ao menos uma ficha ativa atribuída. */
  tem_ficha: boolean;
  /** Data da última sessão finalizada; null = nunca treinou pelo app. */
  ultima_sessao: string | null;
  /** Sessões finalizadas nos últimos N dias. */
  sessoes_periodo: number;
  /** Sessões finalizadas em toda a história. */
  total_sessoes: number;
}

/** Mensalidade como chega do banco para a decisão de acesso (Fase 5). */
export type MensalidadeParaAcesso = {
  id: string;
  competencia: string | null;
  /** Vencimento. */
  data: string;
  valor: number;
  status: string;
};

export type ResultadoAcesso = "liberado" | "alerta" | "bloqueado";

/** Retorno de decidirAcesso — tudo que a recepção precisa mostrar e gravar. */
export type DecisaoAcesso = {
  resultado: ResultadoAcesso;
  motivo: string | null;
  /** null quando a decisão veio do cadastro, sem consultar o financeiro. */
  politicaAplicada: PoliticaInadimplencia | null;
  mensalidadeId: string | null;
  competencia: string | null;
  vencimento: string | null;
  diasAtraso: number;
  quantidadeVencida: number;
  totalVencido: number;
};

export type EstadoAcao = {
  erro?: string;
  ok?: boolean;
  savedAt?: number;
  id?: string;
  /** Preenchido por registrarAcesso para a recepção exibir o resultado. */
  decisao?: DecisaoAcesso;
  /**
   * Preenchido por registrarAcesso com o registro recém-inserido, para a
   * recepção prependar a linha no log sem esperar o próximo carregamento da
   * página. Nunca inclui `valor_repasse` — repasse de parceiro não vai ao
   * cliente (mesma regra de `registrarAcesso`/`confirmarAcessoQr`).
   */
  acessoRegistrado?: Omit<AcessoCatraca, "valor_repasse" | "aluno">;
};

export type Papel = "dono" | "gerente" | "recepcao" | "instrutor";

export const PAPEIS: { value: Papel; label: string; descricao: string }[] = [
  { value: "dono", label: "Dono", descricao: "Acesso total a tudo" },
  { value: "gerente", label: "Gerente", descricao: "Tudo, menos configurações e equipe" },
  { value: "recepcao", label: "Recepção", descricao: "Catraca, alunos e loja" },
  { value: "instrutor", label: "Instrutor", descricao: "Treinos e alunos" },
];

/** Aviso in-app para o aluno (migration 074). */
export interface NotificacaoAluno {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  criada_em: string;
}

/** Perfil da equipe (um usuário da academia). */
export interface PerfilEquipe {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Opcional (migration 064): quem foi cadastrado antes não tem. */
  telefone: string | null;
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
  data_fim: string | null;
  motivo: string | null;
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
    criado_em: string;
  };
  academia: {
    id: string;
    nome_fantasia: string;
    slug_url: string;
  };
  treinos: FichaTreinoPublico[];
  progresso: ProgressoPublico[];
}

/** Mensalidade do próprio aluno (retorno da RPC obter_mensalidades_aluno, Fase 12). Nunca DRE/saldo da academia. */
export interface MensalidadeAlunoPublica {
  id: string;
  competencia: string | null;
  /** Sempre o vencimento. */
  data: string;
  valor: number;
  status: StatusPagamento;
  data_pagamento: string | null;
  forma_pagamento: string | null;
}

/** Acesso efetivo (liberado/alerta) do próprio aluno (retorno da RPC obter_frequencia_aluno, Fase 12). */
export interface AcessoAlunoPublico {
  data_hora_entrada: string;
  status_liberacao: StatusLiberacao;
}

export interface FichaTreinoPublico {
  id: string;
  nome_treino: string;
  objetivo: string | null;
  ordem: number;
  /**
   * Dias da semana em que a ficha se aplica (migration 083). Convenção ISO:
   * 1=segunda … 7=domingo. Vazio = sem dia definido (aparece só na aba "Todos"
   * do seletor de dias). Um treino pode valer para vários dias sem duplicar.
   */
  dias_semana: number[];
  exercicios: ExercicioTreino[];
}

/** Autor exposto na comunidade — só nome e avatar, nunca dado de cadastro. */
export interface AutorComunidade {
  nome: string;
  foto_url: string | null;
}

/** Comentário de uma publicação da comunidade (migration 085). */
export interface ComentarioComunidade {
  id: string;
  texto: string;
  criado_em: string;
  sou_autor: boolean;
  autor: AutorComunidade;
}

/** Publicação do feed da comunidade da academia (migration 085). */
export interface PostComunidade {
  id: string;
  legenda: string | null;
  imagem_url: string | null;
  criado_em: string;
  sou_autor: boolean;
  autor: AutorComunidade;
  total_curtidas: number;
  curtido_por_mim: boolean;
  total_comentarios: number;
  comentarios: ComentarioComunidade[];
}

/** Publicação vista pela moderação do painel (migration 085) — inclui denúncias e status. */
export interface PostModeracao {
  id: string;
  legenda: string | null;
  imagem_url: string | null;
  criado_em: string;
  removido_em: string | null;
  removido_por: "autor" | "moderacao" | "auto" | null;
  autor: AutorComunidade;
  total_denuncias: number;
  total_curtidas: number;
  total_comentarios: number;
}

/** Status de uma sessão de execução de treino pelo aluno (Bloco 1). */
export type StatusSessaoTreino = "ativa" | "finalizada";

/** Percepção de esforço (RPE simplificado, 1 toque) que o aluno registra. */
export type EsforcoTreino = "leve" | "medio" | "pesado";

/**
 * Progresso REALIZADO de um exercício dentro de uma sessão — nunca a
 * prescrição original (que fica em ExercicioTreino, imutável por aqui).
 *
 * `esforco` e `nao_fez` são opcionais: sessões gravadas antes da migration 093
 * não os têm, e a tela trata a ausência como "não informado" / "false".
 */
export interface ProgressoExercicio {
  exercicio_id: string;
  concluido: boolean;
  carga_realizada_kg: number;
  repeticoes_realizadas: string;
  esforco?: EsforcoTreino | null;
  nao_fez?: boolean;
}

/**
 * Contadores de evolução do aluno para o painel "Minha evolução" (migration
 * 093). Campos sempre presentes; zeros quando ainda não há sessão finalizada.
 */
export interface ResumoEvolucaoAluno {
  total_finalizados: number;
  finalizados_mes: number;
  dias_mes: number;
}

/** Sessão de execução de uma ficha de treino pelo aluno (tabela sessoes_treino). */
export interface SessaoTreino {
  id: string;
  treino_id: string;
  status: StatusSessaoTreino;
  progresso: ProgressoExercicio[];
  iniciado_em: string;
  finalizado_em: string | null;
}
