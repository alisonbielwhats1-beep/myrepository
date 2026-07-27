// Camada de acesso a dados — usada por Server Components e Server Actions.
// Toda consulta roda com a sessão do usuário logado; o RLS multi-tenant do
// banco garante que só os dados da academia do admin autenticado voltam.

import { createClient } from "./supabase/server";
import { hojeSaoPaulo } from "./utils";
import { tokenTemFormatoValido } from "./aluno-classificacao";
import {
  AcademiaPublica,
  AcessoAlunoPublico,
  AcessoCatraca,
  AcessosPaginados,
  Aluno,
  CatalogoExercicio,
  Despesa,
  Feedback,
  FichaAlunoPublica,
  FiltroAcessos,
  Funcionario,
  HistoricoPlano,
  LinhaRetencao,
  MensalidadeAlunoPublica,
  PerfilEquipe,
  Plano,
  PlanoPublico,
  Produto,
  ProdutoPublico,
  ProgressoAluno,
  Receita,
  Treino,
  TreinoPublico,
} from "./types";

/**
 * Lookup público mínimo de academia por slug (mini-site) via RPC
 * `obter_academia_publica` — usado pela tela do aluno e pela landing pública,
 * sem exigir login. Não retorna telefone/CPF/dados internos sensíveis.
 */
export async function getAcademiaPublica(
  slug: string
): Promise<AcademiaPublica | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_academia_publica", {
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar academia: ${error.message}`);
  return data && (data as { id: string }).id ? (data as AcademiaPublica) : null;
}

/** Planos públicos do mini-site (nome, valor, descrição) via RPC. */
export async function getPlanosPublicos(slug: string): Promise<PlanoPublico[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_planos_publicos", {
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar planos: ${error.message}`);
  return (data as PlanoPublico[]) ?? [];
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

/** Retorna apenas os campos de saúde/anamnese — deve ser chamado apenas
 *  por Server Actions/Components que já verificaram papel >= gerente. */
export async function getAlunoSaude(
  academiaId: string,
  alunoId: string
): Promise<Pick<Aluno, "id" | "objetivo" | "condicoes_medicas" | "contato_emergencia_nome" | "contato_emergencia_telefone"> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("id, objetivo, condicoes_medicas, contato_emergencia_nome, contato_emergencia_telefone")
    .eq("id", alunoId)
    .eq("academia_id", academiaId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar dados de saúde: ${error.message}`);
  return data ?? null;
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

/**
 * Histórico de acessos da Recepção com paginação e filtros no servidor
 * (Fase 8). Sem limite silencioso: o total real vem de `count: "exact"` e a
 * página é sempre um recorte explícito via `.range()`.
 */
export async function getAcessosPaginado(
  academiaId: string,
  filtro: FiltroAcessos
): Promise<AcessosPaginados> {
  const supabase = createClient();
  const tamanho = Math.min(Math.max(filtro.tamanhoPagina, 1), 100);
  const pagina = Math.max(filtro.pagina, 1);
  const de = (pagina - 1) * tamanho;
  const ate = de + tamanho - 1;

  let query = supabase
    .from("acessos_catraca")
    .select("*, aluno:alunos(id, nome, foto_perfil_url)", { count: "exact" })
    .eq("academia_id", academiaId);

  if (filtro.dataIni) query = query.gte("data_hora_entrada", `${filtro.dataIni}T00:00:00`);
  if (filtro.dataFim) query = query.lte("data_hora_entrada", `${filtro.dataFim}T23:59:59.999`);
  if (filtro.resultado) query = query.eq("status_liberacao", filtro.resultado);
  if (filtro.origem) query = query.eq("origem", filtro.origem);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error, count } = await query
    .order("data_hora_entrada", { ascending: false })
    .range(de, ate);
  if (error) throw new Error(`Falha ao carregar histórico de acessos: ${error.message}`);
  return { acessos: (data as AcessoCatraca[]) ?? [], total: count ?? 0 };
}

/**
 * Último acesso efetivo (liberado/alerta) de cada aluno, para a busca da
 * Recepção mostrar "último acesso" antes de registrar uma nova entrada.
 * Olha só as entradas mais recentes da academia (ordenadas por data), então
 * cobre com folga o uso do dia a dia sem precisar de uma função agregada
 * própria — `retencao_alunos` (migration 030) já cobre o caso de retenção,
 * que só precisa de aluno ATIVO; aqui a busca precisa achar qualquer aluno.
 */
export async function getUltimosAcessosPorAluno(
  academiaId: string,
  limite = 1000
): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acessos_catraca")
    .select("aluno_id, data_hora_entrada")
    .eq("academia_id", academiaId)
    .in("status_liberacao", ["liberado", "alerta"])
    .not("aluno_id", "is", null)
    .order("data_hora_entrada", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao carregar últimos acessos: ${error.message}`);

  const ultimos: Record<string, string> = {};
  for (const row of (data as { aluno_id: string; data_hora_entrada: string }[]) ?? []) {
    // Primeira ocorrência de cada aluno = a mais recente, já que veio ordenado desc.
    if (!ultimos[row.aluno_id]) ultimos[row.aluno_id] = row.data_hora_entrada;
  }
  return ultimos;
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
 * Retorna status e data de todas as mensalidades da academia — apenas os campos
 * necessários para calcular o statusFinanceiro por aluno, sem over-fetch.
 */
export async function getMensalidadesResumidas(
  academiaId: string
): Promise<Array<{ aluno_id: string; status: string; data: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("aluno_id, status, data")
    .eq("academia_id", academiaId)
    .eq("tipo", "mensalidade")
    .not("aluno_id", "is", null);
  if (error) throw new Error(`Falha ao carregar mensalidades: ${error.message}`);
  return (data as Array<{ aluno_id: string; status: string; data: string }>) ?? [];
}

export type MensalidadeDetalhe = {
  id: string;
  aluno_id: string;
  competencia: string | null;
  /** Sempre o vencimento. A data do pagamento fica em data_pagamento. */
  data: string;
  valor: number;
  status: string;
  descricao: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
};

/** Mensalidades com campos completos para exibição na ficha financeira do aluno. */
export async function getMensalidadesDetalhadas(
  academiaId: string
): Promise<MensalidadeDetalhe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("id, aluno_id, competencia, data, valor, status, descricao, data_pagamento, forma_pagamento")
    .eq("academia_id", academiaId)
    .eq("tipo", "mensalidade")
    .not("aluno_id", "is", null)
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar mensalidades: ${error.message}`);
  return (data as MensalidadeDetalhe[]) ?? [];
}

// ---------------------------------------------------------------------------
// Financeiro — agregações no banco (migration 031)
//
// As três funções abaixo devolvem SÓ os totais. O histórico detalhado nunca
// trafega inteiro para o Node: as tabelas continuam usando getReceitas /
// getDespesas, que já filtram por período.
// ---------------------------------------------------------------------------

export type ResumoFinanceiro = {
  receita_recebida: number;
  despesa_paga: number;
  resultado: number;
  receber_vencido: number;
  receber_futuro: number;
  receber_qtd_vencido: number;
  receber_qtd_futuro: number;
  pagar_vencido: number;
  pagar_futuro: number;
  pagar_qtd_vencido: number;
  pagar_qtd_futuro: number;
  saldo_inicial: number;
  saldo_desde: string | null;
  saldo_recebido: number;
  saldo_pago: number;
  saldo: number;
  incompletas_receitas: number;
  incompletas_receitas_valor: number;
  incompletas_despesas: number;
  incompletas_despesas_valor: number;
};

export type LinhaDreBanco = {
  escopo: "receita" | "despesa";
  chave: string;
  total: number;
  realizado: number;
  em_aberto: number;
  sem_competencia: number;
};

export type PontoSerieBanco = {
  bucket: string;
  receita: number;
  despesa: number;
  receita_pend: number;
  despesa_pend: number;
};

/** Caixa do período, pendências, saldo e incompletos — uma linha só. */
export async function getResumoFinanceiro(
  inicio: string,
  fim: string
): Promise<ResumoFinanceiro | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("financeiro_resumo", { p_inicio: inicio, p_fim: fim })
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar resumo financeiro: ${error.message}`);
  return (data as ResumoFinanceiro) ?? null;
}

/** DRE por competência, com realizado e em aberto separados. */
export async function getDreFinanceiro(
  inicio: string,
  fim: string
): Promise<LinhaDreBanco[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("financeiro_dre", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new Error(`Falha ao carregar DRE: ${error.message}`);
  return (data as LinhaDreBanco[]) ?? [];
}

/** Série do gráfico, agregada por dia ou por mês no banco. */
export async function getSerieFinanceira(
  inicio: string,
  fim: string,
  diario: boolean
): Promise<PontoSerieBanco[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("financeiro_serie", {
    p_inicio: inicio,
    p_fim: fim,
    p_diario: diario,
  });
  if (error) throw new Error(`Falha ao carregar série financeira: ${error.message}`);
  return (data as PontoSerieBanco[]) ?? [];
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
    .select("*, aluno:alunos(id, nome, telefone)")
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
 * e-mail/telefone) via RPC `obter_ficha_aluno` (Fase 12: resolvida por
 * `token` pessoal + `slug` da academia, nunca por aluno_id — a junção
 * token+slug é feita dentro do próprio banco). Não exige login: é o link
 * único usado pela tela do aluno. Token malformado nunca chega a fazer a
 * chamada — vira "não encontrado" sem round-trip e sem erro do Postgres.
 */
export async function getFichaAlunoPublica(
  token: string,
  slug: string
): Promise<FichaAlunoPublica | null> {
  if (!tokenTemFormatoValido(token)) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_ficha_aluno", {
    p_token: token,
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar ficha do aluno: ${error.message}`);
  if (!data || !(data as FichaAlunoPublica).aluno) return null;
  return data as FichaAlunoPublica;
}

/**
 * Mensalidades do próprio aluno (competência/valor/vencimento/status/pagamento)
 * via RPC `obter_mensalidades_aluno` (Fase 12), resolvida por token+slug.
 * Não exige login: mesmo link único da ficha. Nunca traz DRE, saldo ou
 * mensalidade de outro aluno.
 */
export async function getMensalidadesAlunoPublico(
  token: string,
  slug: string
): Promise<MensalidadeAlunoPublica[]> {
  if (!tokenTemFormatoValido(token)) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_mensalidades_aluno", {
    p_token: token,
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar mensalidades: ${error.message}`);
  return (data as MensalidadeAlunoPublica[]) ?? [];
}

/**
 * Acessos efetivos (liberado/alerta) do próprio aluno nos últimos `dias` dias,
 * via RPC `obter_frequencia_aluno` (Fase 12), resolvida por token+slug.
 * Acesso negado nunca é retornado aqui — a própria RPC já filtra por
 * status_liberacao.
 */
export async function getFrequenciaAlunoPublico(
  token: string,
  slug: string,
  dias = 90
): Promise<AcessoAlunoPublico[]> {
  if (!tokenTemFormatoValido(token)) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_frequencia_aluno", {
    p_token: token,
    p_slug: slug,
    p_dias: dias,
  });
  if (error) throw new Error(`Falha ao carregar frequência: ${error.message}`);
  return (data as AcessoAlunoPublico[]) ?? [];
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

/** Produtos da loja da academia (admin) — ordenados por destaque e ordem. */
export async function getProdutos(academiaId: string): Promise<Produto[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) throw new Error(`Falha ao carregar produtos: ${error.message}`);
  return (data as Produto[]) ?? [];
}

/**
 * Produtos ativos da loja via RPC pública (mini-site / aluno, sem login).
 * Depende da migration 005 — se ainda não foi aplicada, retorna vazio em vez
 * de derrubar o mini-site público inteiro (visível a qualquer visitante).
 */
export async function getProdutosPublicos(
  slug: string
): Promise<ProdutoPublico[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_produtos_publicos", {
    p_slug: slug,
  });
  if (error) return [];
  return (data as ProdutoPublico[]) ?? [];
}

export interface Notificacoes {
  inadimplentes: number;
  estoqueBaixo: number;
  feedbackNovo: number;
}

/**
 * Contadores para a central de notificações do painel: mensalidades vencidas,
 * produtos para repor e feedbacks não lidos. Consultas leves (counts + um
 * fetch mínimo de produtos).
 */
export async function getNotificacoes(
  academiaId: string
): Promise<Notificacoes> {
  const supabase = createClient();
  // Mesma referência de data usada na ficha do aluno e na recepção.
  const hoje = hojeSaoPaulo();

  const [inadRes, feedRes, prodRes] = await Promise.all([
    supabase
      .from("receitas")
      .select("id", { count: "exact", head: true })
      .eq("academia_id", academiaId)
      .eq("tipo", "mensalidade")
      .eq("status", "pendente")
      .lt("data", hoje),
    supabase
      .from("feedbacks")
      .select("id", { count: "exact", head: true })
      .eq("academia_id", academiaId)
      .eq("lido", false),
    supabase
      .from("produtos")
      .select("estoque, estoque_minimo")
      .eq("academia_id", academiaId)
      .not("estoque", "is", null),
  ]);

  const estoqueBaixo = ((prodRes.data as
    | { estoque: number; estoque_minimo: number }[]
    | null) ?? []).filter((p) => p.estoque <= p.estoque_minimo).length;

  return {
    inadimplentes: inadRes.count ?? 0,
    estoqueBaixo,
    feedbackNovo: feedRes.count ?? 0,
  };
}

export interface LinhaVenda {
  produtoId: string | null;
  nome: string;
  vendas: number;
  total: number;
}

/**
 * Relatório de vendas da loja (receitas do tipo venda_produto, pagas) a partir
 * de `desde` (ISO). Retorna total geral e ranking por produto (mais vendidos).
 *
 * Depende da coluna `receitas.produto_id` (migration 007) — se ainda não foi
 * aplicada, degrada para "sem relatório" em vez de derrubar a página da Loja.
 */
export async function getRelatorioVendas(
  academiaId: string,
  desde: string
): Promise<{ total: number; qtdVendas: number; ranking: LinhaVenda[] }> {
  const vazio = { total: 0, qtdVendas: 0, ranking: [] as LinhaVenda[] };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("valor, produto_id, descricao, produto:produtos(nome)")
    .eq("academia_id", academiaId)
    .eq("tipo", "venda_produto")
    .eq("status", "pago")
    .gte("data", desde);
  if (error) return vazio;

  const linhas = (data as unknown as {
    valor: number;
    produto_id: string | null;
    descricao: string;
    produto: { nome: string } | null;
  }[]) ?? [];

  const mapa = new Map<string, LinhaVenda>();
  let total = 0;
  for (const l of linhas) {
    total += Number(l.valor);
    const chave = l.produto_id ?? l.descricao;
    const nome = l.produto?.nome ?? l.descricao.replace(/^Venda - /, "");
    const atual = mapa.get(chave);
    if (atual) {
      atual.vendas += 1;
      atual.total += Number(l.valor);
    } else {
      mapa.set(chave, {
        produtoId: l.produto_id,
        nome,
        vendas: 1,
        total: Number(l.valor),
      });
    }
  }

  const ranking = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  return { total, qtdVendas: linhas.length, ranking };
}

export interface VendaRecente {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  criado_em: string;
  produto_id: string | null;
  produto: { nome: string; preco: number; estoque: number | null } | null;
}

/** Últimas vendas da loja (tipo venda_produto) — para o histórico com estorno. */
export async function getVendasRecentes(
  academiaId: string,
  limit = 30
): Promise<VendaRecente[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("id, descricao, valor, data, criado_em, produto_id, produto:produtos(nome, preco, estoque)")
    .eq("academia_id", academiaId)
    .eq("tipo", "venda_produto")
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as unknown as VendaRecente[]) ?? [];
}

/** Feedbacks (avaliações) dos alunos — mais recentes primeiro. */
export async function getFeedbacks(academiaId: string): Promise<Feedback[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("feedbacks")
    .select("*, aluno:alunos(id, nome)")
    .eq("academia_id", academiaId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(`Falha ao carregar feedbacks: ${error.message}`);
  return (data as Feedback[]) ?? [];
}

/** Perfis (equipe) da academia. */
export async function getPerfisEquipe(
  academiaId: string
): Promise<PerfilEquipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("perfis_admin")
    .select("id, nome, email, papel, criado_em")
    .eq("academia_id", academiaId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`Falha ao carregar equipe: ${error.message}`);
  return (data as PerfilEquipe[]) ?? [];
}

/** Histórico de planos de um aluno (mais recente primeiro). */
export async function getHistoricoPlanos(
  academiaId: string,
  alunoId: string
): Promise<HistoricoPlano[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("historico_planos")
    .select("*")
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .order("data_inicio", { ascending: false });
  if (error) throw new Error(`Falha ao carregar histórico: ${error.message}`);
  return (data as HistoricoPlano[]) ?? [];
}

/**
 * Histórico de planos de todos os alunos da academia (mais recente primeiro).
 * Depende da tabela `historico_planos` (migration 008) — se ainda não foi
 * aplicada, retorna vazio em vez de derrubar a página de Alunos inteira.
 */
export async function getTodoHistoricoPlanos(
  academiaId: string
): Promise<HistoricoPlano[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("historico_planos")
    .select("*")
    .eq("academia_id", academiaId)
    .order("data_inicio", { ascending: false });
  if (error) return [];
  return (data as HistoricoPlano[]) ?? [];
}

/** Catálogo global de exercícios (grupo muscular), para montagem rápida de treino. */
export async function getCatalogoExercicios(): Promise<CatalogoExercicio[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalogo_exercicios")
    .select("*")
    .order("grupo_muscular", { ascending: true })
    .order("ordem", { ascending: true });
  if (error) throw new Error(`Falha ao carregar catálogo: ${error.message}`);
  return (data as CatalogoExercicio[]) ?? [];
}

/** Histórico de progresso de um aluno (mais recente primeiro). */
export async function getProgressoAluno(
  academiaId: string,
  alunoId: string
): Promise<ProgressoAluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("progresso_aluno")
    .select("*")
    .eq("academia_id", academiaId)
    .eq("aluno_id", alunoId)
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar progresso: ${error.message}`);
  return (data as ProgressoAluno[]) ?? [];
}

/** Todos os registros de progresso da academia (todos os alunos), mais recentes primeiro. */
export async function getTodoProgresso(
  academiaId: string
): Promise<ProgressoAluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("progresso_aluno")
    .select("*")
    .eq("academia_id", academiaId)
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar progresso: ${error.message}`);
  return (data as ProgressoAluno[]) ?? [];
}

/**
 * Retenção: uma linha por aluno ATIVO, com último acesso e contagem de acessos
 * no período, agregados no banco pela RPC `retencao_alunos` (migration 029).
 *
 * Substitui o antigo getAlunosSumidos e o cálculo inline da tela de Retenção.
 * Nenhum histórico de acessos trafega para o frontend, não há limite arbitrário
 * de linhas e não há uma consulta por aluno: é uma chamada só, com a agregação
 * feita pelo Postgres usando idx_acessos_academia_aluno_data.
 *
 * A classificação NÃO acontece aqui — quem classifica é `classificarRetencao`
 * em lib/utils.ts, para Dashboard e Retenção compartilharem a mesma regra.
 */
export async function getRetencaoAlunos(
  diasFrequencia = 30
): Promise<LinhaRetencao[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("retencao_alunos", {
    p_dias_frequencia: diasFrequencia,
  });
  if (error) throw new Error(`Falha ao carregar retenção: ${error.message}`);
  return (data as LinhaRetencao[]) ?? [];
}

export interface SecretsWebhook {
  gympass_webhook_secret: string;
  totalpass_webhook_secret: string;
  gympass_status: string;
  totalpass_status: string;
}

/** Retorna os segredos e status de integração da academia (visíveis só no servidor). */
export async function getSecretsWebhook(
  academiaId: string
): Promise<SecretsWebhook | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("academias")
    .select(
      "gympass_webhook_secret, totalpass_webhook_secret, gympass_status, totalpass_status"
    )
    .eq("id", academiaId)
    .maybeSingle();
  return data ?? null;
}
