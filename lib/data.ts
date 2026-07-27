// Camada de acesso a dados — usada por Server Components e Server Actions.
// Toda consulta roda com a sessão do usuário logado; o RLS multi-tenant do
// banco garante que só os dados da academia do admin autenticado voltam.

import { createClient } from "./supabase/server";
import { hojeSaoPaulo } from "./utils";
import { tokenTemFormatoValido } from "./aluno-classificacao";
import { calcularRange, construirFiltroBuscaAlunos } from "./paginacao";
import {
  AcademiaPublica,
  AcessoAlunoPublico,
  AcessoCatraca,
  AcessosPaginados,
  Aluno,
  AlunosPaginados,
  CatalogoExercicio,
  Despesa,
  Feedback,
  FichaAlunoPublica,
  FiltroAcessos,
  FiltroAlunos,
  Funcionario,
  HistoricoPlano,
  LinhaRetencao,
  MensalidadeAlunoPublica,
  PerfilEquipe,
  Plano,
  PlanoPublico,
  PoliticaInadimplencia,
  POLITICAS_INADIMPLENCIA,
  Produto,
  ProdutoPublico,
  ProgressoAluno,
  Receita,
  SessaoTreino,
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

/**
 * Alunos paginados com busca e filtros no servidor (Fase 13 — escala).
 *
 * Substitui getAlunos() na tela de Alunos: nada de carregar a base inteira
 * para filtrar/ordenar no cliente. Busca cobre nome, matrícula e telefone
 * (por dígitos) via pg_trgm (migration 038); status e plano filtram por
 * igualdade. Ordenação estável (criado_em desc + id desc como desempate)
 * garante que nenhuma linha apareça duas vezes nem suma ao trocar de página.
 */
export async function getAlunosPaginado(
  academiaId: string,
  filtro: FiltroAlunos
): Promise<AlunosPaginados> {
  const supabase = createClient();
  const { de, ate } = calcularRange(filtro.pagina, filtro.tamanhoPagina);

  let query = supabase
    .from("alunos")
    .select("*", { count: "exact" })
    .eq("academia_id", academiaId);

  if (filtro.status) query = query.eq("status_matricula", filtro.status);
  if (filtro.planoId) query = query.eq("plano_id", filtro.planoId);
  if (filtro.busca) {
    const orFiltro = construirFiltroBuscaAlunos(filtro.busca);
    if (orFiltro) query = query.or(orFiltro);
  }

  const { data, error, count } = await query
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .range(de, ate);
  if (error) throw new Error(`Falha ao carregar alunos: ${error.message}`);
  return { alunos: (data as Aluno[]) ?? [], total: count ?? 0 };
}

/**
 * Colunas mínimas de aluno para busca/seleção (Recepção e formulários do
 * Financeiro): evita o over-fetch de select("*") — sem saúde/anamnese/CPF —
 * quando só nome, matrícula, telefone, foto, status e plano são exibidos.
 * Continua sendo a base inteira da academia (necessário para a busca
 * instantânea da Recepção e para o combo de aluno das receitas), então não
 * resolve escala sozinha — só reduz bytes transferidos. Ver riscos restantes.
 */
export async function getAlunosResumo(academiaId: string): Promise<Aluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select(
      "id, academia_id, nome, cpf, email, telefone, foto_perfil_url, data_nascimento, status_matricula, plano_id, matricula_codigo, dia_vencimento, objetivo, condicoes_medicas, contato_emergencia_nome, contato_emergencia_telefone, token_acesso_publico, criado_em, atualizado_em"
    )
    .eq("academia_id", academiaId)
    .order("nome", { ascending: true });
  if (error) throw new Error(`Falha ao carregar alunos: ${error.message}`);
  return (data as Aluno[]) ?? [];
}

/** Contagem de alunos (total e ativos) sem transferir nenhuma linha — só o
 *  count do Postgres, usado pelos KPIs do Dashboard. */
export async function getContagemAlunos(
  academiaId: string
): Promise<{ total: number; ativos: number }> {
  const supabase = createClient();
  const [totalRes, ativosRes] = await Promise.all([
    supabase
      .from("alunos")
      .select("id", { count: "exact", head: true })
      .eq("academia_id", academiaId),
    supabase
      .from("alunos")
      .select("id", { count: "exact", head: true })
      .eq("academia_id", academiaId)
      .eq("status_matricula", "ativa"),
  ]);
  if (totalRes.error) throw new Error(`Falha ao contar alunos: ${totalRes.error.message}`);
  if (ativosRes.error) throw new Error(`Falha ao contar alunos: ${ativosRes.error.message}`);
  return { total: totalRes.count ?? 0, ativos: ativosRes.count ?? 0 };
}

/**
 * Quantos alunos foram criados em [desde, ate] (datas ISO, comparadas como o
 * prefixo de data de `criado_em` em UTC — mesma comparação que
 * `criado_em.slice(0,10) >= desde && <= ate` fazia em memória). Só o count,
 * sem trazer os alunos.
 */
export async function getContagemAlunosCriadosEntre(
  academiaId: string,
  desde: string,
  ate: string
): Promise<number> {
  const supabase = createClient();
  const diaSeguinte = new Date(`${ate}T00:00:00Z`);
  diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
  const { count, error } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academiaId)
    .gte("criado_em", `${desde}T00:00:00.000Z`)
    .lt("criado_em", diaSeguinte.toISOString().slice(0, 10) + "T00:00:00.000Z");
  if (error) throw new Error(`Falha ao contar alunos: ${error.message}`);
  return count ?? 0;
}

/**
 * Contagem cumulativa de alunos cadastrados antes de cada corte, para o
 * gráfico "Evolução de alunos" do Dashboard. Uma consulta count por corte —
 * número fixo (6), não cresce com a base de alunos, então não é o padrão N+1
 * que a Fase 13 proíbe.
 *
 * Cada `corte` é um limite EXCLUSIVO (YYYY-MM-DD): "alunos criados antes
 * disto". Quem chama passa o primeiro dia do mês seguinte, o que evita
 * construir datas inexistentes como 31 de fevereiro — que o Postgres recusa
 * (ao contrário da comparação de string em memória que existia antes).
 */
export async function getEvolucaoAlunosContagem(
  academiaId: string,
  cortes: string[]
): Promise<number[]> {
  const supabase = createClient();
  const resultados = await Promise.all(
    cortes.map((corte) =>
      supabase
        .from("alunos")
        .select("id", { count: "exact", head: true })
        .eq("academia_id", academiaId)
        .lt("criado_em", `${corte}T00:00:00.000Z`)
    )
  );
  for (const r of resultados) {
    if (r.error) throw new Error(`Falha ao contar evolução de alunos: ${r.error.message}`);
  }
  return resultados.map((r) => r.count ?? 0);
}

/**
 * Aniversariantes do mês (RPC `aniversariantes_do_mes`, migration 038) — só
 * nome e dia, agregado no banco. `mesJs` é o valor de `Date#getMonth()`
 * (0-11); a RPC espera 1-12.
 */
export async function getAlunosAniversariantes(
  mesJs: number
): Promise<{ id: string; nome: string; data_nascimento: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("aniversariantes_do_mes", {
    p_mes: mesJs + 1,
  });
  if (error) throw new Error(`Falha ao carregar aniversariantes: ${error.message}`);
  return (data as { id: string; nome: string; data_nascimento: string }[]) ?? [];
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

/**
 * Treinos de um conjunto específico de alunos (Fase 13 — tela de Alunos
 * paginada). Substitui getTodosOsTreinos() ali: só os treinos dos alunos da
 * página atual, não da academia inteira. Lista vazia de ids não bate no
 * banco (evita um `.in("aluno_id", [])`, que o PostgREST aceita mas que aqui
 * é sempre um resultado vazio garantido).
 */
export async function getTreinosDosAlunos(
  academiaId: string,
  alunoIds: string[]
): Promise<Treino[]> {
  if (alunoIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .select("*, exercicios:exercicios_treino(*)")
    .eq("academia_id", academiaId)
    .in("aluno_id", alunoIds)
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
 * Acessos dentro de um intervalo de datas — sem limite de linhas, o recorte
 * é o próprio intervalo (Fase 13). Usado por Relatórios/BI, que antes lia
 * `getAcessos(academiaId, 500)`: com uma academia movimentada, os 500 mais
 * recentes podiam não cobrir nem os últimos 7 dias (número errado nos
 * cards), e com uma academia pequena podiam cobrir meses (gráfico de "7
 * dias" misturando dados de outra época). Delimitar por data resolve os dois
 * casos com o mesmo código de agregação em memória que já existia.
 */
export async function getAcessosPeriodo(
  academiaId: string,
  desdeIso: string,
  ateIso: string
): Promise<AcessoCatraca[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acessos_catraca")
    .select("*, aluno:alunos(id, nome, foto_perfil_url)")
    .eq("academia_id", academiaId)
    .gte("data_hora_entrada", desdeIso)
    .lte("data_hora_entrada", ateIso)
    .order("data_hora_entrada", { ascending: false });
  if (error) throw new Error(`Falha ao carregar acessos: ${error.message}`);
  return (data as AcessoCatraca[]) ?? [];
}

/**
 * Acessos desde um instante (ISO) — sem limite de linhas, para os cards
 * "hoje" da Recepção. Antes a Recepção lia `getAcessos(academiaId)`, que sem
 * argumento de limite pegava as 50 entradas mais recentes DA ACADEMIA: em um
 * dia de pico com mais de 50 check-ins, "acessos hoje"/"negados hoje"/"pico
 * de hoje" vinham truncados e errados. O chamador ainda decide o que é "hoje"
 * (mesmo critério de fuso que já usava), esta função só remove o teto de
 * linhas.
 */
export async function getAcessosRecentes(
  academiaId: string,
  desdeIso: string
): Promise<AcessoCatraca[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acessos_catraca")
    .select("*, aluno:alunos(id, nome, foto_perfil_url)")
    .eq("academia_id", academiaId)
    .gte("data_hora_entrada", desdeIso)
    .order("data_hora_entrada", { ascending: false });
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
 *
 * Fase 13: antes lia as 1000 entradas mais recentes DA ACADEMIA e ficava com
 * a primeira ocorrência de cada aluno_id. Numa academia com mais de ~1000
 * check-ins recentes, um aluno que não aparecesse nesses 1000 registros
 * mostrava "nunca acessou" mesmo já tendo vindo — dado errado, não só
 * truncado. Agora usa a RPC `ultimos_acessos_por_aluno` (migration 038),
 * que agrega DISTINCT ON no banco: uma linha por aluno, sem limite nenhum.
 */
export async function getUltimosAcessosPorAluno(
  academiaId: string
): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ultimos_acessos_por_aluno");
  if (error) throw new Error(`Falha ao carregar últimos acessos: ${error.message}`);

  const ultimos: Record<string, string> = {};
  for (const row of (data as { aluno_id: string; ultimo_acesso: string }[]) ?? []) {
    ultimos[row.aluno_id] = row.ultimo_acesso;
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

/**
 * Mensalidades completas, mas só dos alunos informados (Fase 13 — tela de
 * Alunos paginada). Substitui getMensalidadesDetalhadas(academiaId) ali: em
 * vez do histórico inteiro da academia, só o dos alunos da página atual —
 * que é exatamente o que o painel financeiro por aluno (SituacaoFinanceira)
 * e o mapa de status de cada linha da lista precisam.
 */
export async function getMensalidadesDetalhadasDosAlunos(
  academiaId: string,
  alunoIds: string[]
): Promise<MensalidadeDetalhe[]> {
  if (alunoIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("id, aluno_id, competencia, data, valor, status, descricao, data_pagamento, forma_pagamento")
    .eq("academia_id", academiaId)
    .eq("tipo", "mensalidade")
    .in("aluno_id", alunoIds)
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar mensalidades: ${error.message}`);
  return (data as MensalidadeDetalhe[]) ?? [];
}

/**
 * Só as mensalidades PENDENTES da academia (Fase 13). calcularStatusFinanceiro
 * (lib/utils.ts) descarta mensalidades pagas/canceladas antes de decidir o
 * status — então, para calcular "em dia / pendente / inadimplente" de cada
 * aluno, o histórico pago não faz nenhuma falta. Isso troca "todo o histórico
 * financeiro da academia, para sempre crescente" por "só o que está em
 * aberto agora", sem mudar o resultado de calcularStatusFinanceiro em nada.
 * Usado pela Recepção, que só precisa do status, não do histórico completo.
 */
export async function getMensalidadesPendentes(
  academiaId: string
): Promise<Array<{ aluno_id: string; status: string; data: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("aluno_id, status, data")
    .eq("academia_id", academiaId)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente")
    .not("aluno_id", "is", null);
  if (error) throw new Error(`Falha ao carregar mensalidades: ${error.message}`);
  return (data as Array<{ aluno_id: string; status: string; data: string }>) ?? [];
}

export type MensalidadeVencida = {
  aluno_id: string;
  valor: number;
  data: string;
  aluno: { id: string; nome: string; telefone: string | null } | null;
};

/**
 * Mensalidades pendentes e já vencidas, com o aluno embutido — a lista bruta
 * que alimenta o card de inadimplentes do Dashboard. Naturalmente pequena
 * (só o que está em aberto e atrasado, não o histórico inteiro), então dá
 * pra trazer todas as linhas e agrupar por aluno no servidor, sem precisar
 * de agregação no banco.
 */
export async function getMensalidadesVencidas(
  academiaId: string,
  hojeIso: string
): Promise<MensalidadeVencida[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("aluno_id, valor, data, aluno:alunos(id, nome, telefone)")
    .eq("academia_id", academiaId)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente")
    .not("aluno_id", "is", null)
    .lt("data", hojeIso);
  if (error) throw new Error(`Falha ao carregar mensalidades vencidas: ${error.message}`);
  return (data as unknown as MensalidadeVencida[]) ?? [];
}

/**
 * Próximos vencimentos (qualquer tipo de receita, igual ao comportamento
 * anterior) dentro de uma janela — já ordenado e limitado no banco, em vez
 * de trazer tudo e cortar com `.slice()` no Node.
 */
export async function getProximosVencimentos(
  academiaId: string,
  desdeIso: string,
  ateIso: string,
  limite: number
): Promise<Receita[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("*, aluno:alunos(id, nome, telefone)")
    .eq("academia_id", academiaId)
    .eq("status", "pendente")
    .gte("data", desdeIso)
    .lte("data", ateIso)
    .order("data", { ascending: true })
    .limit(limite);
  if (error) throw new Error(`Falha ao carregar próximos vencimentos: ${error.message}`);
  return (data as Receita[]) ?? [];
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
  ate?: string,
  limite?: number
): Promise<Receita[]> {
  const supabase = createClient();
  let query = supabase
    .from("receitas")
    .select("*, aluno:alunos(id, nome, telefone)")
    .eq("academia_id", academiaId)
    .order("data", { ascending: false });
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  if (limite) query = query.limit(limite);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar receitas: ${error.message}`);
  return (data as Receita[]) ?? [];
}

/**
 * Receitas relevantes para uma janela do Dashboard: vencimento (`data`) OU
 * pagamento (`data_pagamento`) dentro do intervalo.
 *
 * O Dashboard usa este mesmo conjunto de linhas para dois cálculos com
 * critérios diferentes — `receitaPeriodo` filtra por vencimento (`data`,
 * regime de competência simplificado) e `agruparFinanceiro` (o gráfico
 * Receita x Despesa) filtra o caixa por `data_pagamento` (regime de caixa).
 * Delimitar a consulta só por `data` perderia, silenciosamente, uma conta
 * antiga paga dentro do período; delimitar só por `data_pagamento` perderia
 * uma conta pendente que vence no período. A união cobre os dois sem trazer
 * o histórico inteiro.
 */
export async function getReceitasJanela(
  academiaId: string,
  desde: string,
  ate: string
): Promise<Receita[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receitas")
    .select("*, aluno:alunos(id, nome, telefone)")
    .eq("academia_id", academiaId)
    .or(
      `and(data.gte.${desde},data.lte.${ate}),and(data_pagamento.gte.${desde},data_pagamento.lte.${ate})`
    )
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar receitas: ${error.message}`);
  return (data as Receita[]) ?? [];
}

/** Despesas relevantes para uma janela do Dashboard — ver getReceitasJanela. */
export async function getDespesasJanela(
  academiaId: string,
  desde: string,
  ate: string
): Promise<Despesa[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("despesas")
    .select("*")
    .eq("academia_id", academiaId)
    .or(
      `and(data.gte.${desde},data.lte.${ate}),and(data_pagamento.gte.${desde},data_pagamento.lte.${ate})`
    )
    .order("data", { ascending: false });
  if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
  return (data as Despesa[]) ?? [];
}

/**
 * Quantas receitas existem em [desde, ate] — só o count, para a tela saber
 * se o resultado de getReceitas(..., limite) veio truncado (periodo=todos
 * com histórico muito grande) e avisar em vez de fingir que é tudo.
 */
export async function contarReceitas(
  academiaId: string,
  desde?: string,
  ate?: string
): Promise<number> {
  const supabase = createClient();
  let query = supabase
    .from("receitas")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academiaId);
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  const { count, error } = await query;
  if (error) throw new Error(`Falha ao contar receitas: ${error.message}`);
  return count ?? 0;
}

/**
 * Despesas mais recentes primeiro. Filtra por `desde` (>= data) e/ou `ate`
 * (<= data), ambos ISO "YYYY-MM-DD".
 */
export async function getDespesas(
  academiaId: string,
  desde?: string,
  ate?: string,
  limite?: number
): Promise<Despesa[]> {
  const supabase = createClient();
  let query = supabase
    .from("despesas")
    .select("*")
    .eq("academia_id", academiaId)
    .order("data", { ascending: false });
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  if (limite) query = query.limit(limite);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
  return (data as Despesa[]) ?? [];
}

/** Quantas despesas existem em [desde, ate] — ver contarReceitas. */
export async function contarDespesas(
  academiaId: string,
  desde?: string,
  ate?: string
): Promise<number> {
  const supabase = createClient();
  let query = supabase
    .from("despesas")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academiaId);
  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);
  const { count, error } = await query;
  if (error) throw new Error(`Falha ao contar despesas: ${error.message}`);
  return count ?? 0;
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

/**
 * Token do QR de acesso à recepção do próprio aluno (Bloco 1, migration 044)
 * via RPC `obter_token_qr_aluno`, resolvida por token pessoal + slug — nunca
 * aluno_id. Separado do `token_acesso_publico` (que abre toda a área do
 * aluno): o QR nunca deve carregar essa credencial completa.
 */
export async function getTokenQrAlunoPublico(
  token: string,
  slug: string
): Promise<string | null> {
  if (!tokenTemFormatoValido(token)) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_token_qr_aluno", {
    p_token: token,
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar QR de acesso: ${error.message}`);
  return (data as string) ?? null;
}

/**
 * Política de inadimplência da academia do próprio aluno (Bloco 2, migration
 * 047), resolvida por token pessoal + slug — nunca aluno_id/academia_id.
 * Único dado que faltava para calcular `decidirAcesso()` (mesma regra da
 * recepção) no lado do aluno: status_matricula (ficha) e mensalidades
 * pendentes (getMensalidadesAlunoPublico) já vinham de outras funções.
 *
 * Nunca lança: erro do Supabase, RPC ausente ou valor fora do enum conhecido
 * viram `null` da mesma forma que um token inválido. O status de acesso da
 * Home NÃO pode assumir "liberar" quando isto falhar — quem chama precisa
 * tratar `null` como "não consegui confirmar", nunca como um valor padrão.
 */
export async function getPoliticaAcessoAlunoPublico(
  token: string,
  slug: string
): Promise<PoliticaInadimplencia | null> {
  if (!tokenTemFormatoValido(token)) return null;
  const politicasValidas: string[] = POLITICAS_INADIMPLENCIA.map((p) => p.value);
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("obter_politica_acesso_aluno", {
      p_token: token,
      p_slug: slug,
    });
    if (error || typeof data !== "string" || !politicasValidas.includes(data)) {
      return null;
    }
    return data as PoliticaInadimplencia;
  } catch {
    return null;
  }
}

/**
 * Sessões de execução de treino ATIVAS do próprio aluno (Bloco 1, migration
 * 045), no máximo uma por treino, via RPC `obter_sessoes_ativas_treino`,
 * resolvida por token+slug. Usada para decidir "Iniciar" vs "Retomar" sem
 * consultar treino por treino.
 */
export async function getSessoesAtivasTreino(
  token: string,
  slug: string
): Promise<SessaoTreino[]> {
  if (!tokenTemFormatoValido(token)) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("obter_sessoes_ativas_treino", {
    p_token: token,
    p_slug: slug,
  });
  if (error) throw new Error(`Falha ao carregar sessões de treino: ${error.message}`);
  return (data as SessaoTreino[]) ?? [];
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

/**
 * Feedbacks não lidos — sinal simples e independente da central de alertas
 * persistida (Fase 9, lib/notificacoes.ts). "Feedback novo" não é um dos
 * tipos de alerta da Fase 9 (não teria o que "gerar": já existe a coluna
 * `lido` na própria tabela de feedbacks), mas já era mostrado no sino antes
 * desta fase — mantido à parte para não regredir esse sinal.
 */
export async function contarFeedbackNaoLido(academiaId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("feedbacks")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academiaId)
    .eq("lido", false);
  if (error) throw new Error(`Falha ao contar feedbacks: ${error.message}`);
  return count ?? 0;
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

/**
 * Histórico de planos só dos alunos informados (Fase 13 — tela de Alunos
 * paginada). Substitui getTodoHistoricoPlanos() ali.
 */
export async function getHistoricoPlanosDosAlunos(
  academiaId: string,
  alunoIds: string[]
): Promise<HistoricoPlano[]> {
  if (alunoIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("historico_planos")
    .select("*")
    .eq("academia_id", academiaId)
    .in("aluno_id", alunoIds)
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

/**
 * Progresso só dos alunos informados (Fase 13 — tela de Alunos paginada).
 * Substitui getTodoProgresso() ali.
 */
export async function getProgressoDosAlunos(
  academiaId: string,
  alunoIds: string[]
): Promise<ProgressoAluno[]> {
  if (alunoIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("progresso_aluno")
    .select("*")
    .eq("academia_id", academiaId)
    .in("aluno_id", alunoIds)
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
